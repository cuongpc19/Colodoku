// Chọn năm màn mở đầu (1-5) từ bộ sinh của mình — dễ hơn cả Meowdoku.
//
// Meowdoku mở đầu bằng 4×4, 5×5, 6×6, 6×6, 8×8 bậc 1, mỗi màn tặng sẵn một con
// nằm trong vùng nhiều ô để người chơi tự tìm vùng 1 ô. Mình giữ đúng lối đó
// nhưng lưới nhỏ hơn (4, 4, 5, 5, 6) và bàn được chọn kỹ:
//   - có 1-2 vùng 1 ô (2 là mức Meowdoku cho phép ở màn đầu), vùng nền to
//   - sau con tặng sẵn, nước đầu tiên của người chơi luôn là "màu chỉ có 1 ô"
//   - giải trọn bằng cấp 1, và bỏ con tặng đi thì vẫn không quá cấp 2
//
//   node tools/pick_opening.mjs   → in ra khối SCRIPTED để dán vào src/levels.js

import { Puzzle } from "../src/puzzle.js";
import { State, nextDeduction } from "../src/solver.js";
import { generate, pickShape, rng } from "./generate_levels.mjs";
import { prefillFor, singleRegions } from "../src/progression.js";

/** Cấp kỹ thuật cao nhất phải dùng, tính từ thế cờ đã đặt sẵn `given`. */
function hardest(puzzle, given = []) {
  const st = new State(puzzle.size, puzzle.regions);
  for (const [r, c] of given) st.place(r, c);
  let max = 0;
  for (let guard = 0; !st.isComplete() && guard < 300; guard++) {
    const move = nextDeduction(st);
    if (!move) return Infinity;
    max = Math.max(max, move.rank);
    if (move.action === "place") st.place(move.cells[0][0], move.cells[0][1]);
    else for (const [r, c] of move.cells) st.cand[r][c] = false;
  }
  return st.isComplete() ? max : Infinity;
}

/**
 * Sau con tặng sẵn, người chơi phải còn ít nhất một "màu chỉ có một ô" để đặt
 * ngay — tức ô đơn đó không bị con tặng loại mất (khác hàng, khác cột, không kề).
 */
function opensWithSingle(puzzle, given) {
  const [gr, gc] = given[0];
  for (let r = 0; r < puzzle.size; r++)
    for (let c = 0; c < puzzle.size; c++) {
      const region = puzzle.regions[r][c];
      let cells = 0;
      for (const row of puzzle.regions) for (const v of row) if (v === region) cells++;
      if (cells !== 1) continue;
      if (r !== gr && c !== gc && (Math.abs(r - gr) > 1 || Math.abs(c - gc) > 1)) return true;
    }
  return false;
}

const background = (level) => {
  const counts = {};
  for (const ch of level.m) counts[ch] = (counts[ch] || 0) + 1;
  return Math.max(...Object.values(counts)) / level.m.length;
};

// Màn nào cỡ nào, muốn mấy vùng 1 ô.
const PLAN = [
  { size: 4, singles: 2 },
  { size: 4, singles: 1 },
  { size: 5, singles: 2 },
  { size: 5, singles: 1 },
  { size: 6, singles: 2 },
];

const used = new Set();
const usedSolutions = new Set();
const picks = [];
for (const [i, { size, singles }] of PLAN.entries()) {
  const level = i + 1;
  const shapeRand = rng(1000 + level);
  const candidates = [];
  for (let seed = 1; seed < 60000 && candidates.length < 40; seed++) {
    let shape;
    for (let k = 0; k < 50; k++) {
      shape = pickShape(size, 1, shapeRand);
      if (shape.sizes.filter((s) => s === 1).length === singles) break;
    }
    if (shape.sizes.filter((s) => s === 1).length !== singles) continue;
    const found = generate(size, seed, shape);
    if (!found || found.r !== 1 || used.has(found.m) || singleRegions(found.m) !== singles) continue;
    if (usedSolutions.has(found.s.join())) continue; // mỗi màn một cách rải khác nhau
    const puzzle = new Puzzle(found, size);
    const given = prefillFor(level, found, size);
    if (hardest(puzzle, given) !== 1) continue;
    if (hardest(puzzle) > 2) continue;
    if (!opensWithSingle(puzzle, given)) continue;
    candidates.push({ level: found, given, bare: hardest(puzzle) });
  }
  if (!candidates.length) { console.log(`màn ${level}: không tìm được`); continue; }
  // Nền càng to càng "nhìn là hiểu" — chọn bàn có vùng nền lớn nhất.
  candidates.sort((a, b) => background(b.level) - background(a.level));
  const best = candidates[0];
  used.add(best.level.m);
  usedSolutions.add(best.level.s.join());
  picks.push({ n: level, size, ...best });
}

for (const p of picks) {
  const rows = [];
  for (let r = 0; r < p.size; r++) rows.push(`"${p.level.m.slice(r * p.size, (r + 1) * p.size)}"`);
  console.log(`  {
    // Màn ${p.n} — ${p.size}×${p.size}, ${singleRegions(p.level.m)} vùng 1 ô, nền ${(background(p.level) * 100).toFixed(0)}%. Bỏ con tặng thì cấp ${p.bare}.
    size: ${p.size},
    given: [[${p.given[0]}]],
    record: {
      m: ${rows.join(" +\n         ")},
      s: [${p.level.s}],
      r: 1, st: ${p.level.st}, rk: [${p.level.rk}], ch: 0,
    },
  },`);
}
