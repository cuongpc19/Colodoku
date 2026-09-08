// Đối chiếu bộ giải của mình với hồ sơ độ khó có sẵn trong bank của Meowdoku.
//
// Mỗi puzzle trong bank của họ mang sẵn steps và r1..r5 — kết quả solver của
// chính họ. Chạy solver của mình trên cùng puzzle rồi so số liệu là cách trực
// tiếp nhất để biết mình đã dựng lại đúng thang kỹ thuật của họ hay chưa.
//
//   node tools/verify_solver.mjs [slug] [số lượng mẫu]

import { readFileSync } from "node:fs";
import { Puzzle } from "../src/puzzle.js";
import { analyse } from "../src/solver.js";

const slug = process.argv[2] || "classic-9x9";
const sampleSize = Number(process.argv[3] || 200);

const bank = JSON.parse(readFileSync(new URL(`../data/${slug}.json`, import.meta.url), "utf8"));
const records = [];
for (const [tier, list] of Object.entries(bank.tiers))
  for (const record of list) records.push({ tier: Number(tier), record });

// Lấy mẫu rải đều để mọi bậc độ khó đều có mặt.
const stride = Math.max(1, Math.floor(records.length / sampleSize));
const sample = records.filter((_, i) => i % stride === 0).slice(0, sampleSize);

let solved = 0;
let stepsExact = 0;
let maxRankExact = 0;
const stepDelta = [];
const byRating = new Map();

for (const { record } of sample) {
  const puzzle = new Puzzle(record, bank.size);
  const result = analyse(puzzle);
  if (!result.solved) continue;
  solved++;

  const theirMaxRank = puzzle.techniques.reduce((best, n, i) => (n ? i + 1 : best), 0);
  if (result.steps === puzzle.steps) stepsExact++;
  if (result.maxRank === theirMaxRank) maxRankExact++;
  stepDelta.push(result.steps - puzzle.steps);

  if (!byRating.has(puzzle.rating)) byRating.set(puzzle.rating, []);
  byRating.get(puzzle.rating).push(result.steps);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`bank ${slug} — ${sample.length} mẫu, lưới ${bank.size}x${bank.size}\n`);
console.log(`giải được bằng suy luận thuần : ${solved}/${sample.length}`);
console.log(`khớp chính xác số bước        : ${stepsExact}/${solved}`);
console.log(`khớp cấp kỹ thuật cao nhất    : ${maxRankExact}/${solved}`);
console.log(`lệch số bước trung bình        : ${mean(stepDelta).toFixed(2)}\n`);
console.log("số bước trung bình theo độ khó họ chấm:");
for (const [rating, steps] of [...byRating].sort((a, b) => a[0] - b[0]))
  console.log(`  r=${rating}  n=${String(steps.length).padStart(3)}  ${mean(steps).toFixed(1)} bước`);
