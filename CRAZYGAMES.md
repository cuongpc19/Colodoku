# Nộp Ant Guard lên CrazyGames

Làm gì, theo thứ tự nào. Viết theo mẫu `CRAZYGAMES.md` của dự án MarbleSort —
dự án đó đã qua một lần nộp, nên chỗ nào ghi ⚠ là bài học đã trả giá bên ấy,
chép sang đây để khỏi trả lần nữa.

Hai đường: **§1 mỗi lần cập nhật** (đường sẽ dùng thường xuyên), **§2 chỉ lần
nộp đầu**.

---

## 1. Mỗi lần cập nhật

```bash
node tools/flow_test.mjs      # tutorial, bộ chọn màn, kho bàn, màn đặc biệt
node tools/smoke.mjs          # logic bàn cờ trên 200 bàn
node tools/build_crazy.mjs    # dựng gói nộp
```

`build_crazy` tự nghiệm thu và không im lặng bỏ qua chỗ nào. Phải in đủ sáu dấu ✓:

```
Bản "crazy": 47 file · 1.28 MB
  ✓ dưới 20 MB — đủ điều kiện lên trang chủ bản mobile (1.28 MB)
  ✓ không có dữ liệu bản quyền hay công cụ nội bộ
  ✓ đường dẫn đều tương đối
  ✓ có SDK CrazyGames và index.html đã đánh dấu bản crazy
  ✓ có privacy.html và game mở được nó cùng origin
  ✓ không có link trỏ ra ngoài
```

Rồi tải lên:

> Developer Portal → game của mình → **Builds / Files** → kéo **toàn bộ nội dung
> thư mục `dist/crazy/`** vào ô tải lên → lưu → gửi duyệt.

⚠ **Đừng nén thành zip.** Ô tải lên từ chối file nén: *"Archive files are not
supported, please drag and drop the files directly in the upload zone"*.

⚠ **Kéo `dist/crazy/`, tuyệt đối không kéo cả kho.** Kho này còn chứa bộ level
giải mã từ APK của Meowdoku và trang phân tích `lab.html`. Bộ level là dữ liệu
có bản quyền của họ; `lab.html` là công cụ nội bộ, đặt trước mặt người kiểm
duyệt là trượt. `build_crazy` chọn file theo **danh sách trắng** chính vì thế —
thêm file mới vào kho thì phải khai tên mới đi được, quên khai thì nó không đi.

### Nếu sửa trang riêng tư

```bash
node tools/build_site.mjs
npx firebase-tools deploy --only hosting     # → https://colodoku-7dba5.web.app/privacy.html
```

Bản gốc **duy nhất** là `privacy.html` ở thư mục gốc kho. Gói nộp và thư mục
đăng đều chép từ đó ra (`build_crazy.mjs` và `build_site.mjs`), nên không có
chuyện hai bản lệch nhau — nhưng đăng lại thì vẫn phải làm tay, vì nó nằm ngoài
gói nộp.

⚠ **Nội dung phải khớp với thứ game thật sự lưu.** Thêm một khoá localStorage
là trang đó sai ngay hôm ấy. Ba khoá hiện có liệt kê ở §6.

---

## 2. Chỉ lần nộp đầu

- [ ] **Khai báo thanh toán** — phải xong *trước* khi nộp, không phải sau khi duyệt
- [ ] Tài khoản Developer Portal
- [ ] Chạy **Quality Assurance Tool** của họ, dọn sạch mọi cảnh báo
- [x] Ba ảnh bìa: [store/crazygames/](store/crazygames/) — 1920×1080 · 800×1200 · 800×800
- [x] Hai video preview 15-20 giây
- [x] Địa chỉ chính sách riêng tư: `https://colodoku-7dba5.web.app/privacy.html`
      (Firebase Hosting, dự án `colodoku-7dba5`; cấu hình ở `firebase.json` + `.firebaserc`)

Các ô trong đơn có hệ quả thật:

| ô | trả lời | vì sao |
|---|---|---|
| Game engine | **HTML5** | không phải "Externally hosted (iframe)" — ô đó dành cho game tự host |
| Orientation | **Portrait** | bàn cờ vuông, cột dọc; có chạy được khung ngang nhưng bố cục là dọc |
| Supports mobile | **tích** | khai dọc thì họ lo phần xoay máy |
| SDK muting | **tích** | đã làm thật, xem §3; bỏ trống thì phần xử lý tắt tiếng thành vô nghĩa |
| Saves progress | **Có, qua localStorage** | *và bật luôn tính năng Progress Save* — xem §5 |
| Online game | **không** | không có nhiều người chơi |
| Privacy policy | `https://colodoku-7dba5.web.app/privacy.html` | ⚠ chỉ điền vào đơn |

⚠ **Link chính sách riêng tư điền vào ĐƠN và có trong GAME, nhưng không bao giờ
là link trỏ ra ngoài trong giao diện.** Họ cấm hẳn link ra ngoài. Đường trong
game là Cài Đặt → Riêng tư, mở bản `privacy.html` đi kèm trong chính gói, cùng
origin, nạp vào iframe của một lớp phủ — không điều hướng cả trang, vì trong
khung nhúng của họ điều hướng đi là người chơi mất ván đang chơi và không có nút
quay lại.

---

## 3. Phần nối với SDK

Tất cả nằm trong [src/crazy.js](src/crazy.js). Không có SDK thì mọi thứ ở đó im
lặng không làm gì, nên bản GitHub Pages và bản chạy ở máy vẫn y nguyên.

⚠ **SDK chỉ nạp khi thẻ `<html>` có `data-target="crazy"`**, do `build_crazy`
đặt vào. Bản web thường vì thế không gọi sang máy chủ của họ lần nào — kiểm được:

```bash
node tools/build_single.mjs && grep -c crazygames dist/ant-guard.html   # phải ra 0
```

Bốn chỗ dễ làm sai, đều đã xử lý:

- ⚠ **Nạp script của họ bằng JS lúc chạy, KHÔNG đặt thẻ `<script src>` trong
  `<head>`.** Thẻ script thường chặn bộ phân tích HTML, mà mã game là
  `type="module"` nên bị hoãn tới sau khi phân tích xong. Máy chủ của họ trả
  chậm là bộ phân tích đứng, module không chạy, game không khởi động — không
  lỗi, không dấu hiệu gì. MarbleSort dựng lại được: 14 giây trắng màn hình, so
  với 3 giây khi để request đi bình thường.
- ⚠ **Mọi lời gọi đều có hạn chờ.** Trình chặn quảng cáo nuốt request có thể
  treo mà không gọi `onload` lẫn `onerror`. Thà mất SDK còn hơn treo người chơi.
- ⚠ **`addSettingsChangeListener`, không phải sự kiện trên `window`.** MarbleSort
  từng đoán là `wgVolumeChange` và đoán sai — game sẽ báo "không tắt tiếng" mãi
  mãi trong khi vẫn kêu đè lên trang người ta đã tắt, tức ô "SDK muting" trong
  đơn thành khai man.
- ⚠ **`?muteAudio=true` phải làm game im, HOẶC với tín hiệu từ SDK chứ không bị
  SDK ghi đè.** Đó là cách bộ phận kiểm duyệt của họ thử. Bản đầu ở đây cho SDK
  ghi đè tham số địa chỉ; bộ thử bắt được ngay: SDK cục bộ báo "không tắt tiếng"
  là cờ trên địa chỉ bị bỏ qua, đúng vào trường hợp người kiểm mở tay bằng URL.

**Bài hướng dẫn tính là lối chơi, và đó là chỗ mốc đầu tiên rơi vào.** Người
mới mở game là vào thẳng bài hướng dẫn (coi như màn 0), không dừng ở trang chủ.
⚠ Nếu để mốc `gameplayStart` rơi vào màn 1 thì CrazyGames tính cả quãng học
hướng dẫn vào "thời gian tới lối chơi", con số sẽ rất xấu. Đo bằng dấu thời gian
trong log Chrome: bốn sự kiện `SDK initialized`, `loading start`, `loading stop`,
`gameplay start` đóng dấu **cùng một mili-giây** — game dựng xong bài hướng dẫn
từ trước khi SDK kịp tới, nên SDK vừa sẵn sàng là nhận đủ cả chuỗi.

Người chơi cũ có tiến trình thì mở ra ở trang chủ, và `gameplayStart` chỉ nổ khi
họ bấm vào chơi. Đó là chủ ý: trang chủ là menu, phải nằm ngoài cặp mốc thì
quảng cáo mới được phép chen vào đấy.

**Mốc gameplay không gọi tay ở từng chỗ.** `game.js` gắn một `MutationObserver`
lên thuộc tính `hidden` của hai màn hình và bốn lớp phủ, rồi suy ra "đang chơi
hay không". ⚠ Cặp mốc này là cách chủ nhà biết lúc nào được chen quảng cáo; gọi
tay thì chỗ nào quên là quảng cáo nhảy vào giữa ván, mà thêm hộp thoại mới sau
này rất dễ quên.

---

## 4. Nghiệm thu trước khi tải lên

`build_crazy` lo sáu điều ở §1. Đây là những điều nó không thấy được.

**Chạy chính gói đã dựng, không phải mã nguồn:**

```bash
cd dist/crazy && python -m http.server 8125
```

Console phải in đúng chuỗi này — thiếu dòng nào là phần nối SDK chưa chạy:

```
CrazyGames HTML SDK initialized
Local data handler initialized
Requesting game loading start
Requesting game loading stop
Requesting gameplay start
```

Mở Cài Đặt phải thấy thêm `Requesting gameplay stop`, đóng lại thấy
`Requesting gameplay start`. Bắt bằng:

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu \
  --enable-logging=stderr --v=0 --virtual-time-budget=8000 \
  --dump-dom "http://localhost:8125/index.html" 2>&1 | grep "Requesting"
```

⚠ **Đừng bọc `sdk.game.gameplayStop` để đếm.** Cách ấy đo hụt — dòng console của
chính SDK mới là nguồn sự thật.

**Kiểm tràn trang ở mọi cỡ khung.** Đo `scrollWidth - clientWidth` trong iframe,
và ⚠ **nhớ ép animation về khung cuối trước khi đo** (`d.getAnimations().forEach(a => a.finish())`)
— headless không chạy animation CSS nên phần tử đứng ở khung hình đầu, chỗ thẻ
hướng dẫn còn đang dịch ngang, và số đo sẽ sai. Hiện cả sáu cỡ 360×780, 390×844,
461×896, 800×450, 1280×720, 1920×1080 đều tràn 0px.

⚠ Từng có hai lỗi tràn ngang thật ở đây, đều do **cùng một con số ghi ở hai
chỗ**: `.slot` rộng bằng bàn cờ còn thẻ hướng dẫn bên trong rộng hơn thế, mà thẻ
định vị `left: 0` nên tràn sang phải thay vì nằm giữa; rồi màn hình rộng đổi thẻ
lên 640px mà quên đổi khung chứa. Nay bề ngang thẻ khai một chỗ duy nhất là biến
`--coach-w`, và `.slot` lấy `max(var(--board), var(--coach-w))`.

**Rồi kiểm bốn cỡ khung nhúng.** ⚠ **800×450 là cỡ phải soi kỹ.** Game xếp dọc
nên chiều cao là thứ hiếm; ở đây từng tràn 170px và hai nút trợ giúp rơi ra ngoài
khung, phải cuộn mới bấm được. Đã sửa bằng một khối `@media (max-height: 560px)`
trong `style.css`: hạ sàn cứng của `--board` và cắt bớt khoảng đệm. Phần khung cố
định chiếm 221px bất kể bàn to nhỏ, nên ở khung thấp phải cắt đệm trước rồi mới
tới bàn cờ.

⚠ **Dừng server trước khi dựng lại.** Windows khoá thư mục đang được một tiến
trình lấy làm thư mục làm việc. `build_crazy` giờ dọn *nội dung* thay vì xoá cả
thư mục gốc nên chịu được, nhưng đừng chạy build với output đẩy vào `/dev/null`
— làm thế một lần rồi, build chết mà vẫn tưởng xong, và bản cũ trông y hệt bản mới.

---

## 5. Bàn cờ: màu vùng, ô đã loại, và cỡ bàn

Ba thứ này ràng buộc lẫn nhau, và đều đo được bằng `python tools/palette.py`.

⚠ **Bàn n vùng dùng ĐÚNG n MÀU ĐẦU của bảng** (`Puzzle.colourOf`: `region % 12`),
nên bàn 6×6 chỉ thấy `--g0..--g5`. Chấm một bảng màu phải chấm trên MỌI TIỀN TỐ
game dùng thật, không phải chỉ trên cả 12 màu — bảng cũ tách tốt ở 4×4 và 5×5
(ΔE00 22) nhưng rớt xuống 11,5 từ 6×6 trở đi, tức gần suốt game.

⚠ **Bàn cờ KHÔNG vẽ viền vùng — màu là dấu hiệu duy nhất**, nên hai vùng nhìn
giống nhau không phải chuyện xấu đẹp mà là chơi sai được.

**Ô đã loại chừa một VÀNH giữ nguyên màu vùng.** Trước đây ô tắt để
`opacity: 0.28`, kéo mọi màu hội tụ về nền và bóp khoảng cách còn một phần tư:
ΔE00 rớt từ 11,5 xuống **6,2**, dưới hẳn ngưỡng phân biệt. ⚠ Tăng độ mờ gần như
vô ích — từ 28% lên 52% chỉ nhích lên 8,6, mà lại làm mất tín hiệu "ô này đã
loại". Vành giữ nguyên màu thì khoảng cách lúc tắt **bằng đúng** lúc sáng, tức
xoá hẳn một ràng buộc thay vì đánh đổi. Bảng màu hiện tại đo được **17,8** ở bàn
10×10.

⚠ **Vành vẽ bằng HAI LỚP `box-shadow: inset` trong chính ô**, không dùng lớp con
đặt lệch theo phần trăm. Lớp con là một lượt tô riêng, mỗi ô lại rơi vào một vị
trí lẻ pixel khác nhau nên trình duyệt làm tròn mỗi ô một kiểu — vành mỏng 4-5px
thì lệch nửa pixel đã thấy rõ, cả bàn trông xô lệch. Vì cần `currentColor`,
`boardview.js` đặt màu vùng vào `color` chứ không phải `background`.

⚠ **Pseudo-element trong `.cell` phải `position: absolute`.** `.cell` là
`display: grid`, nên một pseudo ở chế độ `relative` là phần tử lưới thật: nó đặt
sàn bề rộng cho ô, mà cột bàn cờ khai `1fr` = `minmax(auto, 1fr)` — cột nào có
kiến thì bị đẩy rộng ra, các cột còn lại chia phần thừa nên hẹp lại. Lỗi này có
sẵn trong `.cell.cat::after` từ đầu, chỉ lộ ra khi ô nhỏ tới mức `1.15em` vượt bề
ngang ô, tức trên máy phóng to màn hình — headless luôn chạy ở tỉ lệ 1 nên không
bao giờ gặp.

**Cỡ bàn: khung không được phình theo bàn.** Chữ, chip và nút trợ giúp từng đo
thẳng bằng `--board`, thành vòng lặp: bàn to lên thì khung cũng to lên và ăn lại
chỗ vừa giành được — ở 1920×1080 khung chiếm 474px, gần bằng cả bàn cờ. Nay
chúng bám `--ui: min(var(--board), 460px)`, quá mức đó thì khung thôi lớn. Đo
thẳng quan hệ cỡ bàn ↔ chiều cao nội dung ra hai đoạn tuyến tính cắt nhau đúng
tại 460px: `cao = 1,40 × bàn + 168` khi bàn ≤ 460, `cao = bàn + 354` khi lớn hơn.
Công thức `--board` giải ngược từ đó.

---

## 6. Những thứ không được đổi sau khi phát hành

- ⚠ **Tiền tố khoá `antguard.`** Automatic Progress Save sao lưu `localStorage`
  nguyên văn, nên đổi tên khoá sau khi phát hành là khôi phục tên cũ vào một game
  đang đọc tên mới, và mọi người chơi mất sạch tiến trình. Ba khoá hiện có:
  `antguard.progress.v2`, `antguard.sound.v1`, `antguard.locale.v1`. Chúng vừa
  được đổi từ `colodoku.*` ngày 2026-09-09 — miễn phí vì chưa ai chơi. Không
  miễn phí lần thứ hai.
- ⚠ Ba khoá ấy cũng được liệt kê trong `privacy.html`. Đổi khoá là phải sửa trang
  đó cùng lúc.

---

## 7. Basic Launch chấm cái gì

Không chỉ là duyệt chất lượng: đó là **hai tuần chạy có giới hạn lượt truy cập**,
và bộ phận kiểm duyệt theo dõi mức độ gắn bó trong lúc chạy. Mấy con số ấy quyết
định có lên Full Launch hay không.

| chỉ số | tốt | của mình |
|---|---|---|
| thời lượng phiên trung bình | 10+ phút | chưa đo |
| giữ chân ngày 1 | 10-15% | localStorage + Progress Save |
| tỉ lệ vào tới lối chơi | 80%+ | vào thẳng bài hướng dẫn, không qua menu |
| thời gian tải | < 10 giây | 1,28 MB |
| dung lượng gói | < 20 MB | **1,28 MB** ✓ |

⚠ **"Thời gian tới lối chơi" đo tới lúc gọi `gameplayStart`**, không phải tới
khung hình đầu. Nên đừng thêm gì vào đường khởi động mà không đo lại con số này.

---

## 8. Còn thiếu

- Chạy Quality Assurance Tool của họ và dọn cảnh báo.
- Khai báo thanh toán.
- ⚠ Kho GitHub `cuongpc19/Colodoku` đang **công khai** và trong cây vẫn còn bộ
  level giải mã của Meowdoku. Gói nộp thì sạch (danh sách trắng lo việc đó),
  nhưng kho công khai là chuyện riêng cần xử lý — xem README.
