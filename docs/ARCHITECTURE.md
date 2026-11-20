# Architecture and data contracts

Browser → same-origin local HTTP control → `LidarManager` → C++ process stdin → SLAMTEC SDK. Scan JSON lines return through stdout → manager → SSE → browser analysis and visualization. The browser does not open USB directly. No Web Serial pairing dialog is needed.

`server.py` uses the Python standard library. Importing it does not start a process or a device scan. `LidarManager` owns acquisition, device discovery, the current source generation and shutdown. The native subprocess exists only for an accessible candidate serial port. A 25-second handshake watchdog and four consecutive scan-data timeouts bound failed attempts. Switching source clears identity and scans immediately; packets from older generations are discarded. Frame IDs increase across native-process restarts so restarted sequence numbers cannot suppress a new stream. `idle` suspends acquisition during file replay.

Static HTTP serving is an allowlist, not a filesystem browser. The listener is loopback-only. Host/Origin checks and JSON content-type enforcement protect control requests from ordinary cross-origin pages; this is not user authentication. SSE is latest-frame delivery rather than a lossless transport, capped at eight clients, with one-second heartbeats and bounded writes. A slow browser may miss revolutions. Experiments report _received_ scans; they do not silently call that a physical detection probability.

`lidar_bridge.cpp` retains the original HQ decoding (`angle_z_q14 × 90 / 16384`, `dist_mm_q2 / 4`, quality shifted by 2). Invalid zero-distance samples are excluded from `points`; `raw_count` includes them. Firmware and scan-mode names are JSON escaped. Scan commands check SDK results. The bridge does not automatically reset an error-state sensor, change persistent serial baud, or claim success on a failed start. SIGINT/SIGTERM/parent-pipe closure trigger a stop and motor-stop attempt. A power loss or force-killed process cannot guarantee a physical motor stop.

Device capabilities come from `getDeviceInfo`, `getHealth`, `getAllSupportedScanModes` and `checkMotorCtrlSupport`. A numeric motor control is exposed only for `MotorCtrlSupportRpm` with a successful bounded `getMotorInfo` query. The pinned SDK's rotation-limit query is not treated as a PWM bound. For PWM or unknown-range devices, only the SDK default start/stop is used.

## HTTP

- `GET /api/state`: latest state, metadata and optional latest frame.
- `GET /api/stream`: SSE `data` messages with `type: state`, metadata and a new optional `scan`. Each frame is sent once per connected client; comments are heartbeats.
- `POST /api/source`: `{source: "hardware"|"demo"|"idle", port: null|string, baud: 0|supported rate, scene: "room"|"target"|"moving"|"dropout"}`.
- `POST /api/control`: `{action: "pause"|"resume"|"health"|"mode"|"motor", value?: integer}`. HTTP 202 means accepted, not that hardware applied it. `last_command` receives the native command result.

## Browser data

`web/core.js` owns pure geometry, filtering, statistics and recording validation. Distances are mm. Display angles are `wrap((invert ? -raw : raw) + offset)`, clockwise from the configured front. X points right, Y points forward. A separate view radius clips drawing without changing analysis. Sector edges are inclusive; 90-degree diagnostic sectors may share boundary points.

Recordings: `schema: rplidar-lab/1`, `kind: recording`, original `source`, `device_info`, starting `config`, `created_at`, and raw `frames`. Files are limited to 25 MB, 1–1,200 frames, 8,192 valid points per frame and 500,000 points total. Values must be finite and timestamps nondecreasing. Settings remain locked while capturing. Recorded timestamps are host receipt times, not synchronized optical acquisition times.

Experiments: the same schema, `kind: experiment`, frozen settings, protocol, reference, tolerance, label, notes, duration, per-scan samples, result, completion status and raw `evidence`. At most 20 recent experiments and 1,000,000 total raw-evidence points are held in browser memory; the oldest complete entries are evicted when either aggregate limit is exceeded. Export before closing or reaching these bounds. Raw evidence is capped at 1,200 scans/500,000 points per trial. Replay is browser-local and retains its original source; it cannot start a new acquisition experiment.

Source changes affect the shared local acquisition service. Separate browser tabs share one instrument; they do not own independent sensors. Source-generation changes abort any active experiment and stop recording. The three-second browser freshness gate also clears plots when the server becomes unreachable.
