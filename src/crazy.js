// Lớp nối với CrazyGames. Không có SDK thì mọi thứ ở đây im lặng không làm gì,
// nên bản chạy trên GitHub Pages hay ở máy vẫn y nguyên.
//
// Phần lớn cách làm ở đây chép từ dự án MarbleSort (src/platform/crazy.ts) —
// dự án đó đã qua một lần nộp, nên mấy chỗ đánh dấu ⚠ là bài học trả giá rồi,
// không phải suy đoán.
//
// ⚠ SDK chỉ nạp khi trang có `data-target="crazy"` trên thẻ <html>, do
// tools/build_crazy.mjs đặt vào. Bản web thường vì thế không gọi sang máy chủ
// của họ lần nào — kiểm được bằng cách xem thuộc tính ấy có hay không.

// ⚠ Script của họ phải nạp bằng JS lúc chạy, KHÔNG đặt thẻ <script src> trong
// <head>. Thẻ script thường chặn bộ phân tích HTML, mà mã game là type=module
// nên bị hoãn tới sau khi phân tích xong: máy chủ của họ trả chậm là bộ phân
// tích đứng, module không chạy, game không khởi động — không lỗi, không dấu
// hiệu gì. MarbleSort dựng lại được lỗi này: 14 giây không có gì, so với 3 giây
// khi để request đi bình thường.
const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";

// ⚠ Hạn chờ là bắt buộc, không thay được bằng onerror: request bị trình chặn
// quảng cáo nuốt có thể treo mà không gọi onload lẫn onerror. Thà mất SDK còn
// hơn treo người chơi ở màn hình trắng.
const LOAD_TIMEOUT_MS = 2000;
const INIT_TIMEOUT_MS = 2500;

let sdk = null;
let started = false;

// Ý muốn của game, ghi lại kể cả khi SDK chưa tới. SDK đến sau thì phát lại —
// game khởi động đồng bộ nên gần như chắc chắn nó gọi trước lúc SDK sẵn sàng.
const want = { loading: false, playing: false };
// Game nạp xong TRƯỚC khi SDK kịp tới — trường hợp thường gặp ở đây, vì gói chỉ
// 1,3 MB còn SDK phải đi qua mạng. Ghi lại để còn phát cặp mốc cho khép kín.
let loadedBeforeSdk = false;

let hostMute = false;
let hostMuteKnown = false;
const muteListeners = [];

const quiet = (fn) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

/** Đặt script của họ vào trang; báo về có hay không, không ném lỗi. */
function loadScript() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    quiet(() => {
      if (globalThis.CrazyGames) return done(true); // trang chủ nhà nạp sẵn
      const el = document.createElement("script");
      el.src = SDK_URL;
      el.async = true;
      el.onload = () => done(true);
      el.onerror = () => done(false);
      document.head.append(el);
      setTimeout(() => done(false), LOAD_TIMEOUT_MS);
    }) ?? done(false);
  });
}

function setHostMute(value) {
  hostMuteKnown = true;
  const next = Boolean(value);
  if (next === hostMute) return;
  hostMute = next;
  for (const cb of muteListeners) quiet(() => cb(next));
}

/** Phát lại ý muốn đã ghi, cho SDK đến muộn vẫn nhận đúng trạng thái. */
function replay() {
  if (!sdk) return;
  if (want.loading) quiet(() => sdk.game.loadingStart());
  else if (loadedBeforeSdk) {
    // Nạp xong trước khi SDK tới: vẫn phát đủ cặp mốc, liền nhau. Bỏ hẳn thì
    // máy trạng thái bên họ không bao giờ thấy game nạp xong; còn hoãn
    // loadingStop tới lúc này thì lại khai khống thời gian nạp bằng thời gian
    // chờ SDK. Phát liền cặp là đúng cả hai đằng.
    quiet(() => sdk.game.loadingStart());
    quiet(() => sdk.game.loadingStop());
  }
  if (want.playing) quiet(() => sdk.game.gameplayStart());
}

export const crazy = {
  /** Có đang chạy trong bản dựng cho CrazyGames không. */
  get active() {
    return document.documentElement.dataset.target === "crazy";
  },

  /** Bắt SDK lên. Không chờ được, không ném lỗi — gọi rồi quên. */
  async init() {
    if (started || !this.active) return;
    started = true;
    const from = Date.now();
    await loadScript();
    const found = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), INIT_TIMEOUT_MS);
      // ⚠ onload chạy không có nghĩa là window.CrazyGames.SDK đã được gán, nên
      // vẫn phải dò thêm chứ không tin mỗi onload.
      const tick = () => {
        const s = globalThis.CrazyGames?.SDK;
        if (s) {
          clearTimeout(timer);
          resolve(s);
        } else if (Date.now() - from < INIT_TIMEOUT_MS) setTimeout(tick, 60);
      };
      tick();
    });
    if (!found) return;

    const left = Math.max(0, INIT_TIMEOUT_MS - (Date.now() - from));
    const ok = await Promise.race([
      quiet(() => found.init())?.then(() => true, () => false) ?? Promise.resolve(false),
      new Promise((r) => setTimeout(() => r(false), left)),
    ]);
    if (!ok) return;
    sdk = found;

    // ⚠ addSettingsChangeListener chứ không phải sự kiện trên window.
    // MarbleSort từng đoán là "wgVolumeChange" và đoán sai: game sẽ báo "không
    // tắt tiếng" mãi mãi trong khi vẫn kêu đè lên trang người ta đã tắt, tức ô
    // khai "có hỗ trợ tắt tiếng qua SDK" trong đơn nộp thành khai man.
    quiet(() => {
      setHostMute(found.game.settings?.muteAudio);
      found.game.addSettingsChangeListener?.((next) => setHostMute(next?.muteAudio));
    });
    replay();
  },

  loadingStart() {
    want.loading = true;
    quiet(() => sdk?.game.loadingStart());
  },
  loadingStop() {
    if (want.loading && !sdk) loadedBeforeSdk = true;
    want.loading = false;
    quiet(() => sdk?.game.loadingStop());
  },

  /**
   * ⚠ Không phải đo đạc — đây là cách chủ nhà biết LÚC NÀO ĐƯỢC PHÉP chen quảng
   * cáo. Mọi lúc dừng, mọi hộp thoại, mọi menu đều phải nằm ngoài cặp mốc này,
   * không thì quảng cáo nhảy vào giữa lúc đang chơi.
   *
   * Vì vậy game.js không gọi tay từng chỗ mà theo dõi thẳng trạng thái ẩn/hiện
   * của màn hình và các lớp phủ — chỗ gọi tay bị quên là chỗ làm hỏng.
   */
  setPlaying(playing) {
    const next = Boolean(playing);
    if (next === want.playing) return;
    want.playing = next;
    quiet(() => (next ? sdk?.game.gameplayStart() : sdk?.game.gameplayStop()));
  },

  /** Một nhịp ăn mừng trên trang chủ nhà khi người chơi làm được việc lớn. */
  happytime() {
    quiet(() => sdk?.game.happytime());
  },

  /**
   * Chủ nhà có đang bắt im tiếng không.
   *
   * ⚠ Đọc thẳng từ SDK, listener chỉ là bản sao: settings.muteAudio mới là sự
   * thật, còn cờ nhớ trong bộ nhớ chỉ cần lỡ một lần gọi lại là game kêu đè lên
   * trang đã tắt tiếng.
   *
   * ⚠ Chấp nhận cả `?muteAudio=true` trên địa chỉ — ĐÓ LÀ CÁCH BỘ PHẬN KIỂM
   * DUYỆT CỦA HỌ THỬ. Không có nó thì game chỉ im khi có SDK thật, đúng vào
   * trường hợp người kiểm mở tay bằng địa chỉ thì lại không.
   */
  hostMuted() {
    // ⚠ HOẶC chứ không phải ưu tiên: hễ một trong hai nguồn bảo im là im. Bản
    // đầu tôi cho SDK ghi đè tham số địa chỉ, và bộ thử bắt được ngay — SDK báo
    // "không tắt tiếng" là cờ ?muteAudio=true bị bỏ qua, đúng vào trường hợp
    // người kiểm duyệt mở tay bằng địa chỉ. Có mặt tham số ấy nghĩa là ai đó cố
    // ý đòi im lặng, không có cách hiểu nào khác.
    const byUrl = quiet(() => new URLSearchParams(location.search).get("muteAudio") === "true") ?? false;
    const live = quiet(() => sdk?.game.settings?.muteAudio);
    const bySdk = typeof live === "boolean" ? live : hostMuteKnown && hostMute;
    return byUrl || bySdk;
  },

  onHostMuteChange(cb) {
    muteListeners.push(cb);
  },

  /** Ngôn ngữ người chơi theo chủ nhà, hoặc null nếu không biết. */
  preferredLang() {
    // ⚠ locale chứ không phải countryCode: nước đang ngồi không phải thứ tiếng
    // người ta đọc.
    const l = quiet(() => sdk?.user?.systemInfo?.locale);
    return l ? String(l).toLowerCase() : null;
  },
};
