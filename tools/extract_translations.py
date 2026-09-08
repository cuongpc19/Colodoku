"""Đọc bản địa hoá gốc của Meowdoku ra JSON.

Chữ trong game nằm ở `assetPackInstallTime.apk` bên trong file .xapk, dưới dạng
`assets/assets/localization/translations.<locale>.translation` — mỗi file là một
resource nhị phân `OptimizedTranslation` của Godot 4.

Định dạng đó chỉ lưu **hash của khoá**, không lưu khoá, nên không lấy lại được
tên khoá gốc. Nhưng bảng hash chỉ phụ thuộc vào tập khoá — mà tập khoá thì giống
nhau ở mọi ngôn ngữ — nên ghép các file theo hash là ra đúng từng cặp câu
en ↔ vi ↔ ja… Đó là cách file này lấy dữ liệu: coi câu tiếng Anh làm khoá.

    python tools/extract_translations.py         # ghi data/reference/meowdoku-i18n.json
    python tools/extract_translations.py --list  # xem có những locale nào
"""

import argparse
import io
import json
import os
import struct
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
XAPK = os.path.join(ROOT, "Meowdoku_+Brain+Puzzle+Games_1.15.0_APKPure.xapk")
ASSET_PACK = "assetPackInstallTime.apk"
PREFIX = "assets/assets/localization/translations."
SUFFIX = ".translation"

# 17 ngôn ngữ Meowdoku phát hành trên Play Store (đúng danh sách config.*.apk),
# ánh xạ sang tên locale trong gói Godot. Tiếng Miến (my) chỉ có ở tài nguyên
# Android của mấy thư viện quảng cáo, gói game không có -> không trích được.
PLAY_STORE_LOCALES = {
    "ar": "ar_SA", "de": "de", "en": "en", "es": "es", "fr": "fr",
    "hi": "hi", "id": "id", "it": "it", "ja": "ja", "ko": "ko",
    "pt": "pt", "ru": "ru", "th": "th", "tr": "tr", "vi": "vi",
    "zh": "zh_CN",
}


# --------------------------------------------------------------- smaz

# Bảng giải nén của smaz (thirdparty/misc/smaz.c trong Godot). OptimizedTranslation
# nén từng câu bằng smaz, trừ khi nén xong lại dài hơn thì để nguyên.
SMAZ_RCB = [
    " ", "the", "e", "t", "a", "of", "o", "and", "i", "n", "s", "e ", "r", " th",
    " t", "in", "he", "th", "h", "he ", "to", "\r\n", "l", "s ", "d", " a", "an",
    "er", "c", " o", "d ", "on", " of", "re", "of ", "t ", ", ", "is", "u", "at",
    "   ", "n ", "or", "which", "f", "m", "as", "it", "that", "\n", "was", "en",
    "  ", " w", "es", " an", " i", "\r", "f ", "g", "p", "nd", " s", "nd ", "ed ",
    "w", "ed", "http://", "for", "te", "ing", "y ", "The", " c", "ti", "r ", "his",
    "st", " in", "ar", "nt", ",", " to", "y", "ng", " h", "with", "le", "al", "to ",
    "b", "ou", "be", "were", " b", "se", "o ", "ent", "ha", "ng ", "their", '"',
    "hi", "from", " f", "in ", "de", "ion", "me", "v", ".", "ve", "all", "re ",
    "ri", "ro", "is ", "co", "f t", "are", "ea", ". ", "her", " m", "er ", " p",
    "es ", "by", "they", "di", "ra", "ic", "not", "s, ", "d t", "at ", "ce", "la",
    "h ", "ne", "as ", "tio", "on ", "n t", "io", "we", " a ", "om", ", a", "s o",
    "ur", "li", "ll", "ch", "had", "this", "e t", "g ", "e\r\n", " wh", "ere",
    " co", "e o", "a ", "us", " d", "ss", "\n\r\n", "\r\n\r", '="', " be", " e",
    "s a", "ma", "one", "t t", "or ", "but", "el", "so", "l ", "e s", "s,", "no",
    "ter", " wa", "iv", "ho", "e a", " r", "hat", "s t", "ns", "ch ", "wh", "tr",
    "ut", "/", "have", "ly ", "ta", " ha", " on", "tha", "-", " l", "ati", "en ",
    "pe", " re", "there", "ass", "si", " fo", "wa", "ec", "our", "who", "its", "z",
    "fo", "rs", ">", "ot", "un", "<", "im", "th ", "nc", "ate", "><", "ver", "ad",
    " we", "ly", "ee", " n", "id", " cl", "ac", "il", "</", "rt", " wi", "div",
    "e, ", " it", "whi", " ma", "ge", "x", "e c", "men", ".com",
]
SMAZ_BYTES = [entry.encode("latin-1") for entry in SMAZ_RCB]


def smaz_decompress(buf):
    out = bytearray()
    i = 0
    size = len(buf)
    while i < size:
        code = buf[i]
        if code == 254:            # một byte để nguyên
            out.append(buf[i + 1])
            i += 2
        elif code == 255:          # cả cụm để nguyên
            length = buf[i + 1] + 1
            out += buf[i + 2:i + 2 + length]
            i += 2 + length
        else:
            out += SMAZ_BYTES[code]
            i += 1
    return bytes(out)


# ------------------------------------------------- resource nhị phân Godot

class Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def u32(self):
        value = struct.unpack_from("<I", self.data, self.pos)[0]
        self.pos += 4
        return value

    def u64(self):
        value = struct.unpack_from("<Q", self.data, self.pos)[0]
        self.pos += 8
        return value

    def take(self, count):
        chunk = self.data[self.pos:self.pos + count]
        self.pos += count
        return chunk

    def string(self):
        return self.take(self.u32()).split(b"\0")[0].decode("utf-8", "replace")


# Mã kiểu Variant trong file .res nhị phân, chỉ cần đúng mấy kiểu gặp ở đây.
V_NIL, V_BOOL, V_INT, V_STRING = 1, 2, 3, 5
V_BYTE_ARRAY, V_INT32_ARRAY = 31, 32


def read_optimized_translation(data):
    """Trả về (hash_table, bucket_table, strings) của một file .translation."""
    reader = Reader(data)
    if reader.take(4) != b"RSRC":
        raise ValueError("không phải resource nhị phân của Godot")
    big_endian = reader.u32()
    for _ in range(3):             # real64, ver_major, ver_minor
        reader.u32()
    ver_format = reader.u32()
    if big_endian:
        raise ValueError("chưa hỗ trợ file big-endian")
    reader.string()                # tên lớp
    reader.u64()                   # offset metadata
    flags = reader.u32()
    if flags & 0x2:                # FORMAT_FLAG_UIDS
        reader.u64()
    if ver_format >= 5 and flags & 0x4:   # FORMAT_FLAG_HAS_SCRIPT_CLASS
        reader.string()
    for _ in range(11):            # trường dự trữ
        reader.u32()

    names = [reader.string() for _ in range(reader.u32())]
    for _ in range(reader.u32()):  # tài nguyên ngoài
        reader.string()
        reader.string()
        if flags & 0x2:
            reader.u64()

    offsets = []
    for _ in range(reader.u32()):  # tài nguyên trong
        reader.string()
        offsets.append(reader.u64())
    if not offsets:
        raise ValueError("file không chứa tài nguyên nào")

    reader.pos = offsets[0]
    reader.string()                # kiểu tài nguyên
    found = {}
    for _ in range(reader.u32()):
        name = names[reader.u32()]
        vtype = reader.u32()
        if vtype == V_INT32_ARRAY:
            count = reader.u32()
            found[name] = struct.unpack_from("<%di" % count, reader.data, reader.pos)
            reader.pos += count * 4
        elif vtype == V_BYTE_ARRAY:
            count = reader.u32()
            found[name] = reader.take(count)
            reader.take((4 - count % 4) % 4)   # đệm cho tròn 4 byte
        elif vtype in (V_BOOL, V_INT):
            reader.u32()
        elif vtype == V_STRING:
            reader.string()
        elif vtype == V_NIL:
            pass
        else:
            break                  # gặp thuộc tính lạ thì dừng, đã đủ dữ liệu
    for key in ("hash_table", "bucket_table", "strings"):
        if key not in found:
            raise ValueError("thiếu thuộc tính %s" % key)
    return found["hash_table"], found["bucket_table"], found["strings"]


def entries(data):
    """{hash của khoá: câu} cho một file .translation."""
    hash_table, bucket_table, blob = read_optimized_translation(data)
    out = {}
    for bucket_at in hash_table:
        if bucket_at < 0:
            continue
        size = bucket_table[bucket_at]
        base = bucket_at + 2       # bỏ qua size và func
        for i in range(size):
            key, offset, packed, original = bucket_table[base + i * 4:base + i * 4 + 4]
            if original == 0:
                out[key & 0xFFFFFFFF] = ""
                continue
            chunk = blob[offset:offset + packed]
            raw = chunk if packed == original else smaz_decompress(chunk)
            out[key & 0xFFFFFFFF] = raw.split(b"\0")[0].decode("utf-8", "replace")
    return out


# ------------------------------------------------------------------ chạy

def open_pack(path):
    xapk = zipfile.ZipFile(path)
    pack = zipfile.ZipFile(io.BytesIO(xapk.read(ASSET_PACK)))
    return pack, sorted(
        name[len(PREFIX):-len(SUFFIX)]
        for name in pack.namelist()
        if name.startswith(PREFIX) and name.endswith(SUFFIX)
    )


def main():
    parser = argparse.ArgumentParser(description="Trích bản địa hoá Meowdoku ra JSON.")
    parser.add_argument("--xapk", default=XAPK)
    parser.add_argument("--out", default=os.path.join(ROOT, "data", "reference", "meowdoku-i18n.json"))
    parser.add_argument("--locales", help="danh sách locale Godot, cách nhau bằng dấu phẩy")
    parser.add_argument("--list", action="store_true", help="chỉ liệt kê locale có trong gói")
    args = parser.parse_args()

    pack, available = open_pack(args.xapk)
    if args.list:
        print("\n".join(available))
        return 0

    wanted = {code: code for code in args.locales.split(",")} if args.locales else PLAY_STORE_LOCALES
    missing = [name for name in wanted.values() if name not in available]
    if missing:
        print("không có trong gói: %s" % ", ".join(missing), file=sys.stderr)
        return 1

    tables = {code: entries(pack.read(PREFIX + name + SUFFIX)) for code, name in wanted.items()}
    english = tables.get("en") or tables[next(iter(tables))]

    # Câu tiếng Anh làm khoá; các hash cùng câu tiếng Anh gộp về một mục.
    rows = {}
    for key, source in english.items():
        if not source:
            continue
        row = rows.setdefault(source, {})
        for code, table in tables.items():
            value = table.get(key)
            if value and code not in row:
                row[code] = value

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=1, sort_keys=True)
    # Console Windows hay là cp1252, in ASCII cho chắc.
    print("%d strings x %d locales -> %s" % (len(rows), len(tables), args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
