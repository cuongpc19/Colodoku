// Đo tần suất "gỡ được ngách khó" theo cửa 1 (bộ giải) trên toàn bộ kho bàn.
//
// Mô phỏng người chơi thường: chỉ đặt kiến, game tự đánh ✕, mỗi lượt nhặt ô dễ
// nhất còn lại. Với mỗi nước, hỏi placementRank trên bàn ngay trước nó — đúng
// đường đi mà src/game.js dùng — rồi áp mốc "bậc >= bậc của bàn".
import fs from "node:fs";
import { State, placementRank, stateFromBoard, EASY_RANKS } from "../src/solver.js";
import { Puzzle } from "../src/puzzle.js";

const pools = JSON.parse(fs.readFileSync("data/pools.json", "utf8"));
const COOLDOWN = 1;
let worst = 0, calls = 0, spent = 0;

console.log("kho       bàn  nước   qua cửa 1   mỗi bàn   % bàn có ít nhất 1");
for (const [key, list] of Object.entries(pools.pools ?? pools).sort((a, b) =>
  a[0].localeCompare(b[0], undefined, { numeric: true }))) {
  if (!Array.isArray(list)) continue;
  const size = Number(key.split("x")[0]);
  let moves = 0, pass = 0, boardsWith = 0;

  for (const level of list) {
    const puzzle = new Puzzle(level, size);
    const rating = level.r || 0;
    const bar = Math.min(rating, EASY_RANKS + 1);
    // Bàn cờ như game giữ: 0 trống, 1 dấu ✕, 2 con kiến.
    const cells = Array.from({ length: size }, () => new Array(size).fill(0));
    const left = new Set(puzzle.solution.map((_, r) => r));
    let since = 99, hits = 0;

    while (left.size) {
      const before = stateFromBoard(puzzle, cells);
      let best = null, easiest = 99;
      for (const r of left) {
        const t0 = performance.now();
        const rank = placementRank(before, r, puzzle.solution[r]);
        spent += performance.now() - t0; calls++;
        worst = Math.max(worst, performance.now() - t0);
        if (rank < easiest) { easiest = rank; best = r; }
        if (rank === 1) break;
      }
      moves++;
      const ok = rating >= 2 && easiest >= bar && since >= COOLDOWN && left.size < size;
      if (ok) { pass++; hits++; since = 0; } else since++;

      // Đặt kiến + loạt ✕ tự đánh, đúng như placeCat.
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
  console.log(`${key.padEnd(8)} ${String(list.length).padStart(4)} ${String(moves).padStart(5)} ` +
    `${String(pass).padStart(11)} ${(pass / list.length).toFixed(2).padStart(9)} ` +
    `${String(Math.round(boardsWith / list.length * 100)).padStart(17)}%`);
}
console.log(`\nchấm 1 ô: trung bình ${(spent / calls).toFixed(2)}ms · chậm nhất ${worst.toFixed(1)}ms`);
