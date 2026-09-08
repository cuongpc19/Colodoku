// Âm thanh: tổng hợp bằng Web Audio ngay lúc phát, không có file — nên không
// mang theo byte nào của Meowdoku và không phải tải gì thêm.
//
//   tick  — đánh / gỡ ✕: một cái gõ khô, rất ngắn
//   pop   — đặt đúng kiến: hai nốt đi lên, tròn tiếng
//   buzz  — đặt sai: tiếng rè trầm
//
// Trình duyệt chỉ cho mở AudioContext sau một cử chỉ của người dùng, nên
// context được tạo lười ở lần phát đầu tiên (luôn nằm trong một sự kiện bấm).

const SOUND_KEY = "colodoku.sound.v1";

let context = null;
let enabled = true;
try {
  enabled = localStorage.getItem(SOUND_KEY) !== "off";
} catch {
  /* không đọc được thì cứ bật */
}

function ctx() {
  if (!context) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    context = new AC();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

/** Một nốt: dạng sóng, tần số đầu → cuối, dài bao lâu, to bao nhiêu. */
function tone({ type = "sine", from, to = from, duration, gain = 0.2, at = 0 }) {
  const ac = ctx();
  if (!ac) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * Tiếng chạm khi đánh / gỡ ✕.
 *
 * Không dùng nhiễu nữa: đo lại thì nhiễu qua bandpass 600 Hz vẫn còn 14% năng
 * lượng trên 2 kHz — bộ lọc chỉ dốc 12 dB mỗi quãng tám nên không cắt nổi đuôi
 * cao, và chính đuôi đó nghe chói. Sine thì không có hoạ âm nào, nên không thể
 * chói: một nốt trầm tụt xuống, tắt rất nhanh, nghe như ngón tay chạm mặt trống.
 */
function click() {
  tone({ from: 190, to: 130, duration: 0.07, gain: 0.09 });
  tone({ from: 380, duration: 0.045, gain: 0.028 }); // hoạ âm khẽ cho có hình tiếng
}

export const sound = {
  get enabled() {
    return enabled;
  },
  set enabled(value) {
    enabled = Boolean(value);
    try {
      localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    } catch {
      /* không nhớ được thì thôi */
    }
  },
  tick() {
    if (enabled) click();
  },
  pop() {
    if (!enabled) return;
    tone({ from: 520, to: 660, duration: 0.09, gain: 0.18 });
    tone({ from: 780, to: 880, duration: 0.14, gain: 0.16, at: 0.07 });
  },
  buzz() {
    if (!enabled) return;
    tone({ type: "sawtooth", from: 170, to: 120, duration: 0.2, gain: 0.12 });
  },
  /** Chuỗi đặt đúng: rải hợp âm đi lên, bậc càng cao càng nhiều nốt. */
  combo(tier) {
    if (!enabled) return;
    const notes = [523, 659, 784, 1047, 1319, 1568]; // C5 E5 G5 C6 E6 G6
    const count = Math.min(notes.length, tier + 1);
    for (let i = 0; i < count; i++)
      tone({ type: "triangle", from: notes[i], duration: 0.16, gain: 0.14, at: i * 0.055 });
  },
};
