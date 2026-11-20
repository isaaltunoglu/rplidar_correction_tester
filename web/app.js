import {
  wrap,
  delta,
  inSector,
  DEFAULT_CONFIG,
  toMillimetres,
  fromMillimetres,
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
const distanceFields = {
  minDistance: {
    key: "min",
    unit: "cm",
    min: 0,
    max: 99999,
    name: "En yakın mesafe",
  },
  maxDistance: {
    key: "max",
    unit: "m",
    min: 1,
    max: 100000,
    name: "En uzak mesafe",
  },
  dangerDistance: {
    key: "danger",
    unit: "cm",
    min: 1,
    max: 50000,
    name: "Kırmızı uyarı mesafesi",
  },
  warningDistance: {
    key: "warning",
    unit: "m",
    min: 2,
    max: 100000,
    name: "Sarı uyarı mesafesi",
  },
  viewRangeValue: {
    key: "viewRange",
    unit: "m",
    min: 500,
    max: 50000,
    name: "Grafik uzaklığı",
  },
  guidedReference: {
    unit: "cm",
    min: 1,
    max: 100000,
    name: "Karşılaştırma uzaklığı",
  },
  trialTolerance: { unit: "cm", min: 1, max: 10000, name: "Hata payı" },
};
const distanceUnits = Object.fromEntries(
  Object.entries(distanceFields).map(([id, f]) => [id, f.unit]),
);
let toleranceMm = 30;
const unitLabel = (u) => (u === "m" ? "metre" : u);
function distanceText(mm, unit) {
  return Number.isFinite(mm)
    ? fromMillimetres(mm, unit).toLocaleString("tr-TR", {
        maximumFractionDigits: 4,
      }) +
        " " +
        unitLabel(unit)
    : "—";
}
function distanceValueMm(id) {
  return distanceFields[id].key
    ? cfg[distanceFields[id].key]
    : id === "guidedReference"
      ? Number($("trialReference").value)
      : toleranceMm;
}
function syncDistanceFields() {
  for (const [id, f] of Object.entries(distanceFields)) {
    const unit = distanceUnits[id],
      input = $(id);
    input.value = fromMillimetres(distanceValueMm(id), unit);
    input.setAttribute("step", "any");
    input.min = fromMillimetres(f.min, unit);
    input.max = fromMillimetres(f.max, unit);
    $(id + "Unit").value = unit;
  }
  $("distanceRangeSummary").textContent =
    distanceText(cfg.min, distanceUnits.minDistance) +
    " – " +
    distanceText(cfg.max, distanceUnits.maxDistance);
  const yellow = distanceText(cfg.warning, distanceUnits.warningDistance),
    red = distanceText(cfg.danger, distanceUnits.dangerDistance);
  $("warningRule").textContent =
    `Nesne ${yellow} veya daha yakındaysa sarı; ${red} veya daha yakındaysa kırmızı uyarı görünür. Kırmızı uyarı önceliklidir.`;
  const clipped = cfg.min > cfg.danger || cfg.max < cfg.warning;
  $("warningScope").textContent =
    "Uyarılar yalnızca seçtiğiniz yön ve inceleme mesafesi içindeki ölçümler için geçerlidir." +
    (clipped
      ? " Uyarı mesafelerinizin bir bölümü inceleme aralığı dışında; dışarıda kalan ölçümler uyarı üretmez."
      : "");
  $("yellowLegend").textContent =
    "Sarı kesikli çizgi: " +
    yellow +
    (cfg.warning > cfg.viewRange ? " (görüntünün dışında)" : "");
  $("redLegend").textContent =
    "Kırmızı kesikli çizgi: " +
    red +
    (cfg.danger > cfg.viewRange ? " (görüntünün dışında)" : "");
}
function checkDistanceConfig(next) {
  if (next.min >= next.max)
    throw Error(
      "En yakın mesafe, en uzak mesafeden küçük olmalı. Değerleri ve birimlerini kontrol edin.",
    );
  if (next.danger >= next.warning)
    throw Error(
      "Kırmızı uyarı mesafesi sarıdan küçük olmalı. Örneğin sarı 1 metre, kırmızı 50 cm olabilir.",
    );
  return validateConfig(next);
}
const sourceName = (s) =>
  ({
    hardware: "Gerçek sensör",
    demo: "Sensörsüz örnek",
    replay: "Kayıttan izleme",
    idle: "Kaynak bekleniyor",
  })[s] || "Bilinmiyor";
const titles = {
  live: "Canlı görüntü",
  experiments: "Adım adım test",
  recordings: "Kayıt ve izleme",
  device: "Ayarlar ve yardım",
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
  if (next === "experiments") {
    if (!trial) setTrialKind(trialKind);
    drawTrial();
  }
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
    "#prepareDemoTarget,#guidedReference,#guidedTrialSelect,#watchRecording,#replayRestart,.settings-panel input,.settings-panel select,.preset,.experiment-option,#trialForm input,#trialForm select,#trialForm textarea,#sourceSelect,#demoScene,#portSelect,#baudSelect,#reconnectButton,#scanMode,#motorSpeed,#applyMotor,#resetConfig,#recordingFile,#replayScrub,#replaySpeed,#replayPlay",
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
  $("watchRecording").disabled = locked || !capture?.frames.length;
}
function syncConfig() {
  const map = {
    sectorCenter: "center",
    sectorWidth: "width",
    viewRange: "viewRange",
    qualityMin: "quality",
    angleOffset: "offset",
    renderStyle: "style",
    colorMode: "color",
  };
  for (const [id, k] of Object.entries(map)) $(id).value = cfg[k];
  syncDistanceFields();
  $("showContext").checked = cfg.context;
  $("invertAngle").checked = cfg.invert;
  const names = { 0: "Ön", 90: "Sağ", 180: "Arka", 270: "Sol" };
  $("centerLabel").textContent =
    cfg.center + "°" + (names[cfg.center] ? " · " + names[cfg.center] : "");
  $("widthLabel").textContent = cfg.width + "°";
  $("viewLabel").textContent = distanceText(
    cfg.viewRange,
    distanceUnits.viewRangeValue,
  );
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
    `Sektör: merkez ${cfg.center}° / açıklık ${cfg.width}° · Mesafe: ${distanceText(cfg.min, distanceUnits.minDistance)}–${distanceText(cfg.max, distanceUnits.maxDistance)} · Q ≥ ${cfg.quality} · Ofset ${cfg.offset}°${cfg.invert ? " · Ters yön" : ""}`;
  $("selectedDirection").textContent =
    cfg.width === 360
      ? "Her yöndeki ölçümler gösteriliyor."
      : `${{ 0: "Ön", 90: "Sağ", 180: "Arka", 270: "Sol" }[cfg.center] || "Seçtiğiniz"} taraf · ${cfg.width}° genişliğinde alan`;
  if (scan) analysis = analyze(scan, cfg);
  renderMetrics();
  requestDraw();
}
const numericConfig = {
  sectorCenter: "center",
  sectorWidth: "width",
  viewRange: "viewRange",
  qualityMin: "quality",
  angleOffset: "offset",
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
for (const [id, f] of Object.entries(distanceFields)) {
  $(id).addEventListener(
    id === "guidedReference" ? "input" : "change",
    (event) => {
      if (trial || recording) return;
      if (event.type === "input" && $(id).value === "") return;
      try {
        const mm = toMillimetres($(id).value, distanceUnits[id]);
        if (mm < f.min || mm > f.max)
          throw Error(
            `${f.name}, ${distanceText(f.min, distanceUnits[id])} ile ${distanceText(f.max, distanceUnits[id])} arasında olmalı.`,
          );
        if (f.key) {
          const next = { ...cfg, [f.key]: mm };
          if (id === "maxDistance")
            next.viewRange = Math.min(50000, Math.max(500, mm));
          cfg = checkDistanceConfig(next);
        } else if (id === "guidedReference") $("trialReference").value = mm;
        else toleranceMm = mm;
        if (id === "guidedReference") return;
        syncConfig();
      } catch (error) {
        toast(error.message, true);
        syncDistanceFields();
      }
    },
  );
  $(id + "Unit").addEventListener("change", () => {
    if (trial || recording) {
      $(id + "Unit").value = distanceUnits[id];
      return;
    }
    distanceUnits[id] = $(id + "Unit").value;
    syncConfig();
    if (id === "guidedReference" && page === "experiments" && !trial)
      setTrialKind(trialKind, true);
  });
}
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
    toast("İsteğiniz iletildi. Ölçüm durumu güncelleniyor.");
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
    notice = `KAYITTAN İZLEME · ${sourceName(replay.source)} kaydı gösteriliyor. Yeni ölçüm yapılmıyor.`;
  } else if (state.source === "demo") {
    badge = "Sensörsüz örnek";
    notice =
      "SENSÖRSÜZ ÖRNEK · Görüntü bilgisayarda oluşturulur. Gerçek sensörden veri alınmıyor.";
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
      state.status.connection === "connecting"
        ? "Sensör bulundu. Bağlantı kuruluyor; kısa bir süre bekleyin."
        : state.status.connection === "stale"
          ? "Yeni ölçüm gelmiyor. USB bağlantısı yeniden deneniyor."
          : state.error?.includes("izni")
            ? "Bu bilgisayarda sensöre erişim izni yok. Ayarlar ve yardım bölümünden bağlantı yönergelerini açın."
            : "Sensörü USB ile bağlayın. Bağlantı otomatik kurulacak. Sensörünüz yoksa örneği deneyin.";
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
      "Uygulamaya yeniden bağlanılıyor. Bağlantı gelene kadar eski ölçümler gizlenir.";
  } else if (paused) {
    emptyTitle.textContent = "Ölçüm durduruldu.";
    emptyDescription.textContent =
      "Yukarıdaki Ölçüme devam et düğmesine basın. Yeni ölçümler geldiğinde noktalar yeniden görünecek.";
  } else if (state.source === "demo") {
    emptyTitle.textContent = "Yeni tarama bekleniyor.";
    emptyDescription.textContent =
      "Örnek ölçümler bekleniyor. Yeni veri geldiğinde noktalar burada görünecek.";
  } else {
    emptyTitle.textContent = "Sensörünüz hazır mı?";
    emptyDescription.textContent =
      "Sensörü USB ile bağlayın; ölçümler otomatik olarak burada görünür. Sensörünüz yoksa örneği açın.";
  }
  $("plotDemo").hidden =
    paused || localReplay || state.source === "demo" || !streamOnline;
  $("plotSource").textContent =
    source === "hardware" ? "USB" : source === "demo" ? "ÖRNEK VERİ" : "KAYIT";
  $("plotWatermark").textContent = localReplay
    ? `KAYIT · ASIL KAYNAK: ${sourceName(replay.source).toLocaleUpperCase("tr")}`
    : source === "demo"
      ? "SENSÖRSÜZ ÖRNEK"
      : fresh()
        ? "GERÇEK SENSÖR"
        : "SENSÖR BEKLENİYOR";
  $("trialSource").textContent = localReplay
    ? `Kayıt / ${sourceName(replay.source)}`
    : sourceName(source);
  $("trialSource").className =
    "badge " +
    (source === "demo" ? "demo" : localReplay ? "replay" : "neutral");
  $("plotDot").classList.toggle("live", fresh());
  $("pauseButton").querySelector("span").textContent = localReplay
    ? replayPlaying
      ? "Ölçümü durdur"
      : "Oynat"
    : state.status.scanning
      ? "Ölçümü durdur"
      : "Ölçüme devam et";
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
        ? `Son tarama: ${new Date(scan.timestamp * 1000).toLocaleTimeString("tr-TR")}`
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
  if (
    page === "experiments" &&
    !trial &&
    guideKey !==
      JSON.stringify([state?.source, state?.selection?.scene, trialKind])
  )
    setTrialKind(trialKind);
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
      fmt(analysis.nearest?.[1] / 1000, 2) + " <small>metre</small>";
    $("metricAngle").textContent = analysis.nearest
      ? `Sensöre göre yönü: ${fmt(analysis.nearest[0], 0)}°`
      : "Bu yönden ölçüm alınamadı";
    $("metricCoverage").innerHTML =
      fmt(analysis.coverage, 1) + " <small>%</small>";
    $("scanMeta").textContent = `Ölçüm ${scan.seq}`;
    const words = {
      unknown: [
        "Bu yönden ölçüm alınamadı",
        "Bu yönde nesne olup olmadığı söylenemez. Yönü veya mesafe ayarlarını kontrol edin.",
      ],
      danger: [
        "Kırmızı uyarı: nesne çok yakın",
        `Nesne ${distanceText(analysis.nearest?.[1], distanceUnits.dangerDistance)} uzakta. Kırmızı uyarı sınırınız ${distanceText(cfg.danger, distanceUnits.dangerDistance)}; bu mesafede veya daha yakında olduğu için kırmızı uyarı gösteriliyor.`,
      ],
      warning: [
        "Sarı uyarı: nesne uyarı mesafesinde",
        `Nesne ${distanceText(analysis.nearest?.[1], distanceUnits.warningDistance)} uzakta. Sarı sınırınız ${distanceText(cfg.warning, distanceUnits.warningDistance)}. ${distanceText(cfg.danger, distanceUnits.dangerDistance)} veya daha yakında kırmızı uyarıya döner.`,
      ],
      clear: [
        "Uyarı mesafesinde ölçüm yok",
        `Alınan ölçümler sarı sınırınız olan ${distanceText(cfg.warning, distanceUnits.warningDistance)} mesafesinden daha uzakta. Ölçüm gelmeyen bir yerin boş olduğu söylenemez.`,
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
      ["metricNear", "— <small>metre</small>"],
      ["metricCoverage", "— <small>%</small>"],
    ])
      $(id).innerHTML = html;
    $("metricRpm").textContent = "Tur / saniye";
    $("metricRaw").textContent = "Yeni tarama bekleniyor";
    $("metricAngle").textContent = "Seçtiğiniz yönde";
    $("scanMeta").textContent = "Güncel tarama yok";
    $("proximity").dataset.state = "unknown";
    $("proximityTitle").textContent = "Güncel ölçüm yok";
    $("proximityText").textContent =
      "Ölçüm gelmeden nesnelerin uzaklığı bilinemez.";
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
      else if (page === "recordings" && localReplay)
        drawRadar($("replayCanvas"));
    });
}
let plotGeometry = null;
function drawRadar(target = $("radarCanvas")) {
  const { ctx: c, w, h } = canvasSize(target);
  if (w < 1) return;
  const x = w / 2,
    y = h / 2 - 2,
    r = Math.max(20, Math.min(w / 2 - 45, h / 2 - 62));
  if (target.id === "radarCanvas") plotGeometry = { x, y, r };
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
      c.fillText(
        distanceText((cfg.viewRange * i) / 4, distanceUnits.viewRangeValue),
        x + 5,
        y - rr + 11,
      );
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
    if (a % 90 !== 0 && $("technicalReadings").open) {
      c.fillStyle = "#8da9bb";
      c.fillText(
        a + "°",
        x + Math.cos(rad) * (r + 17),
        y + Math.sin(rad) * (r + 17),
      );
    }
  }
  for (const [a, label] of [
    [0, "ÖN"],
    [90, "SAĞ"],
    [180, "ARKA"],
    [270, "SOL"],
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
    [cfg.danger, "#dd827b99"],
    [cfg.warning, "#dfb56f99"],
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
  c.fillText(
    distanceText(cfg.viewRange, distanceUnits.viewRangeValue),
    x,
    y + r - 10,
  );
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
    ? `Mesafe: ${fmt(hover[1] / 10, 1)} cm · Yön: ${fmt(hover[0], 0)}°`
    : "Bir noktanın uzaklığını görmek için üzerine gelin veya dokunun.";
}
const observer = new ResizeObserver(() => requestDraw());
for (const id of [
  "radarCanvas",
  "frequencyChart",
  "trialChart",
  "replayCanvas",
])
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
  toast("Kayıt başladı. Bitirdiğinizde Kaydı bitir düğmesine basın.");
}
function stopCapture(
  message = "Kayıt bitti. Kayıt ve izleme sayfasından izleyebilir veya bilgisayarınıza kaydedebilirsiniz.",
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
      (recording ? "Kaydı bitir" : "Kaydı başlat");
  }
  $("recordingInfo").textContent = recording
    ? `${count} ölçüm kaydedildi. Bitirince Kayıt ve izleme sayfasını açın.`
    : "Kaydınızı Kayıt ve izleme sayfasından izleyebilir veya indirebilirsiniz.";
  $("captureFrames").innerHTML = count + " <small>tam çevre ölçümü</small>";
  $("captureStatus").textContent = recording
    ? "Kayıt sürüyor"
    : count
      ? "Kayıt hazır. İzleyebilir veya indirebilirsiniz."
      : "Henüz kayıt başlatılmadı";
  $("captureSize").textContent = count
    ? `${sourceName(capture.source)} · ${fmt(capturedPoints, 0)} nokta · ${fmt(count > 1 ? capture.frames.at(-1).timestamp - capture.frames[0].timestamp : 0, 1)} saniye`
    : "Önce Kaydı başlat, sonra Kaydı bitir düğmesine basın.";
  $("recordCount").textContent = count;
  $("downloadRecording").disabled = !count || recording;
  $("clearRecording").disabled = !count || recording;
  $("watchRecording").disabled = !count || recording || !!trial;
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
    `${fmt(scan.timestamp - replay.frames[0].timestamp, 1)} / ${fmt(replay.frames.at(-1).timestamp - replay.frames[0].timestamp, 1)} saniye · ${replayIndex + 1}. ölçüm`;
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
    $("replayPlay").innerHTML = '<svg><use href="#i-pause"/></svg>Durdur';
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
async function loadRecording(data, name) {
  if (!data || typeof data !== "object")
    throw Error(
      "Dosyada kayıt bilgisi bulunamadı. Bu uygulamadan indirilmiş bir kayıt dosyası seçin.",
    );
  if (data.kind === "experiment" || data.kind === "scan")
    throw Error(
      "Bu dosya bir test veya tek ölçüm dosyası. Yeniden izlemek için Kaydı bilgisayara kaydet düğmesinden indirdiğiniz kayıt dosyasını seçin.",
    );
  replay = validateRecording(data);
  replayIndex = 0;
  $("replayEmpty").hidden = true;
  $("replayControls").hidden = false;
  $("replayFilename").textContent = name;
  $("replaySource").textContent = sourceName(replay.source);
  $("replaySource").className =
    "badge " + (replay.source === "demo" ? "demo" : "neutral");
  $("replayScrub").max = replay.frames.length - 1;
  const duration = replay.frames.at(-1).timestamp - replay.frames[0].timestamp;
  $("replayFacts").innerHTML =
    `<strong>${esc(sourceName(replay.source))}</strong><br>${fmt(duration, 1)} saniyelik kayıt · ${replay.frames.length} tam çevre ölçümü<br>Oynat düğmesiyle noktaların zaman içindeki değişimini izleyin.`;
  await activateReplay();
  toast("Kayıt açıldı. Oynat düğmesiyle aşağıdaki görüntüyü izleyin.");
}
$("recordingFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 25_000_000)
      throw Error(
        "Dosya çok büyük. En fazla 25 MB büyüklüğünde bir kayıt seçin.",
      );
    await loadRecording(JSON.parse(await file.text()), file.name);
  } catch (err) {
    toast(
      err instanceof SyntaxError
        ? "Dosya okunamadı. Bu uygulamadan indirilmiş bir kayıt dosyası (.json) seçin."
        : err.message,
      true,
    );
  } finally {
    $("recordingFile").value = "";
  }
});
$("watchRecording").addEventListener("click", async () => {
  try {
    if (capture?.frames.length && !recording) {
      await loadRecording(capture, "Bu oturumda oluşturduğunuz kayıt");
    }
  } catch (err) {
    toast(err.message, true);
  }
});
$("replayRestart").addEventListener("click", () => {
  if (replay && localReplay && !trial && !recording) {
    stopReplay();
    showReplayFrame(0);
    renderState();
  }
});
const guides = {
  accuracy: {
    name: "Mesafeyi doğru ölçüyor mu?",
    description:
      "Cetvelle ölçtüğünüz uzaklığı, sensörün bulduğu uzaklıkla karşılaştırın.",
    steps: [
      "Düz bir karton veya kutuyu sensörün baktığı yöne yerleştirin.",
      "Sensörün ortasından nesneye kadar olan uzaklığı cetvelle ölçün ve aşağıya santimetre olarak yazın.",
      "Ölçüm boyunca sensörü ve nesneyi sabit tutun.",
    ],
    expected: "Sonuçta cetvel ve sensör ölçümü arasındaki farkı göreceksiniz.",
  },
  repeatability: {
    name: "Aynı nesneyi hep benzer ölçüyor mu?",
    description: "Nesne sabit dururken ölçümlerin ne kadar değiştiğine bakın.",
    steps: [
      "Düz bir nesneyi sensörün baktığı yöne koyun.",
      "Sensörü ve nesneyi sabitleyin; yerlerini değiştirmeyin.",
      "Testi başlatın ve bitene kadar bekleyin.",
    ],
    expected: "Sonuçta en düşük ve en yüksek uzaklığı göreceksiniz.",
  },
  surface: {
    name: "Farklı yüzeyleri görebiliyor mu?",
    description: "Aynı uzaklıkta farklı malzemelerle ayrı ayrı test yapın.",
    steps: [
      "Beyaz karton gibi bir yüzeyi seçtiğiniz yöne yerleştirin.",
      "Uzaklığı ölçüp aşağıya yazın. Notlara malzemenin adını ekleyebilirsiniz.",
      "Testi tekrarlarken yalnızca yüzeyi değiştirin; uzaklığı ve ışığı aynı tutun.",
    ],
    expected:
      "Her testin sonucunda ne kadar ölçüm alınabildiğini karşılaştırabilirsiniz.",
  },
  frequency: {
    name: "Kesintisiz ölçüm yapabiliyor mu?",
    description: "Ölçüm hızının test boyunca nasıl değiştiğine bakın.",
    steps: [
      "Sensörü sabit bir yere koyun.",
      "Çevresindeki nesneleri ve ışığı değiştirmeyin.",
      "Testi başlatın. Ölçüm hızı sonuçta gösterilecek.",
    ],
    expected: "Saniyede kaç tam tur ölçüm alındığını göreceksiniz.",
  },
  coverage: {
    name: "Ön ve arka alanları görebiliyor mu?",
    description: "Seçtiğiniz yönün ne kadarından ölçüm geldiğini görün.",
    steps: [
      "Canlı görüntüden ön, arka veya her yön seçimini yapın.",
      "Sensörün etrafını değiştirmeden testi başlatın.",
      "Başka bir yön seçip aynı testi tekrarlayarak sonuçları karşılaştırın.",
    ],
    expected: "Ölçüm alınamayan bir yönün boş olduğu söylenemez.",
  },
  obstacle: {
    name: "Yakındaki nesneyi görebiliyor mu?",
    description:
      "Seçtiğiniz yönde bir nesne varken ölçümün ne sıklıkla geldiğine bakın.",
    steps: [
      "Yakın bir nesneyi sensörün baktığı yöne yerleştirin.",
      "Gelişmiş görüntü ayarlarındaki mesafe aralığını nesnenin çevresinde daraltın; arkadaki duvar ölçülmesin.",
      "Nesneyi sabit tutup testi başlatın.",
    ],
    expected:
      "Bu test algılama gecikmesini ölçmez; seçilen yönde ölçüm sürekliliğini gösterir.",
  },
};
let guideKey = "";
function setTrialKind(kind, preserveBearing = false) {
  if (trial || !guides[kind]) return;
  trialKind = kind;
  const guide = guides[kind];
  guideKey = JSON.stringify([state?.source, state?.selection?.scene, kind]);
  for (const b of document.querySelectorAll("[data-trial]"))
    b.classList.toggle("active", b.dataset.trial === kind);
  $("guidedTrialSelect").value = kind;
  $("trialTitle").textContent = guide.name;
  $("trialProtocol").textContent = guide.description;
  let steps = guide.steps;
  const demo = state?.source === "demo";
  document.querySelector('label[for="guidedReference"]').textContent = demo
    ? "Karşılaştırılacak örnek uzaklık"
    : "Cetvelle ölçtüğünüz uzaklık";
  $("guidedReferenceField").querySelector(".helper").textContent = demo
    ? `1 metre = 100 cm = 1000 mm. Örnek hedef hazırsa ${distanceText(1000, distanceUnits.guidedReference)} kullanın.`
    : "Sensörün ortasından nesneye kadar ölçün. 100 cm = 1 metre.";
  if (demo && kind === "accuracy")
    $("trialProtocol").textContent =
      "Bilgisayarın ürettiği ölçümü, uzaklığı bilinen örnek bir hedefle karşılaştırın.";
  $("prepareDemoTarget").hidden = !demo || kind !== "accuracy";
  if (demo && kind === "accuracy") {
    const ready = state?.selection?.scene === "target";
    steps = ready
      ? [
          "Bilgisayarda 100 cm uzakta örnek bir nesne var. Gerçek nesne koymanız gerekmez.",
          `Aşağıdaki uzaklık alanını ${distanceText(1000, distanceUnits.guidedReference)} olarak bırakın.`,
          "Testi başlatın. Örnek ölçüm, 100 cm ile karşılaştırılacak.",
        ]
      : [
          "Aşağıdaki düğmeyle 100 cm uzakta bir örnek hedef hazırlayın.",
          `Uzaklık alanında ${distanceText(1000, distanceUnits.guidedReference)} kullanın. Cetvelle ölçmeniz gerekmez.`,
          "Testi başlatın. Bu sonuç gerçek sensörden gelmez.",
        ];
    $("prepareDemoTarget").textContent = ready
      ? "100 cm örnek hedef hazır · Yeniden hazırla"
      : "100 cm örnek hedefi hazırla";
  } else if (demo) {
    steps = [
      "Şu anda bilgisayarda oluşturulan örnek ölçümleri kullanıyorsunuz.",
      "Testi başlatıp sonuçta hangi bilgilerin gösterildiğini inceleyin.",
      "Gerçek nesne veya farklı yüzey deneyi için kendi sensörünüzle aynı testi yapmanız gerekir.",
    ];
  }
  $("trialSteps").innerHTML = steps
    .map((step) => `<li>${esc(step)}</li>`)
    .join("");
  $("trialExpected").textContent =
    demo && kind === "accuracy"
      ? "Sonuçta örnek hedefin uzaklığı ile hesaplanan ölçüm arasındaki farkı göreceksiniz."
      : guide.expected;
  const referenceNeeded = ["accuracy", "surface"].includes(kind);
  $("guidedReferenceField").hidden = !referenceNeeded;
  $("guidedReference").required = referenceNeeded;
  if (!preserveBearing) $("trialBearing").value = cfg.center;
  $("guidedReference").value = fromMillimetres(
    Number($("trialReference").value),
    distanceUnits.guidedReference,
  );
}
$("prepareDemoTarget").addEventListener("click", async () => {
  await changeSource("demo", { scene: "target" });
  $("trialReference").value = 1000;
  syncDistanceFields();
  setTrialKind(trialKind);
});
$("guidedTrialSelect").addEventListener("change", () =>
  setTrialKind($("guidedTrialSelect").value),
);
$("trialReference").addEventListener("input", () => syncDistanceFields());
for (const b of document.querySelectorAll("[data-trial]"))
  b.addEventListener("click", () => setTrialKind(b.dataset.trial));
for (const b of document.querySelectorAll("[data-go]"))
  b.addEventListener("click", () => navigate(b.dataset.go));
$("simpleReport").addEventListener("click", () => $("exportReport").click());
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
    tolerance: toleranceMm,
    distance_units: {
      reference: distanceUnits.guidedReference,
      tolerance: distanceUnits.trialTolerance,
    },
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
  toast("Test başladı. Sensörü ve nesneyi hareket ettirmeyin.");
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
    aborted ||
    `Test bitti. ${fmt(t.elapsed_s, 0)} saniyede ${t.samples.length} ölçüm alındı.`;
  $("trialProgressBar").value = aborted ? 0 : 100;
  renderTrialResult(t);
  renderTrialHistory();
  drawTrial();
  inputLock();
  toast(
    aborted
      ? "Test tamamlanamadı. Sonuç, eksik ölçüm olarak işaretlendi."
      : "Test bitti. Sonucu aşağıdan okuyabilir veya raporu indirebilirsiniz.",
    !!aborted,
  );
}
function describeTrial(t) {
  const r = t.result;
  let heading, body;
  if (t.aborted) {
    heading = "Test tamamlanamadı";
    body =
      "Neden: " +
      t.aborted +
      " Bağlantıyı ve seçtiğiniz yönü kontrol edip yeniden deneyin.";
  } else if (
    t.completion !== "complete" ||
    (!["frequency", "coverage"].includes(t.protocol) && r.n < 5)
  ) {
    heading = "Yeterli ölçüm alınamadı";
    body =
      "Nesneyi seçtiğiniz yöne yerleştirin. Görüntüde noktalar göründüğünde testi yeniden başlatın.";
  } else if (t.protocol === "accuracy") {
    heading = `Sensörün ölçtüğü uzaklık: ${distanceText(r.mean, t.distance_units?.reference || "cm")}`;
    body = `${t.source === "demo" ? "Karşılaştırma için girdiğiniz" : "Cetvelle ölçüp girdiğiniz"} uzaklık ${distanceText(t.reference, t.distance_units?.reference || "cm")}. Ortalama ölçüm ile arasındaki fark ${distanceText(Math.abs(r.bias), t.distance_units?.reference || "cm")}. Seçtiğiniz ±${distanceText(t.tolerance, t.distance_units?.tolerance || "cm")} hata payı içinde kalan ölçümlerin oranı %${fmt(r.withinTolerance, 1)}.`;
  } else if (t.protocol === "repeatability") {
    heading = "Ölçümler ne kadar değişti?";
    body = `Sabit nesne için en düşük uzaklık ${fmt(r.min / 10, 1)} cm, en yüksek uzaklık ${fmt(r.max / 10, 1)} cm oldu. Nesnenin veya sensörün oynaması sonucu etkiler.`;
  } else if (t.protocol === "frequency") {
    heading = `Saniyede ortalama ${fmt(r.hz.mean, 1)} tam tur`;
    body = `Sensör çevresini bir kez dolaştığında bir tam tur tamamlar. Testteki en düşük hız ${fmt(r.hz.min, 1)}, en yüksek hız ${fmt(r.hz.max, 1)} tur/saniye oldu.`;
  } else if (t.protocol === "coverage") {
    heading = `Seçilen alanın %${fmt(r.coverage, 1)} bölümünden ölçüm geldi`;
    body =
      "Bu oran, seçtiğiniz yönün 1 derecelik parçaları üzerinden hesaplanır. Ölçüm gelmeyen bir yerin boş olduğu söylenemez.";
  } else {
    heading = `Ölçüm alınan turlar: %${fmt(r.hitRate, 1)}`;
    body = `Toplam ${r.frames} tam tur ölçümün ${r.n} tanesinde, seçtiğiniz nesne yönünden veri geldi. Mesafe aralığı daraltılmadıysa arkadaki nesneler de bu ölçüme katılabilir.`;
  }
  const origin =
    t.source === "demo"
      ? "Sensörsüz örnek sonucu. Gerçek sensör denenmedi."
      : "Gerçek sensörden alınan ölçümlerle hesaplandı.";
  return { heading, body, origin };
}
function renderTrialResult(t) {
  const r = t.result;
  const { heading, body, origin } = describeTrial(t);
  $("trialResults").innerHTML =
    `<p class="result-source">${esc(origin)}</p><h3>${esc(heading)}</h3><p>${esc(body)}</p><p>Bu testte ${r.frames} tam çevre ölçümü kullanıldı. Sonuç, yalnızca denediğiniz koşulları gösterir.</p><details><summary>Hesapların ayrıntısını göster</summary><p class="result-stats">Ortalama: ${fmt(r.mean, 1)} mm · Standart sapma (ölçümlerin yayılımı): ${fmt(r.sd, 2)} mm · RMSE (karşılaştırma uzaklığına göre hata): ${fmt(r.rmse, 2)} mm · Seçilen yönden ölçüm alınan turlar: %${fmt(r.hitRate, 1)}</p></details>`;
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
  $("simpleReport").disabled = !results.length;
  $("simpleReport").textContent =
    results.length > 1
      ? "Tüm testlerin raporunu indir"
      : "Sonuç raporunu indir";
  $("trialHistory").innerHTML = results.length
    ? [...results]
        .reverse()
        .map(
          (t) =>
            `<tr><td><strong>${esc(t.name)}</strong><br><span class="muted">${esc(t.label || "Koşul belirtilmedi")}${t.completion !== "complete" ? " · EKSİK" : ""}</span></td><td>${esc(sourceName(t.source))}</td><td>${t.result.frames} / %${fmt(t.result.hitRate, 0)}</td><td>${fmt(t.result.mean)}</td><td>${fmt(t.result.sd, 2)}</td><td>${fmt(t.result.rmse, 2)}</td><td>${fmt(t.result.hz.mean, 2)}</td><td><button class="inline-download" data-result="${t.id}">Test verileri</button></td></tr>`,
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
    .map((t) => {
      const r = t.result,
        summary = describeTrial(t);
      return `<section><h2>${esc(guides[t.protocol].name)}</h2><p>${esc(sourceName(t.source))} · ${esc(t.created_at)} · ${t.completion === "complete" ? "Tamamlandı" : "Eksik ölçüm"}</p><h3>${esc(summary.heading)}</h3><p>${esc(summary.origin)}</p><p>${esc(summary.body)}</p><p>Denenen nesne / koşul: ${esc(t.label || "Belirtilmedi")}<br>Notlar: ${esc(t.notes || "Eklenmedi")}</p><details><summary>Hesaplar ve teknik ayrıntılar</summary><p>${esc(protocols[t.protocol].text)}</p><table><tr><th>Alınan / hedef görülen tur</th><th>Ortalama · mm</th><th>Standart sapma · mm</th><th>RMSE · mm</th><th>Ortalama tur/saniye</th></tr><tr><td>${r.frames} / ${r.n}</td><td>${fmt(r.mean)}</td><td>${fmt(r.sd, 2)}</td><td>${fmt(r.rmse, 2)}</td><td>${fmt(r.hz.mean, 2)}</td></tr></table><p>Karşılaştırma uzaklığı: ${t.reference} mm · Hata payı: ±${t.tolerance} mm · Hedef yönü: ${t.bearing}° · Ölçülen açı: ${t.beam}° · Süre: ${fmt(t.elapsed_s, 1)} saniye</p><p>Ayarlar: <code>${esc(JSON.stringify(t.config))}</code></p><p>Cihaz: <code>${esc(JSON.stringify(t.device_info))}</code></p><p>σ, her turda ölçülen hedef uzaklıklarının yayılımıdır. RMSE, karşılaştırma uzaklığına göre hesaplanan ortalama kare hatanın kareköküdür. Bu hesaplar cetvelle yaptığınız ölçümün belirsizliğini içermez. Kayıp hedef ölçümleri oranların paydasında tutulur; arayüze ulaşmayan turlar dahil değildir.</p></details></section>`;
    })
    .join("");
  download(
    `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RPLIDAR Lab · Test sonuçları</title><style>body{font:16px/1.8 system-ui;color:#193b51;max-width:1000px;margin:40px auto;padding:25px}h1{font-size:28px}h2{font-size:23px}h3{font-size:20px}section{border-top:1px solid #b8c9d0;padding:25px 0;break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:10px;border:1px solid #ccd6d9;text-align:left}p,code{overflow-wrap:anywhere}summary{cursor:pointer;font-weight:650}details{margin-top:20px}code{font-size:12px}@media print{body{margin:0;padding:0}}</style><h1>Sensör test sonuçları</h1><p>Bu rapor, bu oturumda yaptığınız ${results.length} testin sonucunu içerir. Sensörsüz örnek sonuçları gerçek sensör testi değildir. Her sonuç yalnızca denediğiniz koşulları gösterir.</p><p>Oluşturulma: ${esc(new Date().toLocaleString("tr-TR"))}</p>${rows}<p>Yöntem: <a href="https://github.com/Slamtec/rplidar_sdk">SLAMTEC ölçüm yazılımı</a>. Ayrıntılı ölçüm noktaları, uygulamada Test verileri düğmesinden ayrıca indirilebilir. Bu rapor oynatılabilir bir kayıt değildir.</p></html>`,
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
      `Ölçülüyor… ${Math.max(0, Math.ceil(trial.duration - elapsed))} saniye kaldı.`;
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
renderCapture();
setTrialKind("accuracy");
navigate(location.hash.slice(1) || "live");
connect();
