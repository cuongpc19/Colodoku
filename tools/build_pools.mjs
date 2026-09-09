// Dựng kho bàn cho bộ máy chọn màn (src/progression.js), hoàn toàn tự sinh —
// không đụng tới bank giải mã từ APK, chỉ dùng hồ sơ hình dạng rút từ đó.
//
// Kho chia theo (cỡ lưới × bậc khó) y như Meowdoku: máy chọn màn quyết định cỡ
// và bậc, rồi rút tuần tự trong kho tương ứng, hết kho thì xoay/lật bàn đi lại.
//
//   node tools/build_pools.mjs                 → dựng tất cả vào data/pools.json
//   node tools/build_pools.mjs --max-size 7    → dựng thử phần nhẹ trước
//   node tools/build_pools.mjs --only 10 --fresh → dựng lại từ đầu riêng lưới 10
//
// Kho được chia hạn ngạch theo "tầng" khuôn (số vùng ≤2 ô × bậc phình của vùng
// lớn nhất — xem shapeKey trong generate_levels.mjs), đúng tỉ lệ bản gốc. Lý do:
// nếu cứ rút khuôn mới mỗi lần thử thì khuôn cân đối hay thất bại sẽ bị khuôn
// khối-to thế chỗ, và kho gặt được lệch hẳn khỏi phân bố đã gieo. Tầng nào
// không đủ hàng thì kho thiếu đúng chừng đó, không lấy tầng khác bù.
//
// Ghi ra file sau mỗi kho, nên dừng giữa chừng vẫn dùng được phần đã có.
// Chạy lại với cùng hạt giống sẽ ra đúng bộ cũ.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generate, pickShape, rng, servable, shapeKey, shapeStrata } from "./generate_levels.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const maxSize = arg("max-size", 99);
const onlySize = arg("only", 0);
const fresh = process.argv.includes("--fresh");

/** Chia `want` suất cho các tầng theo tỉ lệ, phần dư trao cho phần lẻ lớn nhất. */
function allocate(strata, want) {
  const total = strata.reduce((a, [, n]) => a + n, 0);
  const rows = strata.map(([key, n]) => {
    const exact = (n / total) * want;
    return { key, take: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = want - rows.reduce((a, r) => a + r.take, 0);
  for (const row of [...rows].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    row.take++; left--;
  }
  return rows.filter((r) => r.take > 0).map((r) => [r.key, r.take]);
}

// Cỡ × bậc nào cần bao nhiêu bàn. Bậc cao ở lưới nhỏ và bậc thấp ở lưới lớn
// gần như không bao giờ được rút nên không dựng.
const WANT = {
  4: { 1: 16, 2: 12 },
  5: { 1: 20, 2: 16, 3: 12 },
  6: { 1: 30, 2: 30, 3: 24, 4: 16 },
  7: { 1: 30, 2: 30, 3: 30, 4: 24 },
  8: { 1: 24, 2: 30, 3: 30, 4: 30 },
  9: { 1: 16, 2: 30, 3: 30, 4: 24 },
  10: { 1: 16, 2: 40, 3: 40, 4: 30, 5: 16 },
};

/** Cỡ các vùng của một bàn đã đóng gói, tăng dần. */
function sizesOf(m) {
  const count = new Map();
  for (const ch of m) count.set(ch, (count.get(ch) || 0) + 1);
  return [...count.values()].sort((a, b) => a - b);
}

/**
 * Xếp kho sao cho mấy màn liền nhau không cùng một kiểu bàn.
 *
 * Kho dựng xong là xếp lần lượt từng tầng, mà máy chọn màn rút tuần tự — để
 * nguyên thì người chơi gặp cả cụm bàn giống hệt nhau. Trộn ngẫu nhiên thì vẫn
 * vón cục: kho đúng tỉ lệ bản gốc mà mười màn 10×10 đầu vẫn có thể ra liền sáu
 * bàn vùng nền phình. Nên chia bàn theo bậc phình rồi rải vòng tròn có trọng
 * số — mỗi lượt lấy từ nhóm đang tụt xa tỉ lệ của nó nhất. Tỉ lệ cả kho không
 * đổi một li, chỉ nhịp gặp là đều ra.
 */
function spread(list, seed) {
  const rand = rng(seed);
  const groups = new Map();
  for (const level of list) {
    const bucket = shapeKey(sizesOf(level.m)).split("|").pop();
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(level);
  }
  for (const items of groups.values())
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

  const lanes = [...groups.values()].map((items) => ({ items, taken: 0, share: items.length / list.length }));
  const out = [];
  while (out.length < list.length) {
    let best = null, most = -Infinity;
    for (const lane of lanes) {
      if (lane.taken >= lane.items.length) continue;
      const debt = lane.share * (out.length + 1) - lane.taken;
      if (debt > most) { most = debt; best = lane; }
    }
    out.push(best.items[best.taken++]);
  }
  return out;
}

const file = new URL("../data/pools.json", import.meta.url);
const pools = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};

for (const [sizeKey, byRank] of Object.entries(WANT)) {
  const size = Number(sizeKey);
  if (size > maxSize) continue;
  if (onlySize && size !== onlySize) continue;
  for (const [rankKey, want] of Object.entries(byRank)) {
    const rating = Number(rankKey);
    const key = `${size}x${rating}`;
    const quota = allocate(shapeStrata(size, rating), want);
    const found = fresh ? [] : (pools[key] || []);
    if (found.length >= want) {
      // Kho đã đủ: không sinh thêm, nhưng vẫn xếp lại cho đúng nhịp.
      pools[key] = spread(found, size * 7919 + rating);
      writeFileSync(file, JSON.stringify(pools));
      console.log(`bỏ qua ${key}: đã có ${found.length} (xếp lại)`);
      continue;
    }

    const seen = new Set(found.map((l) => l.m));
    const have = new Map();
    for (const level of found) have.set(shapeKey(sizesOf(level.m)), (have.get(shapeKey(sizesOf(level.m))) || 0) + 1);
    const started = Date.now();
    // Hạt giống gắn với (cỡ, bậc) nên mỗi kho đi một dải riêng, chạy lại vẫn ra y hệt.
    let seed = size * 1_000_003 + rating * 7919 + found.length * 101;
    const shapeRand = rng(seed);
    let tries = 0;
    const short = [];
    for (const [stratum, need] of quota) {
      let got = have.get(stratum) || 0;
      // Ngân sách riêng từng tầng: hết thì bỏ dở tầng đó, KHÔNG chuyển sang tầng
      // dễ đẻ hơn — đó chính là chỗ làm kho cũ lệch.
      const budget = need * 20_000;
      for (let n = 0; got < need && n < budget; n++) {
        tries++; seed++;
        const level = generate(size, seed, pickShape(size, rating, shapeRand, stratum));
        if (!level || level.r !== rating || seen.has(level.m)) continue;
        if (!servable(sizesOf(level.m))) continue; // quá 2 vùng 1 ô: rút ra cũng bị bỏ
        seen.add(level.m);
        found.push(level);
        got++;
      }
      if (got < need) short.push(`${stratum} ${got}/${need}`);
      if (Date.now() - started > 25 * 60_000) break; // chốt chặn, đừng treo cả đêm
    }
    if (short.length) console.log(`   tầng thiếu: ${short.join(", ")}`);
    pools[key] = spread(found, size * 7919 + rating);
    writeFileSync(file, JSON.stringify(pools));
    const status = found.length === want ? "ok " : "THIEU";
    console.log(`${status} ${key.padEnd(6)} ${String(found.length).padStart(2)}/${want}  · ${tries} lần thử · ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
}
console.log("xong: data/pools.json");
