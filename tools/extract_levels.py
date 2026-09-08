"""
Giai ma level bank cua Meowdoku (.xapk) va dong goi lai cho web.

Bank goc nam trong assetPackInstallTime.apk duoi dang
    assets/assets/resources/levels/*.json
nhung KHONG phai JSON thuan: moi file bi XOR voi mot key 25 byte lap lai.
Key duoc tim ra bang phan tich index of coincidence (do dai khoa = 25)
roi doi chieu ky tu pho bien nhat tren tung cot.

    python tools/extract_levels.py <duong_dan.xapk> [--raw thu_muc_json_goc]
"""
import argparse
import json
import os
import re
import zipfile

KEY = b"meowdoku-2026-bank-secret"
LEVEL_DIR = "assets/assets/resources/levels/"
DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"


def decode(blob: bytes) -> str:
    """Go lop XOR key lap lai."""
    return bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(blob)).decode("utf-8", "replace")


def read_banks(xapk_path):
    """Tra ve {ten_file: chuoi_json_da_giai_ma} cho toan bo level bank."""
    with zipfile.ZipFile(xapk_path) as xapk:
        with xapk.open("assetPackInstallTime.apk") as fh:
            with zipfile.ZipFile(fh) as pack:
                names = [n for n in pack.namelist() if n.startswith(LEVEL_DIR) and n.endswith(".json")]
                return {os.path.basename(n): decode(pack.read(n)) for n in sorted(names)}


def pack_region_map(region_map):
    """Nen luoi vung mau NxN thanh mot chuoi base36, moi o mot ky tu."""
    return "".join(DIGITS[cell] for row in region_map for cell in row)


def pack_puzzle(p):
    """Giu lai dung nhung truong game can, bo hash chong trung cua ho."""
    out = {
        "m": pack_region_map(p["regionMap"]),
        "s": p["solution"],
        "r": p.get("r", p.get("maxR", 0)),
        "st": p.get("steps", 0),
        "rk": [p.get("r%d" % i, 0) for i in range(1, 6)],
    }
    if p.get("isChainedStrategy"):
        out["ch"] = 1
    for extra in ("date", "label", "pattern", "colorMap", "spRegion"):
        if p.get(extra) is not None:
            out[extra] = p[extra]
    return out


def iter_puzzles(doc):
    """Duyet moi schema bank ve dang (tier, puzzle). Tier None = bank khong chia tier."""
    if isinstance(doc, list):
        for p in doc:
            yield None, p
    elif isinstance(doc, dict):
        for key, value in doc.items():
            tier = key if key.isdigit() else None
            for p in value if isinstance(value, list) else [value]:
                yield tier, p


def classify(filename):
    """bankDataLKStyle9x9.json -> ('lkstyle', 9). Tra ve None neu khong phai bank co luoi."""
    stem = filename[:-len(".json")]
    if stem.endswith(".pace"):
        return None
    match = re.match(r"bankData(.*?)(\d+)x\d+$", stem)
    if match:
        variant = match.group(1).lower() or "classic"
        return variant, int(match.group(2))
    if stem == "bankDataLK":
        return "daily", 0
    if stem in ("bankDataSP", "bankDataSP_TT", "bankDataLKModified"):
        return stem[len("bankData"):].lower(), 0
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xapk")
    ap.add_argument("--out", default="data")
    ap.add_argument("--raw", help="ghi them ban JSON goc da giai ma vao thu muc nay")
    args = ap.parse_args()

    banks = read_banks(args.xapk)
    if args.raw:
        os.makedirs(args.raw, exist_ok=True)
        for name, text in banks.items():
            with open(os.path.join(args.raw, name), "w", encoding="utf-8") as fh:
                fh.write(text)

    os.makedirs(args.out, exist_ok=True)
    pace = {}
    index = []

    for name, text in banks.items():
        if name.endswith(".pace.json"):
            pace[name[:-len(".pace.json")]] = json.loads(text)

    for name, text in sorted(banks.items()):
        kind = classify(name)
        if kind is None:
            continue
        variant, size = kind
        doc = json.loads(text)
        tiers = {}
        for tier, puzzle in iter_puzzles(doc):
            if "regionMap" not in puzzle or "solution" not in puzzle:
                continue
            n = len(puzzle["regionMap"])
            if size and n != size:
                continue
            bucket = tier or str(puzzle.get("r", puzzle.get("maxR", 0)))
            tiers.setdefault(bucket, []).append(pack_puzzle(puzzle))
        if not tiers:
            continue

        slug = "%s-%dx%d" % (variant, size, size) if size else variant
        total = sum(len(v) for v in tiers.values())
        payload = {"slug": slug, "variant": variant, "size": size, "count": total, "tiers": tiers}
        with open(os.path.join(args.out, slug + ".json"), "w", encoding="utf-8") as fh:
            json.dump(payload, fh, separators=(",", ":"))
        index.append({
            "slug": slug,
            "variant": variant,
            "size": size,
            "count": total,
            "tiers": {k: len(v) for k, v in sorted(tiers.items())},
        })
        print("%-22s n=%-3s %6d puzzle" % (slug, size or "?", total))

    with open(os.path.join(args.out, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"banks": index}, fh, indent=1)
    print("\nTong: %d puzzle trong %d bank" % (sum(b["count"] for b in index), len(index)))


if __name__ == "__main__":
    main()
