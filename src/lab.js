// Trang phân tích: duyệt thẳng bank của Meowdoku và xem bộ giải suy luận từng bước.
// Đây là công cụ nghiên cứu level design, không phải vòng chơi — game nằm ở index.html.

import { Board, Puzzle, EMPTY, MARK, CAT } from "./puzzle.js";
import { BoardView } from "./boardview.js";
import { nextDeduction, stateFromBoard } from "./solver.js";
// Trang này cũng đi theo ngôn ngữ đang chọn trong game — tên kỹ thuật và câu
// giải thích đều lấy từ bảng chữ, chỉ phần khung của lại để nguyên tiếng Anh.
import { T, explain } from "./strings.js";

const $ = (id) => document.getElementById(id);
const ui = {
  bank: $("bank"), tier: $("tier"), shuffle: $("shuffle"),
  status: $("status"), toast: $("toast"),
  undo: $("undo"), hint: $("hint"), reset: $("reset"), autox: $("autox"),
  rating: $("m-rating"), steps: $("m-steps"), chained: $("m-chained"), techs: $("techs"),
  step: $("step"), autoplay: $("autoplay"), explain: $("explain"),
};

const lab = { bank: null, puzzle: null, board: null, walk: null, timer: null };
const view = new BoardView($("board"), { onChange: () => refreshStatus() });

// ---------------------------------------------------------------- dữ liệu

async function loadIndex() {
  const index = await fetch("data/index.json").then((r) => r.json());
  const banks = index.banks
    .filter((b) => b.size > 0)
    .sort((a, b) => (a.variant === b.variant ? a.size - b.size : a.variant < b.variant ? -1 : 1));
  ui.bank.innerHTML = banks
    .map((b) => `<option value="${b.slug}">${b.variant} ${b.size}×${b.size} (${b.count})</option>`)
    .join("");
  ui.bank.value = banks.some((b) => b.slug === "classic-9x9") ? "classic-9x9" : banks[0].slug;
}

async function loadBank(slug) {
  lab.bank = await fetch(`data/${slug}.json`).then((r) => r.json());
  ui.tier.innerHTML = Object.keys(lab.bank.tiers).sort()
    .map((t) => `<option value="${t}">${"★".repeat(Number(t) || 1)} (${lab.bank.tiers[t].length})</option>`)
    .join("");
}

// ------------------------------------------------------------- hiển thị

function refreshStatus() {
  const board = lab.board;
  ui.undo.disabled = board.history.length === 0;
  if (board.isSolved()) {
    ui.status.className = "status win";
    ui.status.textContent = `Solved! All ${board.size} ants placed, not a rule broken.`;
    toast("🎉 Solved!");
  } else if (board.conflicts().length) {
    ui.status.className = "status bad";
    ui.status.textContent = "An ant is breaking a rule — see the red tiles.";
  } else {
    ui.status.className = "status";
    ui.status.textContent = `${board.cats().length}/${board.size} ants placed`;
  }
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (ui.toast.hidden = true), 2200);
}

function renderTechniques() {
  const counts = lab.puzzle.techniques;
  ui.techs.innerHTML = Object.entries(T.techniques)
    .map(([rank, name]) => {
      const n = counts[rank - 1] || 0;
      return `<li class="${n ? "used" : "unused"}" title="${T.techniqueNotes[rank]}">
        <span class="rank">${rank}</span><span>${name}</span><span class="count">${n}×</span>
      </li>`;
    })
    .join("");
}

// --------------------------------------------------------- giải từng bước

function resetWalk() {
  stopAutoplay();
  lab.walk = null;
  ui.step.disabled = false;
  ui.explain.textContent = "Press “Next step” to watch how the solver deduces the next cell.";
}

/** Một bước của bộ giải, áp thẳng lên bàn cờ để nhìn thấy suy luận diễn ra. */
function walkStep() {
  if (!lab.walk) {
    lab.board.reset();
    lab.walk = stateFromBoard(lab.puzzle, lab.board.cells);
  }
  const state = lab.walk;
  const move = nextDeduction(state);
  if (!move) {
    ui.explain.innerHTML = state.isComplete()
      ? "<b>Done.</b> The solver placed every ant by deduction alone — no guessing."
      : "<b>Stuck.</b> The current technique ladder cannot finish this puzzle.";
    ui.step.disabled = true;
    stopAutoplay();
    return false;
  }

  if (move.action === "place") state.place(move.cells[0][0], move.cells[0][1]);
  else for (const [r, c] of move.cells) state.cand[r][c] = false;

  // Đồng bộ bàn cờ với trạng thái suy luận: mèo ở ô đã chốt, ✕ ở mọi ô đã loại.
  const changes = [];
  for (let r = 0; r < state.size; r++)
    for (let c = 0; c < state.size; c++) {
      const want = state.placed[r][c] ? CAT : state.cand[r][c] ? EMPTY : MARK;
      if (lab.board.get(r, c) !== want) changes.push([r, c, want]);
    }
  lab.board.apply(changes);
  view.render();
  view.clearHighlights();
  view.highlight(move.cells, "hint");

  const verb = move.action === "place" ? "places an ant" : `excludes ${move.cells.length} cells`;
  ui.explain.innerHTML = `<b>Rank ${move.rank} — ${T.techniques[move.rank]}:</b> ${verb} because ${explain(move.reason, lab.board.puzzle)}.`;
  refreshStatus();
  return true;
}

function stopAutoplay() {
  clearInterval(lab.timer);
  lab.timer = null;
  ui.autoplay.textContent = "⏩ Run to the end";
}

function toggleAutoplay() {
  if (lab.timer) return stopAutoplay();
  ui.autoplay.textContent = "⏸ Pause";
  lab.timer = setInterval(() => {
    if (!walkStep()) stopAutoplay();
  }, 700);
}

// ------------------------------------------------------------------ điều phối

function startLevel(record) {
  lab.puzzle = new Puzzle(record, lab.bank.size);
  lab.board = new Board(lab.puzzle);
  view.autoX = ui.autox.checked;
  view.mount(lab.board);
  view.clearHighlights();
  resetWalk();

  ui.rating.textContent = "★".repeat(lab.puzzle.rating) + ` (${lab.puzzle.rating}/5)`;
  ui.steps.textContent = lab.puzzle.steps;
  ui.chained.textContent = lab.puzzle.chained ? "Yes" : "No";
  renderTechniques();
  refreshStatus();
}

function randomLevel() {
  const list = lab.bank.tiers[ui.tier.value];
  startLevel(list[Math.floor(Math.random() * list.length)]);
}

async function switchBank() {
  await loadBank(ui.bank.value);
  randomLevel();
}

ui.bank.addEventListener("change", switchBank);
ui.tier.addEventListener("change", randomLevel);
ui.shuffle.addEventListener("click", randomLevel);
ui.undo.addEventListener("click", () => { lab.board.undo(); view.render(); refreshStatus(); });
ui.reset.addEventListener("click", () => {
  lab.board.reset();
  view.clearHighlights();
  view.render();
  resetWalk();
  refreshStatus();
});
ui.autox.addEventListener("change", () => (view.autoX = ui.autox.checked));
ui.step.addEventListener("click", walkStep);
ui.autoplay.addEventListener("click", toggleAutoplay);
ui.hint.addEventListener("click", () => {
  const move = nextDeduction(stateFromBoard(lab.puzzle, lab.board.cells));
  if (!move) {
    ui.explain.innerHTML = "Nothing can be deduced from here — an ant may be in the wrong place.";
    return;
  }
  view.clearHighlights();
  view.highlight(move.cells, "hint");
  const verb = move.action === "place" ? "Place an ant here" : "Exclude these cells";
  ui.explain.innerHTML = `<b>Rank ${move.rank} — ${T.techniques[move.rank]}.</b> ${verb}: ${explain(move.reason, lab.board.puzzle)}.`;
});

loadIndex().then(switchBank).catch((err) => {
  ui.status.className = "status bad";
  ui.status.textContent = "Could not load the level data: " + err.message;
});
