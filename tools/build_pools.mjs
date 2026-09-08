// Dựng kho bàn cho bộ máy chọn màn (src/progression.js), hoàn toàn tự sinh —
// không đụng tới bank giải mã từ APK, chỉ dùng hồ sơ hình dạng rút từ đó.
//
// Kho chia theo (cỡ lưới × bậc khó) y như Meowdoku: máy chọn màn quyết định cỡ
// và bậc, rồi rút tuần tự trong kho tương ứng, hết kho thì xoay/lật bàn đi lại.
//
//   node tools/build_pools.mjs                 → dựng tất cả vào data/pools.json
//   node tools/build_pools.mjs --max-size 7    → dựng thử phần nhẹ trước
//
// Ghi ra file sau mỗi kho, nên dừng giữa chừng vẫn dùng được phần đã có.
// Chạy lại với cùng hạt giống sẽ ra đúng bộ cũ.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generate, pickShape, rng } from "./generate_levels.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const maxSize = arg("max-size", 99);

// Cỡ × bậc nào cần bao nhiêu bàn. Bậc cao ở lưới nhỏ và bậc thấp ở lưới lớn
// gần như không bao giờ được rút nên không dựng.
const WANT = {
  4: { 1: 16, 2: 12 },
  5: { 1: 20, 2: 16, 3: 12 },
  6: { 1: 30, 2: 30, 3: 24, 4: 16 },
  7: { 1: 30, 2: 30, 3: 30, 4: 24 },
  8: { 1: 24, 2: 30, 3: 30, 4: 30 },
  9: { 1: 16, 2: 24, 3: 24, 4: 24 },
  10: { 1: 12, 2: 24, 3: 24, 4: 24, 5: 16 },
};

const file = new URL("../data/pools.json", import.meta.url);
const pools = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};

for (const [sizeKey, byRank] of Object.entries(WANT)) {
  const size = Number(sizeKey);
  if (size > maxSize) continue;
  for (const [rankKey, want] of Object.entries(byRank)) {
    const rating = Number(rankKey);
    const key = `${size}x${rating}`;
    if ((pools[key] || []).length >= want) { console.log(`bỏ qua ${key}: đã có ${pools[key].length}`); continue; }

    const found = pools[key] || [];
    const seen = new Set(found.map((l) => l.m));
    const started = Date.now();
    // Hạt giống gắn với (cỡ, bậc) nên mỗi kho đi một dải riêng, chạy lại vẫn ra y hệt.
    let seed = size * 1_000_003 + rating * 7919 + found.length * 101;
    const shapeRand = rng(seed);
    let tries = 0;
    while (found.length < want && tries < 400_000) {
      tries++; seed++;
      const level = generate(size, seed, pickShape(size, rating, shapeRand));
      if (!level || level.r !== rating || seen.has(level.m)) continue;
      seen.add(level.m);
      found.push(level);
      if (Date.now() - started > 25 * 60_000) break; // chốt chặn, đừng treo cả đêm
    }
    pools[key] = found;
    writeFileSync(file, JSON.stringify(pools));
    const status = found.length === want ? "ok " : "THIEU";
    console.log(`${status} ${key.padEnd(6)} ${String(found.length).padStart(2)}/${want}  · ${tries} lần thử · ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
}
console.log("xong: data/pools.json");
