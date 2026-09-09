# Đo và tìm bảng màu vùng cho bàn cờ.
#
#   python tools/palette.py            # đo bảng đang dùng
#   python tools/palette.py --search   # tìm bảng tốt hơn
#   python tools/palette.py --opacity  # cần để ô tắt bao nhiêu phần trăm
#
# Vì sao phải đo bằng máy: cả lối chơi dựa trên "mỗi MÀU một con kiến", và bàn
# cờ KHÔNG vẽ viền vùng — màu là dấu hiệu duy nhất cho biết ô nào thuộc vùng
# nào. Hai vùng nhìn giống nhau vì thế không phải chuyện xấu đẹp mà là chơi sai
# được. Mắt người lại rất kém trong việc đoán hai màu cách nhau bao nhiêu.
#
# Thước đo là CIEDE2000, đơn vị ΔE00. Mốc thường dùng:
#   < 2    gần như một màu
#   2..10  thấy khác khi để cạnh nhau, dễ lẫn khi ở xa nhau
#   > 20   khác hẳn, không thể lẫn
#
# HAI RÀNG BUỘC, và cái thứ hai mới là cái khó:
#
# 1. Bàn n vùng dùng ĐÚNG n MÀU ĐẦU của bảng (Puzzle.colourOf: region % 12), nên
#    bàn 6x6 chỉ thấy g0..g5. Điểm của bảng vì thế phải tính trên MỌI TIỀN TỐ
#    game dùng thật, không phải chỉ trên cả 12 màu.
#
# 2. Ô bị loại thì "tắt đèn" (.cell.mark, opacity 0.28 trên nền .board), tức màu
#    hiển thị chỉ còn 28% pha với nền — mọi khoảng cách màu co lại còn khoảng
#    một phần tư. Mà ô tắt VẪN phải đọc ra vùng, vì người chơi còn phải đếm vùng
#    nào còn mấy ô trống. Nên bảng màu phải tách tốt ở CẢ HAI trạng thái, và
#    trạng thái tắt mới là ràng buộc siết.
import math
import re
import sys

# Cỡ bàn game thật sự phát ra (src/progression.js: FIRST và CYCLE).
SIZES = [4, 5, 6, 7, 8, 9, 10]
CSS = "src/style.css"

# Màu thân con kiến: ô nào gần màu này quá thì kiến đứng lên chìm mất.
ANT = "#b5643c"

# ---------------------------------------------------------------- màu học

def to_rgb(hex_colour):
    return tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))


def to_hex(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(v))) for v in rgb)


def srgb_to_lab(hex_colour):
    r, g, b = (v / 255 for v in to_rgb(hex_colour))
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def ciede2000(lab1, lab2):
    """Khoảng cách màu theo mắt người. Công thức chuẩn CIE 2000."""
    l1, a1, b1 = lab1
    l2, a2, b2 = lab2
    c1, c2 = math.hypot(a1, b1), math.hypot(a2, b2)
    cbar = (c1 + c2) / 2
    g = 0.5 * (1 - math.sqrt(cbar ** 7 / (cbar ** 7 + 25 ** 7))) if cbar > 0 else 0
    a1p, a2p = (1 + g) * a1, (1 + g) * a2
    c1p, c2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if (a1p or b1) else 0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if (a2p or b2) else 0
    dlp = l2 - l1
    dcp = c2p - c1p
    if c1p * c2p == 0:
        dhp = 0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    else:
        dhp = h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360
    dHp = 2 * math.sqrt(c1p * c2p) * math.sin(math.radians(dhp) / 2)
    lbar = (l1 + l2) / 2
    cbarp = (c1p + c2p) / 2
    if c1p * c2p == 0:
        hbarp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbarp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbarp = (h1p + h2p + 360) / 2
    else:
        hbarp = (h1p + h2p - 360) / 2
    t = (1 - 0.17 * math.cos(math.radians(hbarp - 30))
         + 0.24 * math.cos(math.radians(2 * hbarp))
         + 0.32 * math.cos(math.radians(3 * hbarp + 6))
         - 0.20 * math.cos(math.radians(4 * hbarp - 63)))
    dtheta = 30 * math.exp(-(((hbarp - 275) / 25) ** 2))
    rc = 2 * math.sqrt(cbarp ** 7 / (cbarp ** 7 + 25 ** 7))
    sl = 1 + (0.015 * (lbar - 50) ** 2) / math.sqrt(20 + (lbar - 50) ** 2)
    sc = 1 + 0.045 * cbarp
    sh = 1 + 0.015 * cbarp * t
    rt = -math.sin(math.radians(2 * dtheta)) * rc
    return math.sqrt((dlp / sl) ** 2 + (dcp / sc) ** 2 + (dHp / sh) ** 2
                     + rt * (dcp / sc) * (dHp / sh))


# ------------------------------------------------------- đọc số thật từ CSS

def read_css():
    css = open(CSS, encoding="utf-8").read()
    palette = [re.search(rf"--g{i}:\s*(#[0-9a-fA-F]{{6}})", css).group(1) for i in range(12)]
    board_bg = re.search(r"\.board \{[^}]*?background:\s*(#[0-9a-fA-F]{6})", css, re.S).group(1)
    # Ô đã loại giờ chừa một VÀNH giữ nguyên màu vùng, ruột phủ đen mờ. Lấy độ
    # mờ của lớp phủ ấy ra để chấm riêng phần ruột. Bản cũ dùng `opacity` nên
    # vẫn đỡ được cả hai cách viết.
    inner = re.search(r"\.cell\.mark \{[^}]*?rgba\([^)]*?,\s*([\d.]+)\)", css, re.S)
    if inner:
        return palette, board_bg, 1 - float(inner.group(1)), True
    old = re.search(r"\.cell\.mark \{[^}]*?opacity:\s*([\d.]+)", css, re.S)
    return palette, board_bg, float(old.group(1)), False


def dim(hex_colour, bg, opacity):
    """Màu ô lúc tắt đèn: trình duyệt trộn thẳng trong không gian sRGB."""
    c, b = to_rgb(hex_colour), to_rgb(bg)
    return to_hex([opacity * c[i] + (1 - opacity) * b[i] for i in range(3)])


# ------------------------------------------------------------------ chấm

def worst_prefix(colours, transform=lambda c: c):
    """ΔE00 nhỏ nhất trên mọi tiền tố game dùng thật. Trả kèm cặp và cỡ bàn."""
    labs = [srgb_to_lab(transform(c)) for c in colours]
    worst = (999.0, None, None, None)
    for n in SIZES:
        for i in range(n):
            for j in range(i + 1, n):
                d = ciede2000(labs[i], labs[j])
                if d < worst[0]:
                    worst = (d, i, j, n)
    return worst


def report(colours, bg, opacity, title, rim=True):
    print(f"\n{title}")
    # Vành ô đã loại giữ NGUYÊN màu vùng, nên khoảng cách lúc tắt bằng đúng lúc
    # sáng — chỉ còn một ràng buộc. Ruột ô là dấu hiệu phụ, chấm riêng.
    inner = "#050810"  # lớp phủ đen trong box-shadow
    states = ([("SÁNG, và VÀNH ô đã loại", lambda c: c),
               (f"RUỘT ô đã loại (còn {opacity:.0%} màu)", lambda c: dim(c, inner, opacity))]
              if rim else
              [("SÁNG (ô còn dùng được)", lambda c: c),
               (f"TẮT  (ô đã loại, {opacity:.0%})", lambda c: dim(c, bg, opacity))])
    for label, tf in states:
        d, i, j, n = worst_prefix(colours, tf)
        mark = "  <-- DỄ LẪN" if d < 10 else ""
        print(f"  {label}: ΔE00 nhỏ nhất {d:.1f}{mark}")
        print(f"      cặp tệ nhất g{i} {colours[i]} ~ g{j} {colours[j]}, lộ ở bàn {n}x{n}")
    labs = [srgb_to_lab(c) for c in colours]
    lo = min(l for l, _, _ in labs)
    hi = max(l for l, _, _ in labs)
    ch = [math.hypot(a, b) for _, a, b in labs]
    print(f"  độ sáng L* {lo:.0f}..{hi:.0f} · độ tươi C* {min(ch):.0f}..{max(ch):.0f}")
    print("  từng cỡ bàn (sáng và vành / ruột):" if rim else "  từng cỡ bàn (sáng / tắt):")
    dl = [srgb_to_lab(dim(c, inner if rim else bg, opacity)) for c in colours]
    for n in SIZES:
        b1 = min(ciede2000(labs[a], labs[c]) for a in range(n) for c in range(a + 1, n))
        b2 = min(ciede2000(dl[a], dl[c]) for a in range(n) for c in range(a + 1, n))
        flag = "  <--" if b1 < 10 else ""
        print(f"    {n}x{n}: {b1:5.1f} / {b2:5.1f}{flag}")


# ------------------------------------------------------------------- tìm

def candidates(bg, opacity, step=12, l_lo=68, l_hi=90, chroma_min=30):
    """Rải màu trong gam sRGB, giữ lại những màu tươi và sáng vừa tầm."""
    ant = srgb_to_lab(ANT)
    out = []
    for r in range(0, 256, step):
        for g in range(0, 256, step):
            for b in range(0, 256, step):
                hexc = f"#{r:02x}{g:02x}{b:02x}"
                lab = srgb_to_lab(hexc)
                if not (l_lo <= lab[0] <= l_hi):
                    continue
                if math.hypot(lab[1], lab[2]) < chroma_min:
                    continue
                if ciede2000(lab, ant) < 25:
                    continue  # kiến đứng lên sẽ chìm
                out.append((hexc, srgb_to_lab(dim(hexc, bg, opacity))))
    return out


def search(bg, opacity, want=12):
    """
    Chọn lần lượt màu xa nhất so với những màu đã chọn, ĐO Ở TRẠNG THÁI TẮT.

    Hai lý do chọn cách này. Đo ở trạng thái tắt vì đó là ràng buộc siết — tách
    được lúc tắt thì lúc sáng thừa sức tách. Và "xa nhất trước" cho ra thứ tự mà
    MỌI TIỀN TỐ đều tách tốt, đúng thứ game cần, vì bàn n vùng chỉ dùng n màu
    đầu; tối ưu cho cả 12 rồi xếp bừa thứ tự thì bàn 6x6 vẫn có thể vớ phải hai
    màu sát nhau.
    """
    pool = candidates(bg, opacity)
    print(f"  gam ứng viên: {len(pool)} màu")
    chosen = [pool[0]]
    while len(chosen) < want:
        best, best_d = None, -1
        for cand in pool:
            d = min(ciede2000(cand[1], c[1]) for c in chosen)
            if d > best_d:
                best, best_d = cand, d
        chosen.append(best)
    colours = [c[0] for c in chosen]

    # Nắn thêm: đổi từng màu lấy màu khác nếu điểm lúc tắt khá lên.
    tf = lambda c: dim(c, bg, opacity)
    best = worst_prefix(colours, tf)[0]
    for _ in range(40):
        improved = False
        for i in range(len(colours)):
            for cand, _ in pool:
                if cand in colours:
                    continue
                trial = list(colours)
                trial[i] = cand
                s = worst_prefix(trial, tf)[0]
                if s > best + 1e-9:
                    colours, best, improved = trial, s, True
        if not improved:
            break
    return colours


if __name__ == "__main__":
    palette, bg, opacity, rim = read_css()
    print(f"nền bàn cờ {bg} · ô đã loại: " +
          (f"vành giữ nguyên màu, ruột còn {opacity:.0%}" if rim else f"làm mờ còn {opacity:.0%}"))
    report(palette, bg, opacity, "BẢNG ĐANG DÙNG", rim)

    if "--search" in sys.argv:
        print("\nĐANG TÌM...")
        found = search(bg, opacity)
        report(found, bg, opacity, "BẢNG ĐỀ XUẤT", rim)
        print("\n  " + " ".join(f"--g{i}: {c};" for i, c in enumerate(found)))
