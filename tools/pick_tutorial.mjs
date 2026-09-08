// Chọn bàn hướng dẫn từ bộ sinh của mình — khác hẳn bàn của Meowdoku, nhưng
// dạy đúng ngần ấy thứ và cũng chỉ cần kỹ thuật cấp 1.
//
// Điều kiện, kiểm bằng chính planTutorial() và lớp Tutorial mà game dùng:
//   - 4×4, giải trọn bằng cấp 1, lời giải duy nhất
//   - có vùng chỉ một ô để đặt con đầu; hàng+cột của nó cho đủ 6 ô tập nhấn
//   - hai lượt vuốt, mỗi lượt ít nhất 2 ô, và các ô trong một lượt phải kề nhau
//     thành một đường liền (không thì cử chỉ vuốt vô nghĩa)
//   - lượt vuốt thứ nhất phải *cần thiết*: chưa vuốt thì chưa suy ra con thứ ba
//   - con thứ hai phải suy ra được (vùng nhiều hơn một ô), không phải quà tặng
//   - vuốt xong còn 2-3 ô để tự tìm con kiến cuối
//   - bàn khác bàn của Meowdoku, kể cả sau khi xoay/lật
//
//   node tools/pick_tutorial.mjs

import { Board, Puzzle, CAT, MARK } from "../src/puzzle.js";
import { State, nextDeduction, stateFromBoard } from "../src/solver.js";
import { generate, pickShape, rng } from "./generate_levels.mjs";
import { planTutorial, buildSteps, Tutorial } from "../src/tutorial.js";
import { transformRecord } from "../src/progression.js";

const SIZE = 4;

// Bàn hướng dẫn của Meowdoku, để chắc chắn không trùng nó dưới bất kỳ phép
// xoay/lật nào. Chỉ dùng để loại trừ, không dùng để phát hành.
const THEIRS = { m: "1102" + "1112" + "1112" + "1332", s: [2, 0, 3, 1] };
const theirShapes = new Set();
for (let t = 0; t < 8; t++) theirShapes.add(normalise(transformRecord(THEIRS, SIZE, t).m));

/** Đổi tên vùng theo thứ tự gặp, để so hai bàn cùng hình mà khác số hiệu màu. */
function normalise(m) {
  const map = new Map();
  return [...m].map((ch) => {
    if (!map.has(ch)) map.set(ch, map.size);
    return map.get(ch);
  }).join("");
}

/** Cấp kỹ thuật cao nhất phải dùng để giải trọn bàn. */
function hardest(puzzle) {
  const st = new State(puzzle.size, puzzle.regions);
  let max = 0;
  for (let guard = 0; !st.isComplete() && guard < 200; guard++) {
    const move = nextDeduction(st);
    if (!move) return Infinity;
    max = Math.max(max, move.rank);
    if (move.action === "place") st.place(move.cells[0][0], move.cells[0][1]);
    else for (const [r, c] of move.cells) st.cand[r][c] = false;
  }
  return st.isComplete() ? max : Infinity;
}

/**
 * Ngón tay kéo từ ô này sang ô kia có thành một nét liền không: hoặc hai ô kề
 * nhau (kể cả chéo), hoặc cách đúng một ô nhưng thẳng hàng — nhịp đó vẫn là
 * một cú vuốt thẳng, ô ở giữa thường chính là con kiến vừa đặt. Kéo ngang qua
 * ô có kiến không sinh chuyện gì: onPointerMove chỉ đánh dấu ô còn trống.
 */
const isPath = (cells) =>
  cells.every(([r, c], i) => {
    if (i === 0) return true;
    const dr = Math.abs(r - cells[i - 1][0]);
    const dc = Math.abs(c - cells[i - 1][1]);
    if (dr <= 1 && dc <= 1) return true;
    const straight = dr === 0 || dc === 0 || dr === dc;
    return straight && Math.max(dr, dc) === 2;
  });

/** Chạy trọn hướng dẫn đúng như người chơi bấm; trả về số ✕ và số kiến tự đặt. */
function playThrough(puzzle) {
  const board = new Board(puzzle);
  const tutorial = new Tutorial(puzzle, board);
  let marks = 0, ants = 0, guard = 0;
  while (!tutorial.done && guard++ < 40) {
    const step = tutorial.step;
    if (step.needs) {
      for (const [r, c] of tutorial.pending()) {
        board.apply([[r, c, step.needs.value]]);
        if (step.needs.value === MARK) marks++; else ants++;
      }
      if (!tutorial.checkProgress()) return null;
    } else if (step.free) {
      let inner = 0;
      while (!board.isSolved() && inner++ < 20) {
        const move = nextDeduction(stateFromBoard(puzzle, board.cells));
        if (!move || move.rank !== 1) break;
        if (move.action === "place") board.apply([[move.cells[0][0], move.cells[0][1], CAT]]);
        else board.apply(move.cells.map(([r, c]) => [r, c, MARK]));
      }
      if (!board.isSolved()) return null;
    }
    tutorial.advance();
  }
  return tutorial.done ? { marks, ants } : null;
}

/** Cỡ từng vùng, theo số hiệu vùng. */
function regionSizes(m) {
  const count = new Map();
  for (const ch of m) count.set(ch, (count.get(ch) || 0) + 1);
  return [...count.values()];
}

/** Bàn này có dạy được trọn nhịp 9 bước không. */
function fits(puzzle, m) {
  if (hardest(puzzle) !== 1) return null;

  const sizes = regionSizes(m);
  // Đúng một vùng chỉ có một ô: nước đầu tiên phải không thể nhầm. Hai vùng
  // một ô thì người mới dễ bấm vào cái kia rồi bị hướng dẫn chặn, cụt hứng.
  if (sizes.filter((n) => n === 1).length !== 1) return null;
  // Vùng nền cỡ 10/16 ô. Đo hết bàn 4×4 dạy được thì nền luôn là 10 hoặc 11 —
  // muốn hai lượt vuốt ra hồn thì phải có chỗ trống, nên đành rộng hơn bản gốc
  // (9/16) một ô. Quá 10 thì bàn bắt đầu nhợt nhạt.
  if (Math.max(...sizes) > 10) return null;

  const plan = planTutorial(puzzle);
  if (!plan) return null;
  // Con thứ hai phải *suy ra được* chứ không phải quà tặng: vùng của nó nhiều
  // hơn một ô, tức chính mấy dấu ✕ vừa đánh mới ép nó về một ô. Đó là bài học
  // của bước này; vùng một ô thì chỉ lặp lại bài của bước 1.
  const secondColour = m[plan.second[0] * SIZE + plan.second[1]];
  if ([...m].filter((ch) => ch === secondColour).length < 2) return null;
  if (plan.lines.length !== 2 * (SIZE - 1)) return null; // đủ 6 ô tập nhấn
  if (plan.swipeOne.length < 2 || plan.swipeTwo.length < 2) return null;
  if (!isPath(plan.swipeOne) || !isPath(plan.swipeTwo)) return null;

  // Lượt vuốt 1 phải cần thiết: bỏ nó đi thì chưa suy ra được con thứ ba.
  const beforeSwipe = new Set([plan.first, plan.second, ...plan.lines].map(([r, c]) => `${r},${c}`));
  const openCount = (cell) => {
    const region = puzzle.regionAt(...cell);
    let n = 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (puzzle.regions[r][c] === region && !beforeSwipe.has(`${r},${c}`)) n++;
    return n;
  };
  if (openCount(plan.third) === 1) return null;

  // Bước cuối phải còn việc để làm, nhưng đừng nhiều: 2-3 ô trống là vừa — có
  // một suy luận thật để tự tìm con kiến cuối, chứ không phải nhặt ô duy nhất
  // còn sót. (Trên 4×4 tổng hai lượt vuốt tối đa là 5 ô nên không bao giờ còn
  // đúng 1 ô; đòi thế là tự loại hết bàn.)
  const done = new Set([plan.first, plan.second, plan.third, ...plan.lines, ...plan.swipeOne, ...plan.swipeTwo]
    .map(([r, c]) => `${r},${c}`));
  const left = SIZE * SIZE - done.size;
  if (left < 2 || left > 3) return null;

  let steps;
  try {
    steps = buildSteps(puzzle);
  } catch {
    return null;
  }
  if (steps.filter((s) => s.gesture === "swipe").length !== 2) return null;

  const played = playThrough(puzzle);
  if (!played) return null;
  return { plan, played, steps };
}

// ------------------------------------------------------------------ tìm

const shapeRand = rng(20260909);
const found = [];
const seen = new Set(); // bộ sinh hay ra đi ra lại cùng một hình
for (let seed = 1; seed < 200000 && found.length < 40; seed++) {
  const level = generate(SIZE, seed, pickShape(SIZE, 1, shapeRand));
  if (!level || level.r !== 1) continue;
  const shape = normalise(level.m);
  if (theirShapes.has(shape) || seen.has(shape)) continue; // trùng bàn của họ, hoặc trùng bàn đã xét
  seen.add(shape);
  const puzzle = new Puzzle(level, SIZE);
  const ok = fits(puzzle, level.m);
  if (ok) found.push({ level, ...ok });
}

if (!found.length) {
  console.log("không tìm được bàn nào hợp nhịp 9 bước");
} else {
  // Ưu tiên tổng số ô vuốt nhiều nhất, rồi tới lượt đầu dài hơn — lần tập vuốt
  // đầu tiên nên là một nét đầy đặn, lượt sau ngắn hơn cũng được.
  const total = (x) => x.plan.swipeOne.length + x.plan.swipeTwo.length;
  found.sort((a, b) => total(b) - total(a) || b.plan.swipeOne.length - a.plan.swipeOne.length);
  console.log(`(quét ${seen.size} hình bàn khác nhau)`);
  console.log(`${found.length} bàn hợp lệ; ba bàn tốt nhất:\n`);
  for (const { level, plan, played } of found.slice(0, 3)) {
    const rows = [];
    for (let r = 0; r < SIZE; r++) rows.push(level.m.slice(r * SIZE, (r + 1) * SIZE));
    console.log(rows.join("\n"));
    console.log(`  lời giải [${level.s}] · nhấn ${plan.lines.length} ô · vuốt ${plan.swipeOne.length} rồi ${plan.swipeTwo.length} ô`);
    console.log(`  con đầu ${plan.first} · thứ hai ${plan.second} · thứ ba ${plan.third} · cuối ${plan.last}`);
    console.log(`  chạy thử: tự đánh ${played.marks} ✕, tự đặt ${played.ants} con\n`);
  }
  const best = found[0];
  const rows = [];
  for (let r = 0; r < SIZE; r++) rows.push(`"${best.level.m.slice(r * SIZE, (r + 1) * SIZE)}"`);
  console.log("Khối để dán vào src/levels.js:\n");
  console.log(`  record: {
    m: ${rows.join(" +\n       ")},
    s: [${best.level.s}],
    r: 1, st: ${best.level.st}, rk: [${best.level.rk}], ch: 0,
  },`);
}
