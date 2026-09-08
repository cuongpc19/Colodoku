// Phần hiển thị bàn cờ và xử lý thao tác, dùng chung cho cả game lẫn trang phân tích.

import { EMPTY, MARK, CAT } from "./puzzle.js";

// Bấm một lần = ✕, bấm đúp = đặt con vật.
//
// Dấu ✕ được ghi NGAY ở cú bấm đầu, không chờ xem có cú thứ hai hay không —
// chờ thì mỗi lần bấm đều khựng đúng chừng ấy mili-giây, rất rõ khi loại nhiều
// ô liên tiếp. Cú thứ hai trong khoảng dưới đây ghi đè ✕ thành con vật, nên
// người chơi chỉ thấy ✕ loé lên rồi thành kiến — đúng như bản gốc.
const DOUBLE_TAP_MS = 260;

export class BoardView {
  constructor(container, options = {}) {
    this.el = container;
    this.board = null;
    this.cells = [];
    this.autoX = true;
    this.locked = false;
    // Ô game đặt sẵn khi vào màn — người chơi không được sửa, như bản gốc.
    this.fixed = new Set();
    // Ô người chơi đã đặt sai: mang ✕ đỏ và khoá luôn.
    this.wrong = new Set();
    // Trả về false để từ chối một con vật đặt sai chỗ.
    this.validate = options.validate || (() => true);
    this.onReject = options.onReject || (() => {});
    this.onChange = options.onChange || (() => {});
    // Trả về false để chặn một nước đi — tutorial dùng cái này để ép đúng thao tác.
    this.allowMove = options.allowMove || (() => true);

    // pending/single: ô đang chờ hết nhịp bấm đúp, và hành động sẽ chạy khi hết nhịp.
    // lastAt/lastCell: mốc của cú bấm trước, để nhận bấm đúp ngay lập tức thay vì
    // phải chờ timer của cú bấm đơn chạy xong.
    this.tap = { dragging: false, last: null, lastAt: 0, lastCell: null };

    // Bàn tay minh hoạ thao tác trong lúc hướng dẫn. Lớp ngoài lo vị trí, lớp
    // trong lo nhịp nhấn/trượt, để hai transform không giẫm chân nhau.
    this.handEl = document.createElement("div");
    this.handEl.className = "hand";
    this.handEl.hidden = true;
    this.handEl.innerHTML = "<i>👆</i>";
    this.handAnim = null;
    this.el.append(this.handEl);
    this.el.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.el.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.el.addEventListener("pointerup", () => this.onPointerUp());
    this.el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** Dựng lại lưới DOM cho một bàn cờ mới. */
  mount(board, fixed = []) {
    this.board = board;
    this.fixed = new Set(fixed.map(([r, c]) => `${r},${c}`));
    this.wrong = new Set();
    const n = board.size;
    const regions = board.puzzle.regions;
    this.el.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    // CSS lấy --n để tính cỡ mèo/✕ theo cạnh ô thật.
    this.el.style.setProperty("--n", n);
    this.hideHand();
    this.el.innerHTML = "";
    this.el.append(this.handEl);
    this.cells = [];

    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.background = `var(--g${regions[r][c] % 12})`;
        cell.dataset.r = r;
        cell.dataset.c = c;
        this.el.append(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
    this.render();
  }

  render() {
    const board = this.board;
    if (!board) return;
    const clashing = new Set();
    for (const conflict of board.conflicts())
      for (const [r, c] of conflict.cells) clashing.add(`${r},${c}`);

    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const node = this.cells[r][c];
        const value = board.get(r, c);
        node.classList.toggle("mark", value === MARK);
        node.classList.toggle("cat", value === CAT);
        node.classList.toggle("conflict", clashing.has(`${r},${c}`));
        node.classList.toggle("wrong", this.wrong.has(`${r},${c}`));
      }
    }
  }

  clearHighlights() {
    for (const row of this.cells) for (const node of row) node.classList.remove("hint", "spot", "lit", "ring", "preview");
  }

  /**
   * Chế độ hướng dẫn: làm tối cả bàn cờ, chỉ chừa lại các ô đang được nói tới.
   * Meowdoku dùng đúng cách này thay vì viền sáng — nhìn là biết phải bấm đâu.
   */
  setFocus(cells, ring = null) {
    this.el.classList.toggle("dim", Boolean(cells));
    if (cells) this.highlight(cells, "lit");
    if (ring) this.cells[ring[0]][ring[1]]?.classList.add("ring");
  }

  editable(r, c) {
    return !this.fixed.has(`${r},${c}`);
  }

  /**
   * Bàn tay hướng dẫn: `tap` thì đứng nhấn nhịp trên một ô, `swipe` thì trượt
   * lặp qua dãy ô — đúng hai kiểu Meowdoku dùng trong tutorial.
   */
  showHand(cells, mode) {
    if (!cells.length || !this.cells.length) return this.hideHand();
    const hand = this.handEl;
    const first = this.cells[cells[0][0]][cells[0][1]];
    // Ngón tay chạm vào giữa ô, nên gốc bàn tay đặt hơi thấp hơn tâm một chút.
    const spot = ([r, c]) => {
      const cell = this.cells[r][c];
      return `translate(${cell.offsetLeft + cell.offsetWidth / 2}px, ${cell.offsetTop + cell.offsetHeight * 0.45}px)`;
    };

    this.handAnim?.cancel();
    this.handAnim = null;
    hand.style.fontSize = `${first.offsetWidth * 0.62}px`;
    hand.classList.toggle("tapping", mode === "tap");
    hand.hidden = false;

    if (mode === "tap") {
      hand.style.transform = spot(cells[0]);
      return;
    }
    // Dừng một nhịp ở ô đầu và ô cuối cho người chơi kịp nhìn hướng trượt.
    const path = cells.map((cell) => ({ transform: spot(cell) }));
    hand.style.transform = path[0].transform;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      this.handAnim = hand.animate([path[0], ...path, path[path.length - 1]], {
        duration: 420 * (path.length + 1),
        iterations: Infinity,
        easing: "ease-in-out",
      });
  }

  hideHand() {
    this.handAnim?.cancel();
    this.handAnim = null;
    this.handEl.hidden = true;
  }

  highlight(cellList, className = "hint") {
    for (const [r, c] of cellList) this.cells[r][c]?.classList.add(className);
  }

  // ------------------------------------------------------------- nước đi

  /** Đặt mèo, kèm tự đánh ✕ mọi ô bị con mèo đó loại nếu bật tuỳ chọn. */
  placeCat(r, c) {
    const board = this.board;
    if (!this.validate(r, c)) return this.onReject(r, c);
    const changes = [[r, c, CAT]];
    if (this.autoX) {
      const n = board.size;
      const region = board.puzzle.regionAt(r, c);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === r && j === c) continue;
          const blocked = i === r || j === c || board.puzzle.regionAt(i, j) === region ||
            (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1);
          if (blocked && board.get(i, j) === EMPTY) changes.push([i, j, MARK]);
        }
      }
    }
    this.commit(changes);
    this.pop(r, c);
  }

  /** Nhịp bung của con kiến vừa đặt. Gỡ class trước rồi ép reflow, nếu không
   *  đặt hai con liên tiếp thì con sau không chạy lại animation. */
  pop(r, c) {
    const node = this.cells[r]?.[c];
    if (!node || this.board.get(r, c) !== CAT) return;
    node.classList.remove("pop");
    void node.offsetWidth;
    node.classList.add("pop");
    node.addEventListener("animationend", () => node.classList.remove("pop"), { once: true });
  }

  /** Ghi một ô là đặt sai: ✕ đỏ, khoá lại, không hoàn tác được. */
  markWrong(r, c) {
    this.wrong.add(`${r},${c}`);
    this.fixed.add(`${r},${c}`);
    this.board.apply([[r, c, MARK]]);
    this.board.history.length = 0;
    this.render();
  }

  toggleMark(r, c) {
    this.commit([[r, c, this.board.get(r, c) === EMPTY ? MARK : EMPTY]]);
  }

  commit(changes) {
    if (this.board.apply(changes)) {
      this.render();
      this.onChange();
    }
  }

  // -------------------------------------------------------------- thao tác

  cellAt(event) {
    const node = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell");
    return node && this.el.contains(node) ? [+node.dataset.r, +node.dataset.c] : null;
  }

  onPointerDown(event) {
    if (this.locked || !this.board) return;
    const at = this.cellAt(event);
    if (!at || !this.editable(at[0], at[1])) return;
    event.preventDefault();
    const [r, c] = at;
    this.tap.last = at;
    this.tap.dragging = false;
    this.el.setPointerCapture?.(event.pointerId);

    const putCat = () => {
      if (!this.allowMove(r, c, "cat")) return;
      this.board.get(r, c) === CAT ? this.commit([[r, c, EMPTY]]) : this.placeCat(r, c);
    };

    if (event.button === 2) { // chuột phải = đặt con vật luôn
      this.tap.lastCell = null;
      putCat();
      this.tap.last = null;
      return;
    }
    const now = performance.now();
    const sameAsLast = this.tap.lastCell &&
      this.tap.lastCell[0] === r && this.tap.lastCell[1] === c &&
      now - this.tap.lastAt < DOUBLE_TAP_MS;

    if (sameAsLast) { // cú thứ hai vào đúng ô đó — bấm đúp
      this.tap.lastAt = 0;
      this.tap.lastCell = null;
      putCat();
      this.tap.last = null;
      return;
    }
    this.tap.lastAt = now;
    this.tap.lastCell = at;
    if (this.allowMove(r, c, "mark")) this.toggleMark(r, c);
  }

  /** Kéo qua nhiều ô để đánh ✕ hàng loạt, đúng như thao tác vuốt trong Meowdoku. */
  onPointerMove(event) {
    if (this.locked || !this.tap.last || event.buttons === 0) return;
    const at = this.cellAt(event);
    if (!at) return;
    const [r, c] = at;
    if (r === this.tap.last[0] && c === this.tap.last[1]) return;

    if (!this.tap.dragging) { // vừa rời ô đầu tiên: chuyển hẳn sang chế độ kéo
      this.tap.dragging = true;
      // Kéo tiếp thì cú bấm này không còn là nửa đầu của một lần bấm đúp nữa.
      this.tap.lastCell = null;
      const [fr, fc] = this.tap.last;
      if (this.board.get(fr, fc) === EMPTY && this.allowMove(fr, fc, "mark"))
        this.commit([[fr, fc, MARK]]);
    }
    if (this.board.get(r, c) === EMPTY && this.editable(r, c) && this.allowMove(r, c, "mark"))
      this.commit([[r, c, MARK]]);
    this.tap.last = at;
  }

  onPointerUp() {
    if (this.tap.dragging) this.tap.last = null;
  }
}
