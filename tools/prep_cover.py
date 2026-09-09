# Cắt ảnh bìa cửa hàng từ tranh AI vẽ, ra đúng ba cỡ CrazyGames nhận.
#
#   python tools/prep_cover.py Manythings/dọc.png Manythings/vuông.png ...
#
# Ba cỡ lấy từ bộ đã nộp của MarbleSort (xem CRAZYGAMES.md của dự án đó):
# 1920×1080 ngang, 800×1200 dọc, 800×800 vuông — đều PNG.
#
# Nhận nhiều tranh nguồn, mỗi cỡ tự lấy tranh gần tỉ lệ nhất. Vẽ riêng từng tỉ
# lệ vẫn hơn cắt: cắt vuông ra từ tranh dọc là mất chân kiến, cắt ngang ra thì
# mất cả chữ tựa. Cỡ nào không còn nguồn nào cắt nổi thì script bỏ và nói rõ
# mất gì — ảnh cắt hỏng kiểu đó nhìn lướt không phát hiện ra.
import os
import sys

from PIL import Image

os.chdir(os.path.join(os.path.dirname(__file__), ".."))
SOURCES = sys.argv[1:] or ["Manythings/cover.png"]
OUT = "store/crazygames"

# Vị trí hai thứ không được cắt, đo theo tỉ lệ trên tranh nguồn:
TITLE_X = (0.06, 0.94)  # chữ "ANT GUARD" trải gần hết bề ngang
FULL_Y = (0.05, 0.82)   # từ đỉnh chữ xuống hết chân kiến

# (tên, ngang, dọc, neo dọc, dải dọc phải giữ)
#   neo dọc: 0 bám mép trên, 0.5 xén giữa, 1 bám mép dưới — chỉ dùng khi xén cao
SIZES = [
    ("cover-1920x1080", 1920, 1080, 0.5, FULL_Y),
    ("cover-800x1200", 800, 1200, 0.5, FULL_Y),
    ("cover-800x800", 800, 800, 0.18, FULL_Y),
]


def crop_to(im, ratio, anchor):
    """Xén cho đúng tỉ lệ. Trả ảnh kèm dải ngang và dải dọc còn giữ lại."""
    if im.width / im.height > ratio:  # đang rộng hơn: xén hai bên, luôn xén giữa
        w = round(im.height * ratio)
        left = (im.width - w) // 2
        return im.crop((left, 0, left + w, im.height)), (left / im.width, (left + w) / im.width), (0.0, 1.0)
    h = round(im.width / ratio)  # đang cao hơn: xén trên dưới theo neo
    top = round((im.height - h) * anchor)
    return im.crop((0, top, im.width, top + h)), (0.0, 1.0), (top / im.height, (top + h) / im.height)


loaded = []
for path in SOURCES:
    im = Image.open(path).convert("RGB")
    loaded.append((im, path))
    print(f"nguồn: {path}  {im.width}x{im.height}  tỉ lệ {im.width / im.height:.3f}")
os.makedirs(OUT, exist_ok=True)

for name, w, h, anchor, keep_y in SIZES:
    want = w / h
    # Tranh gần tỉ lệ nhất thì xén ít nhất, nên mất ít nhất.
    im, path = min(loaded, key=lambda t: abs(t[0].width / t[0].height - want))
    cropped, got_x, got_y = crop_to(im, want, anchor)

    lost = []
    if got_x[0] > TITLE_X[0] or got_x[1] < TITLE_X[1]:
        lost.append(f"chữ tựa (cần ngang {TITLE_X[0]:.0%}–{TITLE_X[1]:.0%}, còn {got_x[0]:.0%}–{got_x[1]:.0%})")
    if got_y[0] > keep_y[0] or got_y[1] < keep_y[1]:
        lost.append(f"hình chính (cần dọc {keep_y[0]:.0%}–{keep_y[1]:.0%}, còn {got_y[0]:.0%}–{got_y[1]:.0%})")
    if lost:
        print(f"  BỎ {name} {w}x{h}: xén từ {os.path.basename(path)} mất " + "; ".join(lost))
        print("     -> cỡ này phải vẽ riêng một tranh đúng tỉ lệ")
        continue

    out = cropped.resize((w, h), Image.LANCZOS)
    dst = os.path.join(OUT, f"{name}.png")
    out.save(dst, optimize=True)
    scale = w / cropped.width
    note = "phóng to" if scale > 1.01 else "thu nhỏ" if scale < 0.99 else "nguyên cỡ"
    print(f"  {dst}  {os.path.getsize(dst) / 1024:.0f} KB  ({note} {scale:.2f}× từ {os.path.basename(path)})")
