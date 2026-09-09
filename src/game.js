// Vòng chơi chính: trang chủ → hướng dẫn → chơi từng màn một, có lưu tiến trình.

import { Board, Puzzle, CAT, MARK, EMPTY } from "./puzzle.js";
import { BoardView } from "./boardview.js";
import { nextDeduction, stateFromBoard } from "./solver.js";
import { Tutorial, tutorialPuzzle } from "./tutorial.js";
import { T, explain, applyStatic, LANGUAGES, getLocale, setLocale } from "./strings.js";
import { sound } from "./sound.js";
import {
  levelRecord, autoMarksFor, onLevelWon, onLevelFailed, onLevelRestarted, markDirty,
  loadProgress, markCleared, clearProgress, currentLevel, starsFor,
  touchStreak, streakDoneToday, addCoins, spendCoins, useFree,
  COIN_REWARD, COIN_COST,
} from "./progression.js";

// Nhịp nháy sáng cả bàn cờ sau khi làm xong một bước hướng dẫn, trước khi sang
// bước sau. Đủ để thấy mình vừa làm đúng, không đủ để thấy phải chờ; cũng vừa
// đủ dài để lớp phủ tối kịp mờ hết trước khi bước mới dựng lên.
const FLASH_MS = 360;

/** Chạy lại một animation CSS đang gắn sẵn trên phần tử. */
function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // ép trình duyệt tính lại, nếu không animation không chạy lại
  node.classList.add(className);
}

// Ngần này mạng mỗi màn — đúng con số hiện trên màn hình Meowdoku. Hai nút trợ
// giúp thì không giới hạn lượt nữa mà trả bằng tiền (COIN_COST trong progression).
const LIVES = 3;

// Điểm mỗi lần đặt đúng, đọc ngược từ video: 576 cho con đầu, mỗi con đúng liên
// tiếp sau đó cộng thêm 96, đặt sai thì chuỗi về 0.
// Màn 1: 576 → (sai) → 576 → 672 = 1824. Màn 2: 576 → 672 → 768 = 2016.
const SCORE_BASE = 576;
const SCORE_STEP = 96;

const $ = (id) => document.getElementById(id);
const screens = { home: $("screen-home"), play: $("screen-play") };

const ui = {
  homeProgress: $("home-progress"),
  streakCount: $("streak-count"), streakTick: $("streak-tick"),
  kicker: $("play-kicker"), title: $("play-title"), best: $("play-best"),
  chips: $("chips"), count: $("play-count"), lives: $("play-lives"),
  status: $("play-status"), hintText: $("hint-text"),
  coachTop: $("coach-top"), coachTitle: $("coach-title"), coachText: $("coach-text"),
  coachBottom: $("coach-bottom"), coachHint: $("coach-hint"),
  // Một nút viên thuốc dưới bàn cờ, lúc là "Got it!" của hướng dẫn, lúc là Apply
  // của gợi ý — hai vai không bao giờ trùng nhau nên dùng chung được.
  coachNext: $("btn-apply"), apply: $("btn-apply"),
  boosters: $("boosters"), reveal: $("btn-reveal"), revealLeft: $("reveal-left"),
  hint: $("btn-hint"), hintLeft: $("hint-left"),
  playCoins: $("play-coins"), homeCoins: $("home-coins"),
  win: $("win"), winTitle: $("win-title"), winNote: $("win-note"),
  winArt: $("win-art"), winReward: $("win-reward"), confetti: $("confetti"),
  next: $("btn-next"), replay: $("btn-replay"),
  settings: $("settings"), settingsNote: $("settings-note"), language: $("opt-language"),
  soundToggle: $("opt-sound"),
  confirm: $("confirm"), wipeLosing: $("wipe-losing"),
  restart: $("btn-restart"),
};

const state = {
  progress: loadProgress(),
  level: 1,
  spec: null,
  puzzle: null,
  board: null,
  score: 0,
  chain: 0,   // số lần đặt đúng liên tiếp, dùng để cộng dồn điểm
  scored: 0,  // số con đã tính điểm, để biết lần thay đổi nào là đặt thêm
  lives: LIVES,
  hintsUsed: 0,
  offer: null, // nước đi thẻ gợi ý đang chỉ, chờ bấm Apply
  tutorial: null,
  flashing: false,
  shownStep: null, // id bước đang hiện, để biết lúc nào cần chạy lại hiệu ứng
};

const view = new BoardView($("board"), {
  onChange: () => onBoardChange(),
  // Trong nhịp nháy sáng giữa hai bước thì khoá bàn cờ lại, tránh người chơi
  // bấm lại đúng ô vừa xong và làm bước đó "chưa hoàn thành" trở lại.
  allowMove: (r, c, kind) =>
    !state.tutorial || (!state.flashing && state.tutorial.allows(r, c, kind)),
  // Meowdoku bắt lỗi ngay lúc đặt chứ không để người chơi ôm một thế cờ sai.
  validate: (r, c) => Boolean(state.tutorial) || state.puzzle.solution[r] === c,
  onReject: (r, c) => onWrongPlacement(r, c),
  onPlace: (r, c) => { state.lastPlaced = [r, c]; sound.pop(); },
  onMark: () => sound.tick(),
});

// ------------------------------------------------------------- điều hướng

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
  if (name === "home") refreshHome();
}

function refreshHome() {
  const done = state.progress.cleared;
  // Dòng này không đếm gì cả — không tổng số màn, không số màn đã qua. Người
  // chơi đã biết mình tới đâu qua nút Tiếp tục ngay bên dưới.
  ui.homeProgress.textContent = T.levelsWaiting;
  $("btn-play").textContent = done ? T.playOn(currentLevel(state.progress)) : T.play;
  refreshCoins();
  ui.streakCount.textContent = state.progress.streak || 0;
  ui.streakTick.hidden = !streakDoneToday(state.progress);
}

for (const button of document.querySelectorAll("[data-goto]"))
  button.addEventListener("click", () => show(button.dataset.goto));

// --------------------------------------------------------------- vào màn

/** Đưa một bàn cờ lên màn chơi — dùng chung cho màn thường lẫn tutorial. */
function mountPlay({ puzzle, kicker, title, autoMark, given = [], note = "" }) {
  state.puzzle = puzzle;
  state.board = new Board(puzzle);
  state.score = 0;
  state.chain = 0;
  state.lives = LIVES;
  state.hintsUsed = 0;
  state.flashing = false;

  // Con vật game đặt sẵn: ghi thẳng vào bàn cờ rồi xoá lịch sử, để Hoàn tác
  // không gỡ được nó ra — bản gốc cũng khoá cứng con mở màn.
  if (given.length) {
    state.board.apply(given.map(([r, c]) => [r, c, CAT]));
    state.board.history.length = 0;
  }

  view.autoX = autoMark;
  view.locked = false;
  view.mount(state.board, given);
  closeOffer();

  ui.kicker.textContent = kicker;
  ui.title.textContent = title;
  ui.hintText.innerHTML = note;
  ui.win.hidden = true;
  show("play");
}

async function startLevel(n) {
  const loaded = await levelRecord(n, state.progress);
  if (!loaded) {
    ui.status.textContent = T.loadFailed;
    return;
  }
  state.progress = loaded.progress;
  state.level = n;
  state.spec = loaded.spec;
  state.tutorial = null;

  mountPlay({
    puzzle: new Puzzle(loaded.record, loaded.size),
    kicker: T.level,
    title: String(n),
    // Bánh xe phụ: chỉ hai màn đầu game mới đánh ✕ hộ, sau đó người chơi tự loại ô.
    autoMark: autoMarksFor(n),
    given: loaded.given,
  });
  screens.play.classList.remove("tutorial");
  ui.chips.hidden = false;
  ui.boosters.hidden = false;
  ui.coachTop.hidden = true;
  ui.coachBottom.hidden = true;
  refreshHud();
}

function startTutorial() {
  const puzzle = tutorialPuzzle();
  state.level = 0;
  state.spec = null;
  // Tutorial dạy tự loại ô, nên tuyệt đối không đánh ✕ hộ.
  mountPlay({ puzzle, kicker: "", title: T.tutorialTitle, autoMark: false });
  screens.play.classList.add("tutorial");
  ui.chips.hidden = true;
  ui.boosters.hidden = true;
  state.tutorial = new Tutorial(puzzle, state.board);
  state.shownStep = null;
  ui.replay.hidden = true;
  renderCoach();
}

// ------------------------------------------------------------------- HUD

function refreshHud() {
  const board = state.board;
  ui.count.textContent = T.counter(board.cats().length, board.size);
  // Ô bên phải HUD là kỷ lục **chuỗi thắng liên tiếp**, không phải chuỗi ngày
  // điểm danh (`progress.streak`) — cái đó cả ngày chơi bao nhiêu ván vẫn là 1.
  ui.best.textContent = state.progress.bestWin || 0;
  ui.lives.innerHTML = Array.from(
    { length: LIVES },
    (_, i) => `<i class="life${i < state.lives ? "" : " gone"}"></i>`,
  ).join("");
  refreshBooster(ui.reveal, ui.revealLeft, "reveal");
  refreshBooster(ui.hint, ui.hintLeft, "hint");
  refreshCoins();
}

/** Số tiền hiện có, vẽ ở cả trang chủ lẫn màn chơi. */
function refreshCoins() {
  const coins = state.progress.coins || 0;
  ui.playCoins.textContent = coins;
  ui.homeCoins.textContent = coins;
}

const freeLeft = (kind) => state.progress.free?.[kind] || 0;
const canAfford = (price) => (state.progress.coins || 0) >= price;
const canUse = (kind) => freeLeft(kind) > 0 || canAfford(COIN_COST[kind]);

/**
 * Badge trên nút trợ giúp có hai vai: còn lượt miễn phí thì nó đếm lượt (viên
 * đỏ, như bản gốc), hết rồi mới thành **giá tiền** (viên vàng).
 */
function refreshBooster(button, badge, kind) {
  const free = freeLeft(kind);
  // Còn lượt free thì chỉ là con số; hết rồi thì kèm đồng xu cho khỏi đọc nhầm
  // "20" thành "còn 20 lượt".
  badge.innerHTML = free ? String(free) : `<i class="coin"></i>${COIN_COST[kind]}`;
  badge.classList.toggle("price", free === 0);
  button.disabled = Boolean(state.offer);
  // Không đủ tiền thì làm mờ nhưng vẫn bấm được, để còn báo được lý do.
  button.classList.toggle("broke", !canUse(kind));
}

/**
 * Thanh toán một lượt trợ giúp: tiêu lượt miễn phí trước, hết rồi mới trừ xu.
 * Gọi hàm này **sau** khi đã chắc chắn có gợi ý để đưa, không thì mất công vô ích.
 */
function spend(kind) {
  const free = useFree(state.progress, kind);
  if (free) {
    state.progress = free;
    return true;
  }
  const price = COIN_COST[kind];
  const next = spendCoins(state.progress, price);
  if (!next) {
    ui.hintText.textContent = T.notEnoughCoins(price);
    ui.chips.classList.remove("nudge");
    void ui.chips.offsetWidth;
    ui.chips.classList.add("nudge");
    return false;
  }
  state.progress = next;
  refreshCoins();
  return true;
}

function onBoardChange() {
  if (state.tutorial) return onTutorialChange();
  // Số con vật tăng lên nghĩa là vừa đặt đúng thêm một con — cộng điểm theo chuỗi.
  const placed = state.board.cats().length;
  if (placed > state.scored) {
    state.score += SCORE_BASE + SCORE_STEP * state.chain;
    state.chain++;
    if (state.chain >= 2) praise(state.chain - 1);
  }
  state.scored = placed;
  refreshHud();
  if (state.board.isSolved()) finishLevel();
}

/**
 * Chữ khen bay lên từ ô vừa đặt: chuỗi 2 con là "Nice!", dài hơn thì lời khen
 * mạnh dần tới "Perfect!", kèm hợp âm càng dài càng cao. Bậc = số con đúng
 * liên tiếp trước con này. Lời khen để tiếng Anh ở mọi ngôn ngữ, như một
 * tiếng reo chứ không phải câu văn.
 */
function praise(tier) {
  const words = T.combo;
  const index = Math.min(tier - 1, words.length - 1);
  const [r, c] = state.lastPlaced || [0, 0];
  const cell = view.cells[r]?.[c];
  if (!cell) return;
  const node = document.createElement("div");
  node.className = `combo tier-${index}`;
  node.textContent = words[index];
  const board = view.el.getBoundingClientRect();
  const box = cell.getBoundingClientRect();
  // Kẹp vào trong bàn để chữ ở cột biên không văng ra ngoài màn hình.
  const margin = Math.min(70, board.width * 0.18);
  node.style.left = `${Math.max(margin, Math.min(board.width - margin, box.left - board.left + box.width / 2))}px`;
  node.style.top = `${box.top - board.top}px`;
  view.el.appendChild(node);
  node.addEventListener("animationend", () => node.remove(), { once: true });
  sound.combo(index);
}

/** Đặt sai chỗ: ✕ đỏ vĩnh viễn trên ô đó, mất một mạng, chuỗi điểm về 0. */
function onWrongPlacement(r, c) {
  sound.buzz();
  state.chain = 0;
  state.lives--;
  view.markWrong(r, c);
  refreshHud();
  if (state.lives <= 0) gameOver();
}

// ------------------------------------------------------------ hướng dẫn

function renderCoach() {
  const tutorial = state.tutorial;
  view.clearHighlights();
  view.setFocus(null);
  view.hideHand();

  if (tutorial.done) {
    ui.coachTop.hidden = true;
    ui.coachBottom.hidden = true;
    ui.apply.hidden = true;
    view.locked = true;
    // Thưởng luôn cả buổi hướng dẫn: không thì người mới vào màn 1 với ví rỗng,
    // hai nút trợ giúp mờ tịt đúng lúc họ cần chúng nhất.
    state.progress = addCoins(
      markCleared({ ...state.progress, tutorialDone: true }, 0, 0),
      COIN_REWARD,
    );
    refreshCoins();
    cheer();
    ui.winTitle.textContent = T.tut.mastered;
    ui.winReward.hidden = false;
    ui.winReward.querySelector("b").textContent = `+${COIN_REWARD}`;
    ui.winNote.textContent = "";
    ui.next.textContent = T.tut.startGame;
    ui.replay.hidden = true;
    ui.win.hidden = false;
    return;
  }

  const step = tutorial.step;
  const pending = tutorial.pending();

  ui.coachTop.hidden = false;
  ui.coachTitle.hidden = !step.title;
  ui.coachTitle.textContent = step.title || "";
  ui.coachText.innerHTML = step.top;
  ui.coachNext.hidden = !step.button;
  if (step.button) ui.coachNext.textContent = step.button;

  ui.coachBottom.hidden = !step.bottom;
  ui.coachBottom.classList.toggle("tappable", Boolean(step.free));
  ui.coachHint.innerHTML = step.bottom || "";

  // Đổi bước thì cho hai thẻ hiện lại từ đầu; trong cùng một bước (đánh dở vài
  // ô) thì để yên, nếu không mỗi cú bấm lại thấy thẻ nháy một cái.
  if (state.shownStep !== step.id) {
    state.shownStep = step.id;
    replay(ui.coachTop, "enter");
    if (step.bottom) replay(ui.coachBottom, "enter");
    if (step.focus) replay(view.handEl, "enter");
  }

  view.render(); // con vật đặt sẵn được ghi thẳng vào bàn cờ, cần vẽ lại
  if (step.highlight) view.highlight(step.highlight, "hint");
  // Ô còn phải bấm được khoanh vòng; bấm xong thì vòng biến mất theo.
  if (step.focus) view.setFocus(step.focus, pending.length ? step.ring : null);

  // Bàn tay minh hoạ: nhấn nhịp ở ô cần bấm đúp, hoặc trượt qua dãy ô cần vuốt.
  if (!pending.length) view.hideHand();
  else if (step.ring) view.showHand([step.ring], "tap");
  else if (step.gesture === "swipe") view.showHand(pending, "swipe");
  else view.hideHand();

  refreshHud();
}

function onTutorialChange() {
  refreshHud();
  if (!state.tutorial.checkProgress()) return renderCoach();

  // Xong một bước: bỏ lớp tối cho người chơi nhìn thấy toàn bàn cờ một nhịp,
  // rồi mới sang bước kế.
  state.flashing = true;
  view.clearHighlights();
  view.setFocus(null);
  view.hideHand();
  $("board").classList.add("flash");
  setTimeout(() => {
    $("board").classList.remove("flash");
    state.flashing = false;
    state.tutorial.advance();
    renderCoach();
  }, FLASH_MS);
}

ui.coachNext.addEventListener("click", () => {
  // Nút này dùng chung với Apply của gợi ý: chỉ là "Got it!" khi bước hiện tại
  // thật sự có nút, và không có gợi ý nào đang chờ.
  if (!state.tutorial?.step.button || state.offer) return;
  state.tutorial.advance();
  renderCoach();
});

// ------------------------------------------------------------ nút trợ giúp

/**
 * Thẻ gợi ý kiểu Meowdoku: phủ tối màn hình, sáng đúng những ô liên quan và vẽ
 * sẵn ✕ mờ lên chúng để thấy trước kết quả, rồi chờ bấm Apply.
 */
function offerMove(move, text) {
  state.offer = move;
  screens.play.classList.add("offering");
  ui.coachTitle.hidden = true;
  ui.coachText.innerHTML = text;
  ui.coachTop.classList.add("tip");
  ui.coachTop.hidden = false;
  // Thẻ nhắc dưới bàn cờ nhường chỗ cho nút Apply; renderCoach sẽ trả nó lại.
  ui.coachBottom.hidden = true;
  ui.apply.textContent = T.apply;
  ui.apply.hidden = false;
  view.clearHighlights();
  // Sáng cả ô bị ảnh hưởng lẫn ô gây ra suy luận; ô gây ra có viền riêng để
  // người chơi thấy "vì mấy ô này" chứ không chỉ thấy kết quả.
  view.setFocus([...move.cells, ...(move.cause || [])]);
  if (move.cause) view.highlight(move.cause, "cause");
  if (move.action === "eliminate") view.highlight(move.cells, "preview");
  refreshHud();
}

// Apply nằm đè lên hai nút trợ giúp, nên cú thứ hai của một lần bấm đúp rơi
// trúng nút 💡 và mở ngay gợi ý mới. Chặn bằng hai lớp:
//   1. Đang chìa gợi ý  → cả màn chơi tắt tương tác, chỉ Apply bấm được (CSS).
//   2. Vừa bấm Apply xong → khoá thêm một nhịp ngắn, đủ nuốt cú bấm thứ hai.
const BOOSTER_COOLDOWN_MS = 450;
let boosterLockedUntil = 0;
const boostersLocked = () => performance.now() < boosterLockedUntil;

function closeOffer() {
  state.offer = null;
  screens.play.classList.remove("offering");
  state.scored = state.board ? state.board.cats().length : 0;
  ui.coachTop.hidden = true;
  ui.coachTop.classList.remove("tip");
  ui.apply.hidden = true;
  view.setFocus(null);
  view.clearHighlights();
}

/**
 * Gợi ý mà bản gốc đưa ra trước tiên: chọn một con vật đã đặt rồi loại nốt các
 * ô còn trống trong hàng, cột, vùng và các ô kề nó. Hết chỗ loại mới nhờ bộ giải.
 */
function eliminationAroundAnt() {
  const board = state.board;
  const puzzle = state.puzzle;
  for (const [r, c] of board.cats()) {
    const region = puzzle.regionAt(r, c);
    const cells = [];
    for (let i = 0; i < board.size; i++)
      for (let j = 0; j < board.size; j++) {
        if (board.get(i, j) !== EMPTY) continue;
        const blocked = i === r || j === c || puzzle.regionAt(i, j) === region ||
          (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1);
        if (blocked) cells.push([i, j]);
      }
    if (cells.length) return { action: "eliminate", cells, text: T.hintAroundAnt };
  }
  return null;
}

/** Tìm và chìa ra một gợi ý; trả về false nếu không còn gì để gợi. */
function offerHint() {
  const move = eliminationAroundAnt() ||
    nextDeduction(stateFromBoard(state.puzzle, state.board.cells));
  if (!move) {
    ui.hintText.textContent = state.board.isSolved() ? T.solved : T.noHint;
    return false;
  }
  state.hintsUsed++;
  if (!state.tutorial) state.progress = markDirty(state.progress);
  offerMove(
    move,
    move.text || `${move.action === "place" ? T.hintPlace : T.hintExclude} — ${explain(move.reason, state.puzzle)}`,
  );
  return true;
}

ui.hint.addEventListener("click", () => {
  if (state.offer || boostersLocked()) return;
  if (!canUse("hint")) return void spend("hint");
  // Chỉ tính lượt khi thật sự suy ra được nước đi để chỉ.
  if (offerHint()) spend("hint");
  refreshHud();
});

// Thẻ "Tap here for a hint" ở bước tự chơi của tutorial: bấm vào là ra gợi ý,
// không tốn lượt — bản gốc dạy nút gợi ý bằng chính thẻ này.
ui.coachBottom.addEventListener("click", () => {
  // Thẻ này hiện lại ở đúng chỗ nút Apply vừa biến mất, nên cũng phải chịu khoá
  // nguội sau Apply — không thì bấm đúp Apply là mở gợi ý mới ngay.
  if (!state.tutorial?.step.free || state.offer || boostersLocked()) return;
  offerHint();
});

// Nút con kiến: đặt hộ một con đúng chỗ.
ui.reveal.addEventListener("click", () => {
  if (state.offer || boostersLocked()) return;
  if (!canUse("reveal")) return void spend("reveal");
  const row = state.puzzle.solution.findIndex((col, r) => state.board.get(r, col) !== CAT);
  if (row === -1) {
    ui.hintText.textContent = T.solved;
    return;
  }
  if (!spend("reveal")) return;
  state.hintsUsed++;
  state.progress = markDirty(state.progress);
  offerMove({ action: "place", cells: [[row, state.puzzle.solution[row]]] }, T.hintReveal);
});

ui.apply.addEventListener("click", () => {
  const move = state.offer;
  if (!move) return;
  closeOffer();
  boosterLockedUntil = performance.now() + BOOSTER_COOLDOWN_MS;
  if (move.action === "place") {
    const [r, c] = move.cells[0];
    // Ô đang mang ✕ thì gỡ ra trước, nếu không con vật sẽ không đặt được.
    if (state.board.get(r, c) !== EMPTY) state.board.apply([[r, c, EMPTY]]);
    view.placeCat(r, c);
  } else {
    view.commit(move.cells.map(([r, c]) => [r, c, MARK]));
  }
});

// ---------------------------------------------------------------- kết màn

function finishLevel() {
  view.locked = true;
  const stars = starsFor(state.hintsUsed);
  state.progress = addCoins(
    touchStreak(onLevelWon(markCleared(state.progress, state.level, stars), state.level)),
    COIN_REWARD,
  );
  refreshCoins();
  refreshHud(); // chuỗi thắng vừa +1, đừng để HUD sau lưng hộp thoại còn số cũ

  ui.winTitle.textContent = T.cleared;
  // Không có dòng tổng kết ở màn thắng. Vẫn phải xoá, vì hộp thoại này dùng
  // chung với màn hết mạng — nó có để lại chữ ở đó.
  ui.winNote.textContent = "";
  ui.next.textContent = T.nextLevel;
  ui.replay.hidden = false;
  ui.win.hidden = false;
  celebrate(COIN_REWARD);
}

// ------------------------------------------------------------- ăn mừng

const CONFETTI_PIECES = 26;

/**
 * Kiến reo mừng bung vào, rồi tới dòng tiền thưởng, pháo giấy rơi suốt phía sau.
 * Nhịp lấy theo màn thắng của Marble Sort.
 */
function celebrate(coins) {
  cheer();
  ui.winReward.hidden = false;
  ui.winReward.querySelector("b").textContent = `+${coins}`;

  ui.confetti.innerHTML = Array.from({ length: CONFETTI_PIECES }, () => {
    // Mỗi mảnh một màu trong bảng màu vùng, rơi lệch và xoay ngẫu nhiên.
    const style = [
      `--x:${Math.random() * 100}%`,
      `--drift:${(Math.random() - 0.5) * 120}px`,
      `--spin:${Math.random() * 720 - 360}deg`,
      `--dur:${2.6 + Math.random() * 2.2}s`,
      `--delay:${Math.random() * 0.9}s`,
      `--tone:var(--g${Math.floor(Math.random() * 12)})`,
      `--w:${6 + Math.random() * 6}px`,
    ].join(";");
    return `<i style="${style}"></i>`;
  }).join("");
}

function cheer() {
  showArt("ant-happy");
}

/**
 * Đặt hình vào hộp thoại. Gán lại innerHTML mỗi lần để animation chạy từ đầu —
 * thắng màn thứ hai mà kiến đứng im thì mất nửa cái hay.
 */
function showArt(kind) {
  ui.winArt.hidden = false;
  ui.winArt.innerHTML = `<i class="${kind}"></i>`;
}

/** Dẹp pháo giấy khi đóng hộp thoại — không thì 26 animation cứ chạy mãi. */
function stopCelebration() {
  ui.confetti.innerHTML = "";
  ui.winReward.hidden = true;
}

function gameOver() {
  view.locked = true;
  state.progress = onLevelFailed(state.progress, state.level);
  closeOffer();
  stopCelebration();
  // Hết mạng: kiến bối rối, không phải kiến reo mừng.
  showArt("ant-sad");
  ui.winTitle.textContent = T.outOfLives;
  ui.winReward.hidden = true;
  ui.winNote.textContent = T.outOfLivesNote;
  ui.next.textContent = T.tryAgain;
  ui.replay.hidden = true;
  ui.win.hidden = false;
}

ui.next.addEventListener("click", () => {
  ui.win.hidden = true;
  stopCelebration();
  if (state.tutorial) return startLevel(1);
  if (state.lives <= 0) return startLevel(state.level); // Try again
  startLevel(state.level + 1);
});

ui.replay.addEventListener("click", () => {
  ui.win.hidden = true;
  stopCelebration();
  startLevel(state.level);
});

// ------------------------------------------- chốt chặn phóng to khi bấm đúp
//
// `touch-action: manipulation` trong CSS lo được phần lớn, nhưng Safari trên
// iOS vẫn lọt ở những cú chạm không ai gọi preventDefault. Chốt cuối, đặt ở
// mức cả trang: hai cú chạm liên tiếp vừa nhanh vừa gần nhau thì huỷ hành vi
// mặc định của cú thứ hai.
//
// Ngoài bàn cờ thì phải xét **khoảng cách**, không chỉ thời gian: chạm nhanh
// vào hai nút khác nhau là thao tác hợp lệ, huỷ mất thì nút thứ hai coi như
// hỏng. Hai nút gần nhau nhất trên màn hình cách nhau ~150px nên 90px vẫn an
// toàn; ngưỡng cũ 48px hụt hẳn so với một cú bấm đúp lệch tay trên ô cỡ lớn.
//
// Trong bàn cờ thì bỏ hẳn phép đo khoảng cách: ở đó bấm đúp là thao tác đặt
// kiến, chạy bằng pointerdown chứ không cần click, nên huỷ mặc định bao nhiêu
// cũng không mất gì.
const TAP_GUARD_MS = 500;
const TAP_GUARD_PX = 90;
let lastTapAt = 0;
let lastTapX = 0;
let lastTapY = 0;

document.addEventListener(
  "touchend",
  (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const now = performance.now();
    const near = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY) < TAP_GUARD_PX;
    const onBoard = event.target instanceof Element && event.target.closest("#board");
    if ((onBoard || near) && now - lastTapAt < TAP_GUARD_MS) event.preventDefault();
    lastTapAt = now;
    lastTapX = touch.clientX;
    lastTapY = touch.clientY;
  },
  { passive: false }, // không có dòng này thì preventDefault bị bỏ qua
);

// ------------------------------------------------------------------ cài đặt

ui.soundToggle.addEventListener("change", () => {
  sound.enabled = ui.soundToggle.checked;
  if (sound.enabled) sound.pop(); // nghe thử ngay
});

function refreshSettings() {
  ui.soundToggle.checked = sound.enabled;
  ui.settingsNote.textContent = T.settingsNote(state.progress.streak || 0, state.progress.best || 0);
  // Chỉ chơi lại được khi đang ở trong một màn thật — không phải trang chủ, không phải hướng dẫn.
  ui.restart.hidden = screens.play.hidden || Boolean(state.tutorial);
  ui.language.value = getLocale();
}

for (const button of document.querySelectorAll("[data-settings]"))
  button.addEventListener("click", () => {
    refreshSettings();
    ui.settings.hidden = false;
  });

$("btn-close-settings").addEventListener("click", () => (ui.settings.hidden = true));

ui.restart.addEventListener("click", () => {
  ui.settings.hidden = true;
  // Chơi lại giữa chừng: màn này không còn tính là thắng sạch, và chuỗi thắng đứt.
  state.progress = onLevelRestarted(state.progress);
  startLevel(state.level);
});

// Ô chọn ngôn ngữ: 17 thứ tiếng Meowdoku phát hành, tên viết bằng chính nó.
ui.language.innerHTML = LANGUAGES
  .map((language) => `<option value="${language.code}">${language.name}</option>`)
  .join("");

ui.language.addEventListener("change", async () => {
  // Nạp hỏng thì trả ô chọn về thứ tiếng đang chạy, không để chữ nửa nạc nửa mỡ.
  if (!(await setLocale(ui.language.value))) {
    ui.language.value = getLocale();
    return;
  }
  relocalize();
});

/** Vẽ lại toàn bộ chữ sau khi đổi ngôn ngữ, giữ nguyên chỗ đang chơi. */
function relocalize() {
  applyStatic();
  refreshSettings();
  refreshHome();
  if (screens.play.hidden) return;

  // Thẻ gợi ý đang mở còn giữ câu tiếng cũ — đóng lại cho gọn, lượt gợi ý vẫn đã trừ.
  closeOffer();
  if (state.tutorial) {
    ui.title.textContent = T.tutorialTitle;
    state.tutorial.relocalize();
    renderCoach();
  } else {
    ui.kicker.textContent = T.level;
    refreshHud();
  }
}

// Xoá dữ liệu là việc không lùi được, nên hỏi lại bằng một hộp thoại riêng có
// nói rõ mất những gì — thay cho confirm() của trình duyệt.
$("btn-wipe").addEventListener("click", () => {
  const p = state.progress;
  ui.wipeLosing.textContent = T.wipeLosing(p.cleared || 0, p.coins || 0, p.streak || 0);
  ui.confirm.hidden = false;
});

$("btn-wipe-no").addEventListener("click", () => (ui.confirm.hidden = true));

$("btn-wipe-yes").addEventListener("click", () => {
  state.progress = clearProgress();
  ui.confirm.hidden = true;
  ui.settings.hidden = true;
  show("home");
});

// ------------------------------------------------------------------ khởi động

$("btn-play").addEventListener("click", () => {
  if (!state.progress.tutorialDone && state.progress.cleared === 0) return startTutorial();
  startLevel(currentLevel(state.progress));
});
$("btn-tutorial").addEventListener("click", startTutorial);

applyStatic();
show("home");
