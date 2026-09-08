// Tuyến chơi: màn số mấy thì lấy puzzle nào, và ghi nhớ tiến trình người chơi.
//
// Meowdoku giấu cấu hình tuyến chơi trong GDScript đã biên dịch nên không đọc ra
// được. Bảng dưới đây là tuyến do mình dựng, nhưng bám đúng hai thứ đọc được từ
// dữ liệu của họ: thang độ khó r = cấp kỹ thuật cao nhất (1-5), và nhịp
// "dễ - dễ - khó - dễ" chứ không tăng tuyến tính.

import { SCRIPTED } from "./levels.js";
import { T } from "./strings.js";

// Tên 5 bậc nằm ở bảng chữ (`T.ratings`), dịch từ bản địa hoá của Meowdoku.

// Mỗi chặng: bank nào, bậc khó nào, kéo dài bao nhiêu màn.
const CURRICULUM = [
  { slug: "classic-4x4", size: 4, rating: 1, levels: 5 },
  { slug: "classic-5x5", size: 5, rating: 1, levels: 5 },
  { slug: "classic-5x5", size: 5, rating: 2, levels: 5 },
  { slug: "classic-6x6", size: 6, rating: 1, levels: 10 },
  { slug: "classic-6x6", size: 6, rating: 2, levels: 10 },
  { slug: "classic-6x6", size: 6, rating: 3, levels: 10 },
  { slug: "classic-7x7", size: 7, rating: 2, levels: 15 },
  { slug: "classic-7x7", size: 7, rating: 3, levels: 15 },
  { slug: "classic-7x7", size: 7, rating: 4, levels: 15 },
  { slug: "classic-8x8", size: 8, rating: 3, levels: 20 },
  { slug: "classic-8x8", size: 8, rating: 4, levels: 20 },
  { slug: "classic-8x8", size: 8, rating: 5, levels: 15 },
  { slug: "classic-9x9", size: 9, rating: 3, levels: 20 },
  { slug: "classic-9x9", size: 9, rating: 4, levels: 25 },
  { slug: "classic-9x9", size: 9, rating: 5, levels: 20 },
  { slug: "classic-10x10", size: 10, rating: 4, levels: 25 },
  { slug: "classic-10x10", size: 10, rating: 5, levels: 20 },
  { slug: "gc-11x11", size: 11, rating: 3, levels: 20 },
  { slug: "gc-11x11", size: 11, rating: 4, levels: 25 },
  { slug: "gc-11x11", size: 11, rating: 5, levels: 20 },
  { slug: "classic-12x12", size: 12, rating: 4, levels: 20 },
  { slug: "classic-12x12", size: 12, rating: 5, levels: 20 },
];

export const TOTAL_LEVELS = CURRICULUM.reduce((n, stage) => n + stage.levels, 0);

// Game không đánh ✕ hộ ở màn nào — bản ghi màn hình cho thấy Meowdoku bắt tự
// loại ô ngay từ màn 1, vì đó chính là thao tác chính của trò này. Người chơi
// vẫn có thể tự bật "Auto ✕" trong màn; hằng số này giữ lại để đổi ý được nhanh.
export const AUTO_MARK_UNTIL = 0;

export function autoMarksFor(level) {
  return level <= AUTO_MARK_UNTIL;
}

/**
 * Màn thứ n (đánh số từ 1) thuộc chặng nào và lấy puzzle thứ mấy trong bank.
 * Cứ mỗi 7 màn chèn một màn dễ hơn một bậc làm nhịp nghỉ.
 */
export function levelSpec(n) {
  // Vài màn đầu được chép nguyên từ bản gốc, kể cả cỡ lưới, nên chúng không đi
  // theo bảng CURRICULUM.
  const scripted = SCRIPTED[n - 1];
  if (scripted)
    return {
      level: n, slug: null, size: scripted.size, rating: scripted.record.r, breather: false,
      label: `R${scripted.record.r} ${T.ratings[scripted.record.r]}`, stage: -1, offset: 0, scripted: true,
    };

  let remaining = n - 1;
  let stageIndex = 0;
  for (; stageIndex < CURRICULUM.length; stageIndex++) {
    if (remaining < CURRICULUM[stageIndex].levels) break;
    remaining -= CURRICULUM[stageIndex].levels;
  }
  if (stageIndex >= CURRICULUM.length) return null;

  const stage = CURRICULUM[stageIndex];
  const breather = n % 7 === 0 && stage.rating > 1;
  const rating = breather ? stage.rating - 1 : stage.rating;

  return {
    level: n,
    slug: stage.slug,
    size: stage.size,
    rating,
    breather,
    label: `R${rating} ${T.ratings[rating]}`,
    stage: stageIndex,
    offset: remaining,
  };
}

const bankCache = new Map();

async function loadBank(slug) {
  if (!bankCache.has(slug))
    bankCache.set(slug, fetch(`data/${slug}.json`).then((r) => {
      if (!r.ok) throw new Error(`không tải được bank ${slug}`);
      return r.json();
    }));
  return bankCache.get(slug);
}

/** Bản ghi puzzle cho màn n. Chọn theo chỉ số cố định để chơi lại vẫn ra đúng màn đó. */
export async function levelRecord(n) {
  const spec = levelSpec(n);
  if (!spec) return null;
  const scripted = SCRIPTED[n - 1];
  if (scripted) return { spec, record: scripted.record, size: scripted.size, given: scripted.given || [] };

  // Bản dựng một file (tools/build_single.mjs) nhúng sẵn bản ghi từng màn vào
  // đây, nên không phải tải data/*.json qua mạng.
  const embedded = globalThis.__COLODOKU_LEVELS;
  if (embedded) {
    const entry = embedded[n - 1];
    return entry && { spec, record: entry.record, size: entry.size, given: [] };
  }

  const bank = await loadBank(spec.slug);
  // Bậc nhịp nghỉ có thể trống ở vài bank nhỏ — lùi về bậc gốc của chặng.
  const list = bank.tiers[spec.rating] || bank.tiers[String(spec.rating + 1)];
  if (!list || !list.length) return null;
  return { spec, record: list[spec.offset % list.length], size: bank.size, given: [] };
}

// ------------------------------------------------------------- tiến trình

const STORE_KEY = "colodoku.progress.v1";

// Ví tiền: thắng một màn được COIN_REWARD, mỗi lượt bấm trợ giúp trừ đi
// COIN_COST tương ứng. Cả ba con số để chung một chỗ vì chúng cân bằng lẫn
// nhau — 100 đồng một màn tức là 5 lần Gợi ý hoặc 2 lần rưỡi Chỉ chỗ.
export const COIN_REWARD = 100;
export const COIN_COST = { reveal: 20, hint: 10 };

// Vốn mở màn: ngần này lượt miễn phí cho mỗi nút, tiêu hết mới phải trả xu.
// Đây là kho dùng chung cả game chứ không phải hạn mức mỗi màn.
export const FREE_USES = 10;

const BLANK = {
  cleared: 0, tutorialDone: false, stars: {}, streak: 0, lastPlayed: null, best: 0, coins: 0,
  free: { reveal: FREE_USES, hint: FREE_USES },
};

export function loadProgress() {
  try {
    return { ...BLANK, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return { ...BLANK };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(progress));
  } catch {
    /* chế độ riêng tư chặn localStorage — chơi vẫn được, chỉ là không nhớ. */
  }
}

/** Xoá sạch tiến trình — chơi lại từ hướng dẫn như người mới. */
export function clearProgress() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* không xoá được thì thôi, bản sao trong bộ nhớ đã bị thay rồi */
  }
  return { ...BLANK };
}

/** Màn đang mở khoá: màn kế tiếp sau màn cao nhất đã qua. */
export function currentLevel(progress) {
  return Math.min(progress.cleared + 1, TOTAL_LEVELS);
}

export function markCleared(progress, n, stars) {
  const next = { ...progress, stars: { ...progress.stars } };
  next.cleared = Math.max(next.cleared, n);
  next.stars[n] = Math.max(next.stars[n] || 0, stars);
  saveProgress(next);
  return next;
}

/** Tiêu một lượt miễn phí. Hết lượt thì trả về null để bên gọi chuyển sang trả xu. */
export function useFree(progress, kind) {
  const free = progress.free || {};
  if (!free[kind]) return null;
  const next = { ...progress, free: { ...free, [kind]: free[kind] - 1 } };
  saveProgress(next);
  return next;
}

/** Cộng tiền thưởng vào ví và ghi đĩa ngay — thắng màn xong là tiền có thật. */
export function addCoins(progress, amount) {
  const next = { ...progress, coins: (progress.coins || 0) + amount };
  saveProgress(next);
  return next;
}

/** Trừ tiền. Không đủ thì trả về null và ví giữ nguyên — bên gọi tự báo người chơi. */
export function spendCoins(progress, amount) {
  if ((progress.coins || 0) < amount) return null;
  const next = { ...progress, coins: progress.coins - amount };
  saveProgress(next);
  return next;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Chuỗi ngày: chơi xong một màn thì tính là đã "điểm danh" hôm nay. Chơi tiếp
 * ngày kế thì chuỗi +1, nghỉ một ngày là chuỗi về 1.
 */
export function touchStreak(progress) {
  const now = today();
  if (progress.lastPlayed === now) return progress;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = progress.lastPlayed === yesterday ? progress.streak + 1 : 1;
  const next = { ...progress, streak, lastPlayed: now, best: Math.max(progress.best || 0, streak) };
  saveProgress(next);
  return next;
}

/** Hôm nay đã điểm danh chưa — để vẽ dấu ✓ trên thẻ Streak. */
export function streakDoneToday(progress) {
  return progress.lastPlayed === today();
}

/**
 * Sao: 3 nếu tự giải không cần gợi ý, 2 nếu dùng 1-2 lần, 1 nếu dùng nhiều hơn.
 */
export function starsFor(hintsUsed) {
  if (hintsUsed === 0) return 3;
  return hintsUsed <= 2 ? 2 : 1;
}
