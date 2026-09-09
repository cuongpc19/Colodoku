// Mặt cắt tổ kiến trên trang chủ: năm buồng của tầng đang đào, buồng nào đã
// gác đủ năm đêm thì treo đèn, buồng đang gác có kiến đứng, buồng chưa tới thì
// tối và đánh dấu hỏi. Vẽ bằng SVG dựng tại chỗ — không có ảnh nào ngoài kiến.
//
// Câu chuyện: mỗi màn là một ĐÊM GÁC, năm đêm là một CHƯƠNG, mỗi chương giữ
// an toàn cho một BUỒNG. Hết năm buồng là xong một TẦNG, tổ đào xuống tầng mới
// với lại năm buồng đó.

export const CHAPTER_LEN = 5;
export const ROOMS = ["gate", "eggs", "fungus", "candy", "queen"];

/** Chương chứa màn n (từ 1). */
export const chapterOf = (n) => Math.ceil(n / CHAPTER_LEN);
/** Đêm thứ mấy trong chương (1..5). */
export const nightOf = (n) => ((n - 1) % CHAPTER_LEN) + 1;
/** Tầng chứa chương (từ 1). */
export const floorOf = (chapter) => Math.ceil(chapter / ROOMS.length);
/** Khoá buồng của một chương. */
export const roomOf = (chapter) => ROOMS[(chapter - 1) % ROOMS.length];
/** Màn n có phải đêm cuối của chương không. */
export const endsChapter = (n) => n % CHAPTER_LEN === 0;

/**
 * Trạng thái năm buồng của tầng chứa màn `current` (màn sắp chơi):
 *   done   — chương đã xong
 *   now    — chương đang gác, kèm số đêm đã xong
 *   locked — chưa tới
 */
export function floorRooms(current) {
  const chapter = chapterOf(current);
  const floor = floorOf(chapter);
  const firstChapter = (floor - 1) * ROOMS.length + 1;
  return ROOMS.map((key, i) => {
    const c = firstChapter + i;
    const state = c < chapter ? "done" : c === chapter ? "now" : "locked";
    return { key, chapter: c, state, nights: state === "now" ? nightOf(current) - 1 : state === "done" ? CHAPTER_LEN : 0 };
  });
}

// --------------------------------------------------------------- vẽ

const ICONS = {
  gate: `<path d="M-16 14 V-2 a16 16 0 0 1 32 0 V14 Z" fill="#8a5a3c" stroke="#0f1526" stroke-width="2"/><path d="M-8 14 V2 a8 8 0 0 1 16 0 V14 Z" fill="#141826"/>`,
  eggs: `<ellipse cx="-12" cy="4" rx="9" ry="12" fill="#fff4d6" stroke="#0f1526" stroke-width="2"/><ellipse cx="6" cy="0" rx="9" ry="12" fill="#fff4d6" stroke="#0f1526" stroke-width="2"/><ellipse cx="18" cy="10" rx="8" ry="11" fill="#fff4d6" stroke="#0f1526" stroke-width="2"/>`,
  fungus: `<rect x="-5" y="0" width="10" height="14" rx="3" fill="#e9dcc3" stroke="#0f1526" stroke-width="2"/><path d="M-16 2 a16 12 0 0 1 32 0 z" fill="#ff7b6b" stroke="#0f1526" stroke-width="2"/><circle cx="-6" cy="-4" r="2.5" fill="#fff"/><circle cx="6" cy="-6" r="2" fill="#fff"/>`,
  candy: `<g transform="rotate(-20)"><rect x="-13" y="-8" width="26" height="16" rx="8" fill="#ff8fc6" stroke="#0f1526" stroke-width="2"/><path d="M-13 -8 L-22 -14 L-19 0 L-22 14 L-13 8 Z M13 -8 L22 -14 L19 0 L22 14 L13 8 Z" fill="#ffc46b" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"/><path d="M-6 -6 q6 6 0 12 M4 -6 q6 6 0 12" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/></g>`,
  queen: `<path d="M-18 10 L-14 -8 L-5 2 L0 -12 L5 2 L14 -8 L18 10 Z" fill="#ffc46b" stroke="#0f1526" stroke-width="2"/><rect x="-18" y="10" width="36" height="6" fill="#ffc46b" stroke="#0f1526" stroke-width="2"/>`,
};

const ROOM_Y = [52, 132, 212, 292, 372];
const SIDE = [-1, 1, -1, 1, 0];

function lantern(x, y, lit) {
  const glow = lit ? `<circle cx="${x}" cy="${y}" r="26" fill="url(#lampglow)"/>` : "";
  const col = lit ? "#ffc46b" : "#3a4260";
  return `${glow}<rect x="${x - 6}" y="${y - 9}" width="12" height="16" rx="3" fill="${col}" stroke="#0f1526" stroke-width="2"/><rect x="${x - 3}" y="${y - 13}" width="6" height="4" fill="#0f1526"/>`;
}

/**
 * Vẽ mặt cắt tổ vào `container`. `names` là tên buồng theo ngôn ngữ đang chọn,
 * cùng thứ tự ROOMS. Kiến gác đứng ở buồng đang gác, dùng ảnh trong `antUrl`.
 */
export function renderNest(container, rooms, names, antUrl) {
  const out = [];
  out.push(`<path d="M180 -10 V372" stroke="#2a1a12" stroke-width="26" stroke-linecap="round"/>`);
  rooms.forEach((room, i) => {
    const y = ROOM_Y[i];
    const side = SIDE[i];
    const cx = 180 + side * 105;
    if (side) out.push(`<path d="M180 ${y} H${cx}" stroke="#2a1a12" stroke-width="22" stroke-linecap="round"/>`);
    const fill = { done: "#3d2a1e", now: "#4a3324", locked: "#1c1410" }[room.state];
    const stroke = room.state === "locked" ? "#2a1a12" : "#ffc46b";
    const dash = room.state === "now" ? ' stroke-dasharray="6 6"' : "";
    out.push(`<ellipse cx="${cx}" cy="${y}" rx="58" ry="40" fill="${fill}" stroke="${stroke}" stroke-width="3"${dash}/>`);
    if (room.state === "locked") out.push(`<text x="${cx}" y="${y + 7}" text-anchor="middle" font-size="22" fill="#3a4260">?</text>`);
    else out.push(`<g transform="translate(${cx} ${y - 6})">${ICONS[room.key]}</g>`);
    out.push(lantern(cx + 40, y - 30, room.state === "done"));
    out.push(`<text x="${cx}" y="${y + 56}" text-anchor="middle" font-size="12" font-weight="700" fill="${room.state === "locked" ? "#8b93a8" : "#eef0f7"}">${names[i]}</text>`);
    if (room.state === "done")
      out.push(`<g transform="translate(${cx - 40} ${y - 38})"><circle r="11" fill="#6ee0b1"/><path d="M-5 0 l3 4 l7 -8" stroke="#141826" stroke-width="2.5" fill="none"/></g>`);
    if (room.state === "now")
      out.push(`<image href="${antUrl}" x="${cx - 82}" y="${y - 46}" width="46" height="46"/>`);
  });
  container.innerHTML = `<svg viewBox="0 -24 360 460" aria-hidden="true">
<defs><radialGradient id="lampglow"><stop offset="0" stop-color="#ffc46b" stop-opacity=".55"/><stop offset="1" stop-color="#ffc46b" stop-opacity="0"/></radialGradient></defs>
<rect x="-10" y="-20" width="380" height="14" fill="#5e8f35"/>
<path d="M120 -6 q60 -70 120 0 z" fill="#8a5a3c"/><rect x="168" y="-30" width="24" height="26" rx="12" fill="#2a1a12"/>
${out.join("")}</svg>`;
}
