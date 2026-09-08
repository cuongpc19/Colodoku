// Rút "hồ sơ hình dạng" từ bộ level gốc: với mỗi (cỡ lưới × bậc khó), đếm xem
// các màn chia vùng ra sao — bao nhiêu vùng 1 ô, 2 ô, 3 ô..., vùng nền lớn cỡ
// nào, ô đơn hay nằm ở biên không. Chỉ giữ lại thống kê (cỡ vùng đã sắp xếp,
// tỉ lệ), không giữ hình dạng hay vị trí ô nào của màn gốc. Bộ sinh của mình
// dùng hồ sơ này làm khuôn để bàn sinh ra chia vùng y như bản gốc.
//
//   node tools/profile_shapes.mjs   → data/reference/shape-profile.json

import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dataDir = new URL("../data/", import.meta.url);

function describe(m, size) {
  const counts = {};
  const cells = {};
  for (let i = 0; i < m.length; i++) {
    counts[m[i]] = (counts[m[i]] || 0) + 1;
    (cells[m[i]] ||= []).push([Math.floor(i / size), i % size]);
  }
  const signature = Object.values(counts).sort((a, b) => a - b).join(",");
  let singles = 0, onEdge = 0, inCorner = 0;
  for (const [id, n] of Object.entries(counts)) {
    if (n !== 1) continue;
    singles++;
    const [r, c] = cells[id][0];
    const edge = r === 0 || c === 0 || r === size - 1 || c === size - 1;
    const corner = (r === 0 || r === size - 1) && (c === 0 || c === size - 1);
    if (corner) inCorner++;
    else if (edge) onEdge++;
  }
  return { signature, singles, onEdge, inCorner };
}

// Bộ "classic" là bộ chính; các bộ khác chỉ dùng cho cỡ mà classic không có.
const profile = {};
const source = {};
const banks = readdirSync(dataDir).filter((f) => /^[a-z]+-\d+x\d+\.json$/.test(f));
for (const primary of [true, false]) {
  for (const file of banks) {
    const bank = JSON.parse(readFileSync(new URL(file, dataDir), "utf8"));
    const isClassic = bank.variant === "classic";
    if (isClassic !== primary) continue;
    for (const [rating, levels] of Object.entries(bank.tiers)) {
      const key = `${bank.size}x${rating}`;
      if (primary) source[key] = "classic";
      else if (source[key] === "classic") continue;
      else source[key] = (source[key] ? source[key] + "+" : "") + bank.variant;
      const entry = (profile[key] ||= { shapes: {}, singles: 0, edge: 0, corner: 0 });
      for (const level of levels) {
        const d = describe(level.m, bank.size);
        entry.shapes[d.signature] = (entry.shapes[d.signature] || 0) + 1;
        entry.singles += d.singles;
        entry.edge += d.onEdge;
        entry.corner += d.inCorner;
      }
    }
  }
}

// Đổi số đếm ô đơn thành xác suất "ô đơn nằm ở cạnh / ở góc".
for (const entry of Object.values(profile)) {
  const n = entry.singles || 1;
  entry.edgeShare = entry.edge / n;
  entry.cornerShare = entry.corner / n;
  delete entry.singles; delete entry.edge; delete entry.corner;
}

writeFileSync(new URL("reference/shape-profile.json", dataDir), JSON.stringify({ source, profile }));
for (const key of Object.keys(profile).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
  const total = Object.values(profile[key].shapes).reduce((a, b) => a + b, 0);
  console.log(`${key.padEnd(6)} ${String(total).padStart(5)} màn · ${String(Object.keys(profile[key].shapes).length).padStart(4)} chữ ký · ô đơn ở cạnh ${(profile[key].edgeShare * 100).toFixed(0)}% góc ${(profile[key].cornerShare * 100).toFixed(0)}% · ${source[key]}`);
}
