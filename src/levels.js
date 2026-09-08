// Bàn hướng dẫn và năm màn mở đầu — do tools/pick_opening.mjs sinh và chọn. Chữ số trong `m` là chỉ số màu, trỏ vào --g0..--g11 trong
// style.css; tên màu nằm ở khoá `colors` trong data/i18n/.
//
// Điều kiện chọn: bàn hướng dẫn phải dạy trọn ba luật và đã được chạy thử qua
// chính lớp Tutorial; năm màn đầu giải trọn bằng cấp 1 và luôn có một màu chỉ
// một ô để bắt đầu.

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
    m: "1102" +
       "1112" +
       "1112" +
       "1332",
    s: [2, 0, 3, 1],
    r: 1, st: 4, rk: [4, 0, 0, 0, 0], ch: 0,
  },
};

/**
 * Năm màn mở đầu, do tools/pick_opening.mjs chọn từ bộ sinh của mình: lưới nhỏ
 * hơn Meowdoku (4, 4, 5, 5, 6 thay vì 4, 5, 6, 6, 8), mỗi màn 1-2 màu chỉ có
 * một ô và vùng nền to để người mới nhìn là hiểu.
 *
 * `given` là con game đặt sẵn khi vào màn, theo đúng luật của Meowdoku cho màn
 * 1-6: con nằm trong vùng nhiều ô, để nước đầu của người chơi là "màu chỉ có
 * một ô". Từ màn 6 trở đi con tặng sẵn do progression.js tính.
 */
export const SCRIPTED = [
  {
    // Màn 1 — 4×4, 2 vùng 1 ô, nền 69%. Bỏ con tặng thì cấp 1.
    size: 4,
    given: [[1,0]],
    record: {
      m: "1101" +
         "1111" +
         "1112" +
         "1322",
      s: [2,0,3,1],
      r: 1, st: 4, rk: [4,0,0,0,0], ch: 0,
    },
  },
  {
    // Màn 2 — 4×4, 1 vùng 1 ô, nền 63%. Bỏ con tặng thì cấp 1.
    size: 4,
    given: [[0,1]],
    record: {
      m: "0031" +
         "0331" +
         "2333" +
         "3333",
      s: [1,3,0,2],
      r: 1, st: 4, rk: [4,0,0,0,0], ch: 0,
    },
  },
  {
    // Màn 3 — 5×5, 2 vùng 1 ô, nền 44%. Bỏ con tặng thì cấp 1.
    size: 5,
    given: [[0,0]],
    record: {
      m: "01111" +
         "01111" +
         "42141" +
         "44443" +
         "44444",
      s: [0,3,1,4,2],
      r: 1, st: 5, rk: [5,0,0,0,0], ch: 0,
    },
  },
  {
    // Màn 4 — 5×5, 1 vùng 1 ô, nền 48%. Bỏ con tặng thì cấp 1.
    size: 5,
    given: [[1,0]],
    record: {
      m: "14044" +
         "14442" +
         "33442" +
         "33344" +
         "33344",
      s: [2,0,4,1,3],
      r: 1, st: 5, rk: [5,0,0,0,0], ch: 0,
    },
  },
  {
    // Màn 5 — 6×6, 2 vùng 1 ô, nền 47%. Bỏ con tặng thì cấp 1.
    size: 6,
    given: [[0,0]],
    record: {
      m: "001111" +
         "000111" +
         "021113" +
         "111113" +
         "114333" +
         "333355",
      s: [0,3,1,5,2,4],
      r: 1, st: 6, rk: [6,0,0,0,0], ch: 0,
    },
  },
];
