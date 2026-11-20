# UI review evidence

The redesign is documented from `index.html`, `web/styles.css`, `web/app.js`, and `web/core.js`. It retains the local Python server and C++ SLAMTEC SDK bridge. The visual direction is the field research station recorded in `DESIGN.md`; `.impeccable/design.json` supplies matching schema-version-2 extensions and ten component previews. The formal contract in `docs/UI_DIRECTION.md` retrospectively consolidates the delegated direction. Seed `5b3a139c` is corroborated by `.impeccable/questions/roll.json`; the original catalog roll was degraded, with no online quality-bar board or approved comp.

## Available evidence

- Source review covers desktop and responsive layouts, local Manrope, explicit data states, keyboard focus, reduced-motion rules, shared SVG iconography, and the angular ribbon/sector relationship.
- Implementation verification reported 11 passing Python tests, 9 passing JavaScript tests, and passing DOM workflow tests.
- Actual Chrome workflow checks are recorded in `artifacts/browser/checks.json`: no page errors, no mobile horizontal overflow, sector selection, keyboard point inspection, CSV export, recording, an accuracy trial, report export, replay, source switching, pause/resume and stale-data clearing. The source is explicitly simulation.
- The synthetic 1000mm target trial produced a mean of approximately 999.4mm. This checks the simulated workflow; it is not physical accuracy evidence.
- Hardware remains unavailable. `physical_sensor_verified` is false. No new physical sensor measurements or device validation are claimed.

## Rendered review disposition

**Disposition: ship. Visual ship approval: granted for the reviewed rendered software surface. Physical sensor validation: not granted.**

The earlier sandbox restriction was resolved. Actual Chrome captured twelve full-page screenshots at desktop (1512 × 1100) and mobile (390 × 844), replacing the previous missing-image evidence gap. The capture manifest is `artifacts/browser/screenshots.sha256.json`.

Desktop captures: `desktop-live.png`, `desktop-experiment.png`, `desktop-recordings.png`, `desktop-replay.png`, `desktop-device.png`, and `desktop-disconnected.png`. Mobile captures: `mobile-live.png`, `mobile-experiments.png`, `mobile-recordings.png`, `mobile-device.png`, `mobile-paused.png`, and `mobile-stale.png`. All are under `artifacts/browser/`.

The finish reviewer confirmed that the initial twelve captures were valid and that the Field Research Station typography, material, ground, responsive treatment and source states were consistent. The one material finding was five Unicode external-link arrows. These were replaced by the shared `i-external` SVG symbol. The reviewer then reread refreshed primary desktop/mobile captures and regenerated desktop-device, mobile-device and desktop-disconnected captures, confirmed authored SVG icons without regression, and returned the final disposition **ship**. This verdict covers the scored fix following full review of the twelve original valid captures; it is approval of the rendered software surface only.

Source updates supporting this review include a wrapping plot toolbar with minimum height (49px), desktop padding (10px 17px), mobile padding (10px 11px), bottom label room in the canvas, state-specific empty copy, accurate paused-replay source text, and a source-transition guard against old SSE data arriving before the HTTP acknowledgment. Browser evidence supports the tested software states and captured viewports; it does not establish physical sensor behavior, every possible viewport, or a general touch usability study.

## Stop-hook triage

The existing scoped exceptions in `.impeccable/config.json` remain limited to `index.html`:

- `cramped-padding`: the initial wrapper findings missed logical or nested insets. Final source gives the plot toolbar (10px) vertical padding; telemetry cells have (23px) right padding, table cells (12px 15px) padding inside the scroll wrapper, and the device panel (30px) right padding with its divider removed when the responsive padding is removed. The exception's historical reason still mentions the earlier (8px) toolbar inset; current source and this record supersede that measurement. Because this exception covers the rule within the file, future rendered review must continue to inspect new controls for spacing.
- `cream-palette`: Field Paper is the deliberate ground of the delegated design, paired with ink blue navigation, a dark plot and terracotta annotations. This records an agent decision within authorized scope, not a separate user-confirmed color choice.

No global rule or whole-file suppression was added. Low-contrast and tiny functional CSS text findings were fixed in source rather than suppressed. The exceptions do not by themselves grant visual approval.

## Not canonized

The prior missing-capture condition is superseded by actual Chrome evidence. The Unicode external arrows were repaired rather than recorded as icon style. No rendered defect is promoted into a reusable rule. Context-specific semantic shades remain documented without treating every one-off fill as a primitive. Unused light-accent and green CSS primitives are identified as such rather than asserted as universal component fills.
