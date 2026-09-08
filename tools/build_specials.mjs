// Màn đặc biệt vẽ hình — đúng nhịp Meowdoku đặt (màn 10, 20, 30, 40, 50, 55,
// 60, 62, 70, 75, 80, 90, 100, 123, 456), hình thì mình tự vẽ: chữ số của chính
// số màn, cửa sổ, sóng, biểu đồ cột, chữ π, chữ IQ. Vùng vẽ hình được khoá
// cứng; phần còn lại của bàn do bộ sinh lấp cho tới khi lời giải duy nhất và
// độ khó rơi vào khoảng mong muốn.
//
//   node tools/build_specials.mjs   → data/specials.json

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Puzzle } from "../src/puzzle.js";
import { rng, shuffled, growRegions, finish } from "./generate_levels.mjs";
import { SPECIAL_LEVELS } from "../src/progression.js";

// Chữ 3 ô rộng × 5 ô cao, nét 1 ô, mỗi chữ là một khối liền.
const FONT = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", "..#", "..#"],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  "I": ["###", ".#.", ".#.", ".#.", "###"],
  "Q": ["####", "#..#", "#..#", "####", "...#"],
  "|": ["#", "#", "#", "#", "#"], // số 1 gầy, cho chỗ chật
  "1tall": [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"], // số 1 cao, cho bàn 10×10
};

/** Đặt chữ lên lưới: mỗi nét là một vùng, mỗi lỗ kín bên trong chữ cũng là một vùng. */
function stamp(grid, glyph, top, left, nextId) {
  const rows = glyph.length, cols = glyph[0].length;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (glyph[r][c] === "#") grid[top + r][left + c] = nextId;
  let id = nextId + 1;
  // Lỗ: ô trống trong khung chữ không thoát ra được mép khung.
  const seen = new Set();
  const inside = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (glyph[r][c] === "#" || seen.has(`${r},${c}`)) continue;
      const pocket = [];
      const queue = [[r, c]];
      seen.add(`${r},${c}`);
      let escapes = false;
      while (queue.length) {
        const [i, j] = queue.pop();
        pocket.push([i, j]);
        for (const [a, b] of [[i-1,j],[i+1,j],[i,j-1],[i,j+1]]) {
          if (!inside(a, b)) { escapes = true; continue; }
          if (glyph[a][b] === "#" || seen.has(`${a},${b}`)) continue;
          seen.add(`${a},${b}`);
          queue.push([a, b]);
        }
      }
      if (!escapes) {
        for (const [i, j] of pocket) grid[top + i][left + j] = id;
        id++;
      }
    }
  return id;
}

const blank = (n) => Array.from({ length: n }, () => new Array(n).fill(-1));

/** Vẽ một dãy chữ ở giữa bàn, cách nhau `gap` cột. */
function text(n, glyphs, gap = 1, top = null) {
  const grid = blank(n);
  const widths = glyphs.map((g) => FONT[g][0].length);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (glyphs.length - 1);
  let left = Math.floor((n - total) / 2);
  const row = top ?? Math.floor((n - 5) / 2);
  let id = 0;
  glyphs.forEach((g, i) => {
    id = stamp(grid, FONT[g], row, left, id);
    left += widths[i] + gap;
  });
  return { grid, pictureCount: id };
}

/**
 * Bốn ô cửa sổ hình chữ L quay về giữa, khung là phần lấp tự do. Ô vuông 2×2
 * thì không dùng được: hai con ở hai ô cạnh nhau đổi chỗ cho nhau là ra lời
 * giải thứ hai mà không thể vá vì cả bốn ô đều bị khoá.
 */
function window(n) {
  const grid = blank(n);
  const m = n - 2;
  const panes = [
    [[1, 1], [1, 2], [2, 1]],
    [[1, m], [1, m - 1], [2, m]],
    [[m, 1], [m - 1, 1], [m, 2]],
    [[m, m], [m - 1, m], [m, m - 1]],
  ];
  panes.forEach((cells, id) => { for (const [r, c] of cells) grid[r][c] = id; });
  return { grid, pictureCount: panes.length };
}

/** Một đường sóng liền chạy ngang bàn. */
function wave(n) {
  const grid = blank(n);
  const mid = Math.floor(n / 2);
  const height = (c) => mid + Math.round(2 * Math.sin((c / (n - 1)) * Math.PI * 2));
  let prev = height(0);
  for (let c = 0; c < n; c++) {
    const h = height(c);
    // nối bậc thang để đường sóng liền một khối
    for (let r = Math.min(prev, h); r <= Math.max(prev, h); r++) grid[r][c] = 0;
    prev = h;
  }
  return { grid, pictureCount: 1 };
}

/** Biểu đồ cột: mỗi cột một màu, cao thấp khác nhau, chân cột chạm đáy. */
function bars(n, heights) {
  const grid = blank(n);
  heights.forEach((h, i) => {
    for (let r = n - h; r < n; r++) grid[r][i + 1] = i;
  });
  return { grid, pictureCount: heights.length };
}

/** Chữ π: thanh ngang trên, hai chân xuống dưới. */
function pi(n) {
  const grid = blank(n);
  const top = 2;
  for (let c = 1; c <= n - 2; c++) grid[top][c] = 0;
  for (let r = top + 1; r <= n - 2; r++) { grid[r][2] = 0; grid[r][n - 3] = 0; }
  return { grid, pictureCount: 1 };
}

// Mỗi màn đặc biệt: cỡ, hình, và khoảng bậc khó chấp nhận (thấp, mong muốn).
const SPECS = {
  10: { size: 7, draw: (n) => text(n, ["1"]), rank: [1, 2] },
  20: { size: 8, draw: (n) => text(n, ["2"]), rank: [2, 2] },
  30: { size: 9, draw: (n) => text(n, ["3", "0"]), rank: [2, 4] }, // màn 30 của họ cũng bậc 4
  40: { size: 8, draw: (n) => window(n), rank: [2, 3] },
  50: { size: 9, draw: (n) => text(n, ["5", "0"]), rank: [3, 4] },
  55: { size: 9, draw: (n) => wave(n), rank: [3, 4] },
  60: { size: 9, draw: (n) => text(n, ["6", "0"]), rank: [3, 4] },
  62: { size: 7, draw: (n) => bars(n, [3, 3, 4, 5, 6, 7]), rank: [2, 4] },
  70: { size: 9, draw: (n) => text(n, ["7", "0"]), rank: [3, 4] },
  75: { size: 9, draw: (n) => pi(n), rank: [3, 4] },
  80: { size: 9, draw: (n) => text(n, ["I", "Q"]), rank: [3, 4] },
  90: { size: 9, draw: (n) => text(n, ["9", "0"]), rank: [3, 4] },
  100: { size: 10, draw: (n) => text(n, ["1tall"], 1, 1), rank: [2, 4], seconds: 300 }, // họ cũng vẽ số 1 ở màn 100
  123: { size: 9, draw: (n) => text(n, ["|", "2", "3"]), rank: [3, 4] },
  456: { size: 9, draw: (n) => text(n, ["4", "5", "6"], 0), rank: [3, 4], seconds: 300 },
};

/**
 * Rải N con hợp luật sao cho mỗi vùng vẽ hình có đúng một con; các con còn lại
 * rơi vào ô trống. Quay lui theo hàng, thứ tự cột ngẫu nhiên.
 */
function pictureSolution(n, picture, pictureCount, rand) {
  const cols = [];
  const perRegion = new Array(pictureCount).fill(0);
  let free = n - pictureCount; // số con còn được đặt ngoài hình
  const walk = (row) => {
    if (row === n) return perRegion.every((k) => k === 1);
    // Cắt sớm: các hàng còn lại phải đủ nuôi những vùng hình còn thiếu.
    const missing = perRegion.filter((k) => k === 0).length;
    if (missing > n - row) return false;
    for (const c of shuffled([...Array(n).keys()], rand)) {
      if (cols.includes(c)) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      const p = picture[row][c];
      if (p >= 0) { if (perRegion[p]) continue; perRegion[p]++; }
      else { if (!free) continue; free--; }
      cols.push(c);
      if (walk(row + 1)) return true;
      cols.pop();
      if (p >= 0) perRegion[p]--; else free++;
    }
    return false;
  };
  return walk(0) ? cols : null;
}

/** Bảng màu: nét vẽ lấy màu đậm nổi bật, phần lấp lấy các màu còn lại. */
const STRONG = [0, 1, 3, 7, 9, 2];
const SOFT = [4, 5, 6, 8, 10, 11, 2, 9, 7, 3, 1, 0];
function colourMap(n, pictureRegions) {
  const cm = new Array(n);
  let s = 0, o = 0;
  for (let id = 0; id < n; id++) cm[id] = pictureRegions.has(id) ? STRONG[s++ % STRONG.length] : SOFT[o++ % SOFT.length];
  return cm;
}

function buildSpecial(level, spec) {
  const n = spec.size;
  const { grid: picture, pictureCount } = spec.draw(n);
  const locked = (r, c) => picture[r][c] >= 0;
  let best = null;
  const started = Date.now();
  // Mỗi màn tối đa hai phút; không ra thì dùng bàn gần nhất hoặc bỏ (dùng màn thường).
  for (let seed = 1; seed < 40000 && Date.now() - started < (spec.seconds || 120) * 1000; seed++) {
    const rand = rng(level * 7919 + seed);
    const solution = pictureSolution(n, picture, pictureCount, rand);
    if (!solution) continue;

    // Vùng hình p có con ở hàng r_p → đổi nhãn vùng đó thành r_p, vì bộ sinh gọi
    // vùng theo hàng của con vật. Vùng hình không được nuôi thêm ô nào.
    const label = new Array(pictureCount);
    solution.forEach((c, r) => { if (picture[r][c] >= 0) label[picture[r][c]] = r; });
    const fixed = picture.map((row) => row.map((p) => (p >= 0 ? label[p] : -1)));
    const frozen = new Set(label);
    const regions = growRegions(n, solution, rand, fixed, frozen);
    if (!regions) continue;

    const level_ = finish(n, regions, solution, rand, null, locked);
    if (!level_) continue;
    const [lo, hi] = spec.rank;
    if (level_.r < lo || level_.r > hi) { if (!best || Math.abs(level_.r - hi) < Math.abs(best.r - hi)) best = { ...level_, off: true }; continue; }
    best = { ...level_, cm: colourMap(n, frozen), pic: [...frozen] };
    if (level_.r === hi) break;
  }
  return best;
}

const file = new URL("../data/specials.json", import.meta.url);
const force = process.argv.includes("--force");
const out = !force && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
for (const [level, spec] of Object.entries(SPECS)) {
  if (!SPECIAL_LEVELS[level]) throw new Error(`màn ${level} không có trong SPECIAL_LEVELS`);
  if (out[level]) { console.log(`bỏ qua màn ${level}: đã có (dùng --force để dựng lại)`); continue; }
  const started = Date.now();
  const built = buildSpecial(Number(level), spec);
  if (!built || built.off) { console.log(`THIEU màn ${level} (${SPECIAL_LEVELS[level]}): ${built ? `chỉ ra bậc ${built.r}` : "không dựng được"}`); continue; }
  const { pic, ...record } = built;
  out[level] = { size: spec.size, record, pic };
  const rows = [];
  for (let r = 0; r < spec.size; r++) rows.push(record.m.slice(r * spec.size, (r + 1) * spec.size));
  console.log(`ok màn ${String(level).padStart(3)} ${SPECIAL_LEVELS[level].padEnd(6)} ${spec.size}×${spec.size} bậc ${record.r} · ${record.st} bước · ${((Date.now() - started) / 1000).toFixed(1)}s\n   ${rows.join("\n   ")}`);
}
writeFileSync(file, JSON.stringify(out));
console.log(`data/specials.json · ${Object.keys(out).length}/${Object.keys(SPECS).length} màn`);
