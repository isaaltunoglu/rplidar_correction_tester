/** Pure measurement functions. Distances: mm; angles: degrees, clockwise from front. */
export const wrap = (a) => ((a % 360) + 360) % 360;
export const delta = (a, b) => wrap(a - b + 180) - 180;
export const inSector = (a, center, width) =>
  width >= 360 || Math.abs(delta(a, center)) <= width / 2 + 1e-8;
export const displayAngle = (a, cfg) =>
  wrap((cfg.invert ? -a : a) + cfg.offset);
export const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((a, b) => a - b),
    n = a.length;
  return n % 2 ? a[n >> 1] : (a[n / 2 - 1] + a[n / 2]) / 2;
};
export const mean = (xs) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function summarize(xs, reference = null) {
  const n = xs.length;
  if (!n)
    return {
      n: 0,
      mean: null,
      sd: null,
      min: null,
      max: null,
      bias: null,
      rmse: null,
      p95: null,
    };
  const avg = mean(xs);
  const errors = reference === null ? [] : xs.map((x) => x - reference);
  const sorted = errors.map(Math.abs).sort((a, b) => a - b);
  return {
    n,
    mean: avg,
    sd:
      n > 1
        ? Math.sqrt(xs.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1))
        : null,
    min: Math.min(...xs),
    max: Math.max(...xs),
    bias: errors.length ? mean(errors) : null,
    rmse: errors.length ? Math.sqrt(mean(errors.map((e) => e * e))) : null,
    p95: sorted.length ? sorted[Math.ceil(0.95 * n) - 1] : null,
  };
}
export const DEFAULT_CONFIG = Object.freeze({
  center: 0,
  width: 120,
  offset: 0,
  invert: false,
  min: 150,
  max: 8000,
  quality: 0,
  viewRange: 5000,
  danger: 500,
  warning: 1000,
  style: "points",
  color: "distance",
  context: true,
});
export function filterPoints(points, cfg, sector = true) {
  return points
    .map(([raw, d, q]) => [displayAngle(raw, cfg), d, q, raw])
    .filter(
      ([a, d, q]) =>
        d >= cfg.min &&
        d <= cfg.max &&
        q >= cfg.quality &&
        (!sector || inSector(a, cfg.center, cfg.width)),
    );
}
export function analyze(scan, cfg) {
  const all = filterPoints(scan.points, cfg, false);
  const points = all.filter(([a]) => inSector(a, cfg.center, cfg.width));
  const bins = new Set(
    points.map(([a]) => Math.floor(wrap(a - cfg.center + cfg.width / 2))),
  );
  const nearest = points.length
    ? points.reduce((a, b) => (a[1] < b[1] ? a : b))
    : null;
  const sectors = [0, 90, 180, 270].map((center) => {
    const p = all.filter(([a]) => inSector(a, center, 90));
    return p.length ? Math.min(...p.map((x) => x[1])) : null;
  });
  return {
    all,
    points,
    nearest,
    sectors,
    coverage: Math.min(100, (100 * bins.size) / Math.ceil(cfg.width)),
    validRatio: scan.raw_count
      ? (100 * scan.points.length) / scan.raw_count
      : 0,
    alarm: !nearest
      ? "unknown"
      : nearest[1] <= cfg.danger
        ? "danger"
        : nearest[1] <= cfg.warning
          ? "warning"
          : "clear",
  };
}
export function trialSample(scan, cfg, bearing, beam) {
  const pts = filterPoints(scan.points, cfg).filter(([a]) =>
    inSector(a, bearing, beam),
  );
  return {
    timestamp: scan.timestamp,
    seq: scan.seq,
    hz: scan.hz,
    range: median(pts.map((p) => p[1])),
    quality: median(pts.map((p) => p[2])),
    count: pts.length,
    coverage: analyze(scan, cfg).coverage,
  };
}
export function trialResult(samples, reference, tolerance) {
  const ranges = samples.map((s) => s.range).filter((x) => x !== null);
  const stats = summarize(ranges, reference);
  return {
    ...stats,
    frames: samples.length,
    hitRate: samples.length ? (100 * ranges.length) / samples.length : 0,
    withinTolerance: samples.length
      ? (100 *
          ranges.filter((x) => Math.abs(x - reference) <= tolerance).length) /
        samples.length
      : 0,
    hz: summarize(samples.map((s) => s.hz)),
    coverage: mean(samples.map((s) => s.coverage)),
    quality: median(samples.map((s) => s.quality).filter((x) => x !== null)),
  };
}
export function validateConfig(c) {
  const rules = {
    center: [0, 360],
    width: [1, 360],
    offset: [-360, 360],
    min: [0, 100000],
    max: [1, 100000],
    quality: [0, 63],
    viewRange: [500, 50000],
    danger: [1, 50000],
    warning: [2, 100000],
  };
  if (!c || typeof c !== "object") throw Error("Filtre ayarları bulunamadı.");
  const out = { ...DEFAULT_CONFIG };
  for (const [k, [lo, hi]] of Object.entries(rules)) {
    if (!Number.isFinite(c[k]) || c[k] < lo || c[k] > hi)
      throw Error(`Geçersiz filtre: ${k}`);
    out[k] = c[k];
  }
  if (out.min >= out.max || out.danger >= out.warning)
    throw Error("Mesafe veya uyarı aralıkları geçersiz.");
  out.invert = !!c.invert;
  out.context = !!c.context;
  out.style = ["points", "rays", "contour"].includes(c.style)
    ? c.style
    : "points";
  out.color = ["distance", "quality", "single"].includes(c.color)
    ? c.color
    : "distance";
  return out;
}
export function validateRecording(data) {
  if (
    !data ||
    data.schema !== "rplidar-lab/1" ||
    data.kind !== "recording" ||
    !["hardware", "demo", "legacy"].includes(data.source)
  )
    throw Error("RPLIDAR Lab kayıt biçimi bekleniyor (rplidar-lab/1).");
  const config = validateConfig(data.config);
  if (
    !Array.isArray(data.frames) ||
    !data.frames.length ||
    data.frames.length > 1200
  )
    throw Error("Kayıt 1–1200 tarama içermeli.");
  let total = 0,
    previous = -Infinity;
  const frames = data.frames.map((f) => {
    if (
      !f ||
      !Array.isArray(f.points) ||
      f.points.length > 8192 ||
      !Number.isFinite(f.timestamp) ||
      f.timestamp < previous ||
      !Number.isFinite(f.hz) ||
      f.hz < 0 ||
      f.hz > 1000 ||
      !Number.isInteger(f.raw_count) ||
      f.raw_count < f.points.length ||
      f.raw_count > 16384
    )
      throw Error("Geçersiz tarama verisi.");
    previous = f.timestamp;
    total += f.points.length;
    if (total > 500000) throw Error("Kayıt en fazla 500.000 nokta içerebilir.");
    const points = f.points.map((p) => {
      if (
        !Array.isArray(p) ||
        p.length !== 3 ||
        !p.every(Number.isFinite) ||
        p[0] < 0 ||
        p[0] >= 360 ||
        p[1] <= 0 ||
        p[1] > 1000000 ||
        p[2] < 0 ||
        p[2] > 63
      )
        throw Error("Geçersiz nokta; açı, mesafe veya kalite sınır dışında.");
      return [...p];
    });
    return {
      type: "scan",
      seq: Number.isInteger(f.seq) ? f.seq : 0,
      timestamp: f.timestamp,
      hz: f.hz,
      raw_count: f.raw_count,
      mode: typeof f.mode === "string" ? f.mode.slice(0, 64) : "Replay",
      points,
    };
  });
  return {
    schema: data.schema,
    kind: "recording",
    source: data.source,
    created_at: typeof data.created_at === "string" ? data.created_at : null,
    config,
    device_info:
      data.device_info && typeof data.device_info === "object"
        ? data.device_info
        : null,
    frames,
  };
}
export const escapeHTML = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
