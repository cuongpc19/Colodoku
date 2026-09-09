// Tự sinh level, để thay hẳn bộ dữ liệu giải mã từ APK của Meowdoku.
//
// Cách làm, đúng ba bước:
//   1. Rải N con vật hợp luật (mỗi hàng/cột một con, không con nào kề nhau).
//   2. Nuôi N vùng màu từ chính N ô đó cho tới khi phủ kín bàn — nên mỗi vùng
//      chắc chắn chứa đúng một con. Mỗi vùng được giao trước một cỡ đích, lấy
//      từ hồ sơ hình dạng của bản gốc (data/reference/shape-profile.json): bao
//      nhiêu vùng 1 ô, 2 ô, 3 ô, vùng nền lớn cỡ nào, ô đơn có hay ở biên không
//      — nên bàn sinh ra chia vùng y hệt cách bản gốc chia ở cùng cỡ và bậc.
//   3. Chấm độ khó bằng thang 5 cấp trong src/solver.js, đúng thang Meowdoku
//      dùng; lời giải phải duy nhất.
//
//   node tools/generate_levels.mjs --size 8 --count 20 --rating 3

import { readFileSync } from "node:fs";
import { Puzzle } from "../src/puzzle.js";
import { State, nextDeduction } from "../src/solver.js";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Bộ sinh số giả ngẫu nhiên có hạt giống, để sinh lại y hệt khi cần. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const shuffled = (list, rand) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ------------------------------------------------------------ hồ sơ hình dạng

let profileCache = null;
/** Hồ sơ hình dạng rút từ bản gốc (tools/profile_shapes.mjs). */
export function loadProfile() {
  if (!profileCache)
    profileCache = JSON.parse(readFileSync(new URL("../data/reference/shape-profile.json", import.meta.url), "utf8"));
  return profileCache;
}

// Hai chỉ số quyết định bàn chơi *cảm thấy* khó hay dễ — thang 5 cấp trong
// solver.js mù với cả hai: số vùng ≤2 ô (mỗi vùng như vậy tặng không một con)
// và tỉ lệ ô mà vùng lớn nhất chiếm (vùng nền càng phình thì càng ít ràng buộc
// thật). Kho được dựng theo đúng tỉ lệ hai chỉ số này của bản gốc, xem
// tools/build_pools.mjs.
const SHARE_BUCKETS = [25, 40, 55, 70];

/** Tầng của một khuôn: "số vùng ≤2 ô | bậc phình của vùng lớn nhất". */
export function shapeKey(sizes) {
  const total = sizes.reduce((a, b) => a + b, 0);
  const share = (sizes[sizes.length - 1] / total) * 100;
  const bucket = SHARE_BUCKETS.findIndex((limit) => share < limit);
  return `${sizes.filter((s) => s <= 2).length}|${bucket === -1 ? SHARE_BUCKETS.length : bucket}`;
}

/**
 * Khuôn mà máy chọn màn có thể phục vụ thật. Bản gốc chốt tối đa 2 vùng 1 ô
 * (xem singleLimit trong src/progression.js) nên khuôn nhiều hơn thế có nằm
 * trong bank cũng không bao giờ tới tay người chơi — không tính vào tỉ lệ đích,
 * và cũng không sinh làm gì.
 */
export const servable = (sizes) => sizes.filter((s) => s === 1).length <= 2;

/** Tần suất từng tầng trong bản gốc, giảm dần. */
export function shapeStrata(size, rating) {
  const entry = loadProfile().profile[`${size}x${rating}`];
  if (!entry) throw new Error(`hồ sơ hình dạng không có tổ hợp ${size}x${rating}`);
  const weight = new Map();
  for (const [sig, n] of Object.entries(entry.shapes)) {
    const sizes = sig.split(",").map(Number);
    if (!servable(sizes)) continue;
    const key = shapeKey(sizes);
    weight.set(key, (weight.get(key) || 0) + n);
  }
  return [...weight].sort((a, b) => b[1] - a[1]);
}

/**
 * Rút một "khuôn" cho cỡ lưới và bậc khó này theo đúng tần suất bản gốc dùng:
 * danh sách cỡ vùng (tăng dần) và xác suất ô đơn nằm ở cạnh / ở góc.
 */
export function pickShape(size, rating, rand, stratum = null) {
  const entry = loadProfile().profile[`${size}x${rating}`];
  if (!entry) throw new Error(`hồ sơ hình dạng không có tổ hợp ${size}x${rating}`);
  const shapes = Object.entries(entry.shapes).filter(([sig]) => {
    if (!stratum) return true;
    const sizes = sig.split(",").map(Number);
    return servable(sizes) && shapeKey(sizes) === stratum;
  });
  if (!shapes.length) throw new Error(`hồ sơ ${size}x${rating} không có tầng ${stratum}`);
  const total = shapes.reduce((a, [, n]) => a + n, 0);
  let pick = rand() * total;
  let signature = shapes[shapes.length - 1][0];
  for (const [sig, n] of shapes) {
    pick -= n;
    if (pick < 0) { signature = sig; break; }
  }
  return { sizes: signature.split(",").map(Number), edgeShare: entry.edgeShare, cornerShare: entry.cornerShare };
}

/** Chữ ký cỡ vùng của một lưới, để so với cỡ đích. */
export const shapeOf = (regions) => {
  const counts = new Map();
  for (const row of regions) for (const v of row) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.values()].sort((a, b) => a - b);
};

// ------------------------------------------------------------------- sinh

/** Bước 1: một cách rải N con hợp luật, tìm bằng quay lui theo thứ tự ngẫu nhiên. */
export function randomSolution(n, rand) {
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
 * Giao cỡ đích cho từng vùng của bàn đã nuôi xong (vùng i mọc từ con ở hàng i).
 * Vùng cỡ 1 được giao cho con ở góc / ở cạnh / ở trong theo đúng xác suất của
 * bản gốc; cỡ còn lại ghép theo thứ hạng — vùng đang to nhất nhận cỡ đích to
 * nhất — để bước nắn phải chuyển ít ô nhất.
 */
export function assignTargets(n, solution, shape, rand, grown) {
  const target = new Array(n).fill(0);
  const where = solution.map((c, r) => {
    const edge = r === 0 || c === 0 || r === n - 1 || c === n - 1;
    const corner = (r === 0 || r === n - 1) && (c === 0 || c === n - 1);
    return corner ? "corner" : edge ? "edge" : "inner";
  });
  const free = new Set(solution.keys());
  const singles = shape.sizes.filter((s) => s === 1).length;
  for (let i = 0; i < singles; i++) {
    const roll = rand();
    const want = roll < shape.cornerShare ? "corner" : roll < shape.cornerShare + shape.edgeShare ? "edge" : "inner";
    const pool = [...free].filter((r) => where[r] === want);
    const pick = (pool.length ? pool : [...free])[Math.floor(rand() * (pool.length || free.size))];
    target[pick] = 1;
    free.delete(pick);
  }
  const have = new Array(n).fill(0);
  for (const row of grown) for (const v of row) have[v]++;
  const byHave = [...free].sort((a, b) => have[b] - have[a]);
  const rest = shape.sizes.filter((s) => s !== 1).sort((a, b) => b - a);
  byHave.forEach((r, i) => (target[r] = rest[i]));
  return target;
}

/**
 * Bước 2a: nuôi vùng tự do từ N hạt giống cho tới khi phủ kín bàn. Mỗi vòng
 * chọn ngẫu nhiên một vùng còn lấn được rồi lấn sang một ô trống kề nó.
 * `fixed` là lưới đã có sẵn vài ô (hình vẽ ở màn đặc biệt) và `frozen` là
 * những vùng không được nuôi thêm.
 */
export function growRegions(n, solution, rand, fixed = null, frozen = new Set()) {
  const grid = fixed ? fixed.map((row) => [...row]) : Array.from({ length: n }, () => new Array(n).fill(-1));
  solution.forEach((c, r) => (grid[r][c] = r));

  const frontier = solution.map(() => []);
  const push = (region, r, c) => {
    if (r < 0 || c < 0 || r >= n || c >= n || grid[r][c] !== -1) return;
    frontier[region].push([r, c]);
  };
  solution.forEach((c, r) => {
    push(r, r - 1, c); push(r, r + 1, c); push(r, r, c - 1); push(r, r, c + 1);
  });

  let left = 0;
  for (const row of grid) for (const v of row) if (v === -1) left++;
  while (left > 0) {
    const alive = [];
    for (let i = 0; i < n; i++) {
      if (frozen.has(i)) continue; // vùng vẽ hình: giữ nguyên
      frontier[i] = frontier[i].filter(([r, c]) => grid[r][c] === -1);
      if (frontier[i].length) alive.push(i);
    }
    if (!alive.length) return null; // còn ô trống mà không vùng nào với tới
    const region = alive[Math.floor(rand() * alive.length)];
    const open = frontier[region];
    const [r, c] = open[Math.floor(rand() * open.length)];
    grid[r][c] = region;
    left--;
    push(region, r - 1, c); push(region, r + 1, c); push(region, r, c - 1); push(region, r, c + 1);
  }
  return grid;
}

/**
 * Bước 2b: nắn bàn đã phủ kín về đúng cỡ đích `target[i]` của từng vùng, bằng
 * cách chuyển từng ô biên từ vùng đang thừa sang vùng kề đang thiếu. Không bao
 * giờ chuyển ô có con vật, không làm vùng đứt khúc, không đụng ô `locked`.
 * Bí thì trả về null.
 */
export function fitTargets(n, grid, solution, target, rand, locked = () => false, maxMoves = 3 * n * n) {
  const have = new Array(n).fill(0);
  for (const row of grid) for (const v of row) have[v]++;

  for (let move = 0; move < maxMoves; move++) {
    const donors = new Set(), receivers = new Set();
    for (let i = 0; i < n; i++) {
      if (have[i] > target[i]) donors.add(i);
      else if (have[i] < target[i]) receivers.add(i);
    }
    if (!donors.size) return grid;

    // Mọi ô biên có thể chuyển: thuộc vùng thừa, kề vùng thiếu. Nếu không có,
    // cho chuyển qua vùng trung gian đang vừa đủ nhưng kề vùng thiếu — nó thừa
    // ra một ô rồi sẽ nhả tiếp ở vòng sau.
    const touching = (region, set) => {
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          if (grid[r][c] === region)
            for (const [i, j] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]])
              if (i >= 0 && j >= 0 && i < n && j < n && set.has(grid[i][j])) return true;
      return false;
    };
    let options = [];
    const collect = (accept) => {
      const out = [];
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const from = grid[r][c];
          if (!donors.has(from) || solution[r] === c || locked(r, c)) continue;
          const to = new Set();
          for (const [i, j] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]])
            if (i >= 0 && j >= 0 && i < n && j < n && grid[i][j] !== from && accept(grid[i][j])) to.add(grid[i][j]);
          for (const v of to) out.push([r, c, from, v]);
        }
      return out;
    };
    options = collect((v) => receivers.has(v));
    if (!options.length) {
      const relays = new Set();
      for (let i = 0; i < n; i++) if (!donors.has(i) && !receivers.has(i) && touching(i, receivers)) relays.add(i);
      options = collect((v) => relays.has(v));
    }
    if (!options.length) return null;

    // Ưu tiên chuyển cho vùng thiếu nhiều, nhưng vẫn ngẫu nhiên để không lặp mãi.
    let picked = null;
    for (const [r, c, from, to] of shuffled(options, rand)) {
      if (!stillConnected(grid, from, r, c)) continue;
      picked = [r, c, from, to];
      if (target[to] - have[to] >= 2) break;
    }
    if (!picked) return null;
    const [r, c, from, to] = picked;
    grid[r][c] = to;
    have[from]--; have[to]++;
  }
  return null;
}

/** Lời giải khác với lời giải mình định, nếu có. Dùng để biết phải vá chỗ nào. */
export function findRival(n, regions, mine) {
  const cols = new Array(n);
  let rival = null;
  // Cột và vùng đã dùng giữ trong bitmask; `differs` bật lên khi đã lệch khỏi
  // lời giải của mình, để tới hàng cuối mà vẫn chưa lệch thì cắt nhánh luôn.
  const walk = (row, usedCols, usedRegions, differs) => {
    if (rival) return;
    if (row === n) {
      if (differs) rival = cols.slice();
      return;
    }
    if (row === n - 1 && !differs) {
      for (let c = 0; c < n; c++) {
        if (c === mine[row]) continue;
        const bitC = 1 << c, bitR = 1 << regions[row][c];
        if ((usedCols & bitC) || (usedRegions & bitR)) continue;
        if (Math.abs(cols[row - 1] - c) <= 1) continue;
        cols[row] = c;
        rival = cols.slice();
        return;
      }
      return;
    }
    for (let c = 0; c < n; c++) {
      const bitC = 1 << c, bitR = 1 << regions[row][c];
      if ((usedCols & bitC) || (usedRegions & bitR)) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      cols[row] = c;
      walk(row + 1, usedCols | bitC, usedRegions | bitR, differs || c !== mine[row]);
      if (rival) return;
    }
  };
  walk(0, 0, 0, false);
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
 *
 * `locked(r, c)` = true là ô không được đụng (vùng vẽ hình ở màn đặc biệt).
 * Mỗi lần cắt làm một vùng bớt một ô, vùng kia thêm một ô, nên có thể lệch khỏi
 * cỡ đích; người gọi so lại chữ ký sau khi vá.
 */
export function forceUnique(n, regions, solution, rand, locked = () => false, maxSteps = 400) {
  for (let step = 0; step < maxSteps; step++) {
    const rival = findRival(n, regions, solution);
    if (!rival) return true;

    const targets = shuffled(
      rival.map((c, r) => [r, c]).filter(([r, c]) => solution[r] !== c && !locked(r, c)),
      rand,
    );
    let patched = false;
    for (const [r, c] of targets) {
      const from = regions[r][c];
      if (!stillConnected(regions, from, r, c)) continue;

      const neighbours = shuffled([[r-1,c],[r+1,c],[r,c-1],[r,c+1]], rand)
        .filter(([i, j]) => i >= 0 && j >= 0 && i < n && j < n && regions[i][j] !== from && !locked(i, j));
      if (!neighbours.length) continue;

      regions[r][c] = regions[neighbours[0][0]][neighbours[0][1]];
      patched = true;
      break;
    }
    if (!patched) return false; // bí, bỏ mẻ này
  }
  return false;
}

/** Bước 3: chấm độ khó — cấp kỹ thuật cao nhất mà lời giải bắt buộc phải dùng. */
export function rate(puzzle) {
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

/**
 * Sau khi vá cho duy nhất, bàn được coi là vẫn đúng khuôn nếu số vùng 1, 2, 3 ô
 * y nguyên và vùng nền chỉ xê dịch tối đa 2 ô — vá chỉ chuyển từng ô lẻ giữa
 * hai vùng lớn, không được làm mất hay sinh thêm vùng nhỏ.
 */
export function closeEnough(actual, wanted) {
  const small = (list) => [1, 2, 3].map((k) => list.filter((s) => s === k).length).join();
  if (small(actual) !== small(wanted)) return false;
  return Math.abs(actual[actual.length - 1] - wanted[wanted.length - 1]) <= 2;
}

export const pack = (regions, solution) => ({ m: regions.flat().map((i) => DIGITS[i]).join(""), s: solution });

/**
 * Một puzzle hoàn chỉnh chia vùng đúng khuôn `shape` (xem pickShape), hoặc null
 * nếu mẻ này hỏng. `strict` = false thì chấp nhận bàn lệch cỡ đích sau khi vá
 * cho duy nhất.
 */
export function generate(size, seed, shape, strict = true) {
  const rand = rng(seed);
  const solution = randomSolution(size, rand);
  if (!solution) return null;
  const grown = growRegions(size, solution, rand);
  if (!grown) return null;
  const regions = fitTargets(size, grown, solution, assignTargets(size, solution, shape, rand, grown), rand);
  if (!regions) return null;
  return finish(size, regions, solution, rand, strict ? shape.sizes : null);
}

/** Vá cho duy nhất rồi chấm điểm; dùng chung cho bàn thường lẫn màn đặc biệt. */
export function finish(size, regions, solution, rand, mustMatch = null, locked = () => false) {
  // Mọi bước của bộ giải đều là suy luận đúng — không bước nào loại đi ô thuộc
  // một lời giải nào đó. Nên giải trọn vẹn được bằng suy luận thì lời giải đã
  // là duy nhất, khỏi cần vét cạn. Đây là đường nhanh.
  let scored = rate(new Puzzle(pack(regions, solution), size));
  if (!scored) {
    if (!forceUnique(size, regions, solution, rand, locked)) return null;
    scored = rate(new Puzzle(pack(regions, solution), size));
    if (!scored) return null; // duy nhất nhưng khó quá thang kỹ thuật của mình
  }
  // Nghiệm thu cỡ vùng ở cả hai nhánh. Đường nhanh thì fitTargets đã khớp sẵn,
  // nhưng vá cho duy nhất có thể đẩy bàn lệch khuôn — mà lệch khuôn nghĩa là
  // lệch tầng, tức lệch đúng cái quyết định độ khó cảm nhận.
  if (mustMatch) {
    const actual = shapeOf(regions);
    if (!closeEnough(actual, mustMatch)) return null;
    if (shapeKey(actual) !== shapeKey(mustMatch)) return null;
  }
  return { ...pack(regions, solution), r: scored.rating, st: scored.steps, rk: scored.techniques, ch: 0 };
}

// ------------------------------------------------------------------ CLI

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};

if (process.argv[1]?.endsWith("generate_levels.mjs")) {
  const size = arg("size", 8);
  const want = arg("count", 10);
  const rating = arg("rating", 1);
  const out = [];
  const spread = [0, 0, 0, 0, 0];
  let tries = 0, grown = 0;
  const started = Date.now();
  const pickRand = rng(size * 31 + rating);

  for (let seed = 1; out.length < want && tries < want * 4000; seed++) {
    tries++;
    const level = generate(size, seed, pickShape(size, rating, pickRand));
    if (!level) continue;
    grown++;
    spread[level.r - 1]++;
    if (level.r !== rating) continue;
    out.push(level);
  }

  const ms = Date.now() - started;
  console.log(`${size}×${size} bậc ${rating}: sinh ${out.length}/${want} màn sau ${tries} lần thử (${grown} bàn hợp lệ) · ${ms}ms`);
  console.log(`  phân bố độ khó của các bàn hợp lệ: R1..R5 = ${spread.join(" / ")}`);
  if (out.length) console.log(`  ví dụ: ${JSON.stringify(out[0])}`);
}
