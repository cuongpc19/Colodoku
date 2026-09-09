// Dựng gói nộp CrazyGames vào dist/crazy/.
//
//   node tools/build_crazy.mjs
//
// Game vốn chạy thẳng từ mã nguồn (module ES, không cần đóng gói), nên việc ở
// đây chủ yếu là CHỌN file nào được đi — và chọn kiểu danh sách trắng, không
// phải danh sách đen. Kho này còn chứa bộ level giải mã từ APK của Meowdoku và
// trang phân tích lab.html; cả hai lọt vào gói nộp đều là hỏng việc, một cái về
// bản quyền, một cái vì công cụ nội bộ đặt trước mặt người kiểm duyệt là trượt.
// Danh sách đen thì thêm file mới là quên; danh sách trắng thì file mới phải
// được khai mới đi được.
//
// Cuối cùng script tự nghiệm thu và IN RA, không im lặng bỏ qua: bốn giới hạn
// cứng của họ cộng thêm mấy thứ chỉ kho này mới có.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = join(root, "dist", "crazy");

/** Đúng những file game cần lúc chạy. Không có gì khác được vào gói. */
const FILES = [
  "index.html",
  "privacy.html",
  "manifest.webmanifest",
  "src/style.css",
  "src/boardview.js",
  "src/crazy.js",
  "src/game.js",
  "src/levels.js",
  "src/nest.js",
  "src/progression.js",
  "src/puzzle.js",
  "src/solver.js",
  "src/sound.js",
  "src/strings.js",
  "src/tutorial.js",
  "data/pools.json",
  "data/specials.json",
  "data/i18n/en.json",
  "data/i18n/vi.json",
];
const DIRS = ["assets"];

// Những thứ tuyệt đối không được có trong gói, kiểm lại sau khi chép.
const BANNED = [
  [/data\/(classic|gc|gcsample|lkstyle|lkmodified|onefish|sp|sp_tt|daily|index)[-.]/, "kho level giải mã từ APK"],
  [/data\/raw\//, "bản giải mã thô"],
  [/data\/reference\//, "tài liệu tham chiếu của họ"],
  [/lab\.(html|js)/, "trang phân tích nội bộ"],
  [/\.xapk$/, "gói APK gốc"],
];

// Dọn NỘI DUNG chứ không xoá cả thư mục gốc: Windows khoá thư mục đang được
// một tiến trình lấy làm thư mục làm việc, hay đang mở trong Explorer — xoá gốc
// thì build chết giữa chừng và để lại bản cũ, mà bản cũ trông y hệt bản mới.
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) rmSync(join(out, name), { recursive: true, force: true });

for (const file of FILES) {
  const from = join(root, file);
  if (!existsSync(from)) throw new Error(`thiếu file khai trong FILES: ${file}`);
  mkdirSync(dirname(join(out, file)), { recursive: true });
  cpSync(from, join(out, file));
}
for (const dir of DIRS) cpSync(join(root, dir), join(out, dir), { recursive: true });

// ------------------------------------------------------------- sửa index.html

let html = readFileSync(join(out, "index.html"), "utf8");

// Đánh dấu đây là bản CrazyGames. src/crazy.js chỉ nạp SDK khi thấy dấu này,
// nên bản web thường không gọi sang máy chủ của họ lần nào.
html = html.replace('<html lang="en">', '<html lang="en" data-target="crazy">');

// Thẻ Open Graph trỏ về GitHub Pages — vô nghĩa trong khung nhúng của họ, mà
// lại là đường dẫn tuyệt đối ra ngoài. Bỏ cho gọn.
html = html.replace(/\s*<meta property="og:[^>]*>/g, "").replace(/\s*<meta name="twitter:[^>]*>/g, "");
writeFileSync(join(out, "index.html"), html);

// ------------------------------------------------------------------ nghiệm thu

const walk = (dir, base = "") => {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) found.push(...walk(full, rel));
    else found.push({ rel, size: statSync(full).size });
  }
  return found;
};

const shipped = walk(out);
const bytes = shipped.reduce((a, f) => a + f.size, 0);
const mb = bytes / 1024 / 1024;
const problems = [];
const say = (ok, text) => {
  console.log(`  ${ok ? "✓" : "✗"} ${text}`);
  if (!ok) problems.push(text);
};

console.log(`Bản "crazy": ${shipped.length} file · ${mb.toFixed(2)} MB`);

// 1. Giới hạn dung lượng — dưới 20 MB mới được lên trang chủ bản mobile.
say(mb < 20, `dưới 20 MB — đủ điều kiện lên trang chủ bản mobile (${mb.toFixed(2)} MB)`);

// 2. Không file cấm nào lọt vào.
const sneaked = shipped.filter((f) => BANNED.some(([re]) => re.test(f.rel)));
say(
  sneaked.length === 0,
  sneaked.length ? `LỌT FILE CẤM: ${sneaked.map((f) => f.rel).join(", ")}` : "không có dữ liệu bản quyền hay công cụ nội bộ",
);

// 3. Mọi đường dẫn phải tương đối — gói chạy trong thư mục con của họ.
const texts = shipped.filter((f) => /\.(html|js|css|webmanifest)$/.test(f.rel));
const absolute = [];
for (const f of texts) {
  const body = readFileSync(join(out, f.rel), "utf8");
  for (const m of body.matchAll(/(?:src|href)\s*=\s*["'](\/[^/"'][^"']*)["']/g)) absolute.push(`${f.rel}: ${m[1]}`);
}
say(absolute.length === 0, absolute.length ? `đường dẫn tuyệt đối: ${absolute.join(", ")}` : "đường dẫn đều tương đối");

// 4. Có lớp nối SDK, và index.html có đánh dấu để nó bật lên.
const hasSdk = readFileSync(join(out, "src/crazy.js"), "utf8").includes("crazygames-sdk-v3.js");
const marked = readFileSync(join(out, "index.html"), "utf8").includes('data-target="crazy"');
say(hasSdk && marked, "có SDK CrazyGames và index.html đã đánh dấu bản crazy");

// 5. Trang riêng tư đi kèm và mở được từ trong game.
const hasPrivacy = existsSync(join(out, "privacy.html"));
const linked = readFileSync(join(out, "src/game.js"), "utf8").includes('"privacy.html"');
say(hasPrivacy && linked, "có privacy.html và game mở được nó cùng origin");

// 6. Không link trỏ ra ngoài trong giao diện — họ cấm hẳn.
const outbound = [];
for (const f of texts) {
  const body = readFileSync(join(out, f.rel), "utf8");
  // Bắt cả mailto: và tel: chứ không riêng http — công cụ kiểm duyệt của họ
  // tính mọi thẻ <a> không trỏ vào trong gói là link ra ngoài.
  for (const m of body.matchAll(/href\s*=\s*["']((?:https?|mailto|tel):[^"']+)["']/g))
    outbound.push(`${f.rel}: ${m[1]}`);
}
say(outbound.length === 0, outbound.length ? `link ra ngoài: ${outbound.join(", ")}` : "không có link trỏ ra ngoài");

console.log(`\n  → ${out}`);
if (problems.length) {
  console.error(`\n${problems.length} chỗ chưa đạt, chưa nộp được.`);
  process.exit(1);
}
console.log("\nKéo TOÀN BỘ NỘI DUNG thư mục trên vào ô tải lên của Developer Portal.");
console.log("Đừng nén thành zip — ô tải lên từ chối file nén.");
