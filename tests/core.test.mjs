import test from "node:test";
import assert from "node:assert/strict";
import {
  wrap,
  delta,
  inSector,
  analyze,
  trialSample,
  trialResult,
  summarize,
  validateRecording,
  validateConfig,
  DEFAULT_CONFIG,
  escapeHTML,
} from "../web/core.js";
const cfg = { ...DEFAULT_CONFIG };
test("front and rear 120 degree sectors wrap across 0 correctly", () => {
  for (const a of [0, 30, 60, 300, 359]) assert.ok(inSector(a, 0, 120));
  for (const a of [61, 120, 180, 299]) assert.ok(!inSector(a, 0, 120));
  for (const a of [120, 180, 240]) assert.ok(inSector(a, 180, 120));
  assert.ok(!inSector(0, 180, 120));
  assert.ok(inSector(350, 0, 360));
  assert.equal(wrap(-90), 270);
  assert.equal(delta(359, 1), -2);
});
test("orientation changes analysis and raw angle is preserved", () => {
  const s = {
    raw_count: 3,
    points: [
      [0, 1000, 30],
      [90, 2000, 20],
      [180, 500, 40],
    ],
  };
  let a = analyze(s, { ...cfg, width: 20, offset: 180 });
  assert.equal(a.points.length, 1);
  assert.equal(a.points[0][3], 180);
  assert.equal(a.nearest[1], 500);
  a = analyze(s, { ...cfg, center: 270, width: 20, invert: true });
  assert.equal(a.points[0][3], 90);
});
test("invalid or filtered points never produce a clear-space claim", () => {
  const a = analyze(
    {
      points: [
        [0, 100, 0],
        [0, 1000, 5],
      ],
      raw_count: 4,
    },
    { ...cfg, quality: 10 },
  );
  assert.equal(a.alarm, "unknown");
  assert.equal(a.nearest, null);
  assert.equal(a.coverage, 0);
  assert.deepEqual(a.sectors, [null, null, null, null]);
});
test("sector thresholds apply only to selected sector", () => {
  const a = analyze(
    {
      points: [
        [0, 1400, 30],
        [180, 200, 30],
      ],
      raw_count: 2,
    },
    cfg,
  );
  assert.equal(a.alarm, "clear");
  assert.equal(a.nearest[1], 1400);
  assert.equal(a.sectors[2], 200);
});
test("measurement statistics use sample SD and reference error", () => {
  const s = summarize([990, 1000, 1010], 1000);
  assert.equal(s.mean, 1000);
  assert.equal(s.sd, 10);
  assert.equal(s.bias, 0);
  assert.ok(Math.abs(s.rmse - Math.sqrt(200 / 3)) < 1e-9);
  assert.equal(s.p95, 10);
  assert.equal(summarize([1]).sd, null);
  assert.equal(summarize([]).mean, null);
});
test("target sampling uses scan median and counts missed target scans", () => {
  const frame = {
    timestamp: 1,
    seq: 1,
    hz: 10,
    points: [
      [359, 990, 30],
      [0, 1010, 30],
      [1, 1000, 30],
      [30, 3000, 30],
    ],
    raw_count: 4,
  };
  const sample = trialSample(frame, cfg, 0, 4);
  assert.equal(sample.range, 1000);
  const missed = { ...sample, range: null, count: 0 };
  const result = trialResult([sample, missed], 1000, 20);
  assert.equal(result.hitRate, 50);
  assert.equal(result.withinTolerance, 50);
  assert.equal(result.n, 1);
});
function recording() {
  return {
    schema: "rplidar-lab/1",
    kind: "recording",
    source: "demo",
    config: cfg,
    frames: [
      { timestamp: 1, seq: 1, hz: 10, raw_count: 1, points: [[0, 1000, 30]] },
    ],
  };
}
test("recording validation preserves source and only accepts bounded finite points", () => {
  const r = validateRecording(recording());
  assert.equal(r.source, "demo");
  for (const bad of [NaN, Infinity, -1, 360]) {
    const f = recording();
    f.frames[0].points[0][0] = bad;
    assert.throws(() => validateRecording(f));
  }
  const f = recording();
  f.frames[0].points[0][2] = 64;
  assert.throws(() => validateRecording(f));
});
test("replay rejects reversed timestamps, missing config, excessive frames and foreign schema", () => {
  const f = recording();
  f.frames.push({ ...f.frames[0], timestamp: 0 });
  assert.throws(() => validateRecording(f));
  assert.throws(() => validateRecording({ ...recording(), config: {} }));
  assert.throws(() =>
    validateRecording({
      ...recording(),
      frames: Array(1201).fill(recording().frames[0]),
    }),
  );
  assert.throws(() => validateRecording({ ...recording(), schema: "other" }));
});
test("configuration validation rejects invalid ranges and metadata escapes HTML", () => {
  assert.throws(() => validateConfig({ ...cfg, min: 10000, max: 1000 }));
  assert.throws(() => validateConfig({ ...cfg, danger: 2000, warning: 1000 }));
  assert.throws(() => validateConfig({ ...cfg, width: 0 }));
  assert.equal(escapeHTML('<script>"&'), "&lt;script&gt;&quot;&amp;");
});

test("length conversion keeps millimetres, centimetres and metres equivalent", async () => {
  const { toMillimetres, fromMillimetres } = await import("../web/core.js");
  assert.equal(toMillimetres(1, "m"), 1000);
  assert.equal(toMillimetres(100, "cm"), 1000);
  assert.equal(toMillimetres(1000, "mm"), 1000);
  assert.equal(toMillimetres("1.25", "m"), 1250);
  assert.equal(fromMillimetres(1250, "cm"), 125);
  assert.equal(fromMillimetres(1250, "m"), 1.25);
  assert.equal(toMillimetres(fromMillimetres(0.25, "m"), "m"), 0.25);
  for (const [value, unit] of [
    ["", "cm"],
    [Infinity, "m"],
    [true, "mm"],
    [1, "ft"],
  ])
    assert.throws(() => toMillimetres(value, unit));
});
test("converted alert distances honor inclusive red and yellow boundaries", async () => {
  const { toMillimetres } = await import("../web/core.js");
  const c = {
    ...cfg,
    danger: toMillimetres(50, "cm"),
    warning: toMillimetres(1, "m"),
  };
  const alarm = (d) => analyze({ points: [[0, d, 30]], raw_count: 1 }, c).alarm;
  assert.equal(alarm(500), "danger");
  assert.equal(alarm(501), "warning");
  assert.equal(alarm(1000), "warning");
  assert.equal(alarm(1001), "clear");
});
