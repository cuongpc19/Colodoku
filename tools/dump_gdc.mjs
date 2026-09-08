// Đọc GDScript đã biên dịch (.gdc, Godot 4.x): giải nén zstd, lấy bảng định
// danh + hằng số + luồng token, in ra thành mã giả gần như nguồn.
//   node dump_gdc.mjs <file.gdc> [--raw]
import { readFileSync } from "node:fs";
import { zstdDecompressSync } from "node:zlib";

const file = process.argv[2];
const raw = process.argv.includes("--raw");
const data = readFileSync(file);
if (data.toString("latin1", 0, 4) !== "GDSC") throw new Error("không phải GDSC");
const version = data.readUInt32LE(4);
const decompressedSize = data.readUInt32LE(8);
const body = decompressedSize === 0 ? data.subarray(12) : zstdDecompressSync(data.subarray(12));

let pos = 0;
const u32 = () => { const v = body.readUInt32LE(pos); pos += 4; return v; };
const i32 = () => { const v = body.readInt32LE(pos); pos += 4; return v; };
const f32 = () => { const v = body.readFloatLE(pos); pos += 4; return v; };
const f64 = () => { const v = body.readDoubleLE(pos); pos += 8; return v; };
const i64 = () => { const v = body.readBigInt64LE(pos); pos += 8; return Number(v); };
const pad4 = () => { pos = (pos + 3) & ~3; };
const str = () => { const len = u32(); const s = body.toString("utf8", pos, pos + len); pos += len; pad4(); return s; };

const identifierCount = u32(), constantCount = u32(), tokenLineCount = u32(), tokenCount = u32();

const identifiers = [];
for (let i = 0; i < identifierCount; i++) {
  const len = u32(); // số ký tự, mỗi ký tự UTF-32LE, từng byte XOR 0xb6
  let s = "";
  for (let j = 0; j < len; j++) {
    const cp = (body[pos] ^ 0xb6) | ((body[pos + 1] ^ 0xb6) << 8) | ((body[pos + 2] ^ 0xb6) << 16) | ((body[pos + 3] ^ 0xb6) << 24);
    s += String.fromCodePoint(cp >>> 0);
    pos += 4;
  }
  identifiers.push(s);
}

function variant() {
  const header = u32();
  const type = header & 0xff, flags = header >>> 16;
  const is64 = flags & 1;
  switch (type) {
    case 0: return null;
    case 1: return Boolean(u32());
    case 2: return is64 ? i64() : i32();
    case 3: return is64 ? f64() : f32();
    case 4: return JSON.stringify(str());
    case 5: return `Vector2(${f32()}, ${f32()})`;
    case 6: return `Vector2i(${i32()}, ${i32()})`;
    case 7: return `Rect2(${f32()}, ${f32()}, ${f32()}, ${f32()})`;
    case 9: return `Vector3(${f32()}, ${f32()}, ${f32()})`;
    case 20: return `Color(${f32()}, ${f32()}, ${f32()}, ${f32()})`;
    case 21: return "&" + JSON.stringify(str());
    case 22: { // NodePath
      let n = u32();
      if (n & 0x80000000) { n &= 0x7fffffff; const sub = u32(); const fl = u32(); const parts = []; for (let i = 0; i < n + sub; i++) parts.push(str()); return "^" + JSON.stringify((fl & 1 ? "/" : "") + parts.slice(0, n).join("/") + (sub ? ":" + parts.slice(n).join(":") : "")); }
      return "^" + JSON.stringify(str());
    }
    case 27: { // Dictionary
      const kt = (header >>> 16) & 0b11, vt = (header >>> 18) & 0b11;
      if (kt === 1) u32(); else if (kt === 2 || kt === 3) str();
      if (vt === 1) u32(); else if (vt === 2 || vt === 3) str();
      const count = u32() & 0x7fffffff; const out = [];
      for (let i = 0; i < count; i++) out.push(`${variant()}: ${variant()}`);
      return `{${out.join(", ")}}`;
    }
    case 28: { // Array
      const tt = (header >>> 16) & 0b11;
      if (tt === 1) u32(); else if (tt === 2 || tt === 3) str();
      const count = u32() & 0x7fffffff; const out = [];
      for (let i = 0; i < count; i++) out.push(variant());
      return `[${out.join(", ")}]`;
    }
    case 29: { const n = u32(); const b = body.subarray(pos, pos + n); pos += n; pad4(); return `PackedByteArray(${[...b].join(",")})`; }
    case 30: { const n = u32(); const o = []; for (let i = 0; i < n; i++) o.push(i32()); return `PackedInt32Array(${o.join(",")})`; }
    case 31: { const n = u32(); const o = []; for (let i = 0; i < n; i++) o.push(i64()); return `PackedInt64Array(${o.join(",")})`; }
    case 32: { const n = u32(); const o = []; for (let i = 0; i < n; i++) o.push(f32()); return `PackedFloat32Array(${o.join(",")})`; }
    case 33: { const n = u32(); const o = []; for (let i = 0; i < n; i++) o.push(f64()); return `PackedFloat64Array(${o.join(",")})`; }
    case 34: { const n = u32(); const o = []; for (let i = 0; i < n; i++) o.push(JSON.stringify(str())); return `PackedStringArray(${o.join(",")})`; }
    default: throw new Error(`variant type ${type} chưa hỗ trợ tại ${pos}`);
  }
}
const constants = [];
for (let i = 0; i < constantCount; i++) constants.push(variant());

pos += tokenLineCount * 8; // dòng
pos += tokenLineCount * 8; // cột

// Bảng token của Godot 4.4/4.5 (bytecode 100/101).
const NAMES = `EMPTY ANNOTATION IDENTIFIER LITERAL < <= > >= == != and or not && || ! & | ~ ^ << >> + - * ** / % = += -= *= **= /= %= <<= >>= &= |= ^= if elif else for while break continue pass return match when as assert await breakpoint class class_name const enum extends func in is namespace preload self signal static super trait var void yield [ ] { } ( ) , ; . .. : $ -> _ NEWLINE INDENT DEDENT PI TAU INF NAN VCS_CONFLICT BACKTICK ? ERROR EOF`.split(" ");
if (version >= 101) NAMES.splice(NAMES.indexOf("..") + 1, 0, "..."); // 4.5 thêm token ... (đo từ dữ liệu thật)

const tokens = [];
for (let i = 0; i < tokenCount; i++) {
  // Mỗi token 8 byte: u32 (bit7 = cờ, bit0-6 = loại, bit8+ = chỉ số) + u32 dòng.
  const v = u32();
  const type = v & 0x7f, index = v >>> 8;
  const line = u32();
  tokens.push({ type, index, line });
}

if (raw) { console.log({ version, identifiers, constants }); }
let line = "", depth = 0, lastLine = -1;
const flush = () => { if (line.trim()) console.log("  ".repeat(Math.max(0, depth)) + line.trim()); line = ""; };
for (const t of tokens) {
  const name = NAMES[t.type] ?? `<${t.type}>`;
  if (t.line !== lastLine) { flush(); lastLine = t.line; }
  if (name === "NEWLINE") { flush(); continue; }
  if (name === "INDENT") { depth++; continue; }
  if (name === "DEDENT") { depth--; continue; }
  if (name === "EOF") break;
  let text = name;
  if (name === "IDENTIFIER") text = identifiers[t.index] ?? `id?${t.index}`;
  else if (name === "LITERAL") text = String(constants[t.index] ?? `const?${t.index}`);
  else if (name === "ANNOTATION") text = "@" + (identifiers[t.index] ?? "");
  line += text + " ";
}
flush();
