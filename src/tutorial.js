// Hướng dẫn cho người mới — dựng lại đúng từng bước tutorial của Meowdoku
// 1.15.0, đối chiếu khung hình trong bản ghi màn hình:
//
//   1. Đặt con mèo đầu tiên vào ô xanh lá (ô duy nhất của vùng đó)
//   2. Thẻ "Well done! Only one cat per color." + nút Got it!
//   3. Tự đánh ✕ cả hàng và cột của con mèo đó
//   4. Vùng hồng đậm chỉ còn một ô — đặt mèo thứ hai
//   5. Vuốt để đánh ✕ ba ô kề con mèo vừa đặt
//   6. Vùng xanh chỉ còn một ô — đặt mèo thứ ba
//   7. Tự tìm con mèo cuối
//   8. "Excellent! You've mastered the rules!"
//
// Bàn cờ nằm ở levels.js. Các ô cần thao tác được suy ra từ luật chứ không ghi
// cứng toạ độ — chúng trùng khớp với video, và flow_test.mjs kiểm lại điều đó.

import { CAT, MARK, Puzzle } from "./puzzle.js";
import { TUTORIAL, PALETTE } from "./levels.js";
import { T } from "./strings.js";


export function tutorialPuzzle() {
  return new Puzzle(TUTORIAL.record, TUTORIAL.size);
}

const cellsWhere = (puzzle, test) => {
  const out = [];
  for (let r = 0; r < puzzle.size; r++)
    for (let c = 0; c < puzzle.size; c++) if (test(r, c)) out.push([r, c]);
  return out;
};

const regionOf = (puzzle, [r, c]) => cellsWhere(puzzle, (i, j) => puzzle.regions[i][j] === puzzle.regionAt(r, c));

const catAt = (puzzle, row) => [row, puzzle.solution[row]];

/**
 * Tên màu vùng, tô đúng màu đó — Meowdoku cũng gắn [color] vào tên màu.
 * Tên lấy từ bảng chữ nên đổi theo ngôn ngữ; PALETTE trong levels.js giữ tên
 * tiếng Anh làm bản gốc để đối chiếu với video.
 */
const colourTag = (region) => {
  const index = region % PALETTE.length;
  return `<b class="key" style="color: var(--k${index})">${T.colors[index]}</b>`;
};

/** Ô cùng hàng hoặc cùng cột với một con mèo (không tính chính nó). */
const linesOf = (puzzle, [r, c]) =>
  cellsWhere(puzzle, (i, j) => (i === r || j === c) && !(i === r && j === c));

/** Ô chạm cạnh hoặc góc một con mèo, bỏ những ô đã bị các bước trước loại rồi. */
const touching = (puzzle, [r, c], done) => {
  const seen = new Set(done.map(([i, j]) => `${i},${j}`));
  return cellsWhere(
    puzzle,
    (i, j) => Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1 && !(i === r && j === c) && !seen.has(`${i},${j}`),
  );
};

/**
 * Xếp dãy ô thành một đường vuốt liền: bắt đầu từ ô thấp nhất (trái nhất nếu
 * hoà), rồi mỗi bước nhảy sang ô gần nhất còn lại. Với ba ô kề con thứ hai, ra
 * đúng đường "từ dưới đi lên rồi sang phải" mà bàn tay minh hoạ cần vẽ.
 */
function swipePath(cells) {
  const left = [...cells].sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const path = [left.shift()];
  while (left.length) {
    const [r, c] = path[path.length - 1];
    left.sort((a, b) => Math.hypot(a[0] - r, a[1] - c) - Math.hypot(b[0] - r, b[1] - c));
    path.push(left.shift());
  }
  return path;
}

/**
 * Kịch bản 8 bước. Mỗi bước có thể:
 *   focus  — chỉ những ô này sáng, phần còn lại của bàn bị làm tối
 *   ring   — ô được khoanh vòng, nơi cần bấm hai lần
 *   needs  — điều kiện hoàn thành: các ô phải mang giá trị này
 *   button — chờ bấm nút thay vì chờ thao tác trên bàn cờ
 *   free   — mở khoá cả bàn, chờ người chơi giải nốt
 */
export function buildSteps(puzzle) {
  // Đọc `T.tut` ngay tại đây chứ không giữ sẵn ở đầu file: đổi ngôn ngữ là ruột
  // của `T` bị thay mới, giữ sẵn thì câu chữ sẽ đứng nguyên ở thứ tiếng cũ.
  const { tut } = T;
  const first = catAt(puzzle, 0); // ô xanh lá — vùng chỉ có một ô nên chắc chắn đúng
  const second = catAt(puzzle, 3); // vùng hồng đậm
  const third = catAt(puzzle, 1); // vùng xanh

  const lines = linesOf(puzzle, first);
  const neighbours = swipePath(touching(puzzle, second, lines));

  return [
    {
      id: "place-first",
      top: tut.placeFirst,
      focus: [first],
      ring: first,
      needs: { cells: [first], value: CAT },
    },
    {
      id: "rule-colour",
      title: tut.wellDone,
      top: tut.onePerColour,
      rule: "region",
      highlight: regionOf(puzzle, first),
      button: tut.gotIt,
    },
    {
      id: "exclude-lines",
      title: tut.nice,
      top: tut.rowCol,
      bottom: tut.tapToExclude,
      rule: "line",
      focus: lines,
      needs: { cells: lines, value: MARK },
    },
    {
      id: "place-second",
      top: `${tut.onlyLast(colourTag(puzzle.regionAt(...second)))}<br />${tut.doubleTapPlace}`,
      rule: "region",
      focus: regionOf(puzzle, second),
      ring: second,
      needs: { cells: [second], value: CAT },
    },
    {
      id: "exclude-touching",
      top: tut.adjacent,
      bottom: tut.swipeToExclude,
      rule: "touch",
      gesture: "swipe",
      focus: neighbours,
      needs: { cells: neighbours, value: MARK },
    },
    {
      id: "place-third",
      top: `${tut.onlyLast(colourTag(puzzle.regionAt(...third)))}<br />${tut.doubleTapPlace}`,
      rule: "region",
      focus: regionOf(puzzle, third),
      ring: third,
      needs: { cells: [third], value: CAT },
    },
    {
      id: "find-last",
      top: tut.findLast,
      bottom: tut.tapForHint,
      free: true,
    },
    { id: "done", done: true },
  ];
}

export class Tutorial {
  constructor(puzzle, board) {
    this.puzzle = puzzle;
    this.board = board;
    this.steps = buildSteps(puzzle);
    this.index = 0;
  }

  /** Dựng lại câu chữ sau khi đổi ngôn ngữ, giữ nguyên bước đang học. */
  relocalize() {
    this.steps = buildSteps(this.puzzle);
  }

  get step() {
    return this.steps[this.index];
  }

  get done() {
    return Boolean(this.step.done);
  }

  /** Bước này đang chờ người chơi động vào bàn cờ (chứ không phải bấm nút). */
  get waiting() {
    return Boolean(this.step.needs || this.step.free);
  }

  /** Ô của bước hiện tại còn chưa đánh đúng — dùng để khoanh vòng và đếm tiến độ. */
  pending() {
    const needs = this.step.needs;
    if (!needs) return [];
    return needs.cells.filter(([r, c]) => this.board.get(r, c) !== needs.value);
  }

  /** Chỉ nhận đúng ô và đúng thao tác bước hiện tại yêu cầu. */
  allows(r, c, kind) {
    const step = this.step;
    if (step.free || step.done) return true;
    if (!step.needs) return false;
    const wanted = step.needs.value === CAT ? "cat" : "mark";
    return kind === wanted && step.needs.cells.some(([i, j]) => i === r && j === c);
  }

  /** Gọi sau mỗi thay đổi bàn cờ; true nếu bước hiện tại vừa xong. */
  checkProgress() {
    const step = this.step;
    if (step.free) return this.board.isSolved();
    return Boolean(step.needs) && this.pending().length === 0;
  }

  advance() {
    if (!this.done) this.index++;
    return this.step;
  }
}
