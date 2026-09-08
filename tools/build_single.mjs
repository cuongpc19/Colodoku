// Gói cả game vào một file HTML chạy được không cần server.
//
// Bản này nhúng sẵn đúng 360 bản ghi mà tuyến chơi dùng tới, thay vì cả 30 bank
// (28.755 puzzle) — vừa nhẹ đi ~80 lần, vừa mang theo ít dữ liệu của họ nhất có
// thể. Ảnh con kiến và CSS cũng được nhúng thẳng vào file.
//
//   node tools/build_single.mjs        →  dist/colodoku.html

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { levelSpec, TOTAL_LEVELS } from "../src/progression.js";
import { SCRIPTED } from "../src/levels.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

// Thứ tự phụ thuộc — nối tay thay vì gọi bundler, dự án không có bước build nào khác.
const MODULES = [
  "src/puzzle.js", "src/solver.js", "src/levels.js", "src/strings.js",
  "src/boardview.js", "src/tutorial.js", "src/progression.js", "src/game.js",
];

/** Gỡ import/export để các module ghép lại thành một khối script chạy được. */
function flatten(source) {
  return source
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?[ \t]*$/gm, "")
    .replace(/^export\s+(?=(const|let|function|class|async)\b)/gm, "")
    .trim();
}

// --- gom bản ghi từng màn -----------------------------------------------

const banks = new Map();
const bankOf = (slug) => {
  if (!banks.has(slug)) banks.set(slug, JSON.parse(read(`data/${slug}.json`)));
  return banks.get(slug);
};

const levels = [];
for (let n = 1; n <= TOTAL_LEVELS; n++) {
  if (SCRIPTED[n - 1]) { levels.push(null); continue; } // đã nằm sẵn trong levels.js
  const spec = levelSpec(n);
  const bank = bankOf(spec.slug);
  const list = bank.tiers[spec.rating] || bank.tiers[String(spec.rating + 1)];
  const record = list[spec.offset % list.length];
  levels.push({ record, size: bank.size });
}

// --- nhúng tài nguyên ----------------------------------------------------

const antData = readFileSync(new URL("assets/ant-512.png", root)).toString("base64");
const css = read("src/style.css")
  .replace(/url\("\.\.\/assets\/ant-512\.png"\)/g, `url("data:image/png;base64,${antData}")`);

const script = [
  `globalThis.__COLODOKU_LEVELS = ${JSON.stringify(levels)};`,
  ...MODULES.map((path) => `// ---- ${path} ----\n${flatten(read(path))}`),
].join("\n\n");

// --- ghép vào index.html -------------------------------------------------

const html = read("index.html")
  .replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="src\/game\.js"><\/script>/, `<script type="module">\n${script}\n</script>`)
  // Bản một file không kèm trang phân tích.
  .replace(/\s*<a class="linkish" href="lab\.html">[^<]*<\/a>/, "");

mkdirSync(new URL("dist/", root), { recursive: true });
writeFileSync(new URL("dist/colodoku.html", root), html);

// Bản cho Artifact: nơi đó tự bọc <html>/<head>/<body> nên chỉ nộp phần ruột,
// và class "app" trên <body> phải gắn bằng script vì thẻ body không phải của mình.
const artifact = html
  .replace(/^[\s\S]*?<title>/, "<title>")
  .replace(/<\/head>\s*<body class="app">/, '<script>document.body.classList.add("app");</script>')
  .replace(/\s*<\/body>\s*<\/html>\s*$/, "");
writeFileSync(new URL("dist/colodoku-artifact.html", root), artifact);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`dist/colodoku.html · ${kb(html.length)} (kiến ${kb(antData.length)}, ${levels.filter(Boolean).length} màn nhúng sẵn)`);
console.log(`dist/colodoku-artifact.html · ${kb(artifact.length)}`);
