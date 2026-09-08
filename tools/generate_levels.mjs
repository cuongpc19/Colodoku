// Tự sinh level, để thay hẳn bộ dữ liệu giải mã từ APK của Meowdoku.
//
// Cách làm, đúng ba bước:
//   1. Rải N con vật hợp luật (mỗi hàng/cột một con, không con nào kề nhau).
//   2. Nuôi N vùng màu từ chính N ô đó cho tới khi phủ kín bàn — nên mỗi vùng
//      chắc chắn chứa đúng một con.
//   3. Vét cạn kiểm tra lời giải có duy nhất không; rồi chấm độ khó bằng thang
//      5 cấp trong src/solver.js, đúng thang Meowdoku dùng.
//
// Bước 2 quyết định độ khó: vùng nuôi càng "loang" thì càng dễ suy, vùng bị ép
// thành dải dài hẹp thì càng khó. `bias` điều khiển chuyện đó.
//
//   node tools/generate_levels.mjs --size 8 --count 20 --rating 3

import { Puzzle } from "../src/puzzle.js";
import { State, nextDeduction } from "../src/solver.js";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Bộ sinh số giả ngẫu nhiên có hạt giống, để sinh lại y hệt khi cần. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const shuffled = (list, rand) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Bước 1: một cách rải N con hợp luật, tìm bằng quay lui theo thứ tự ngẫu nhiên. */
function randomSolution(n, rand) {
  const cols = [];
  const walk = (row) => {
    if (row === n) return true;
    for (const c of shuffled([...Array(n).keys()], rand)) {
      if (cols.includes(c)) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      cols.push(c);
      if (walk(row + 1)) return true;
      cols.pop();
    }
    return false;
  };
  return walk(0) ? cols : null;
}

/**
 * Bước 2: nuôi vùng từ N hạt giống. Mỗi vòng chọn một vùng rồi lấn sang một ô
 * trống kề nó. `bias` gần 1 thì ưu tiên vùng đang nhỏ (các vùng đều nhau, dễ);
 * gần 0 thì chọn ngẫu nhiên (vùng méo mó, khó hơn).
 */
function growRegions(n, solution, rand, bias) {
  const grid = Array.from({ length: n }, () => new Array(n).fill(-1));
  solution.forEach((c, r) => (grid[r][c] = r));

  const frontier = solution.map(() => []);
  const sizes = solution.map(() => 1);
  const push = (region, r, c) => {
    if (r < 0 || c < 0 || r >= n || c >= n || grid[r][c] !== -1) return;
    frontier[region].push([r, c]);
  };
  solution.forEach((c, r) => {
    push(r, r - 1, c); push(r, r + 1, c); push(r, r, c - 1); push(r, r, c + 1);
  });

  let left = n * n - n;
  while (left > 0) {
    const alive = [...Array(n).keys()].filter((i) => frontier[i].some(([r, c]) => grid[r][c] === -1));
    if (!alive.length) return null; // bàn bị chia cắt, bỏ mẻ này
    const region = rand() < bias
      ? alive.reduce((a, b) => (sizes[a] <= sizes[b] ? a : b))
      : alive[Math.floor(rand() * alive.length)];

    const open = frontier[region].filter(([r, c]) => grid[r][c] === -1);
    const [r, c] = open[Math.floor(rand() * open.length)];
    grid[r][c] = region;
    sizes[region]++;
    left--;
    frontier[region] = open.filter(([i, j]) => i !== r || j !== c);
    push(region, r - 1, c); push(region, r + 1, c); push(region, r, c - 1); push(region, r, c + 1);
  }
  return grid;
}

/** Bước 3a: đếm lời giải, dừng sớm khi đã thấy cái thứ hai. */
function countSolutions(n, regions, cap = 2) {
  let found = 0;
  const cols = [], used = new Set();
  const walk = (row) => {
    if (found >= cap) return;
    if (row === n) return void found++;
    for (let c = 0; c < n; c++) {
      const region = regions[row][c];
      if (cols.includes(c) || used.has(region)) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      cols.push(c); used.add(region);
      walk(row + 1);
      cols.pop(); used.delete(region);
    }
  };
  walk(0);
  return found;
}

/** Lời giải khác với lời giải mình định, nếu có. Dùng để biết phải vá chỗ nào. */
function findRival(n, regions, mine) {
  const cols = [], used = new Set();
  let rival = null;
  const walk = (row) => {
    if (rival) return;
    if (row === n) {
      if (cols.some((c, r) => c !== mine[r])) rival = [...cols];
      return;
    }
    for (let c = 0; c < n; c++) {
      const region = regions[row][c];
      if (cols.includes(c) || used.has(region)) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      cols.push(c); used.add(region);
      walk(row + 1);
      cols.pop(); used.delete(region);
    }
  };
  walk(0);
  return rival;
}

/** Vùng có còn liền một khối không nếu bỏ ô (br,bc) ra. */
function stillConnected(regions, region, br, bc) {
  const n = regions.length;
  const cells = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (regions[r][c] === region && !(r === br && c === bc)) cells.push([r, c]);
  if (cells.length === 0) return false;

  const seen = new Set([cells[0].join()]);
  const queue = [cells[0]];
  while (queue.length) {
    const [r, c] = queue.pop();
    for (const [i, j] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      if (regions[i][j] !== region || (i === br && j === bc)) continue;
      if (seen.has(`${i},${j}`)) continue;
      seen.add(`${i},${j}`);
      queue.push([i, j]);
    }
  }
  return seen.size === cells.length;
}

/**
 * Vá cho tới khi lời giải là duy nhất: tìm một lời giải đối thủ, rồi cắt một ô
 * mà nó dùng sang vùng bên cạnh — làm vậy là phá đúng lời giải đó mà không đụng
 * tới lời giải của mình. Lặp lại cho tới khi hết đối thủ.
 */
function forceUnique(n, regions, solution, rand, maxSteps = 400) {
  for (let step = 0; step < maxSteps; step++) {
    const rival = findRival(n, regions, solution);
    if (!rival) return true;

    // Những ô mà đối thủ dùng còn mình thì không — cắt một trong số đó.
    const targets = shuffled(
      rival.map((c, r) => [r, c]).filter(([r, c]) => solution[r] !== c),
      rand,
    );
    let patched = false;
    for (const [r, c] of targets) {
      const from = regions[r][c];
      if (solution[r] === c) continue;            // đừng đụng ô của lời giải mình
      if (!stillConnected(regions, from, r, c)) continue;

      const neighbours = shuffled([[r-1,c],[r+1,c],[r,c-1],[r,c+1]], rand)
        .filter(([i, j]) => i >= 0 && j >= 0 && i < n && j < n && regions[i][j] !== from);
      if (!neighbours.length) continue;

      regions[r][c] = regions[neighbours[0][0]][neighbours[0][1]];
      patched = true;
      break;
    }
    if (!patched) return false; // bí, bỏ mẻ này
  }
  return false;
}

/** Bước 3b: chấm độ khó — cấp kỹ thuật cao nhất mà lời giải bắt buộc phải dùng. */
function rate(puzzle) {
  const state = new State(puzzle.size, puzzle.regions);
  const counts = [0, 0, 0, 0, 0];
  let steps = 0, max = 0;
  while (!state.isComplete()) {
    const move = nextDeduction(state);
    if (!move) return null; // không giải nổi bằng suy luận thuần
    counts[move.rank - 1]++;
    steps++;
    max = Math.max(max, move.rank);
    if (move.action === "place") state.place(move.cells[0][0], move.cells[0][1]);
    else for (const [r, c] of move.cells) state.cand[r][c] = false;
  }
  return { rating: max, steps, techniques: counts };
}

/** Một puzzle hoàn chỉnh, hoặc null nếu mẻ này hỏng. */
export function generate(size, seed, bias) {
  const rand = rng(seed);
  const solution = randomSolution(size, rand);
  if (!solution) return null;
  const regions = growRegions(size, solution, rand, bias);
  if (!regions) return null;
  if (!forceUnique(size, regions, solution, rand)) return null;
  if (countSolutions(size, regions) !== 1) return null; // kiểm lại cho chắc

  const record = { m: regions.flat().map((i) => DIGITS[i]).join(""), s: solution };
  const scored = rate(new Puzzle(record, size));
  if (!scored) return null;
  return { ...record, r: scored.rating, st: scored.steps, rk: scored.techniques, ch: 0 };
}

// ------------------------------------------------------------------ CLI

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};

if (process.argv[1]?.endsWith("generate_levels.mjs")) {
  const size = arg("size", 8);
  const want = arg("count", 10);
  const rating = arg("rating", 0); // 0 = nhận mọi bậc
  const out = [];
  const spread = [0, 0, 0, 0, 0];
  let tries = 0;
  const started = Date.now();

  for (let seed = 1; out.length < want && tries < want * 4000; seed++) {
    tries++;
    // Trộn nhiều `bias` để có đủ cả màn dễ lẫn màn khó.
    const level = generate(size, seed, (seed % 10) / 12);
    if (!level) continue;
    spread[level.r - 1]++;
    if (rating && level.r !== rating) continue;
    out.push(level);
  }

  const ms = Date.now() - started;
  console.log(`${size}×${size}: sinh ${out.length}/${want} màn sau ${tries} lần thử · ${ms}ms`);
  console.log(`  phân bố độ khó của mọi màn hợp lệ: R1..R5 = ${spread.join(" / ")}`);
  if (out.length) console.log(`  ví dụ: ${JSON.stringify(out[0])}`);
}
