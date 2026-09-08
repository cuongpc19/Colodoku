// Ba bàn cờ mở đầu, chép đúng từng ô từ bản ghi màn hình Meowdoku 1.15.0
// (tutorial → Level 1 → Level 2). Chữ số trong `m` là chỉ số màu, trỏ vào
// PALETTE bên dưới và vào --g0..--g11 trong style.css.
//
// Bảng màu lấy bằng cách lấy mẫu pixel từ chính khung hình video, nên tên màu
// trong lời hướng dẫn ("Sky Blue", "Rose") khớp đúng thứ người chơi nhìn thấy.

export const PALETTE = [
  { key: "blue", name: "Sky Blue" },
  { key: "orange", name: "Orange" },
  { key: "green", name: "Green" },
  { key: "rose", name: "Rose" },
  { key: "sand", name: "Sand" },
  { key: "gold", name: "Gold" },
  { key: "orchid", name: "Orchid" },
  { key: "purple", name: "Purple" },
  { key: "mint", name: "Mint" },
  { key: "coral", name: "Coral" },
  { key: "lime", name: "Lime" },
  { key: "taupe", name: "Taupe" },
];

export const colourName = (region) => PALETTE[region % PALETTE.length].name;

// Bàn tutorial: xanh(0) · cam(1) · xanh lá(2) · hồng đậm(3)
export const TUTORIAL = {
  size: 4,
  record: {
    m: "0121" +
       "0111" +
       "0031" +
       "0331",
    s: [2, 0, 3, 1],
    r: 1, st: 4, rk: [4, 0, 0, 0, 0], ch: 0,
  },
};

/**
 * Các màn được chép nguyên từ video, theo đúng thứ tự chơi. Màn nào có ở đây
 * thì dùng bản này; hết danh sách mới quay về bank của Meowdoku.
 *
 * `given` là con mèo game đặt sẵn khi vào màn — trong video Level 1 mở ra đã là
 * 1/4 và Level 2 là 1/5, người chơi không tự đặt con đầu tiên.
 */
export const SCRIPTED = [
  {
    // Level 1 — xanh(0) · hồng đậm(3) · vàng(4) · vàng đậm(5)
    size: 4,
    given: [[1, 3]],
    record: {
      m: "0344" +
         "0445" +
         "0045" +
         "0444",
      s: [1, 3, 0, 2],
      // Số bước/kỹ thuật đo bằng bộ giải, tính từ thế cờ đã có con mèo `given`.
      r: 1, st: 3, rk: [3, 0, 0, 0, 0], ch: 0,
    },
  },
  {
    // Level 2 — hồng(6) · hồng đậm(3) · vàng(4) · vàng đậm(5) · tím(7)
    size: 5,
    given: [[0, 4]],
    record: {
      m: "66645" +
         "66345" +
         "66444" +
         "64444" +
         "77777",
      s: [4, 2, 0, 3, 1],
      // Không có con mèo đặt sẵn thì màn này cần tới kỹ thuật cấp 4; có nó thì
      // chỉ còn cấp 1 — đó chính là lý do họ tặng sẵn con đầu tiên.
      r: 1, st: 4, rk: [4, 0, 0, 0, 0], ch: 0,
    },
  },
];
