# UI review evidence

## Current revision

This record covers the selectable-distance-unit extension to the beginner interface: discoverable measurement range controls, clearly explained yellow/red warning marks, and mm/cm/metre entry. It supersedes the earlier dense dashboard layout and its rendered approval. The local Python server and C++ SLAMTEC SDK bridge remain the architecture. `PRODUCT.md`, `docs/UI_DIRECTION.md`, `docs/QUICKSTART_TR.md`, `index.html`, `web/styles.css`, `web/app.js` and `web/core.js` describe the current product and implementation.

The Field Research Station palette remains. The original seven-direction roll used seed `5b3a139c`, corroborated by `.impeccable/questions/roll.json`; its online catalog and quality-bar cards were unavailable. No approved comp or comp-fidelity score exists. The formal contract is retrospective. `DESIGN.md` and `.impeccable/design.json` retain the larger type, horizontal navigation and progressive disclosure, and now record paired distance fields and explained threshold legends.

## Changed experience

- Seven distance fields pair the number with mm/cm/metre: minimum/maximum inspection range, red/yellow warning distances, plot-view distance, reference and tolerance. Unit changes preserve the physical quantity; internal values and exported numeric settings remain millimetres, while test snapshots retain entry units for readable results.
- A discoverable distance-range disclosure shows current limits and separates physical sensor range, software inspection range and plot zoom. The warning disclosure explains threshold order, red priority and selected-sector/range scope. Dashed yellow/red legends repeat the chosen-unit distances and label off-view marks.

- Source, direction and readable result are the initial live workflow. Desktop direction/result controls sit left of the plot; mobile puts the plot between direction choices and result. Technical telemetry, filters, statistics, raw tables and exports start closed; distance and warning controls have their own plain-language disclosures.
- Six question-based guided tests explain preparation before measuring, offer mm/cm/metre entry, and present readable conclusions and an HTML report before statistics. Simulation has its own instructions and a 100cm example-target action.
- Recording explains measurement data versus video and distinguishes file purposes. Source, duration and count precede playback. A completed in-memory recording can be watched directly in an inline player, with play/stop/rewind, time scrubber, named speeds and elapsed/total time. Wrong JSON kinds receive a plain explanation.
- Body text is 15px, ordinary controls 14–15px, fields at least 44px high, and main actions at least 42px high. Selected preset subtitles and plot-download hover contrast were corrected; plot state labels/readouts are at least 12px.

## Browser evidence

`artifacts/browser/checks.json` records successful actual Chrome workflows at desktop (1512 × 1100) and mobile (390 × 844), with no page errors or mobile horizontal overflow. It covers preservation of physical distance across mm/cm/metre changes, measurement range and automatic plot scale, selected-unit alert rules and legends, canonical-millimetre reference/tolerance exports, progressive disclosure, front/rear selection, point inspection in centimetres, all six guided protocols, cm-to-mm conversion, a guided test and readable report, recording export, watch without downloading, inline replay and rewind, wrong JSON recovery, recording import, pause/resume and stale clearing.

Seventeen full-page screenshots were regenerated in the final Chrome run for the current revision. The thirteen retained workflow views are supplemented by `desktop-distance-settings.png`, `mobile-distance-settings.png`, `desktop-alert-red.png`, and `desktop-alert-yellow.png`. Desktop: `desktop-live.png`, `desktop-experiment.png`, `desktop-recordings.png`, `desktop-replay-player.png`, `desktop-replay.png`, `desktop-device.png`, and `desktop-disconnected.png`. Mobile: `mobile-live.png`, `mobile-experiments.png`, `mobile-recordings.png`, `mobile-device.png`, `mobile-paused.png`, and `mobile-stale.png`. All are under `artifacts/browser/`; the screenshot manifest is `screenshots.sha256.json` and related evidence manifest is `evidence.sha256.json`.

All 22 Python/JavaScript tests and the DOM integration checks passed. The final actual Chrome rerun passed and regenerated all seventeen PNGs and the screenshot/evidence manifests. The simulated 1000mm target trial mean in checks.json is 1000.2703225806451mm (approximately 1000.3mm). This is simulated workflow and unit-conversion evidence rather than physical measurement accuracy. Hardware is unavailable and `physical_sensor_verified` remains false.

## Revision-specific rendered disposition

**Disposition: ship for the distance-unit extension. Visual ship approval: granted for the reviewed software presentation. Physical sensor validation and novice user-study approval: not granted.**

The fresh distance-unit finish reviewer returned **ship**, with no material fixes. All required captures were valid and evidence hashes matched current source and images. The reviewer found paired fields, range discoverability, inclusive threshold explanations, red priority, scope notes and mobile adaptation consistent with the existing direction. DESIGN.md and its sidecar matched the extension. No numeric score is invented; no approved comp or catalog quality-bar card exists, so the catalog ceiling could not be independently compared. This is a revision-specific software-presentation review.

This review concerns the rendered software at captured viewports. It is not a novice user study, a general touch/device study, or validation of the physical sensor, USB reconnection or device performance. The earlier dense-layout ship decision is historical and does not transfer to this revision.

## Stop-hook triage and stale catalog

The existing `cramped-padding` and `cream-palette` exceptions in `.impeccable/config.json` remain scoped to `index.html`; there is no global rule or whole-file suppression. The padding exception originally addressed nested/logical inset findings. Its historical toolbar measurement predates this revision: current toolbar padding is 12px 16px on desktop and 12px on mobile. Current readable type and expanded controls are documented from source rather than inferred from that exception. Future additions still need rendered spacing review.

Field Paper is a deliberate palette decision within the delegated design, not a separate user-confirmed color approval. Mechanical contrast problems were corrected in source rather than granted a new exception. The old font/color catalog was based on the earlier documentation and is stale for this revision; current tokens are in `DESIGN.md` and its matching sidecar. Catalog staleness is not a new suppression or a fresh detector pass.

## Not canonized

The former dense first-view telemetry and fixed rail are superseded, not retained as house rules. Confusing JSON terminology and a download-dependent playback path are not reusable patterns. The prior glyph-arrow, preset-subtitle, hover-contrast and empty-recording control-state findings were repaired rather than canonized. No unobserved defect, physical validation claim or beginner user-study claim is introduced by this documentation.
