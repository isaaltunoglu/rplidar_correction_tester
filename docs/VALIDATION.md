# Validation record

Date: 2026-11-21. No physical LiDAR was available for this change. The user's report that the previous program connected successfully is prior user evidence, not a new test of this revision.

| Check                                           | Status                 | Evidence and scope                                                                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native adapter compile                          | PASS                   | `make`; C++17, `-Wall -Wextra`; adapter linked against the existing pinned SDK                                                                                                                                                            |
| Clean source-only compile                       | PASS                   | Source archive extracted under `/tmp/rplidar-clean-build`; SDK and adapter built from source without existing `.o`/`.a` files                                                                                                             |
| Python service/manager checks                   | PASS                   | 11 tests: generation isolation, disconnect clearing, simulation, pause/resume, idle, input validation, USB deduplication, HTTP parsing, static allowlist, origin/host guards and source transitions                                       |
| JavaScript analysis/import checks               | PASS                   | 9 tests: front/rear wrapping, offset/reversal, missing-data semantics, sector thresholds, sample SD/RMSE, per-scan target medians, missed-target denominator, bounded replay validation, escaping                                         |
| DOM application integration                     | PASS                   | LinkeDOM exercised sector changes, proximity, recording/CSV/JSON, timed trial/report, replay, stale source-generation rejection and disconnect. Canvas and layout were stubbed; **no pixel/visual verification**                          |
| Python static lint                              | PASS                   | Ruff selected correctness/import rules, configured in `pyproject.toml`                                                                                                                                                                    |
| JavaScript syntax                               | PASS                   | `node --check` for app and core                                                                                                                                                                                                           |
| Missing-device adapter behavior                 | PASS                   | Native adapter invoked against an explicitly nonexistent temporary port; emitted structured handshake error and exited without claiming a connection                                                                                      |
| UI mechanical review                            | PARTIAL                | Two bounded detector passes; small text/contrast findings corrected, including mobile breadcrumb. Follow-up stop-hook triage recorded index.html-scoped exceptions for four source-confirmed wrapper-padding false positives and the documented intentional warm palette; mechanical checks do not establish rendered appearance |
| Local HTTP socket smoke                         | NOT RUN                | Environment denies socket creation with `Operation not permitted`. Real HTTP handlers were instead exercised with in-memory request/response streams                                                                                      |
| Real desktop/mobile browser flows/screenshots   | NOT RUN                | Chrome launch fails with `setsockopt: Operation not permitted`; `tests/browser_smoke.py` is supplied for normal local/CI execution                                                                                                        |
| Independent visual finish review                | RECAPTURE              | Reviewer requires valid desktop/mobile captures. No visual approval was inferred from unit/DOM tests                                                                                                                                      |
| GitHub Actions                                  | PREPARED, NOT EXECUTED | Workflow builds, runs checks and captures browser artifacts after publication                                                                                                                                                             |
| Physical USB discovery/reconnect                | NOT VERIFIED           | Logic implemented and discovery deduplication tested; no physical hotplug test performed                                                                                                                                                  |
| Actual sensor modes, health, motor and accuracy | NOT VERIFIED           | Must be observed on the connected model/revision; no bench or performance claim made                                                                                                                                                      |

## Run the outstanding software review without a sensor

```bash
python3 -m pip install playwright==1.61.0
python3 -m playwright install chromium
python3 tests/browser_smoke.py
```

On Linux CI, Playwright can install OS dependencies using `python3 -m playwright install --with-deps chromium`. The workflow already includes this command. Screenshots and exported sample files appear in `artifacts/browser/`. Inspect each desktop/mobile capture and keyboard behavior before calling visual review complete. These remain simulation evidence.

## Evidence boundaries

Host receipt timestamps are not synchronized optical measurement timestamps. SSE delivers the latest frame and can omit revolutions; target hit rate is conditional on received scans. Default filters, the view-radius slider and the mode's nominal range are not verified sensor limits. Simulation can validate software behavior while proving nothing about actual sensor accuracy, laser safety, power, thermal performance or suitability for a robot's protective function.
