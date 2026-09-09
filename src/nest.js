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
    return {
      key,
      chapter: c,
      nameIndex: roomNameIndex(c),
      state: c < chapter ? "done" : c === chapter ? "now" : "locked",
    };
  });
}

// --------------------------------------------------------------- vẽ

/* Hình từng buồng — tranh vẽ, cắt từ một tấm 4x4 bằng tools/slice_rooms.py.
   Đường dẫn viết thẳng từng cái chứ KHÔNG ghép tên file lúc
   chạy: tools/build_single.mjs nhúng ảnh bằng cách dò chuỗi trong mã nguồn,
   mà chuỗi ghép thì nó không thấy — bản một file sẽ mất sạch hình. */
const ICON_URL = {
  gate: "assets/room-gate.png",
  eggs: "assets/room-eggs.png",
  fungus: "assets/room-fungus.png",
  candy: "assets/room-candy.png",
  queen: "assets/room-queen.png",
  nursery: "assets/room-nursery.png",
  well: "assets/room-well.png",
  granary: "assets/room-granary.png",
  aphids: "assets/room-aphids.png",
  winter: "assets/room-winter.png",
  roots: "assets/room-roots.png",
  spring: "assets/room-spring.png",
  crystal: "assets/room-crystal.png",
  vault: "assets/room-vault.png",
  heart: "assets/room-heart.png",
};
const ICON = 62; // bề ngang hình trong hệ toạ độ của viewBox

const ROOM_Y = [52, 132, 212, 292, 372];
const SIDE = [-1, 1, -1, 1, 0];
const RX = 58;
const RY = 40;

/** Đèn treo ở buồng đã gác xong — dấu hiệu buồng an toàn. */
function lantern(x, y) {
  return (
    `<circle cx="${x}" cy="${y}" r="30" fill="url(#lampglow)"/>` +
    `<image href="assets/room-lantern.png" x="${x - 16}" y="${y - 20}" width="32" height="40"/>`
  );
}

/**
 * Vẽ mặt cắt tổ vào `container`. `names` là tên năm buồng theo ngôn ngữ đang
 * chọn, cùng thứ tự `rooms`.
 */
export function renderNest(container, rooms, names) {
  const out = [];
  out.push(`<path d="M180 -10 V372" stroke="#2a1a12" stroke-width="26" stroke-linecap="round"/>`);
  rooms.forEach((room, i) => {
    const y = ROOM_Y[i];
    const side = SIDE[i];
    const cx = 180 + side * 105;
    if (side) out.push(`<path d="M180 ${y} H${cx}" stroke="#2a1a12" stroke-width="22" stroke-linecap="round"/>`);
    const fill = { done: "#3d2a1e", now: "#4a3324", locked: "#1c1410" }[room.state];
    // Viền nói trạng thái: buồng đang gác sáng và dày nhất, buồng đã xong trầm
    // hơn, buồng chưa tới gần như chìm vào đất.
    const stroke = { done: "#9a7a45", now: "#ffc46b", locked: "#2a1a12" }[room.state];
    out.push(
      `<ellipse cx="${cx}" cy="${y}" rx="${RX}" ry="${RY}" fill="${fill}"` +
        ` stroke="${stroke}" stroke-width="${room.state === "now" ? 5 : 3}"/>`,
    );
    // Buồng chưa tới vẫn thấy hình, chỉ mờ đi — tên nó đã ghi ngay dưới rồi nên
    // giấu hình cũng chẳng giữ được bí mật nào, mà dấu "?" thì trống trải.
    out.push(
      `<image href="${ICON_URL[room.key]}" x="${cx - ICON / 2}" y="${y - ICON / 2}"` +
        ` width="${ICON}" height="${ICON}"${room.state === "locked" ? ' opacity="0.3"' : ""}/>`,
    );
    if (room.state === "done") out.push(lantern(cx + 42, y - 28));
    out.push(`<text x="${cx}" y="${y + 66}" text-anchor="middle" font-size="12" font-weight="700" fill="${room.state === "locked" ? "#8b93a8" : "#eef0f7"}">${names[i]}</text>`);
  });
  container.innerHTML = `<svg viewBox="0 -24 360 480" aria-hidden="true">
<defs><radialGradient id="lampglow"><stop offset="0" stop-color="#ffc46b" stop-opacity=".55"/><stop offset="1" stop-color="#ffc46b" stop-opacity="0"/></radialGradient></defs>
<rect x="-10" y="-20" width="380" height="14" fill="#5e8f35"/>
<path d="M120 -6 q60 -70 120 0 z" fill="#8a5a3c"/><rect x="168" y="-30" width="24" height="26" rx="12" fill="#2a1a12"/>
${out.join("")}</svg>`;
}
