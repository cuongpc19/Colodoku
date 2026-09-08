// Chạy thử tutorial và tuyến chơi mà không cần trình duyệt.
//
// Phần đầu đối chiếu với bản ghi màn hình Meowdoku 1.15.0: bàn cờ, con mèo đặt
// sẵn, lời giải và đúng những ô mà từng bước hướng dẫn bắt người chơi bấm.

import { readFileSync } from "node:fs";
import { Board, Puzzle, CAT, MARK, EMPTY } from "../src/puzzle.js";
import { Tutorial, buildSteps, tutorialPuzzle } from "../src/tutorial.js";
import { nextDeduction, stateFromBoard, State } from "../src/solver.js";
import { levelSpec, levelRecord, TOTAL_LEVELS } from "../src/progression.js";
import { SCRIPTED, TUTORIAL } from "../src/levels.js";

let failures = 0;
const check = (ok, msg) => { if (!ok) { console.error("FAIL " + msg); failures++; } };

const bankOf = (slug) =>
  JSON.parse(readFileSync(new URL(`../data/${slug}.json`, import.meta.url), "utf8"));

const asSet = (cells) => new Set(cells.map(([r, c]) => `${r},${c}`));
const sameCells = (a, b) => a.length === b.length && a.every(([r, c]) => asSet(b).has(`${r},${c}`));

/** Mọi lời giải hợp lệ, tìm bằng vét cạn — dùng để chắc màn chỉ có một đáp án. */
function allSolutions(puzzle) {
  const n = puzzle.size, out = [], cols = [], regions = new Set();
  const walk = (r) => {
    if (r === n) return out.push([...cols]);
    for (let c = 0; c < n; c++) {
      const region = puzzle.regions[r][c];
      if (cols.includes(c) || regions.has(region)) continue;
      if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      cols.push(c); regions.add(region); walk(r + 1); cols.pop(); regions.delete(region);
    }
  };
  walk(0);
  return out;
}

/** Cấp kỹ thuật cao nhất phải dùng, tính từ thế cờ đã có sẵn `given`. */
function hardestRank(puzzle, given) {
  const state = new State(puzzle.size, puzzle.regions);
  for (const [r, c] of given) state.place(r, c);
  let max = 0;
  for (let guard = 0; !state.isComplete() && guard < 200; guard++) {
    const move = nextDeduction(state);
    if (!move) return Infinity;
    max = Math.max(max, move.rank);
    if (move.action === "place") state.place(move.cells[0][0], move.cells[0][1]);
    else for (const [r, c] of move.cells) state.cand[r][c] = false;
  }
  return state.isComplete() ? max : Infinity;
}

// --- các bàn chép từ video phải giải được và chỉ có đúng một đáp án ---------
for (const [name, def] of [["tutorial", TUTORIAL], ["màn 1", SCRIPTED[0]], ["màn 2", SCRIPTED[1]]]) {
  const puzzle = new Puzzle(def.record, def.size);
  const solutions = allSolutions(puzzle);
  check(solutions.length === 1, `${name}: có ${solutions.length} lời giải, cần đúng 1`);
  check(
    JSON.stringify(solutions[0]) === JSON.stringify(def.record.s),
    `${name}: lời giải ghi trong levels.js lệch với lời giải thật`,
  );
  const rank = hardestRank(puzzle, def.given || []);
  check(rank === 1, `${name}: cần tới kỹ thuật cấp ${rank}, quá khó cho vài màn mở đầu`);
}

// --- tutorial: đi hết các bước như người chơi thật ---------------------------
const puzzle = tutorialPuzzle();
const board = new Board(puzzle);
const tutorial = new Tutorial(puzzle, board);

// Thứ tự các bước phải khớp đúng video.
check(
  tutorial.steps.map((s) => s.id).join(" → ") ===
    "place-first → rule-colour → exclude-lines → place-second → exclude-touching → place-third → find-last → done",
  "thứ tự các bước hướng dẫn lệch với bản gốc",
);

// Đúng những ô mà video bắt người chơi bấm.
const stepById = Object.fromEntries(tutorial.steps.map((s) => [s.id, s]));
check(sameCells(stepById["place-first"].focus, [[0, 2]]), "bước 1 không chỉ vào ô xanh lá");
check(
  sameCells(stepById["exclude-lines"].focus, [[0, 0], [0, 1], [0, 3], [1, 2], [2, 2], [3, 2]]),
  "bước loại theo hàng/cột không đúng 6 ô như video",
);
check(
  sameCells(stepById["exclude-touching"].focus, [[2, 0], [2, 1], [3, 0]]),
  "bước loại ô kề không đúng 3 ô như video",
);
check(String(stepById["place-second"].ring) === "3,1", "mèo thứ hai không rơi vào ô hồng đậm (3,1)");
check(String(stepById["place-third"].ring) === "1,0", "mèo thứ ba không rơi vào ô xanh (1,0)");

// Mỗi bước trỏ tới thẻ nhắc luật phải có thẻ tương ứng trong index.html.
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cards = [...html.matchAll(/data-rule="(\w+)"/g)].map((m) => m[1]);
check(cards.length === 3, `màn chơi có ${cards.length} thẻ nhắc luật, cần 3`);
const used = new Set();
for (const step of buildSteps(puzzle))
  if (step.rule) {
    check(cards.includes(step.rule), `bước "${step.id}" trỏ tới thẻ luật không có: ${step.rule}`);
    used.add(step.rule);
  }
check(used.size === cards.length, "hướng dẫn không nhắc tới đủ cả 3 thẻ luật");

check(board.cats().length === 0, "tutorial mở ra đã có mèo sẵn — bản gốc để người chơi tự đặt con đầu");

let handMarks = 0;
let handCats = 0;
let guard = 0;
while (!tutorial.done && guard++ < 60) {
  const step = tutorial.step;
  if (step.needs) {
    const kind = step.needs.value === CAT ? "cat" : "mark";
    const other = kind === "cat" ? "mark" : "cat";
    // Bấm sai kiểu vào đúng ô, hoặc bấm ô ngoài yêu cầu, đều phải bị chặn.
    const [r0, c0] = step.needs.cells[0];
    check(!tutorial.allows(r0, c0, other), `bước "${step.id}" cho bấm sai kiểu thao tác`);
    for (let r = 0; r < puzzle.size; r++)
      for (let c = 0; c < puzzle.size; c++)
        if (!step.needs.cells.some(([i, j]) => i === r && j === c))
          check(!tutorial.allows(r, c, kind), `bước "${step.id}" cho bấm ô ngoài yêu cầu`);

    // Đánh từng ô một; sau mỗi ô bước vẫn phải chưa xong cho tới ô cuối.
    const todo = tutorial.pending();
    todo.forEach(([r, c], i) => {
      check(tutorial.allows(r, c, kind), `bước "${step.id}" chặn nhầm ô nó yêu cầu`);
      board.apply([[r, c, step.needs.value]]);
      if (kind === "mark") handMarks++; else handCats++;
      check(
        tutorial.checkProgress() === (i === todo.length - 1),
        `bước "${step.id}" báo xong sai nhịp ở ô thứ ${i + 1}`,
      );
    });
    tutorial.advance();
  } else if (step.free) {
    let solveGuard = 0;
    while (!board.isSolved() && solveGuard++ < 40) {
      const move = nextDeduction(stateFromBoard(puzzle, board.cells));
      if (!move) break;
      check(move.rank === 1, "phần tự giải nốt cần kỹ thuật cao hơn cấp 1");
      if (move.action === "place") board.apply([[move.cells[0][0], move.cells[0][1], CAT]]);
      else board.apply(move.cells.map(([r, c]) => [r, c, MARK]));
    }
    check(board.isSolved(), "không giải nốt được màn tutorial");
    check(tutorial.checkProgress(), "bước tự chơi không ghi nhận khi đã thắng");
    tutorial.advance();
  } else {
    check(Boolean(step.button), `bước "${step.id}" không chờ thao tác mà cũng không có nút`);
    tutorial.advance();
  }
}
check(tutorial.done, "tutorial không đi hết được các bước");
check(handMarks === 9, `người chơi tự đánh ${handMarks} dấu ✕, video là 9`);
check(handCats === 3, `người chơi tự đặt ${handCats} mèo trong phần dẫn dắt, video là 3`);
console.log(`tutorial: ${tutorial.steps.length} bước · tự đánh ${handMarks} ✕ · tự đặt ${handCats} mèo`);

// --- màn chép từ video: đúng cỡ lưới và có con mèo mở màn -------------------
for (const [i, def] of SCRIPTED.entries()) {
  const n = i + 1;
  const loaded = await levelRecord(n);
  check(loaded.size === def.size, `màn ${n}: cỡ lưới lệch`);
  check(sameCells(loaded.given, def.given), `màn ${n}: con mèo đặt sẵn lệch`);
  for (const [r, c] of loaded.given)
    check(new Puzzle(loaded.record, loaded.size).solution[r] === c, `màn ${n}: mèo đặt sẵn không nằm trong lời giải`);
  check(levelSpec(n).size === def.size, `màn ${n}: levelSpec báo sai cỡ lưới`);
}

// --- tuyến chơi: mọi màn còn lại phải trỏ tới một puzzle có thật ------------
const seen = new Map();
for (let n = SCRIPTED.length + 1; n <= TOTAL_LEVELS; n++) {
  const spec = levelSpec(n);
  check(spec !== null, `màn ${n} không có trong tuyến chơi`);
  if (!spec) continue;
  const bank = seen.get(spec.slug) || seen.set(spec.slug, bankOf(spec.slug)).get(spec.slug);
  const list = bank.tiers[spec.rating] || bank.tiers[String(spec.rating + 1)];
  check(list && list.length > 0, `màn ${n}: bank ${spec.slug} không có bậc ${spec.rating}`);
  if (!list) continue;
  const level = new Puzzle(list[spec.offset % list.length], bank.size);
  check(level.size === spec.size, `màn ${n}: kích thước lưới lệch với tuyến chơi`);
}
check(levelSpec(TOTAL_LEVELS + 1) === null, "tuyến chơi không kết thúc đúng chỗ");

// Độ khó phải đi lên, chỉ trừ các màn nhịp nghỉ cố ý hạ một bậc.
let regressions = 0;
for (let n = SCRIPTED.length + 2; n <= TOTAL_LEVELS; n++) {
  const prev = levelSpec(n - 1);
  const now = levelSpec(n);
  const weight = (s) => s.size * 10 + s.rating;
  if (weight(now) < weight(prev) && !now.breather) regressions++;
}
check(regressions === 0, `${regressions} màn tụt độ khó ngoài ý muốn`);

console.log(`tuyến chơi: ${TOTAL_LEVELS} màn · ${failures} lỗi`);
process.exit(failures ? 1 : 0);
