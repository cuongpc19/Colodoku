// Dựng thư mục đem đăng công khai (dist/site) rồi mới deploy Firebase Hosting.
//
//   node tools/build_site.mjs
//   npx firebase-tools deploy --only hosting
//
// Trang này chỉ tồn tại vì đơn nộp CrazyGames đòi một ĐỊA CHỈ công khai cho
// chính sách riêng tư. Bản thân game không trỏ ra đây bao giờ — trong game là
// bản privacy.html đi kèm ngay trong gói, cùng origin (họ cấm link ra ngoài).
//
// ⚠ Bản gốc duy nhất là privacy.html ở thư mục gốc kho. Cả gói nộp
// (tools/build_crazy.mjs) lẫn thư mục đăng này đều CHÉP từ đó ra, nên không có
// chuyện hai bản lệch nhau. MarbleSort giữ hai bản rời và phải ghi hẳn vào tài
// liệu là "sửa nhớ cập nhật cả hai chỗ" — đó là thứ sớm muộn cũng quên.

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = join(root, "dist", "site");

// Dọn nội dung chứ không xoá thư mục gốc — Windows khoá thư mục đang mở.
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) rmSync(join(out, name), { recursive: true, force: true });

cpSync(join(root, "privacy.html"), join(out, "privacy.html"));

// Trang gốc: có người sẽ gõ thẳng tên miền, đừng để họ gặp lỗi 404 trống trơn.
writeFileSync(
  join(out, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ant Guard</title>
    <style>
      body {
        margin: 0; display: grid; place-items: center; min-height: 100dvh;
        background: #141826; color: #eef0f7; text-align: center;
        font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      a { color: #ffc46b; }
    </style>
  </head>
  <body>
    <div>
      <h1>Ant Guard</h1>
      <p><a href="privacy.html">Privacy Policy</a></p>
    </div>
  </body>
</html>
`,
);

const bytes = readdirSync(out).reduce((a, f) => a + readFileSync(join(out, f)).length, 0);
console.log(`dist/site: ${readdirSync(out).join(", ")} · ${(bytes / 1024).toFixed(1)} KB`);
console.log("Đăng lên:  npx firebase-tools deploy --only hosting");
