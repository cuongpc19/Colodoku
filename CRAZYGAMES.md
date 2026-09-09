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

`privacy.html` vừa nằm trong gói vừa phải đăng công khai để điền vào đơn, nên
sửa là phải cập nhật cả hai chỗ. Bản công khai hiện đăng cùng GitHub Pages của
game.

⚠ **Nội dung phải khớp với thứ game thật sự lưu.** Thêm một khoá localStorage
là trang đó sai ngay hôm ấy. Ba khoá hiện có liệt kê ở §5.

---

## 2. Chỉ lần nộp đầu

- [ ] **Khai báo thanh toán** — phải xong *trước* khi nộp, không phải sau khi duyệt
- [ ] Tài khoản Developer Portal
- [ ] Chạy **Quality Assurance Tool** của họ, dọn sạch mọi cảnh báo
- [x] Ba ảnh bìa: [store/crazygames/](store/crazygames/) — 1920×1080 · 800×1200 · 800×800
- [x] Hai video preview 15-20 giây
- [ ] Địa chỉ trang chính sách riêng tư (bản công khai của `privacy.html`)

Các ô trong đơn có hệ quả thật:

| ô | trả lời | vì sao |
|---|---|---|
| Game engine | **HTML5** | không phải "Externally hosted (iframe)" — ô đó dành cho game tự host |
| Orientation | **Portrait** | bàn cờ vuông, cột dọc; có chạy được khung ngang nhưng bố cục là dọc |
| Supports mobile | **tích** | khai dọc thì họ lo phần xoay máy |
| SDK muting | **tích** | đã làm thật, xem §3; bỏ trống thì phần xử lý tắt tiếng thành vô nghĩa |
| Saves progress | **Có, qua localStorage** | *và bật luôn tính năng Progress Save* — xem §5 |
| Online game | **không** | không có nhiều người chơi |
| Privacy policy | địa chỉ bản công khai | ⚠ chỉ điền vào đơn |

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

## 5. Những thứ không được đổi sau khi phát hành

- ⚠ **Tiền tố khoá `antguard.`** Automatic Progress Save sao lưu `localStorage`
  nguyên văn, nên đổi tên khoá sau khi phát hành là khôi phục tên cũ vào một game
  đang đọc tên mới, và mọi người chơi mất sạch tiến trình. Ba khoá hiện có:
  `antguard.progress.v2`, `antguard.sound.v1`, `antguard.locale.v1`. Chúng vừa
  được đổi từ `colodoku.*` ngày 2026-09-09 — miễn phí vì chưa ai chơi. Không
  miễn phí lần thứ hai.
- ⚠ Ba khoá ấy cũng được liệt kê trong `privacy.html`. Đổi khoá là phải sửa trang
  đó cùng lúc.

---

## 6. Basic Launch chấm cái gì

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

## 7. Còn thiếu

- Chạy Quality Assurance Tool của họ và dọn cảnh báo.
- Đăng `privacy.html` lên một địa chỉ công khai rồi điền vào đơn.
- Khai báo thanh toán.
- ⚠ Kho GitHub `cuongpc19/Colodoku` đang **công khai** và trong cây vẫn còn bộ
  level giải mã của Meowdoku. Gói nộp thì sạch (danh sách trắng lo việc đó),
  nhưng kho công khai là chuyện riêng cần xử lý — xem README.
