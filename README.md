# Colodoku

Bản dựng lại Meowdoku trên web, dùng chính bộ level đã giải mã từ APK để nghiên cứu cách họ thiết kế màn chơi.

> **Chỉ dùng nội bộ.** Bộ level trong `data/` là dữ liệu có bản quyền của `com.oakever.meowdoku`, trích ra để học cách họ làm. Luật chơi và thuật toán thì tự do dùng lại, nhưng đừng phát hành bản có sẵn dữ liệu này — mỗi puzzle gốc còn mang hash `_pid_h` nhận diện được. Muốn phát hành thì thay bằng level tự sinh.
>
> Ba bàn cờ trong [`src/levels.js`](src/levels.js) (tutorial, màn 1, màn 2) được chép tay từ bản ghi màn hình `Recording 2026-09-08 135759.mp4`, kèm bảng màu lấy mẫu pixel từ chính video — cũng là thiết kế của họ, cùng ràng buộc như trên.

Giao diện có **17 thứ tiếng**, mặc định tiếng Anh, đổi trong **Cài đặt → Ngôn ngữ**. Xem mục [Ngôn ngữ](#ngôn-ngữ) bên dưới.

## Chạy

> **Repo này không kèm `data/`.** Bộ level là dữ liệu có bản quyền của Meowdoku (xem cảnh báo đầu file), nên `.gitignore` loại cả thư mục. Clone về thì phải tự dựng lại từ file `.xapk` của mình:
>
> ```bash
> python tools/extract_levels.py <file .xapk> --out data --raw data/raw
> ```
>
> Riêng `data/i18n/` (17 file chữ) là viết tay, không có tool sinh lại — thiếu nó thì game không hiện được chữ nào.

```bash
python -m http.server 8123
```

Mở http://localhost:8123 — cần chạy qua HTTP vì game dùng ES module và `fetch`, mở thẳng `file://` sẽ không tải được dữ liệu.

Hai trang:

- **`index.html`** — game: hướng dẫn từng bước, rồi chơi lần lượt 360 màn, có lưu tiến trình và chấm sao.
- **`lab.html`** — công cụ mổ level design: duyệt thẳng 30 bank của Meowdoku, xem bộ giải suy luận từng bước.

## Tuyến chơi

360 màn, chia 22 chặng, lưới lớn dần 4×4 → 12×12 và độ khó lên dần R1 → R5. Cứ mỗi 7 màn chèn một màn dễ hơn một bậc làm **nhịp nghỉ** — tái hiện nhịp "dễ – dễ – khó – dễ" thay vì tăng tuyến tính.

Hai màn đầu lấy nguyên từ video (xem [`src/levels.js`](src/levels.js)), kể cả con mèo game đặt sẵn khi vào màn — bỏ con mèo đó đi thì màn 2 nhảy từ cấp kỹ thuật 1 lên 4, nên nó là một phần của thiết kế chứ không phải quà tặng.

Từ màn 3 trở đi thì lấy từ bank. Cấu hình tuyến chơi thật của Meowdoku nằm trong GDScript đã biên dịch (`.gdc`, header `GDSC` + nén) nên không đọc ra được; bảng trong [`src/progression.js`](src/progression.js) là tuyến do mình dựng, nhưng bám đúng thang 5 bậc và tên bậc (**Nhập Môn · Trung Cấp · Thử Thách · Bậc Thầy · Huyền Thoại**) lấy từ bản địa hoá của họ.

Sao mỗi màn: 3 sao nếu không dùng gợi ý, 2 sao nếu dùng 1–2 lần, 1 sao nếu nhiều hơn. Tiến trình lưu ở `localStorage`.

**Tự đánh ✕** chỉ bật ở hướng dẫn và **màn 1–2**, coi như phần nối tiếp của tutorial. Từ màn 3 trở đi người chơi tự loại ô — đó mới là thao tác chính của trò này, để mãi thì không bao giờ học được cách suy luận. Vào màn 3 có một dòng nhắc, và người chơi vẫn bật lại được bằng ô tick nếu muốn.

## Hướng dẫn

Dựng lại đúng tutorial của Meowdoku, đối chiếu từng khung hình trong video: cùng bàn cờ 4×4, cùng thứ tự bước, cùng câu chữ. Người chơi tự đặt cả ba con mèo đầu và tự đánh 9 dấu ✕ — game không đặt hộ con nào.

| Bước | Lời dẫn | Người chơi làm |
|---|---|---|
| `place-first` | ***Double-tap** to place the cat on a cell.* | bấm đúp ô xanh lá |
| `rule-colour` | *Well done! Only one cat per **color**.* + nút **Got it!** | đọc |
| `exclude-lines` | *Nice! Cats can't be in the **same row or column**.*<br />*Tap empty cells to exclude them.* | ✕ 6 ô |
| `place-second` | *Only the last **Rose** remains — **Double-tap** to place a cat* | bấm đúp |
| `exclude-touching` | *No cats can be **adjacent** to each other.*<br />***Swipe** across these cells to exclude them.* | vuốt 3 ô |
| `place-third` | *Only the last **Sky Blue** remains — **Double-tap** to place a cat* | bấm đúp |
| `find-last` | *Find the **last cat**!* + *Tap here for a hint.* | tự giải |
| `done` | *Excellent! You've mastered the rules!* + **Start Game** | |

Cơ chế chỉ chỗ cũng lấy đúng của họ: **phủ tối cả màn hình**, chỉ chừa lại thẻ hướng dẫn và mấy ô đang được nói tới; ô cần bấm đúp có thêm vòng trắng đập chậm. Trong lúc hướng dẫn, chip đếm mèo và ba thẻ nhắc luật bị giấu đi — bản gốc cũng vậy. Xong mỗi bước, lớp phủ tắt một nhịp cho cả bàn sáng lên rồi mới sang bước sau.

Mỗi bước khoá mọi ô ngoài yêu cầu, và khoá cả thao tác sai kiểu: bấm đúp vào ô đang cần ✕ thì không ăn.

Toạ độ không ghi cứng — [`src/tutorial.js`](src/tutorial.js) suy các ô cần bấm ra từ luật (hàng+cột của con mèo đầu, rồi các ô kề con mèo thứ hai). [`tools/flow_test.mjs`](tools/flow_test.mjs) đối chiếu kết quả đó với đúng những ô video bắt bấm.

Một chỗ cố ý khác bản gốc: nút quay lại vẫn hiện trong lúc hướng dẫn, vì ở đây người chơi có thể mở hướng dẫn lại từ trang chủ và cần đường ra.

## Màn chơi

Bố cục chép theo ảnh chụp bản gốc: **Level** và **Score** hai bên thanh trên, bánh răng bên phải, dưới đó là chip đếm con vật và chip mạng, rồi ba thẻ nhắc luật, bàn cờ, và hai nút trợ giúp tròn.

- **Điểm** đọc ngược ra từ video: `576` cho con đầu, mỗi con đúng liên tiếp sau đó `+96`, đặt sai thì chuỗi về 0. Khớp đúng cả hai màn trong video — màn 1 `576 + 576 + 672 = 1824`, màn 2 `576 + 672 + 768 = 2016`.
- **Mạng**: 3 lượt. Đặt sai chỗ thì ô đó mang ✕ đỏ vĩnh viễn và mất một mạng, đúng như bản gốc — họ bắt lỗi ngay lúc đặt chứ không để người chơi ôm một thế cờ sai.
- **Hai nút trợ giúp**, mỗi nút 5 lượt mỗi màn. Nút con vật đặt hộ một con đúng chỗ; nút bóng đèn đưa ra gợi ý.
- **Gợi ý** trình bày y như họ: phủ tối màn hình, sáng những ô liên quan và vẽ sẵn ✕ mờ lên chúng để thấy trước kết quả, kèm nút **Apply** to ở dưới. Câu đầu tiên cũng là câu của họ — *"This ant's row, column and neighbors can't have other ants — exclude them"*; hết chỗ loại quanh các con đã đặt thì mới nhờ tới bộ giải.

Trang chủ dựng theo ảnh: ảnh đại diện và bánh răng trên cùng, hai thẻ **Daily Challenge** (khoá) và **Streak**, chữ hiệu, rồi nút viên thuốc vào màn kế. Chuỗi ngày là thật (lưu trong `localStorage`, đứt nếu nghỉ một ngày); thẻ Daily Challenge mới chỉ có phần vỏ.

## Luật

1. Mỗi vùng màu đúng **1** con mèo
2. Mỗi hàng đúng **1** con, mỗi cột đúng **1** con
3. Hai con mèo **không được kề nhau**, kể cả chéo

Ba luật này luôn hiện thành **3 thẻ nhắc** trên đầu màn chơi, mỗi thẻ có sơ đồ 3×3 minh hoạ — đúng chữ của họ: *1 Cat per color · 1 Cat per column and row · Cats cannot touch*.

Thao tác: bấm một lần đánh ✕ (kéo để đánh hàng loạt), bấm đúp hoặc chuột phải đặt 🐱.

## Ngôn ngữ

**Cài đặt → Ngôn ngữ**, đúng 17 thứ tiếng Meowdoku phát hành trên Play Store (danh sách `config.*.apk` trong `.xapk`):

> English · Tiếng Việt · 中文 · 日本語 · 한국어 · Français · Deutsch · Español · Português · Italiano · Русский · Türkçe · العربية · हिन्दी · Bahasa Indonesia · ไทย · မြန်မာ

Thứ tự ưu tiên khi chọn ngôn ngữ mở màn:

1. **Thứ tiếng người chơi tự chọn** trong Cài đặt — đã chọn rồi thì không bao giờ đè lên. Lưu ở `localStorage` (`colodoku.locale.v1`).
2. **`locale` của CrazyGames SDK** — `window.CrazyGames.SDK.user.systemInfo.locale`, dạng `"en-US"`. Đây là field chính họ bảo dùng, và yêu cầu duyệt game cũng bắt phải theo. Chỉ đọc được nếu trang nhúng đã gọi `SDK.init()` **trước** khi nạp `src/game.js`. (SDK v2 không có `locale`, chỉ có `countryCode` — nhánh này sẽ bỏ qua.)
3. **Ngôn ngữ trình duyệt** — `navigator.languages`, duyệt theo đúng thứ tự người dùng đặt.
4. **Tiếng Anh.**

Thẻ kiểu `pt-BR` cắt còn `pt`; `in` (mã cũ) hiểu là `id`; thẻ nào không có trong 17 mã thì bỏ qua và xét tiếp ứng viên sau. `zh-TW` và `zh-HK` hiện ra **chữ giản thể** vì chỉ có một bản 中文; muốn đúng thì thêm `zh-TW` từ `translations.zh_TW.translation` trong gói game.

Kết quả dò **không được lưu** — `localStorage` chỉ giữ lựa chọn của người chơi, nên đổi ngôn ngữ máy là game đổi theo. Tiếng Ả Rập tự động bật `dir="rtl"`.

Mỗi ngôn ngữ một file `data/i18n/<mã>.json`, chỉ nạp thứ tiếng đang chọn. Khoá viết phẳng (`tut.gotIt`), câu nào có `{0}` thì [`src/strings.js`](src/strings.js) biến thành hàm, nên phía dùng cứ viết `T.play`, `T.playOn(3)`, `T.tut.gotIt`. Chữ tĩnh trong HTML đánh dấu bằng `data-i18n="khoá"`.

Thêm một ngôn ngữ = chép `data/i18n/en.json` thành file mới rồi thêm một dòng vào `LANGUAGES`.

### Chữ lấy ở đâu

Phần lớn là **bản dịch chính chủ của Meowdoku**, trích thẳng từ APK:

```bash
python tools/extract_translations.py          # -> data/reference/meowdoku-i18n.json
python tools/extract_translations.py --list   # 84 locale có trong gói
```

Ba chỗ phải dịch tay:

- câu Colodoku tự thêm (tên màn hình, lời nhắc tắt tự đánh ✕, lời giải thích của bộ giải);
- **mèo → kiến** ở mọi câu mượn lại — tiếng Nga, Ả Rập, Pháp… đổi con vật là đổi cả giống và đuôi từ, không thay máy móc được;
- **tiếng Miến (`my`)**: `config.my.apk` chỉ chứa chuỗi Android của mấy thư viện quảng cáo, gói game không có tiếng Miến — nên `data/i18n/my.json` là bản dịch của mình, không phải của họ.

Câu giải thích của bộ giải có nhắc hàng/cột/màu thì viết sẵn thành ba câu riêng (`reasons.onlyCell.row/.col/.region`) chứ không thêm danh từ vào một chỗ trống — vì lý do giống như trên.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `index.html` | Game: trang chủ, chọn màn, màn chơi |
| `lab.html` | Công cụ phân tích level design |
| `src/puzzle.js` | Mô hình bàn cờ, luật chơi, phát hiện xung đột |
| `src/solver.js` | Bộ giải theo 5 cấp kỹ thuật — dùng cho gợi ý và chấm độ khó |
| `src/boardview.js` | Vẽ lưới và xử lý thao tác, dùng chung cho game lẫn lab |
| `src/levels.js` | Bàn tutorial + hai màn đầu, chép từ video, và bảng màu của họ |
| `src/strings.js` | Bảng chữ: nạp ngôn ngữ, đổi ngôn ngữ, đổ chữ vào HTML |
| `src/progression.js` | Tuyến 360 màn và lưu tiến trình |
| `src/tutorial.js` | 8 bước hướng dẫn, tính ô cần bấm từ luật |
| `src/game.js` | Vòng chơi chính |
| `src/lab.js` | Trang phân tích |
| `tools/extract_levels.py` | Giải mã level bank từ `.xapk` và đóng gói cho web |
| `tools/extract_translations.py` | Giải mã bản địa hoá Godot từ `.xapk` ra JSON |
| `tools/verify_solver.mjs` | Đối chiếu bộ giải của mình với số liệu độ khó của họ |
| `tools/smoke.mjs` | Kiểm tra logic bàn cờ không cần trình duyệt |
| `tools/flow_test.mjs` | Kiểm tra tutorial và tuyến chơi không cần trình duyệt |
| `data/` | 30 bank, 28.755 puzzle (4,1 MB) |
| `data/raw/` | Bản JSON gốc đã giải mã, giữ nguyên mọi trường (15 MB) |
| `data/i18n/` | 17 file chữ, mỗi ngôn ngữ một file |
| `data/reference/` | Bản địa hoá gốc của Meowdoku, dùng để đối chiếu |

Dựng lại dữ liệu từ APK:

```bash
python tools/extract_levels.py Meowdoku_+Brain+Puzzle+Games_1.15.0_APKPure.xapk --out data --raw data/raw
```

## Những gì đọc được từ level bank của họ

Bank gốc nằm trong `assetPackInstallTime.apk` tại `assets/assets/resources/levels/`, đuôi `.json` nhưng bị XOR với khoá 25 byte lặp lại `meowdoku-2026-bank-secret` (tìm ra bằng phân tích index of coincidence). Mỗi puzzle:

```json
{
  "seed": 100023,
  "regionMap": [[0,0,0,...], ...],
  "solution": [0,8,4,1,5,3,6,2,7],
  "r": 3, "steps": 13,
  "r1": 9, "r2": 2, "r3": 2, "r4": 0, "r5": 0,
  "_pid_h": "aaaddc81b682582d",
  "_pid_s": [0,1,2,3,4,5,6,7],
  "isChainedStrategy": false
}
```

**Công thức chấm độ khó của họ**, suy ra từ dữ liệu: `r` = **cấp kỹ thuật cao nhất mà lời giải bắt buộc phải dùng**, không phải số bước. Thống kê trên bank classic 8×8, 9×9, 10×10 cho ra `maxRank` trung bình đúng bằng 1.00 / 2.00 / 3.00 / 4.00 / 5.00 cho r = 1..5, phương sai bằng 0.

Vài hệ quả:

- `r1` luôn bằng `N` — đó là N lần đặt mèo, mỗi lần tính một bước cấp 1.
- `r2..r5` đếm số lần dùng kỹ thuật loại trừ ở từng cấp. Số bước có tăng theo độ khó nhưng không phải thứ quyết định.
- `_pid_s` là chữ ký chuẩn hoá dưới 8 phép đối xứng của hình vuông, dùng để không phát hành hai màn thực chất là một sau khi xoay/lật.
- File `.pace.json` đi kèm mỗi bank mô tả nhịp độ **bên trong từng màn**, không phải giữa các màn: `r_seq` dài đúng `N`, ghi cấp kỹ thuật của từng nước đặt mèo theo thứ tự. Màn bậc 1 ra `[1,1,1,1,1,1,1,1,1]`, màn bậc 2 ra `[1,2,1,1,1,1,1,1,1]` — tức là chỗ khó nằm ở đâu trong lúc giải cũng được thiết kế, chứ không chỉ có "khó tổng thể bao nhiêu". Kèm theo là `hint_click_seq` (dự đoán số lần bấm gợi ý ở từng bước) và `g1..g4`.
- `levels-7x7.json` chứa tham số sinh màn (`seed`, `regionSeed`, `bias`, `prefillCount`), cho thấy họ có generator chứ không chỉ có bank tĩnh.

## Thang kỹ thuật trong `src/solver.js`

Đã chỉnh cho khớp thang thật của Meowdoku — tên và mô tả lấy nguyên từ bản địa hoá tiếng Việt của họ:

| Cấp | Tên của họ | Mô tả của họ |
|---|---|---|
| 1 | Ứng viên duy nhất | Một hàng/cột/vùng chỉ còn 1 ô |
| 2 | Ràng buộc vùng-hàng/cột | Các ứng viên vùng tập trung ở một hàng hoặc cột |
| 3 | Khóa tập hợp (K) | K vùng chỉ chiếm K hàng hoặc K cột |
| 4 | Khóa nâng cao | Khóa tập hợp lớn hơn hoặc kiểm tra giả định |
| 5 | Suy luận chuỗi sâu | Chuỗi giả định nhiều bước để loại ô |

Hai điểm phải sửa so với bản đầu:

- **Cấp 2 chạy hai chiều.** Bốn câu gợi ý của họ đi thành cặp — `Ứng viên %s đều ở hàng %d` (vùng nằm trong hàng) và `Ứng viên hàng %d đều thuộc %s` (hàng nằm trong vùng) — nên cả hai chiều cùng là cấp 2, kéo mọi cấp sau xuống một bậc. Bản đầu tách làm hai cấp nên lệch toàn bộ thang.
- **Cấp 4 chỉ nhận mâu thuẫn tức thì.** Chuỗi của họ phân biệt rõ `Đặt ở đây gây mâu thuẫn trực tiếp` (cấp 4) với `Đặt ở đây gây mâu thuẫn (%d bước)` (cấp 5). Cho cấp 4 lan truyền thêm bước có nhích khớp `r` lên 184/200 nhưng làm sai lệch số bước gấp năm lần (0,21 → 1,01), nên giữ đúng nghĩa "trực tiếp".

Thêm một kỹ thuật của họ mà bản đầu thiếu: hàng và cột cùng bị khoá vào một vùng thì ô giao của chúng chắc chắn có mèo (`Hàng và cột thuộc cùng một vùng — ô giao phải có mèo`).

Đối chiếu lại với bank của họ (`node tools/verify_solver.mjs <bank> <số mẫu>`):

| Bank | Giải được | Khớp cấp `r` | Lệch số bước |
|---|---|---|---|
| classic-7x7 | 120/120 | 106/120 | 0,38 |
| classic-9x9 | 120/120 | 105/120 | 0,21 |
| classic-10x10 | 120/120 | 118/120 | 0,86 |
| lkstyle-9x9 | 120/120 | 113/120 | −0,91 |

Trên mẫu 200 màn classic-9x9, khớp cấp `r` đi từ **60/200 lên 180/200** sau khi sửa thang.

## Trích từ bản địa hoá của họ

Không đọc được `.gdc` (đã biên dịch và nén), nhưng chữ trong game thì đọc được hết: `assetPackInstallTime.apk` chứa **84 file** `assets/assets/localization/translations.<locale>.translation`, mỗi file là một resource nhị phân `OptimizedTranslation` của Godot 4.

[`tools/extract_translations.py`](tools/extract_translations.py) đọc trọn: bóc header `RSRC`, lấy `hash_table` / `bucket_table` / `strings`, rồi giải nén smaz từng câu.

Định dạng này **không lưu tên khoá**, chỉ lưu hash của nó — nhưng bảng hash chỉ phụ thuộc vào tập khoá, mà tập khoá thì giống nhau ở mọi ngôn ngữ. Ghép các file theo hash là ra đúng từng cặp câu en ↔ vi ↔ ja…, lấy câu tiếng Anh làm khoá. Kết quả: **2.101 câu × 16 ngôn ngữ** ở [`data/reference/meowdoku-i18n.json`](data/reference/meowdoku-i18n.json).

Bản đọc thô trước đó (2.552 chuỗi tiếng Việt, không có khoá, lấy được vì smaz chỉ nén được tiếng Anh nên câu có dấu nằm nguyên dạng) vẫn giữ ở [`data/reference/meowdoku-vi-strings.txt`](data/reference/meowdoku-vi-strings.txt). Blob chuỗi được ghi theo thứ tự nguồn (bảng băm chỉ trỏ vào nó), nên thứ tự đọc ra xấp xỉ thứ tự trong file gốc của họ.

Ngoài thang kỹ thuật và kịch bản tutorial, còn lấy được: tên 5 bậc độ khó (**Nhập Môn · Trung Cấp · Thử Thách · Bậc Thầy · Huyền Thoại**), tên hai kho (`Kho thường` / `Kho LK tối ưu` — khớp `bankData` với `bankDataLKStyle`), mốc `Thử Thách Hằng Ngày mở khóa ở màn 21`, và dấu vết một biến thể kiểu sudoku (`1 mèo mỗi lưới 9`, `1 mèo mỗi 3*3`).
