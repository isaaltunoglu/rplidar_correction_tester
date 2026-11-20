import {
  wrap,
  delta,
  inSector,
  DEFAULT_CONFIG,
  analyze,
  trialSample,
  trialResult,
  validateConfig,
  validateRecording,
  escapeHTML as esc,
} from "./core.js";
const $ = (id) => document.getElementById(id);
const fmt = (v, n = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("tr-TR", {
        minimumFractionDigits: n,
        maximumFractionDigits: n,
      });
const sourceName = (s) =>
  ({
    hardware: "Fiziksel cihaz",
    demo: "Simülasyon",
    replay: "Tekrar oynatma",
    idle: "Kaynak bekleniyor",
  })[s] || "Bilinmiyor";
const titles = {
  live: "Canlı tarama",
  experiments: "Deney tezgâhı",
  recordings: "Kayıt & tekrar",
  device: "Cihaz & kaynaklar",
};
let cfg = { ...DEFAULT_CONFIG },
  state = null,
  scan = null,
  analysis = null,
  page = "live",
  history = [],
  receivedAt = 0,
  streamOnline = false,
  deviceKey = "",
  portsKey = "",
  eventsKey = "",
  serverGeneration = null,
  minimumGeneration = -1,
  lastCommandKey = "",
  raf = 0,
  hover = null,
  toastTimer;
let recording = false,
  capture = null,
  capturedPoints = 0;
let replay = null,
  replayIndex = 0,
  replayPlaying = false,
  replayTimer = null,
  localReplay = false;
let sourceChanging = false;
let trialKind = "accuracy",
  trial = null,
  results = [],
  lastTrial = null;
const protocols = {
  accuracy: {
    name: "Mesafe doğruluğu",
    text: "Düz, mat bir hedefi seçili doğrultuya dik yerleştirin. Lazerin dönme merkezinden hedefe olan mesafeyi bağımsız bir referansla ölçün. Dar hedef açıklığını seçin; her turdaki medyan mesafe referansla karşılaştırılır. Tolerans deneyin kabul ölçütüdür; üretici garantisi değildir.",
  },
  repeatability: {
    name: "Tekrarlanabilirlik",
    text: "Sensörü ve düz hedefi sabitleyin. Aynı açı, mesafe, tarama modu ve ışık koşullarında ölçüm yapın. Tur başına hedef medyanlarının standart sapması (σ) tekrarlanabilirliği gösterir; tek başına mutlak doğruluğu göstermez.",
  },
  surface: {
    name: "Yüzey karşılaştırması",
    text: "Mesafeyi, açıyı ve aydınlatmayı sabit tutarak beyaz, siyah, parlak ve saydam hedefleri sırayla deneyin. Koşul alanına malzemeyi yazıp her malzeme için ayrı deney başlatın. Hedef isabet oranı ve saçılımı karşılaştırın. Q sabit olabilir; kalibre edilmiş yansıtıcılık değildir.",
  },
  frequency: {
    name: "Tarama performansı",
    text: "Cihaz sekmesinden desteklenen tarama modunu seçin, veri kararlı hale gelince ölçün. Her mod için ayrı deney kaydedin. Ortalama/minimum/maksimum tur frekansı ile geçerli dönüşleri karşılaştırın. SDK tur frekansı ile arayüze teslim hızı farklı olabilir.",
  },
  coverage: {
    name: "Açısal kapsama",
    text: "Canlı taramadan incelenecek sektörü seçin. Aynı çevrede ön 120°, arka 120° ve tam 360° için ayrı deney yapın. Açısal doluluk, en az bir geçerli dönüş içeren 1° kutuların oranıdır. Dönüş olmayan açı, açık alan veya sensör arızası olarak tek başına yorumlanamaz.",
  },
  obstacle: {
    name: "Yakın hedef algılama",
    text: "Bir hedefi seçili doğrultuya yerleştirin; hedef açıklığı içindeki geçerli dönüş oranını ölçün. Arka planın hedef sayılmaması için canlı taramada mesafe filtresini hedef çevresinde daraltın. Bu deney zaman damgalı bir hareket referansı kullanmaz; fiziksel algılama gecikmesi ölçtüğünü iddia etmez.",
  },
};
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").className = "toast" + (error ? " error" : "");
  $("toast").hidden = false;
  toastTimer = setTimeout(
    () => ($("toast").hidden = true),
    error ? 6500 : 3800,
  );
}
function navigate(next) {
  if (!titles[next]) next = "live";
  page = next;
  for (const b of document.querySelectorAll("[data-page]"))
    b.classList.toggle("active", b.dataset.page === next);
  for (const k of Object.keys(titles)) {
    const el = $("page-" + k);
    el.hidden = k !== next;
    el.classList.toggle("active", k === next);
  }
  $("pageCrumb").textContent = titles[next];
  if (location.hash !== "#" + next) historyReplace(next);
  requestDraw();
  if (next === "experiments") drawTrial();
}
function historyReplace(next) {
  window.history.replaceState(null, "", "#" + next);
}
for (const b of document.querySelectorAll("[data-page]"))
  b.addEventListener("click", () => navigate(b.dataset.page));
window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));
async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("Sunucudan geçerli yanıt alınamadı.");
  }
  if (!response.ok) throw Error(data.error || "İşlem tamamlanamadı.");
  return data;
}
function fresh() {
  return (
    !!scan &&
    (localReplay ||
      (streamOnline &&
        state?.status?.scanning &&
        state.status.connection === "connected" &&
        performance.now() - receivedAt < 3000))
  );
}
function activeSource() {
  return localReplay ? "replay" : state?.source;
}
function inputLock() {
  const locked = !!trial || recording;
  for (const el of document.querySelectorAll(
    ".settings-panel input,.settings-panel select,.preset,.experiment-option,#trialForm input,#trialForm textarea,#sourceSelect,#demoScene,#portSelect,#baudSelect,#reconnectButton,#scanMode,#motorSpeed,#applyMotor,#resetConfig,#recordingFile,#replayScrub,#replaySpeed,#replayPlay",
  )) {
    el.disabled = locked;
  }
  if (!locked) {
    $("scanMode").disabled =
      !state?.device_info?.scan_modes?.length || activeSource() !== "hardware";
    $("applyMotor").disabled =
      !state?.device_info?.motor?.adjustable || activeSource() !== "hardware";
  }
  for (const id of ["trialStart"])
    $(id).disabled = !!trial || recording || localReplay || !fresh();
  $("trialCancel").disabled = !trial;
  for (const id of ["recordButton", "recordButton2"])
    $(id).disabled = !!trial || (!recording && (!fresh() || localReplay));
  $("pauseButton").disabled =
    !!trial ||
    recording ||
    (!localReplay &&
      (!streamOnline ||
        !state?.device_info ||
        state?.status.connection !== "connected"));
  $("tryDemo").disabled = locked;
  $("plotDemo").disabled = locked;
}
function syncConfig() {
  const map = {
    sectorCenter: "center",
    sectorWidth: "width",
    viewRange: "viewRange",
    minDistance: "min",
    maxDistance: "max",
    qualityMin: "quality",
    angleOffset: "offset",
    dangerDistance: "danger",
    warningDistance: "warning",
    renderStyle: "style",
    colorMode: "color",
  };
  for (const [id, k] of Object.entries(map)) $(id).value = cfg[k];
  $("showContext").checked = cfg.context;
  $("invertAngle").checked = cfg.invert;
  const names = { 0: "Ön", 90: "Sağ", 180: "Arka", 270: "Sol" };
  $("centerLabel").textContent =
    cfg.center + "°" + (names[cfg.center] ? " · " + names[cfg.center] : "");
  $("widthLabel").textContent = cfg.width + "°";
  $("viewLabel").textContent = fmt(cfg.viewRange / 1000, 2) + " m";
  const start = wrap(cfg.center - cfg.width / 2),
    end = wrap(cfg.center + cfg.width / 2);
  $("sectorStart").textContent = fmt(start, 0) + "°";
  $("sectorEnd").textContent = fmt(end, 0) + "°";
  $("sectorDescription").textContent =
    cfg.width === 360
      ? "Tam tur · tüm açılar"
      : `${names[cfg.center] || "Özel"} yön · ${fmt(start, 1)}° → ${fmt(end, 1)}°${start > end ? " (0° üzerinden)" : ""}`;
  for (const b of document.querySelectorAll(".preset"))
    b.classList.toggle(
      "active",
      +b.dataset.center === cfg.center && +b.dataset.width === cfg.width,
    );
  $("trialConfigSummary").textContent =
    `Sektör: merkez ${cfg.center}° / açıklık ${cfg.width}° · Mesafe: ${cfg.min}–${cfg.max} mm · Q ≥ ${cfg.quality} · Ofset ${cfg.offset}°${cfg.invert ? " · Ters yön" : ""}`;
  if (scan) analysis = analyze(scan, cfg);
  renderMetrics();
  requestDraw();
}
const numericConfig = {
  sectorCenter: "center",
  sectorWidth: "width",
  viewRange: "viewRange",
  minDistance: "min",
  maxDistance: "max",
  qualityMin: "quality",
  angleOffset: "offset",
  dangerDistance: "danger",
  warningDistance: "warning",
};
for (const [id, key] of Object.entries(numericConfig))
  $(id).addEventListener(
    id === "sectorCenter" || id === "sectorWidth" || id === "viewRange"
      ? "input"
      : "change",
    () => {
      if (trial || recording) return;
      try {
        const next = validateConfig({ ...cfg, [key]: Number($(id).value) });
        cfg = next;
        syncConfig();
      } catch (e) {
        toast(e.message, true);
        syncConfig();
      }
    },
  );
for (const [id, key] of [
  ["showContext", "context"],
  ["invertAngle", "invert"],
])
  $(id).addEventListener("change", () => {
    cfg[key] = $(id).checked;
    syncConfig();
  });
for (const [id, key] of [
  ["renderStyle", "style"],
  ["colorMode", "color"],
])
  $(id).addEventListener("change", () => {
    cfg[key] = $(id).value;
    syncConfig();
  });
for (const b of document.querySelectorAll(".preset"))
  b.addEventListener("click", () => {
    cfg.center = +b.dataset.center;
    cfg.width = +b.dataset.width;
    syncConfig();
  });
$("resetConfig").addEventListener("click", () => {
  cfg = { ...DEFAULT_CONFIG };
  syncConfig();
});
$("showRaw").addEventListener("change", () => {
  $("rawContainer").hidden = !$("showRaw").checked;
  renderRaw();
});
async function changeSource(source, extra = {}) {
  if (trial || recording) {
    toast("Önce etkin deneyi veya kaydı durdurun.", true);
    return;
  }
  sourceChanging = true;
  try {
    const accepted = await api("/api/source", {
      source,
      port: $("portSelect").value || null,
      baud: Number($("baudSelect").value),
      scene: $("demoScene").value,
      ...extra,
    });
    minimumGeneration = accepted.generation ?? -1;
    localReplay = false;
    stopReplay();
    // SSE can deliver the new source before its HTTP acknowledgement arrives.
    // Preserve that new frame rather than blanking an already live stream.
    if (state?.generation !== accepted.generation) {
      scan = analysis = null;
      history = [];
      receivedAt = 0;
    }
    deviceKey = "";
    serverGeneration = null;
    $("sourceSelect").value = source === "idle" ? "replay" : source;
    renderMetrics();
    requestDraw();
  } catch (e) {
    toast(e.message, true);
    $("sourceSelect").value = activeSource() || "hardware";
  } finally {
    sourceChanging = false;
  }
}
$("sourceSelect").addEventListener("change", async () => {
  if ($("sourceSelect").value === "replay") {
    if (replay) await activateReplay();
    else {
      $("sourceSelect").value =
        state?.source === "idle" ? "replay" : state?.source || "hardware";
      navigate("recordings");
      toast("Tekrar oynatmak için bir kayıt dosyası açın.");
    }
  } else await changeSource($("sourceSelect").value);
});
for (const id of ["tryDemo", "plotDemo"])
  $(id).addEventListener("click", () => changeSource("demo"));
$("demoScene").addEventListener("change", () => {
  if (state?.source === "demo" && !localReplay) changeSource("demo");
});
$("reconnectButton").addEventListener("click", () => changeSource("hardware"));
$("pauseButton").addEventListener("click", async () => {
  if (localReplay) {
    toggleReplay();
    return;
  }
  try {
    await api("/api/control", {
      action: state?.status.scanning ? "pause" : "resume",
    });
    toast("Komut gönderildi; cihaz yanıtı bekleniyor.");
  } catch (e) {
    toast(e.message, true);
  }
});
$("healthButton").addEventListener("click", async () => {
  if (trial || recording) {
    toast("Sağlık sorgusu için etkin ölçümü durdurun.", true);
    return;
  }
  try {
    await api("/api/control", { action: "health" });
    toast("SDK sağlık sorgusu gönderildi.");
  } catch (e) {
    toast(e.message, true);
  }
});
$("scanMode").addEventListener("change", async () => {
  try {
    await api("/api/control", {
      action: "mode",
      value: Number($("scanMode").value),
    });
    toast("Tarama modu komutu gönderildi.");
  } catch (e) {
    toast(e.message, true);
  }
  deviceKey = "";
});
$("applyMotor").addEventListener("click", async () => {
  try {
    await api("/api/control", {
      action: "motor",
      value: Number($("motorSpeed").value),
    });
    toast("Motor hedefi gönderildi; gerçek frekansı ölçümlerde izleyin.");
  } catch (e) {
    toast(e.message, true);
  }
});
function connect() {
  const events = new EventSource("/api/stream");
  events.onopen = () => {
    streamOnline = true;
  };
  events.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type !== "state") return;
      if (msg.generation < minimumGeneration) return;
      streamOnline = true;
      const oldGen = serverGeneration;
      serverGeneration = msg.generation;
      if (oldGen !== null && oldGen !== serverGeneration) {
        if (trial) finishTrial("Kaynak veya bağlantı oturumu değişti.");
        if (recording) stopCapture("Kaynak değiştiği için kayıt durduruldu.");
        if (!localReplay) {
          scan = analysis = null;
          history = [];
        }
      }
      state = msg;
      if (localReplay && msg.source !== "idle") {
        stopReplay();
        localReplay = false;
        scan = analysis = null;
        if (!sourceChanging)
          toast("Başka bir istemci veri kaynağını değiştirdi.", true);
      }
      if (!localReplay) {
        $("sourceSelect").value = msg.source === "idle" ? "replay" : msg.source;
        if (msg.scan) receiveScan(msg.scan);
        else if (
          !msg.status.scanning ||
          msg.status.connection !== "connected"
        ) {
          if (trial) finishTrial("Tarama kesildi.");
          if (recording) stopCapture("Tarama kesildiği için kayıt durduruldu.");
          scan = analysis = null;
        }
      }
      renderState();
    } catch (e) {
      console.error("Stream message rejected", e);
    }
  };
  events.onerror = () => {
    streamOnline = false;
    minimumGeneration = -1;
    if (!localReplay) {
      if (trial) finishTrial("Sunucu bağlantısı kesildi.");
      if (recording) stopCapture("Sunucu bağlantısı kesildi.");
      scan = analysis = null;
    }
    renderState();
  };
}
function receiveScan(frame) {
  scan = frame;
  receivedAt = performance.now();
  analysis = analyze(scan, cfg);
  history.push(scan.hz);
  if (history.length > 60) history.shift();
  if (recording) {
    if (
      capture.frames.length >= 1200 ||
      capturedPoints + frame.points.length > 500000
    )
      stopCapture("Kayıt sınırına ulaşıldı; dosyayı indirebilirsiniz.");
    else {
      capture.frames.push(frame);
      capturedPoints += frame.points.length;
      renderCapture();
    }
  }
  if (trial) {
    if (
      frame.source !== trial.source ||
      frame.generation !== trial.generation
    ) {
      finishTrial("Kaynak değişti.");
    } else {
      if (
        trial.evidence.length >= 1200 ||
        trial.evidence.reduce((n, f) => n + f.points.length, 0) +
          frame.points.length >
          500000
      ) {
        finishTrial("Ham kanıt sınırına ulaşıldı. Daha kısa deney seçin.");
      } else {
        trial.samples.push(
          trialSample(frame, trial.config, trial.bearing, trial.beam),
        );
        trial.evidence.push(frame);
        drawTrial();
      }
    }
  }
  renderMetrics();
  requestDraw();
}
function renderState() {
  if (!state) return;
  const source = activeSource();
  let badge, notice;
  if (localReplay) {
    badge = replayPlaying ? "Kayıt oynatılıyor" : "Kayıt · duraklatıldı";
    notice = `TEKRAR OYNATMA · Asıl kaynak: ${sourceName(replay.source)}. Yeni fiziksel ölçüm yapılmıyor.`;
  } else if (state.source === "demo") {
    badge = "Simülasyon";
    notice =
      "SİMÜLASYON · Görünen noktalar yapay olarak üretilir. Fiziksel sensör testi değildir.";
  } else if (!streamOnline) {
    badge = "Sunucu bağlantısı yok";
    notice =
      "Yerel sunucuya erişilemiyor. start.sh çalışıyor olmalı; bağlantı otomatik yeniden denenecek.";
  } else if (state.status.connection === "connected") {
    badge = state.status.scanning ? "USB bağlı" : "USB · Duraklatıldı";
    notice =
      state.error ||
      `${state.device_info?.model || "RPLIDAR"} bağlı. ${state.status.scanning ? "Canlı ölçüm alınıyor." : "Motor ve tarama duraklatıldı."}`;
  } else {
    badge =
      state.status.connection === "connecting"
        ? "Cihaz tanınıyor"
        : state.status.connection === "stale"
          ? "Veri güncel değil"
          : "USB aranıyor";
    notice =
      state.error ||
      "USB adaptörü bulundu. SDK cihaz kimliğini ve baud hızını sorguluyor.";
  }
  $("connectionBadge").className =
    "badge " +
    (localReplay
      ? "replay"
      : source === "demo"
        ? "demo"
        : source === "hardware" &&
            streamOnline &&
            state.status.connection === "connected"
          ? "live"
          : !streamOnline
            ? "error"
            : "neutral");
  $("connectionBadge").innerHTML =
    '<span class="status-dot"></span>' + esc(badge);
  $("sourceNotice").dataset.source = localReplay ? "replay" : state.source;
  $("noticeText").textContent = notice;
  $("tryDemo").hidden =
    localReplay ||
    state.source === "demo" ||
    (streamOnline && state.status.connection === "connected");
  const paused =
    !localReplay &&
    state.status.connection === "connected" &&
    !state.status.scanning;
  const emptyTitle = $("plotEmpty").querySelector("h2");
  const emptyDescription = $("plotEmpty").querySelector("p");
  if (!streamOnline && !localReplay) {
    emptyTitle.textContent = "Sunucu bağlantısı kesildi.";
    emptyDescription.textContent =
      "Yerel sunucuya yeniden bağlanılıyor. Güncel ölçüm gelene kadar önceki veriler gösterilmez.";
  } else if (paused) {
    emptyTitle.textContent = "Tarama duraklatıldı.";
    emptyDescription.textContent =
      "Devam et düğmesiyle ölçüm akışını yeniden başlatın. Önceki ölçümler güncel veri olarak gösterilmez.";
  } else if (state.source === "demo") {
    emptyTitle.textContent = "Yeni tarama bekleniyor.";
    emptyDescription.textContent =
      "Simülasyon akışı hazırlanıyor veya yeni veri ulaşmıyor. Güncel sentetik ölçüm geldiğinde görünüm yenilenir.";
  } else {
    emptyTitle.textContent = "Bir bağlantı, 360° keşif.";
    emptyDescription.textContent =
      "USB LiDAR bağlandığında tarama burada görünür. Sensör olmadan simülasyonla tüm iş akışını deneyin.";
  }
  $("plotDemo").hidden =
    paused || localReplay || state.source === "demo" || !streamOnline;
  $("plotSource").textContent =
    source === "hardware" ? "USB" : source === "demo" ? "SİMÜLASYON" : "KAYIT";
  $("plotWatermark").textContent = localReplay
    ? `KAYIT · ASIL KAYNAK: ${sourceName(replay.source).toLocaleUpperCase("tr")}`
    : source === "demo"
      ? "SİMÜLASYON · SENTETİK VERİ"
      : fresh()
        ? "FİZİKSEL ÖLÇÜM"
        : "FİZİKSEL VERİ BEKLENİYOR";
  $("trialSource").textContent = localReplay
    ? `Kayıt / ${sourceName(replay.source)}`
    : sourceName(source);
  $("trialSource").className =
    "badge " +
    (source === "demo" ? "demo" : localReplay ? "replay" : "neutral");
  $("plotDot").classList.toggle("live", fresh());
  $("pauseButton").querySelector("span").textContent = localReplay
    ? replayPlaying
      ? "Duraklat"
      : "Oynat"
    : state.status.scanning
      ? "Duraklat"
      : "Devam et";
  $("pauseButton")
    .querySelector("use")
    .setAttribute(
      "href",
      localReplay
        ? replayPlaying
          ? "#i-pause"
          : "#i-play"
        : state.status.scanning
          ? "#i-pause"
          : "#i-play",
    );
  $("footerState").textContent = localReplay
    ? `Kayıt zamanı: ${scan ? new Date(scan.timestamp * 1000).toLocaleTimeString("tr-TR") : "—"}`
    : !streamOnline
      ? "Sunucu bağlantısı kesildi"
      : fresh()
        ? `Son tarama: ${new Date(scan.timestamp * 1000).toLocaleTimeString("tr-TR")} · ${scan.mode}`
        : "Yeni tarama bekleniyor";
  const dk = JSON.stringify([
    state.device_info,
    state.status.mode_id,
    state.status.motor_requested,
    state.source,
  ]);
  if (dk !== deviceKey) {
    deviceKey = dk;
    renderDevice();
  }
  const pk = JSON.stringify(state.ports);
  if (pk !== portsKey) {
    portsKey = pk;
    const selected = $("portSelect").value;
    $("portSelect").innerHTML =
      '<option value="">Otomatik algıla</option>' +
      state.ports
        .map(
          (p) =>
            `<option value="${esc(p.path)}">${esc(p.label)} · ${esc(p.path)}${!p.accessible ? " · izin yok" : ""}</option>`,
        )
        .join("");
    if ([...$("portSelect").options].some((o) => o.value === selected))
      $("portSelect").value = selected;
  }
  const ek = JSON.stringify(state.events);
  if (ek !== eventsKey) {
    eventsKey = ek;
    $("eventLog").innerHTML = state.events.length
      ? [...state.events]
          .reverse()
          .map(
            (e) =>
              `<li class="${["warning", "error"].includes(e.level) ? e.level : ""}"><time>${new Date(e.timestamp * 1000).toLocaleTimeString("tr-TR")}</time><span>${esc(e.message)}</span></li>`,
          )
          .join("")
      : "<li>Henüz bağlantı olayı yok.</li>";
  }
  const ck = JSON.stringify(state.last_command);
  if (ck !== lastCommandKey) {
    lastCommandKey = ck;
    if (
      state.last_command &&
      !state.last_command.pending &&
      state.last_command.ok === false
    )
      toast("Cihaz komutu uygulamadı: " + state.last_command.command, true);
  }
  if (state.last_command?.pending) {
    $("footerState").textContent = "Cihaz komutunun tamamlanması bekleniyor…";
  }
  renderMetrics();
  inputLock();
  requestDraw();
}
function renderDevice() {
  const d = state?.device_info;
  if (!d) {
    $("deviceInfo").innerHTML =
      "<dt>Model</dt><dd>Fiziksel cihaz bekleniyor</dd>";
    $("scanMode").innerHTML = '<option value="">Bağlı cihaz yok</option>';
    $("scanMode").disabled = true;
    $("motorControl").hidden = true;
    $("motorInfo").textContent = "Motor yetenekleri henüz okunmadı.";
    return;
  }
  const health =
    d.health_status === null || d.health_status === undefined
      ? "Fiziksel sorgu yok"
      : d.health_status === 0
        ? "OK"
        : d.health_status === 1
          ? "Uyarı"
          : d.health_status === 2
            ? "İç hata"
            : "Okunamadı";
  const rows = [
    ["Kaynak", sourceName(state.source)],
    ["Model", d.model],
    ["Teknoloji", d.technology],
    ["Seri numarası", d.serial || "—"],
    ["Firmware / donanım", d.firmware ? `${d.firmware} / ${d.hardware}` : "—"],
    ["Port / baud", d.port ? `${d.port} / ${d.baudrate}` : "—"],
    [
      "SDK sağlık durumu",
      `${health}${d.health_error ? " · kod " + d.health_error : ""}`,
    ],
  ];
  $("deviceInfo").innerHTML = rows
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
    .join("");
  const modes = d.scan_modes || [];
  $("scanMode").innerHTML = modes.length
    ? modes
        .map((m) => `<option value="${m.id}">${esc(m.name)} · ${m.id}</option>`)
        .join("")
    : '<option value="">Mod listesi bildirilmedi</option>';
  $("scanMode").disabled = !modes.length || state.source !== "hardware";
  if (state.status.mode_id !== undefined)
    $("scanMode").value = state.status.mode_id;
  const m = modes.find((m) => m.id === state.status.mode_id);
  $("modeInfo").textContent = m
    ? `${fmt(m.us_per_sample, 2)} µs / örnek · nominal ${fmt(m.us_per_sample > 0 ? 1e6 / m.us_per_sample : null, 0)} örnek/s · modun bildirdiği azami mesafe ${fmt(m.max_distance_m)} m. Gerçek dönüş sayısı çevreye bağlıdır.`
    : "Cihazın bildirdiği modlar seçilebilir. Mod listesi yoksa SDK varsayılanı kullanılır.";
  const motor = d.motor || {};
  $("motorControl").hidden = !motor.adjustable || state.source !== "hardware";
  if (motor.adjustable) {
    $("motorSpeed").min = motor.min;
    $("motorSpeed").max = motor.max;
    $("motorSpeed").value = state.status.motor_requested || motor.min;
  }
  $("motorInfo").textContent = motor.adjustable
    ? `SDK aralığı ${motor.min}–${motor.max} RPM. Bu hedef değerdir; gerçekleşen hız taramadan hesaplanır.`
    : motor.support === 1
      ? "PWM motor kontrolü mevcut. SDK bu cihaz için doğrulanmış PWM ayar aralığı vermiyor; varsayılan başlat/durdur kullanılır."
      : motor.known
        ? "Sayısal hız ayarı cihaz tarafından desteklenmiyor; başlat/durdur kullanılır."
        : "Motor yeteneği doğrulanamadı. Sayısal hız ayarı sunulmaz.";
}
function renderMetrics() {
  const ok = fresh() && analysis;
  $("plotEmpty").hidden = !!ok;
  if (ok) {
    $("metricHz").innerHTML = fmt(scan.hz, 2) + " <small>Hz</small>";
    $("metricRpm").textContent =
      fmt(scan.hz * 60, 0) + " RPM · taramadan hesaplanan";
    $("metricPoints").textContent = fmt(analysis.points.length, 0);
    $("metricRaw").textContent =
      `${fmt(scan.points.length, 0)} geçerli / ${fmt(scan.raw_count, 0)} ham dönüş`;
    $("metricNear").innerHTML =
      fmt(analysis.nearest?.[1] / 1000, 2) + " <small>m</small>";
    $("metricAngle").textContent = analysis.nearest
      ? `${fmt(analysis.nearest[0], 1)}° · seçili sektör`
      : "Seçili sektörde geçerli dönüş yok";
    $("metricCoverage").innerHTML =
      fmt(analysis.coverage, 1) + " <small>%</small>";
    $("scanMeta").textContent = `Tur ${scan.seq} · ${scan.mode}`;
    const words = {
      unknown: [
        "Geçerli dönüş yok",
        "Bu sektörde açıklık değerlendirilemiyor.",
      ],
      danger: [
        "Yakın yansıma algılandı",
        `En yakın dönüş ${fmt(analysis.nearest?.[1], 0)} mm. Eşik: ${cfg.danger} mm.`,
      ],
      warning: [
        "Uyarı aralığında yansıma",
        `En yakın dönüş ${fmt(analysis.nearest?.[1], 0)} mm. Eşik: ${cfg.warning} mm.`,
      ],
      clear: [
        "Eşik içinde yansıma yok",
        "Geçerli dönüşler eşiklerin dışında. Eksik dönüşler açık alan sayılmaz.",
      ],
    };
    $("proximity").dataset.state = analysis.alarm;
    $("proximityTitle").textContent = words[analysis.alarm][0];
    $("proximityText").textContent = words[analysis.alarm][1];
    analysis.sectors.forEach(
      (d, i) =>
        ($("dir" + i).textContent =
          d === null ? "Veri yok" : fmt(d / 1000, 2) + " m"),
    );
  } else {
    for (const [id, html] of [
      ["metricHz", "— <small>Hz</small>"],
      ["metricPoints", "—"],
      ["metricNear", "— <small>m</small>"],
      ["metricCoverage", "— <small>%</small>"],
    ])
      $(id).innerHTML = html;
    $("metricRpm").textContent = "Tur / saniye";
    $("metricRaw").textContent = "Yeni tarama bekleniyor";
    $("metricAngle").textContent = "Seçili sektör içinde";
    $("scanMeta").textContent = "Güncel tarama yok";
    $("proximity").dataset.state = "unknown";
    $("proximityTitle").textContent = "Güncel ölçüm yok";
    $("proximityText").textContent = "Veri yokken açıklık değerlendirilemez.";
    for (let i = 0; i < 4; i++) $("dir" + i).textContent = "—";
  }
  for (const id of ["exportCSV", "exportJSON", "snapshotButton"])
    $(id).disabled = !ok;
  if ($("showRaw").checked) renderRaw();
  $("trialStart").disabled = !!trial || recording || localReplay || !ok;
}
function renderRaw() {
  if (!$("showRaw").checked) return;
  const pts = fresh() ? analysis.points : [];
  $("rawBody").innerHTML = pts.length
    ? pts
        .slice(0, 120)
        .map(
          ([a, d, q, raw]) =>
            `<tr><td>${fmt(a, 2)}°</td><td>${fmt(raw, 2)}°</td><td>${fmt(d, 1)}</td><td>${fmt(d * Math.sin((a * Math.PI) / 180), 1)}</td><td>${fmt(d * Math.cos((a * Math.PI) / 180), 1)}</td><td>${q}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6" class="empty-cell">Seçili sektörde güncel ve geçerli dönüş yok.</td></tr>';
}
function canvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * dpr),
    h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}
function requestDraw() {
  if (!raf)
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (page === "live") {
        drawRadar();
        drawFrequency();
      } else if (page === "experiments") drawTrial();
    });
}
let plotGeometry = null;
function drawRadar() {
  const { ctx: c, w, h } = canvasSize($("radarCanvas"));
  if (w < 1) return;
  const x = w / 2,
    y = h / 2 - 2,
    r = Math.max(20, Math.min(w / 2 - 45, h / 2 - 62));
  plotGeometry = { x, y, r };
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#102c40";
  c.fillRect(0, 0, w, h);
  const a0 = ((cfg.center - cfg.width / 2 - 90) * Math.PI) / 180,
    a1 = ((cfg.center + cfg.width / 2 - 90) * Math.PI) / 180;
  c.beginPath();
  c.moveTo(x, y);
  c.arc(x, y, r, a0, a1);
  c.closePath();
  c.fillStyle = "#e9a37c0b";
  c.fill();
  c.lineWidth = 1;
  c.font = "11px Manrope";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (let i = 1; i <= 4; i++) {
    const rr = (r * i) / 4;
    c.beginPath();
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.strokeStyle = i === 4 ? "#4c687a" : "#2b495d";
    c.stroke();
    c.fillStyle = "#93adbd";
    if (i < 4)
      c.fillText(fmt((cfg.viewRange * i) / 4000, 2) + " m", x + 5, y - rr + 11);
  }
  for (let a = 0; a < 360; a += 30) {
    const rad = ((a - 90) * Math.PI) / 180;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(rad) * r, y + Math.sin(rad) * r);
    c.strokeStyle = a % 90 === 0 ? "#355469" : "#213f53";
    c.setLineDash(a % 90 === 0 ? [] : [2, 5]);
    c.stroke();
    c.setLineDash([]);
    if (a % 90 !== 0) {
      c.fillStyle = "#8da9bb";
      c.fillText(
        a + "°",
        x + Math.cos(rad) * (r + 17),
        y + Math.sin(rad) * (r + 17),
      );
    }
  }
  for (const [a, label] of [
    [0, "ÖN · 0°"],
    [90, "SAĞ · 90°"],
    [180, "ARKA · 180°"],
    [270, "SOL · 270°"],
  ]) {
    const rad = ((a - 90) * Math.PI) / 180;
    c.fillStyle = "#bcced7";
    c.font = "11px Manrope";
    c.textAlign = a === 90 ? "right" : a === 270 ? "left" : "center";
    c.fillText(
      label,
      a === 90 ? w - 10 : a === 270 ? 10 : x + Math.cos(rad) * (r + 27),
      y + Math.sin(rad) * (r + 23),
    );
    c.textAlign = "center";
  }
  for (const [dist, color] of [
    [cfg.danger, "#cb756280"],
    [cfg.warning, "#bca06465"],
  ])
    if (dist < cfg.viewRange) {
      c.beginPath();
      c.arc(x, y, (dist / cfg.viewRange) * r, 0, 2 * Math.PI);
      c.setLineDash([3, 5]);
      c.strokeStyle = color;
      c.stroke();
      c.setLineDash([]);
    }
  if (cfg.width < 360) {
    for (const a of [a0, a1]) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      c.strokeStyle = "#d89c76a0";
      c.lineWidth = 1;
      c.stroke();
    }
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.lineWidth = 2;
    c.strokeStyle = "#d89c76";
    c.stroke();
  }
  if (fresh() && analysis) {
    if (cfg.context) {
      c.fillStyle = "#748e9c77";
      for (const [a, d] of analysis.all) {
        if (d > cfg.viewRange || inSector(a, cfg.center, cfg.width)) continue;
        const rad = (a * Math.PI) / 180;
        c.fillRect(
          x + ((Math.sin(rad) * d) / cfg.viewRange) * r - 1,
          y - ((Math.cos(rad) * d) / cfg.viewRange) * r - 1,
          2,
          2,
        );
      }
    }
    let prev = null;
    for (const [a, d, q] of analysis.points) {
      if (d > cfg.viewRange) {
        prev = null;
        continue;
      }
      const rad = (a * Math.PI) / 180,
        px = x + ((Math.sin(rad) * d) / cfg.viewRange) * r,
        py = y - ((Math.cos(rad) * d) / cfg.viewRange) * r;
      const color =
        cfg.color === "quality"
          ? `hsl(${35 + (q / 63) * 130} 54% 70%)`
          : cfg.color === "single"
            ? "#f1ae87"
            : d <= cfg.danger
              ? "#ef9384"
              : d <= cfg.warning
                ? "#e5c17d"
                : `hsl(${23 + Math.min(1, d / cfg.max) * 155} 52% 72%)`;
      if (cfg.style === "rays") {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(px, py);
        c.strokeStyle = color + "55";
        if (!color.startsWith("#")) c.strokeStyle = color;
        c.globalAlpha = 0.25;
        c.lineWidth = 0.7;
        c.stroke();
        c.globalAlpha = 1;
      }
      if (
        cfg.style === "contour" &&
        prev &&
        Math.abs(delta(a, prev.a)) < 4 &&
        Math.abs(d - prev.d) < 300
      ) {
        c.beginPath();
        c.moveTo(prev.x, prev.y);
        c.lineTo(px, py);
        c.strokeStyle = color;
        c.lineWidth = 1;
        c.stroke();
      }
      c.fillStyle = color;
      c.beginPath();
      c.arc(
        px,
        py,
        hover && Math.abs(delta(a, hover[0])) < 0.05 && d === hover[1]
          ? 4
          : 1.7,
        0,
        Math.PI * 2,
      );
      c.fill();
      prev = { a, d, x: px, y: py };
    }
  }
  c.beginPath();
  c.arc(x, y, 7, 0, Math.PI * 2);
  c.fillStyle = "#d6e4eb";
  c.fill();
  c.beginPath();
  c.arc(x, y, 2.5, 0, Math.PI * 2);
  c.fillStyle = "#183b50";
  c.fill();
  c.font = "11px Manrope";
  c.fillStyle = "#a9c1cd";
  c.fillText(fmt(cfg.viewRange / 1000, 2) + " m", x, y + r - 10);
}
function chartLine(
  canvas,
  values,
  { color = "#376f87", reference = null, markers = false } = {},
) {
  const { ctx: c, w, h } = canvasSize(canvas);
  if (w < 1 || h < 1) return;
  c.clearRect(0, 0, w, h);
  const finite = values.filter(Number.isFinite);
  if (!finite.length) {
    c.fillStyle = "#617c87";
    c.font = "10px Manrope";
    c.textAlign = "center";
    c.fillText("Henüz ölçüm yok", w / 2, h / 2);
    return;
  }
  let lo = Math.min(...finite),
    hi = Math.max(...finite);
  if (reference !== null && Number.isFinite(reference)) {
    lo = Math.min(lo, reference);
    hi = Math.max(hi, reference);
  }
  const pad = Math.max(1, (hi - lo) * 0.15);
  lo -= pad;
  hi += pad;
  const y = (v) => h - 10 - ((v - lo) / (hi - lo)) * (h - 20),
    x = (i) => 8 + (i / Math.max(1, values.length - 1)) * (w - 16);
  if (reference !== null) {
    c.strokeStyle = "#b87355";
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(0, y(reference));
    c.lineTo(w, y(reference));
    c.stroke();
    c.setLineDash([]);
  }
  c.strokeStyle = color;
  c.lineWidth = 1.6;
  c.beginPath();
  let connected = false;
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      connected = false;
      return;
    }
    if (connected) c.lineTo(x(i), y(v));
    else c.moveTo(x(i), y(v));
    connected = true;
  });
  c.stroke();
  if (markers || finite.length === 1) {
    c.fillStyle = color;
    values.forEach((v, i) => {
      if (Number.isFinite(v)) {
        c.beginPath();
        c.arc(x(i), y(v), 2, 0, 2 * Math.PI);
        c.fill();
      }
    });
  }
  return { lo, hi };
}
function drawFrequency() {
  chartLine($("frequencyChart"), history);
  $("hzMin").textContent = history.length
    ? fmt(Math.min(...history), 1) + " Hz"
    : "—";
  $("hzMax").textContent = history.length
    ? fmt(Math.max(...history), 1) + " Hz"
    : "—";
}
$("radarCanvas").addEventListener("pointermove", (e) => {
  if (!fresh() || !plotGeometry) return;
  const b = $("radarCanvas").getBoundingClientRect(),
    g = plotGeometry;
  let best = null,
    bestDist = 14;
  for (const p of analysis.points) {
    const [a, d] = p;
    if (d > cfg.viewRange) continue;
    const rad = (a * Math.PI) / 180;
    const dist = Math.hypot(
      e.clientX - b.left - g.x - ((Math.sin(rad) * d) / cfg.viewRange) * g.r,
      e.clientY - b.top - g.y + ((Math.cos(rad) * d) / cfg.viewRange) * g.r,
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  hover = best;
  pointReadout();
  requestDraw();
});
$("radarCanvas").addEventListener("pointerleave", () => {
  hover = null;
  pointReadout();
  requestDraw();
});
$("radarCanvas").addEventListener("keydown", (e) => {
  if (
    !["ArrowRight", "ArrowLeft"].includes(e.key) ||
    !fresh() ||
    !analysis.points.length
  )
    return;
  e.preventDefault();
  const idx = hover ? analysis.points.indexOf(hover) : -1;
  hover =
    analysis.points[
      (idx + (e.key === "ArrowRight" ? 1 : -1) + analysis.points.length) %
        analysis.points.length
    ];
  pointReadout();
  requestDraw();
});
function pointReadout() {
  $("pointReadout").textContent = hover
    ? `${fmt(hover[0], 2)}° · ${fmt(hover[1], 1)} mm · Q ${hover[2]} · X ${fmt(hover[1] * Math.sin((hover[0] * Math.PI) / 180), 0)} / Y ${fmt(hover[1] * Math.cos((hover[0] * Math.PI) / 180), 0)} mm`
    : "Noktayı incelemek için üzerine gelin veya dokunun. Klavye: ← →";
}
const observer = new ResizeObserver(() => requestDraw());
for (const id of ["radarCanvas", "frequencyChart", "trialChart"])
  observer.observe($(id));
function download(content, name, type = "application/json") {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
function provenance() {
  return {
    source: localReplay ? "replay" : state.source,
    original_source: localReplay ? replay.source : null,
    device_info: localReplay ? replay.device_info : state.device_info,
    config: { ...cfg },
    exported_at: new Date().toISOString(),
  };
}
$("exportJSON").addEventListener("click", () => {
  if (fresh())
    download(
      JSON.stringify(
        { schema: "rplidar-lab/1", kind: "scan", ...provenance(), scan },
        null,
        2,
      ),
      `rplidar-scan-${stamp()}.json`,
    );
});
$("exportCSV").addEventListener("click", () => {
  if (!fresh()) return;
  const p = provenance();
  const rows = [
    "# RPLIDAR Lab; schema=rplidar-lab/1; source=" +
      p.source +
      "; original_source=" +
      (p.original_source || ""),
    "# config=" + JSON.stringify(cfg),
    "timestamp_s,scan_seq,raw_angle_deg,angle_deg,distance_mm,x_mm,y_mm,quality",
  ];
  for (const [a, d, q, raw] of analysis.points) {
    rows.push(
      [
        scan.timestamp,
        scan.seq,
        raw,
        a.toFixed(3),
        d,
        (d * Math.sin((a * Math.PI) / 180)).toFixed(2),
        (d * Math.cos((a * Math.PI) / 180)).toFixed(2),
        q,
      ].join(","),
    );
  }
  download(
    rows.join("\n"),
    `rplidar-sector-${stamp()}.csv`,
    "text/csv;charset=utf-8",
  );
});
$("snapshotButton").addEventListener("click", () => {
  if (!fresh()) return;
  const a = document.createElement("a");
  a.href = $("radarCanvas").toDataURL("image/png");
  a.download = `rplidar-${activeSource()}-${stamp()}.png`;
  a.click();
});
function startCapture() {
  if (!fresh() || localReplay || trial) {
    toast("Kayıt için canlı cihaz veya simülasyon taraması gerekir.", true);
    return;
  }
  capture = {
    schema: "rplidar-lab/1",
    kind: "recording",
    created_at: new Date().toISOString(),
    source: state.source,
    device_info: structuredClone(state.device_info),
    config: { ...cfg },
    frames: [],
  };
  capturedPoints = 0;
  recording = true;
  renderCapture();
  inputLock();
  toast("Ham tarama kaydı başladı. Ayarlar kayıt boyunca sabit tutulur.");
}
function stopCapture(
  message = "Kayıt durduruldu. Dosyayı indirmeyi unutmayın.",
) {
  recording = false;
  renderCapture();
  inputLock();
  toast(message);
}
for (const id of ["recordButton", "recordButton2"])
  $(id).addEventListener("click", () =>
    recording ? stopCapture() : startCapture(),
  );
function renderCapture() {
  const count = capture?.frames.length || 0;
  for (const id of ["recordButton", "recordButton2"]) {
    $(id).classList.toggle("is-recording", recording);
    $(id).innerHTML =
      '<span class="record-dot"></span>' +
      (recording ? "Kaydı durdur" : "Kaydı başlat");
  }
  $("recordingInfo").textContent = recording
    ? `${count} tarama kaydedildi`
    : "Ham 360° veri kaydedilir";
  $("captureFrames").innerHTML = count + " <small>tarama</small>";
  $("captureStatus").textContent = recording
    ? "Kayıt sürüyor"
    : count
      ? "Kayıt indirmeye hazır"
      : "Kayıt hazır";
  $("captureSize").textContent = count
    ? `${sourceName(capture.source)} · ${fmt(capturedPoints, 0)} nokta · ${fmt(count > 1 ? capture.frames.at(-1).timestamp - capture.frames[0].timestamp : 0, 1)} saniye`
    : "En fazla 1.200 tarama / 500.000 nokta";
  $("recordCount").textContent = count;
  $("downloadRecording").disabled = !count || recording;
  $("clearRecording").disabled = !count || recording;
}
$("downloadRecording").addEventListener("click", () => {
  if (capture?.frames.length)
    download(
      JSON.stringify(capture),
      `rplidar-${capture.source}-${stamp()}.json`,
    );
});
$("clearRecording").addEventListener("click", () => {
  if (!recording) {
    capture = null;
    capturedPoints = 0;
    renderCapture();
  }
});
function stopReplay() {
  clearTimeout(replayTimer);
  replayPlaying = false;
  $("replayPlay").innerHTML = '<svg><use href="#i-play"/></svg>Oynat';
}
async function activateReplay() {
  if (!replay || trial || recording) return;
  try {
    const accepted = await api("/api/source", { source: "idle" });
    minimumGeneration = accepted.generation ?? -1;
    stopReplay();
    localReplay = true;
    scan = analysis = null;
    history = [];
    cfg = { ...replay.config };
    syncConfig();
    $("sourceSelect").value = "replay";
    showReplayFrame(replayIndex);
    renderState();
  } catch (e) {
    toast(e.message, true);
  }
}
function showReplayFrame(index) {
  if (!replay) return;
  replayIndex = Math.max(0, Math.min(replay.frames.length - 1, index));
  scan = { ...replay.frames[replayIndex], source: "replay", generation: -1 };
  receivedAt = performance.now();
  analysis = analyze(scan, cfg);
  $("replayScrub").value = replayIndex;
  $("replayPosition").textContent =
    `${replayIndex + 1} / ${replay.frames.length}`;
  history = replay.frames
    .slice(Math.max(0, replayIndex - 59), replayIndex + 1)
    .map((f) => f.hz);
  renderMetrics();
  requestDraw();
  inputLock();
}
function playStep() {
  if (!replayPlaying || !localReplay) return;
  if (replayIndex >= replay.frames.length - 1) {
    stopReplay();
    renderState();
    return;
  }
  const gap =
    ((replay.frames[replayIndex + 1].timestamp -
      replay.frames[replayIndex].timestamp) *
      1000) /
    Number($("replaySpeed").value);
  replayTimer = setTimeout(
    () => {
      showReplayFrame(replayIndex + 1);
      playStep();
    },
    Math.max(5, Math.min(gap, 10000)),
  );
}
function toggleReplay() {
  if (trial || recording) return;
  if (!localReplay) {
    activateReplay().then(() => {
      if (localReplay) toggleReplay();
    });
    return;
  }
  if (replayPlaying) stopReplay();
  else {
    if (replayIndex >= replay.frames.length - 1) showReplayFrame(0);
    replayPlaying = true;
    $("replayPlay").innerHTML = '<svg><use href="#i-pause"/></svg>Duraklat';
    playStep();
  }
  renderState();
}
$("replayPlay").addEventListener("click", toggleReplay);
$("replayScrub").addEventListener("input", () => {
  stopReplay();
  showReplayFrame(Number($("replayScrub").value));
  renderState();
});
$("replaySpeed").addEventListener("change", () => {
  if (replayPlaying) {
    clearTimeout(replayTimer);
    playStep();
  }
});
$("viewReplay").addEventListener("click", () => navigate("live"));
$("recordingFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 25_000_000) throw Error("Dosya 25 MB sınırını aşıyor.");
    replay = validateRecording(JSON.parse(await file.text()));
    replayIndex = 0;
    $("replayEmpty").hidden = true;
    $("replayControls").hidden = false;
    $("replayFilename").textContent = file.name;
    $("replaySource").textContent = sourceName(replay.source);
    $("replaySource").className =
      "badge " + (replay.source === "demo" ? "demo" : "neutral");
    $("replayScrub").max = replay.frames.length - 1;
    await activateReplay();
    toast(
      "Kayıt yüklendi. Canlı tarama ekranından açıları inceleyebilirsiniz.",
    );
  } catch (err) {
    toast(err.message, true);
  } finally {
    $("recordingFile").value = "";
  }
});
function setTrialKind(kind) {
  if (trial) return;
  trialKind = kind;
  for (const b of document.querySelectorAll("[data-trial]"))
    b.classList.toggle("active", b.dataset.trial === kind);
  $("trialTitle").textContent = protocols[kind].name;
  $("trialProtocol").textContent = protocols[kind].text;
}
for (const b of document.querySelectorAll("[data-trial]"))
  b.addEventListener("click", () => setTrialKind(b.dataset.trial));
$("trialForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!fresh() || recording || trial) return;
  if (localReplay) {
    toast(
      "Deney için USB veya simülasyon kaynağı seçin. Kayıtlar yeni edinim deneyi sayılmaz.",
      true,
    );
    return;
  }
  const bearing = Number($("trialBearing").value),
    beam = Number($("trialBeam").value);
  if (!inSector(bearing, cfg.center, cfg.width)) {
    toast("Hedef doğrultusu seçili görüş alanının dışında.", true);
    return;
  }
  const duration = Number($("trialDuration").value);
  trial = {
    schema: "rplidar-lab/1",
    kind: "experiment",
    id: Date.now(),
    protocol: trialKind,
    name: protocols[trialKind].name,
    source: state.source,
    generation: state.generation,
    device_info: structuredClone(state.device_info),
    scan_mode: scan.mode,
    config: { ...cfg },
    reference: Number($("trialReference").value),
    tolerance: Number($("trialTolerance").value),
    duration,
    bearing,
    beam,
    label: $("trialLabel").value.trim(),
    notes: $("trialNotes").value.trim(),
    created_at: new Date().toISOString(),
    start: performance.now(),
    samples: [],
    evidence: [],
  };
  lastTrial = null;
  $("trialResults").hidden = true;
  $("trialState").textContent = "Ölçülüyor";
  $("trialState").className = "badge live";
  $("trialProgressBar").value = 0;
  inputLock();
  toast("Deney başladı. Sensörü ve hedefi sabit tutun.");
});
$("trialCancel").addEventListener("click", () =>
  finishTrial("Kullanıcı iptal etti."),
);
function finishTrial(aborted = null) {
  if (!trial) return;
  const t = trial;
  trial = null;
  t.elapsed_s = (performance.now() - t.start) / 1000;
  delete t.start;
  t.aborted = aborted;
  t.result = trialResult(t.samples, t.reference, t.tolerance);
  t.completion = aborted
    ? "incomplete"
    : t.samples.length >= 5
      ? "complete"
      : "insufficient";
  results.push(t);
  // Bound aggregate raw evidence as well as the number of retained results.
  while (
    results.length > 1 &&
    (results.length > 20 ||
      results.reduce(
        (n, r) => n + r.evidence.reduce((m, f) => m + f.points.length, 0),
        0,
      ) > 1000000)
  ) {
    results.shift();
  }
  lastTrial = t;
  $("trialState").textContent = aborted
    ? "Kesildi"
    : t.completion === "insufficient"
      ? "Yetersiz veri"
      : "Tamamlandı";
  $("trialState").className =
    "badge " + (aborted ? "error" : t.source === "demo" ? "demo" : "neutral");
  $("trialProgress").textContent =
    aborted || `${t.samples.length} tur · ${fmt(t.elapsed_s, 1)} saniye`;
  $("trialProgressBar").value = aborted ? 0 : 100;
  renderTrialResult(t);
  renderTrialHistory();
  drawTrial();
  inputLock();
  toast(
    aborted
      ? "Deney kesildi; eksik sonuç işaretlendi."
      : "Deney tamamlandı. Sonuç ve ham kanıt hazır.",
    !!aborted,
  );
}
function renderTrialResult(t) {
  const r = t.result;
  const valid = t.completion === "complete";
  let text = t.aborted
    ? "Eksik deney: " + t.aborted
    : t.protocol === "frequency"
      ? `Tur frekansı ${fmt(r.hz.min, 2)}–${fmt(r.hz.max, 2)} Hz. σ = ${fmt(r.hz.sd, 3)} Hz. Arayüze ulaşan ${r.frames} tur incelendi.`
      : t.protocol === "coverage"
        ? `Ortalama 1° açısal doluluk %${fmt(r.coverage, 1)}. Bu, sensörün doğruluğu veya alanın güvenli olduğu anlamına gelmez.`
        : r.n < 5
          ? "Hedef açıklığında en az 5 geçerli tur yok. Sonuç çıkarmak için ölçümü tekrarlayın."
          : `Geçerli hedef turu ${r.n}/${r.frames}. Tüm alınan turlarda ±${t.tolerance} mm tolerans içinde kalma oranı %${fmt(r.withinTolerance, 1)}. Kayıp hedef turları paydaya dahildir.`;
  if (t.source === "demo") text = "SİMÜLASYON SONUCU · " + text;
  if (!valid) text += " Tamamlanmış fiziksel test olarak kullanmayın.";
  $("trialResults").innerHTML =
    `<div><span>Ortalama mesafe</span><strong>${fmt(r.mean, 1)} mm</strong></div><div><span>Standart sapma · σ</span><strong>${fmt(r.sd, 2)} mm</strong></div><div><span>RMSE</span><strong>${fmt(r.rmse, 2)} mm</strong></div><div><span>Hedef isabeti</span><strong>%${fmt(r.hitRate, 1)}</strong></div><p>${esc(text)}</p>`;
  $("trialResults").hidden = false;
}
function drawTrial() {
  const t = trial || lastTrial;
  chartLine($("trialChart"), t ? t.samples.map((s) => s.range) : [], {
    reference: t?.reference ?? null,
    markers: true,
  });
  $("trialChartLabel").textContent = t
    ? `${t.name} · Tur başına hedef medyanı (mm) · Kesikli çizgi: ${t.reference} mm referans · Geçersiz turlarda çizgi kesilir.`
    : "Deney tamamlandığında tur başına ölçümler burada görünür.";
}
function renderTrialHistory() {
  $("exportReport").disabled = !results.length;
  $("trialHistory").innerHTML = results.length
    ? [...results]
        .reverse()
        .map(
          (t) =>
            `<tr><td><strong>${esc(t.name)}</strong><br><span class="muted">${esc(t.label || "Koşul belirtilmedi")}${t.completion !== "complete" ? " · EKSİK" : ""}</span></td><td>${esc(sourceName(t.source))}</td><td>${t.result.frames} / %${fmt(t.result.hitRate, 0)}</td><td>${fmt(t.result.mean)}</td><td>${fmt(t.result.sd, 2)}</td><td>${fmt(t.result.rmse, 2)}</td><td>${fmt(t.result.hz.mean, 2)}</td><td><button class="inline-download" data-result="${t.id}">JSON</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="8" class="empty-cell">Henüz deney yok.</td></tr>';
}
$("trialHistory").addEventListener("click", (e) => {
  const b = e.target.closest("[data-result]");
  if (b) {
    const t = results.find((t) => String(t.id) === b.dataset.result);
    if (t) download(JSON.stringify(t), `rplidar-experiment-${t.id}.json`);
  }
});
$("exportReport").addEventListener("click", () => {
  if (!results.length) return;
  const rows = results
    .map(
      (t) =>
        `<section><h2>${esc(t.name)} · ${esc(t.label || "Koşul belirtilmedi")}</h2><p><strong>${esc(sourceName(t.source))} · ${t.completion === "complete" ? "TAMAMLANDI" : "EKSİK"}</strong> · ${esc(t.created_at)}</p><p>${esc(protocols[t.protocol].text)}</p><table><tr><th>Tur / geçerli hedef</th><th>Ort. mm</th><th>σ mm</th><th>Yanlılık mm</th><th>RMSE mm</th><th>P95 |hata| mm</th><th>Hz</th></tr><tr><td>${t.result.frames} / ${t.result.n}</td><td>${fmt(t.result.mean)}</td><td>${fmt(t.result.sd, 2)}</td><td>${fmt(t.result.bias, 2)}</td><td>${fmt(t.result.rmse, 2)}</td><td>${fmt(t.result.p95, 2)}</td><td>${fmt(t.result.hz.mean, 2)}</td></tr></table><p>Hedef isabeti %${fmt(t.result.hitRate)} · ±${t.tolerance} mm içinde %${fmt(t.result.withinTolerance)} · Referans ${t.reference} mm · Hedef ${t.bearing}° ±${t.beam / 2}° · Gerçek süre ${fmt(t.elapsed_s, 2)} s</p><p>1° doluluk %${fmt(t.result.coverage)} · Q medyanı ${fmt(t.result.quality)} · Tarama modu ${esc(t.scan_mode)}</p><p>Filtreler: <code>${esc(JSON.stringify(t.config))}</code></p><p>Cihaz: <code>${esc(JSON.stringify(t.device_info))}</code></p><p>Notlar: ${esc(t.notes || "—")}</p>${t.aborted ? "<p>Kesilme nedeni: " + esc(t.aborted) + "</p>" : ""}</section>`,
    )
    .join("");
  download(
    `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RPLIDAR Lab · Deney raporu</title><style>body{font:14px/1.8 system-ui;color:#193b51;max-width:1100px;margin:40px auto;padding:25px}h1{font-size:28px}h2{font-size:20px}section{border-top:1px solid #b8c9d0;padding:25px 0;break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:12px}td,th{padding:8px;border:1px solid #ccd6d9;text-align:left}p,code{overflow-wrap:anywhere}code{font-size:11px}@media print{body{margin:0;padding:0}}</style><h1>RPLIDAR Lab · Deney raporu</h1><p>Oluşturulma: ${esc(new Date().toLocaleString("tr-TR"))}. Simülasyon sonuçları fiziksel cihaz doğrulaması değildir. σ tur medyanlarının örnek standart sapmasıdır. Hedef isabeti geçerli hedef dönüşü bulunan turların alınan tüm turlara oranıdır. Arayüze teslim edilmeyen turlar bu paydaya dahil değildir.</p><p>Ham kanıtlar her deney satırının JSON dosyasındadır. Bu rapor yeni bir fiziksel test veya üretici uygunluk beyanı değildir. Referans ölçüm belirsizliği ayrıca değerlendirilmelidir.</p>${rows}<p>Yöntem ve kaynak: <a href="https://github.com/Slamtec/rplidar_sdk">SLAMTEC SDK</a> · <a href="https://www.slamtec.com/en/lidar/a2spec">Üretici model özellikleri</a></p></html>`,
    `rplidar-report-${stamp()}.html`,
    "text/html;charset=utf-8",
  );
});
setInterval(() => {
  if (trial) {
    const elapsed = (performance.now() - trial.start) / 1000;
    $("trialProgressBar").value = Math.min(
      100,
      (elapsed / trial.duration) * 100,
    );
    $("trialProgress").textContent =
      `${fmt(elapsed, 1)} / ${trial.duration} s · ${trial.samples.length} tur`;
    if (elapsed >= trial.duration) finishTrial();
    else if (!fresh()) finishTrial("Güncel tarama alınamadı.");
  }
  if (!localReplay && scan && !fresh()) {
    if (recording) stopCapture("Tarama güncel olmadığı için kayıt durduruldu.");
    scan = analysis = null;
    renderState();
  }
  inputLock();
}, 200);
window.addEventListener("beforeunload", (e) => {
  if (recording || trial) {
    e.preventDefault();
    e.returnValue = "";
  }
});
syncConfig();
setTrialKind("accuracy");
navigate(location.hash.slice(1) || "live");
connect();
