// Đo tần suất "gỡ được ngách khó" trên toàn bộ kho bàn.
//
// Bậc từng nước là số đo thật: mô phỏng người chơi thường (chỉ đặt kiến, game
// tự đánh ✕, mỗi lượt nhặt ô dễ nhất còn lại) rồi hỏi placementRank trên bàn
// ngay trước nước đó — đúng đường đi mà src/game.js dùng.
//
// Thời gian nghĩ thì KHÔNG có số thật, phải dựng mô hình: mỗi bậc một mốc giây,
// nhân nhiễu log-chuẩn, thêm hệ số nhanh/chậm riêng của từng người chơi. Con số
// ra được là ước lượng, không phải đo đạc.
import fs from "node:fs";
import { placementRank, stateFromBoard, EASY_RANKS } from "../src/solver.js";
import { Puzzle } from "../src/puzzle.js";

const HARD_TRADE = [
  { ratio: 1.5, floor: 8_000 },
  { ratio: 2.2, floor: 15_000 },
  { ratio: 3.0, floor: 25_000 },
];
const WINDOW = 6, COOLDOWN = 1;
const BASE_SEC = { 1: 5, 2: 12, 3: 24, 4: 38 }; // mốc giây theo bậc

let seed = 12345;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const noise = (sigma) => Math.exp((rand() + rand() + rand() - 1.5) * 2 * sigma);
const median = (l) => { const a = [...l].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

const pools = JSON.parse(fs.readFileSync("data/pools.json", "utf8"));
console.log("kho       bàn  nước | bậc>=2 |  khen  mỗi bàn  % bàn có | trong đó dưới trần");
for (const [key, list] of Object.entries(pools.pools ?? pools).sort((a, b) =>
  a[0].localeCompare(b[0], undefined, { numeric: true }))) {
  if (!Array.isArray(list)) continue;
  const size = Number(key.split("x")[0]);
  let moves = 0, eligible = 0, cheers = 0, below = 0, boardsWith = 0;

  for (const level of list) {
    const puzzle = new Puzzle(level, size);
    const bar = Math.min(level.r || 0, EASY_RANKS + 1);
    const pace = noise(0.45); // người chơi này nhanh hay chậm
    const cells = Array.from({ length: size }, () => new Array(size).fill(0));
    const left = new Set(puzzle.solution.map((_, r) => r));
    const gaps = [];
    let since = 99, hits = 0, first = true;

    while (left.size) {
      const before = stateFromBoard(puzzle, cells);
      let best = null, rank = 99;
      for (const r of left) {
        const got = placementRank(before, r, puzzle.solution[r]);
        if (got < rank) { rank = got; best = r; }
        if (got === 1) break;
      }
      moves++;
      if (rank >= 2) eligible++;
      const gap = BASE_SEC[Math.min(rank, 4)] * 1000 * pace * noise(0.5);
      const recent = gaps.slice(-WINDOW);

      let ok = false;
      if (!first && since >= COOLDOWN && rank >= 2) {
        const { ratio, floor } = HARD_TRADE[Math.min(Math.max(bar - rank, 0), 2)];
        if (gap >= floor && gap <= 240_000) {
          const usual = recent.length >= 3 ? median(recent) : Math.max(...recent);
          ok = gap >= usual * ratio;
        }
      }
      if (ok) { cheers++; hits++; since = 0; if (rank < bar) below++; } else since++;
      gaps.push(gap);
      first = false;

      const c = puzzle.solution[best];
      cells[best][c] = 2;
      const region = puzzle.regions[best][c];
      for (let i = 0; i < size; i++)
        for (let j = 0; j < size; j++) {
          if (i === best && j === c) continue;
          const blocked = i === best || j === c || puzzle.regions[i][j] === region ||
            (Math.abs(i - best) <= 1 && Math.abs(j - c) <= 1);
          if (blocked && cells[i][j] === 0) cells[i][j] = 1;
        }
      left.delete(best);
    }
    if (hits) boardsWith++;
  }
  console.log(`${key.padEnd(8)} ${String(list.length).padStart(4)} ${String(moves).padStart(5)} | ` +
    `${String(Math.round(eligible / moves * 100)).padStart(5)}% | ${String(cheers).padStart(5)} ` +
    `${(cheers / list.length).toFixed(2).padStart(8)} ${String(Math.round(boardsWith / list.length * 100)).padStart(8)}% | ` +
    `${String(below).padStart(6)} nước`);
}
