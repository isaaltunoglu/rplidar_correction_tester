/** DOM integration checks, not a substitute for a rendered browser.
 * npm install --no-save linkedom; node tests/dom-smoke.mjs
 * Or supply LINKEDOM_PATH to an existing installation.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseHTML } = require(process.env.LINKEDOM_PATH || "linkedom");
const { window } = parseHTML(
  await readFile(new URL("../index.html", import.meta.url), "utf8"),
);
const { document } = window;
let location = { hash: "#live" };
window.history = {
  replaceState: (_a, _b, url) => {
    location.hash = url;
  },
};
Object.assign(globalThis, { window, document, location });
Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
  configurable: true,
  get() {
    return (
      this._value ??
      this.querySelector("option[selected]")?.getAttribute("value") ??
      this.querySelector("option")?.getAttribute("value") ??
      ""
    );
  },
  set(value) {
    this._value = String(value);
  },
});
const noOp = () => {};
const ctx = new Proxy(
  { setTransform: noOp, measureText: () => ({ width: 20 }) },
  { get: (o, k) => o[k] ?? noOp, set: (o, k, v) => ((o[k] = v), true) },
);
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    width: 650,
    height:
      this.id === "frequencyChart" ? 44 : this.id === "trialChart" ? 160 : 460,
    left: 0,
    top: 0,
  };
};
window.HTMLCanvasElement.prototype.getContext = () => ctx;
window.HTMLCanvasElement.prototype.toDataURL = () => "";
globalThis.ResizeObserver = class {
  observe() {}
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
const interval = globalThis.setInterval;
globalThis.setInterval = (fn, ms) => {
  const t = interval(fn, ms);
  t.unref();
  return t;
};
let stream;
globalThis.EventSource = class {
  constructor() {
    stream = this;
  }
};
let state = {
  type: "state",
  version: "1",
  source: "demo",
  generation: 0,
  revision: 1,
  device_info: {
    model: "Sanal oda",
    scan_modes: [],
    motor: { adjustable: false },
    health_status: null,
  },
  status: { scanning: true, connection: "connected", mode: "Synthetic" },
  ports: [],
  events: [],
  last_command: null,
};
function emit(scan = null) {
  stream.onopen?.();
  stream.onmessage({
    data: JSON.stringify({
      ...state,
      revision: ++state.revision,
      ...(scan ? { scan } : {}),
    }),
  });
}
function frame(seq) {
  return {
    type: "scan",
    seq,
    frame_id: seq,
    timestamp: Date.now() / 1000,
    source: state.source,
    generation: state.generation,
    hz: 10,
    mode: "Synthetic",
    raw_count: 4,
    points: [
      [0, 1000, 30],
      [1, 1001, 30],
      [180, 400, 30],
      [90, 3000, 30],
    ],
  };
}
globalThis.fetch = async (path, options) => {
  const body = JSON.parse(options.body);
  if (path === "/api/source") {
    state = {
      ...state,
      source: body.source,
      generation: state.generation + 1,
      status: {
        scanning: body.source === "demo",
        connection: body.source === "idle" ? "searching" : "connected",
        mode: "Synthetic",
      },
    };
    setTimeout(() => emit(), 20);
  }
  if (path === "/api/control") {
    state.status.scanning = body.action !== "pause";
    setTimeout(() => emit(), 20);
  }
  return {
    ok: true,
    json: async () => ({ accepted: true, generation: state.generation }),
  };
};
const blobs = [];
URL.createObjectURL = (blob) => {
  blobs.push(blob);
  return "blob:test";
};
URL.revokeObjectURL = noOp;
const $ = (id) => document.getElementById(id);
const click = (id) =>
  $(id).dispatchEvent(new window.Event("click", { bubbles: true }));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await import("../web/app.js");
emit(frame(1));
assert.equal($("plotEmpty").hidden, true);
assert.ok($("metricPoints").textContent.includes("2"));
assert.ok($("noticeText").textContent.includes("SİMÜLASYON"));
document.querySelector('.preset[data-center="180"]').click();
assert.ok($("metricNear").textContent.includes("0,40"));
assert.equal($("proximity").dataset.state, "danger");
document.querySelector('.preset[data-center="0"][data-width="120"]').click();
click("recordButton");
assert.equal($("sectorWidth").disabled, true);
emit(frame(2));
emit(frame(3));
click("recordButton");
click("downloadRecording");
const recorded = JSON.parse(await blobs.at(-1).text());
assert.equal(recorded.source, "demo");
assert.equal(recorded.frames.length, 2);
click("exportCSV");
assert.ok((await blobs.at(-1).text()).includes("raw_angle_deg"));
click("exportJSON");
assert.equal(JSON.parse(await blobs.at(-1).text()).source, "demo");
document.querySelector('[data-page="experiments"]').click();
$("trialDuration").value = "3";
$("trialForm").dispatchEvent(new window.Event("submit", { cancelable: true }));
assert.equal($("sourceSelect").disabled, true);
for (let seq = 4; seq <= 34; seq++) {
  emit(frame(seq));
  await wait(100);
}
await wait(250);
assert.ok($("trialHistory").textContent.includes("Mesafe doğruluğu"));
assert.equal($("trialState").textContent, "Tamamlandı");
assert.ok($("trialResults").textContent.includes("SİMÜLASYON"));
click("exportReport");
assert.ok(
  (await blobs.at(-1).text()).includes("SİMÜLASYON") ||
    (await blobs.at(-1).text()).includes("Simülasyon"),
);
const file = $("recordingFile");
Object.defineProperty(file, "files", {
  configurable: true,
  value: [
    {
      name: "demo.json",
      size: 5000,
      text: async () => JSON.stringify(recorded),
    },
  ],
});
file.dispatchEvent(new window.Event("change"));
await wait(80);
assert.ok($("noticeText").textContent.includes("TEKRAR OYNATMA"));
assert.equal($("trialStart").disabled, true);
assert.equal($("replayEmpty").hidden, true);
// A queued packet from before the source-change acknowledgement must not exit replay.
stream.onmessage({
  data: JSON.stringify({
    ...state,
    generation: state.generation - 1,
    source: "demo",
  }),
});
assert.ok($("noticeText").textContent.includes("TEKRAR OYNATMA"));
$("sourceSelect").value = "demo";
$("sourceSelect").dispatchEvent(new window.Event("change"));
await wait(50);
emit(frame(35));
assert.ok($("noticeText").textContent.includes("SİMÜLASYON"));
state = {
  ...state,
  source: "hardware",
  generation: state.generation + 1,
  device_info: null,
  status: { scanning: false, connection: "searching" },
};
emit();
assert.equal($("plotEmpty").hidden, false);
assert.equal($("proximity").dataset.state, "unknown");
assert.equal($("recordButton").disabled, true);
console.log(
  "DOM integration: sector, proximity, recording/export, timed experiment/report, replay, source transition and disconnect passed. Rendering not tested.",
);
process.exit(0);
