// Mặt cắt tổ kiến trên trang chủ: năm buồng của tầng đang đào, buồng nào đã
// gác đủ năm đêm thì treo đèn, buồng đang gác có kiến đứng, buồng chưa tới thì
// tối và đánh dấu hỏi. Vẽ bằng SVG dựng tại chỗ — không có ảnh nào ngoài kiến.
//
// Câu chuyện: mỗi màn là một ĐÊM GÁC, năm đêm là một CHƯƠNG, mỗi chương giữ
// an toàn cho một BUỒNG. Hết năm buồng là xong một TẦNG, tổ đào xuống tầng mới
// — và tầng mới có năm buồng KHÁC, không lặp lại tên cũ.
//
// Ba tầng đầu có tên và hình riêng; từ tầng 4 thì quay vòng lại, nhưng số tầng
// vẫn tăng nên vẫn phân biệt được. Muốn thêm tầng thì nối một mảng khoá vào
// FLOORS và năm tên vào `rooms` trong data/i18n/*.json, đúng thứ tự.

export const CHAPTER_LEN = 5;

/** Khoá buồng theo tầng. Mỗi tầng đúng CHAPTER_LEN buồng. */
export const FLOORS = [
  ["gate", "eggs", "fungus", "candy", "queen"],
  ["nursery", "well", "granary", "aphids", "winter"],
  ["roots", "spring", "crystal", "vault", "heart"],
];

/** Chương chứa màn n (từ 1). */
export const chapterOf = (n) => Math.ceil(n / CHAPTER_LEN);
/** Đêm thứ mấy trong chương (1..CHAPTER_LEN). */
export const nightOf = (n) => ((n - 1) % CHAPTER_LEN) + 1;
/** Tầng chứa chương (từ 1). */
export const floorOf = (chapter) => Math.ceil(chapter / CHAPTER_LEN);
/** Màn n có phải đêm cuối của chương không. */
export const endsChapter = (n) => n % CHAPTER_LEN === 0;

/** Buồng thứ mấy trong tầng (0..CHAPTER_LEN-1). */
const slotOf = (chapter) => (chapter - 1) % CHAPTER_LEN;
/** Mảng khoá buồng của tầng đó — quay vòng khi hết FLOORS. */
const keysOfFloor = (floor) => FLOORS[(floor - 1) % FLOORS.length];

/**
 * Chỗ của tên buồng trong mảng `rooms` của bảng chữ: mảng đó phẳng, xếp theo
 * tầng rồi tới buồng, nên tầng 2 buồng 1 nằm ở vị trí 5.
 */
export function roomNameIndex(chapter) {
  return (((floorOf(chapter) - 1) % FLOORS.length) * CHAPTER_LEN) + slotOf(chapter);
}

/**
 * Trạng thái năm buồng của tầng chứa màn `current` (màn sắp chơi):
 *   done   — chương đã xong
 *   now    — chương đang gác
 *   locked — chưa tới
 */
export function floorRooms(current) {
  const chapter = chapterOf(current);
  const floor = floorOf(chapter);
  const first = (floor - 1) * CHAPTER_LEN + 1;
  return keysOfFloor(floor).map((key, i) => {
    const c = first + i;
    const state = c < chapter ? "done" : c === chapter ? "now" : "locked";
    return {
      key,
      chapter: c,
      nameIndex: roomNameIndex(c),
      state,
      // Đêm đã gác xong trong buồng này — vòng quanh buồng đang gác vẽ theo nó.
      nights: state === "now" ? nightOf(current) - 1 : state === "done" ? CHAPTER_LEN : 0,
    };
  });
}

// --------------------------------------------------------------- vẽ

const ICONS = {
  // --- tầng 1: mặt đất ---
  gate: `<path d="M-16 14 V-2 a16 16 0 0 1 32 0 V14 Z" fill="#8a5a3c" stroke="#0f1526" stroke-width="2"/><path d="M-8 14 V2 a8 8 0 0 1 16 0 V14 Z" fill="#141826"/>`,
  eggs: `<ellipse cx="-12" cy="4" rx="9" ry="12" fill="#fff4d6" stroke="#0f1526" stroke-width="2"/><ellipse cx="6" cy="0" rx="9" ry="12" fill="#fff4d6" stroke="#0f1526" stroke-width="2"/><ellipse cx="18" cy="10" rx="8" ry="11" fill="#fff4d6" stroke="#0f1526" stroke-width="2"/>`,
  fungus: `<rect x="-5" y="0" width="10" height="14" rx="3" fill="#e9dcc3" stroke="#0f1526" stroke-width="2"/><path d="M-16 2 a16 12 0 0 1 32 0 z" fill="#ff7b6b" stroke="#0f1526" stroke-width="2"/><circle cx="-6" cy="-4" r="2.5" fill="#fff"/><circle cx="6" cy="-6" r="2" fill="#fff"/>`,
  candy: `<g transform="rotate(-20)"><rect x="-13" y="-8" width="26" height="16" rx="8" fill="#ff8fc6" stroke="#0f1526" stroke-width="2"/><path d="M-13 -8 L-22 -14 L-19 0 L-22 14 L-13 8 Z M13 -8 L22 -14 L19 0 L22 14 L13 8 Z" fill="#ffc46b" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"/><path d="M-6 -6 q6 6 0 12 M4 -6 q6 6 0 12" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/></g>`,
  queen: `<path d="M-18 10 L-14 -8 L-5 2 L0 -12 L5 2 L14 -8 L18 10 Z" fill="#ffc46b" stroke="#0f1526" stroke-width="2"/><rect x="-18" y="10" width="36" height="6" fill="#ffc46b" stroke="#0f1526" stroke-width="2"/>`,

  // --- tầng 2: sâu hơn, chỗ nuôi và tích trữ ---
  // Ấu trùng cuộn tròn, ba con nằm cạnh nhau.
  nursery: `<g fill="#fff0d0" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"><path d="M-18 8 a9 9 0 0 1 0 -14 a7 7 0 0 1 8 8 a5 5 0 0 1 -6 2 z"/><path d="M2 12 a9 9 0 0 1 0 -14 a7 7 0 0 1 8 8 a5 5 0 0 1 -6 2 z"/><path d="M14 -2 a7 7 0 0 1 0 -11 a5 5 0 0 1 6 6 a4 4 0 0 1 -5 2 z"/></g>`,
  // Giếng: thành giếng xây đá, mặt nước sáng bên trong.
  well: `<path d="M-16 14 V-4 h32 V14 Z" fill="#6b5a4a" stroke="#0f1526" stroke-width="2"/><ellipse cx="0" cy="-4" rx="16" ry="6" fill="#5fd4e8" stroke="#0f1526" stroke-width="2"/><path d="M-8 -4 a8 3 0 0 0 16 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7"/><path d="M-14 4 h28 M-14 9 h28" stroke="#0f1526" stroke-width="1.4" opacity=".5"/>`,
  // Kho hạt: đống hạt xếp thành tháp.
  granary: `<g fill="#d8b48a" stroke="#0f1526" stroke-width="2"><ellipse cx="-11" cy="9" rx="8" ry="6"/><ellipse cx="6" cy="10" rx="8" ry="6"/><ellipse cx="-3" cy="0" rx="8" ry="6"/><ellipse cx="12" cy="0" rx="7" ry="5"/><ellipse cx="3" cy="-9" rx="7" ry="5"/></g>`,
  // Chuồng rệp: con rệp tròn trên một chiếc lá — kiến nuôi rệp lấy mật.
  aphids: `<path d="M-22 12 q10 -14 26 -12 q12 2 16 10 q-16 8 -30 6 z" fill="#6ea34a" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"/><ellipse cx="2" cy="-6" rx="11" ry="9" fill="#b9e06a" stroke="#0f1526" stroke-width="2"/><circle cx="-2" cy="-8" r="2" fill="#0f1526"/><path d="M-6 -14 l-4 -6 M6 -14 l5 -6" stroke="#0f1526" stroke-width="2" stroke-linecap="round"/>`,
  // Buồng trú đông: bông tuyết sáu cánh.
  winter: `<g stroke="#7ab5ff" stroke-width="3" stroke-linecap="round"><path d="M0 -15 V15 M-13 -8 L13 8 M-13 8 L13 -8"/><path d="M0 -15 l-4 5 M0 -15 l4 5 M0 15 l-4 -5 M0 15 l4 -5" stroke-width="2.4"/></g><circle cx="0" cy="0" r="3" fill="#e8f4ff"/>`,

  // --- tầng 3: tận đáy ---
  // Rễ cây đâm xuống, ba nhánh.
  roots: `<g fill="none" stroke="#a06a3c" stroke-width="4" stroke-linecap="round"><path d="M0 -14 V14"/><path d="M0 -2 q-10 4 -13 14"/><path d="M0 2 q11 3 14 12"/><path d="M0 -10 q-8 1 -10 7"/></g>`,
  // Mạch nước ấm: giọt nước và hai vòng sóng.
  spring: `<path d="M0 -14 q10 12 10 18 a10 10 0 0 1 -20 0 q0 -6 10 -18 z" fill="#5fd4e8" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"/><path d="M-4 4 a5 5 0 0 0 6 5" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/><path d="M-18 12 q6 4 12 0 M8 14 q6 4 12 0" fill="none" stroke="#5fd4e8" stroke-width="2" opacity=".6"/>`,
  // Hang lấp lánh: một viên đá quý cắt mặt.
  crystal: `<path d="M0 -15 L13 -5 L8 14 H-8 L-13 -5 Z" fill="#9d8cff" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"/><path d="M0 -15 L0 14 M-13 -5 H13" stroke="#0f1526" stroke-width="1.6" opacity=".55"/><path d="M-6 -8 L-2 -2" stroke="#fff" stroke-width="2" opacity=".8" stroke-linecap="round"/>`,
  // Kho lớn: ba bao tải xếp chồng.
  vault: `<g fill="#c9a86b" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"><path d="M-18 14 v-9 a8 8 0 0 1 5 -7 l-2 -3 h8 l-2 3 a8 8 0 0 1 5 7 v9 z"/><path d="M2 14 v-9 a8 8 0 0 1 5 -7 l-2 -3 h8 l-2 3 a8 8 0 0 1 5 7 v9 z"/><path d="M-8 -2 v-6 a7 7 0 0 1 4 -6 l-2 -3 h7 l-2 3 a7 7 0 0 1 4 6 v6 z" fill="#d8b48a"/></g>`,
  // Tim tổ: trái tim ấm, chỗ sâu nhất.
  heart: `<path d="M0 14 C-16 4 -18 -6 -11 -11 C-5 -15 0 -10 0 -6 C0 -10 5 -15 11 -11 C18 -6 16 4 0 14 Z" fill="#ff7b6b" stroke="#0f1526" stroke-width="2" stroke-linejoin="round"/><path d="M-6 -6 q2 -4 5 -3" fill="none" stroke="#fff" stroke-width="2" opacity=".75" stroke-linecap="round"/>`,
};

const ROOM_Y = [52, 132, 212, 292, 372];
const SIDE = [-1, 1, -1, 1, 0];
const RX = 58;
const RY = 40;

/* Chu vi hình bầu dục, xấp xỉ Ramanujan — sai số dưới 1‰ ở tỉ lệ này. Cần con
   số thật vì thanh tiến độ vẽ bằng stroke-dasharray, mà dasharray tính theo
   đơn vị chiều dài chứ không theo phần trăm. (`pathLength` thì gọn hơn nhưng
   Safari cũ không nhận nó trên hình cơ bản.) */
const RING = (() => {
  const h = ((RX - RY) / (RX + RY)) ** 2;
  return Math.PI * (RX + RY) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
})();

/**
 * Vòng quanh buồng đang gác là thanh tiến độ, chia thành đúng CHAPTER_LEN đoạn
 * rời — đếm được bằng mắt, không phải ước theo độ dài cung. Đoạn đã gác xong
 * sáng màu đèn, đoạn còn lại để màu đất. Bắt đầu từ đỉnh, đi theo chiều kim
 * đồng hồ.
 *
 * Mỗi đoạn là một ellipse riêng: dasharray cắt ra đúng một đoạn, dashoffset
 * đẩy nó về chỗ của mình. Vẽ một lượt bằng dasharray lặp thì nhanh hơn nhưng
 * không tô riêng từng đoạn theo trạng thái được.
 */
function progressRing(cx, cy, done, total) {
  const unit = RING / total;
  const gap = 12;
  const seg = unit - gap;
  return Array.from({ length: total }, (_, i) => {
    const lit = i < done;
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="${RX}" ry="${RY}" fill="none"` +
      ` stroke="${lit ? "#ffc46b" : "#7d6a52"}" stroke-width="${lit ? 6 : 5}" stroke-linecap="round"` +
      ` stroke-dasharray="${seg.toFixed(2)} ${RING.toFixed(2)}"` +
      ` stroke-dashoffset="${(-i * unit - gap / 2).toFixed(2)}"` +
      ` transform="rotate(-90 ${cx} ${cy})"/>`
    );
  }).join("");
}

function lantern(x, y, lit) {
  const glow = lit ? `<circle cx="${x}" cy="${y}" r="26" fill="url(#lampglow)"/>` : "";
  const col = lit ? "#ffc46b" : "#3a4260";
  return `${glow}<rect x="${x - 6}" y="${y - 9}" width="12" height="16" rx="3" fill="${col}" stroke="#0f1526" stroke-width="2"/><rect x="${x - 3}" y="${y - 13}" width="6" height="4" fill="#0f1526"/>`;
}

/**
 * Vẽ mặt cắt tổ vào `container`. `names` là tên năm buồng theo ngôn ngữ đang
 * chọn, cùng thứ tự `rooms`. Kiến gác đứng ở buồng đang gác.
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
    out.push(`<ellipse cx="${cx}" cy="${y}" rx="${RX}" ry="${RY}" fill="${fill}"/>`);
    // Buồng đang gác đeo vòng tiến độ; buồng đã xong thì vòng khép kín, buồng
    // chưa tới chỉ có nét viền mờ.
    if (room.state === "now") out.push(progressRing(cx, y, room.nights, CHAPTER_LEN));
    else
      out.push(
        `<ellipse cx="${cx}" cy="${y}" rx="${RX}" ry="${RY}" fill="none" stroke="${room.state === "done" ? "#9a7a45" : "#2a1a12"}" stroke-width="3"/>`,
      );
    if (room.state === "locked") out.push(`<text x="${cx}" y="${y + 7}" text-anchor="middle" font-size="22" fill="#3a4260">?</text>`);
    else out.push(`<g transform="translate(${cx} ${y - 6})">${ICONS[room.key]}</g>`);
    out.push(lantern(cx + 40, y - 30, room.state === "done"));
    out.push(`<text x="${cx}" y="${y + 66}" text-anchor="middle" font-size="12" font-weight="700" fill="${room.state === "locked" ? "#8b93a8" : "#eef0f7"}">${names[i]}</text>`);
    if (room.state === "done")
      out.push(`<g transform="translate(${cx - 40} ${y - 38})"><circle r="11" fill="#6ee0b1"/><path d="M-5 0 l3 4 l7 -8" stroke="#141826" stroke-width="2.5" fill="none"/></g>`);
    if (room.state === "now")
      out.push(`<image href="${antUrl}" x="${cx - 82}" y="${y - 46}" width="46" height="46"/>`);
  });
  container.innerHTML = `<svg viewBox="0 -24 360 480" aria-hidden="true">
<defs><radialGradient id="lampglow"><stop offset="0" stop-color="#ffc46b" stop-opacity=".55"/><stop offset="1" stop-color="#ffc46b" stop-opacity="0"/></radialGradient></defs>
<rect x="-10" y="-20" width="380" height="14" fill="#5e8f35"/>
<path d="M120 -6 q60 -70 120 0 z" fill="#8a5a3c"/><rect x="168" y="-30" width="24" height="26" rx="12" fill="#2a1a12"/>
${out.join("")}</svg>`;
}
