# RPLIDAR Lab

A local measurement and experiment workspace for SLAMTEC RPLIDAR sensors. Inspect scans, choose angular sectors, run documented experiments and export the evidence. The interface is in Turkish; the acquisition service runs entirely on your computer.

**[Türkçe başlangıç kılavuzu](docs/QUICKSTART_TR.md)** · [Experiments](docs/EXPERIMENTS.md) · [Research sources](docs/RESEARCH.md) · [Validation status](docs/VALIDATION.md)

## Start

Linux, Python 3.10+, `g++` with C++17 and GNU Make:

```bash
./start.sh
```

The launcher builds the native adapter if needed, starts the local service and opens `http://localhost:8080`. Supported USB serial adapters are discovered in the background, baud rates are tried automatically, and disconnections trigger a fresh connection attempt. Initial OS serial-device permission may still be required; see [USB setup](docs/USB.md). No browser extension, frontend build, Python package or cloud account is required.

Without hardware or a compiler:

```bash
./start.sh --demo
```

For a headless session, use `python3 server.py --demo` and open the printed URL yourself. Add `--port 8081` if the default is occupied. To select a known port directly: `LIDAR_PORT=/dev/ttyUSB0 ./start.sh`. The UI also offers an advanced port and baud selector.

## What you can test

- Front/rear 120°, front 180°, full 360° and any custom sector; mounting offset and angle reversal.
- Point cloud, rays and contour visualization; cursor/touch/keyboard point inspection; distance and quality filters.
- Scan frequency and its recent history, selected returns, angular occupancy, nearest returns and four directional summaries.
- Distance accuracy, repeatability, surface comparisons, scan performance, angular coverage and target-return continuity. Each trial stores conditions, frozen settings, per-revolution target medians and raw evidence.
- Device-reported model, serial, firmware, technology, health, scan modes and conditional RPM controls. PWM devices use the SDK default start/stop; numeric PWM adjustment is intentionally unavailable without verified bounds.
- Full-scan recording, validated JSON import, replay speed/seeking, selected-sector CSV, raw JSON, PNG and an HTML experiment report that can be printed to PDF.
- Four explicitly synthetic scenarios: room, 1,000 mm target, moving object and missing returns.

A 120° sector filters a 360° acquisition in software. It does not physically restrict the laser. A contour is not SLAM; a missing return is not proof of free space. Quality can be constant in compressed scan modes. Actual device specifications depend on model, revision and mode; the application does not infer them from the former A2M8 page title.

## Project layout

```text
server.py              Local HTTP/SSE service, USB discovery and supervision
lidar_bridge.cpp       Checked SDK calls; JSON-lines transport and commands
web/core.js            Pure geometry, statistics and import validation
web/app.js             Visualization, experiments, recording and replay
web/styles.css         Responsive interface and local font
rplidar_sdk/            Vendor SDK, pinned revision and original license
assets/                Self-hosted font and SVG assets
tests/                 Unit, DOM and optional real-browser checks
docs/                  Methods, sources, USB setup and evidence limitations
scripts/               Packaging and local Git helper
.github/workflows/     Build, tests and browser evidence workflow
```

## Development and checks

```bash
make
make test
npm install
npm run test:dom
python3 -m pip install playwright==1.61.0
python3 -m playwright install chromium
python3 tests/browser_smoke.py
```

Only the last four commands need development dependencies/network access. Normal operation does not. [Validation status](docs/VALIDATION.md) distinguishes checks performed here from checks that could not run. Hardware was unavailable during this change; no new bench verification is claimed.

## Git and publishing

A local `main` history is prepared. In this managed workspace, the root `.git` directory is a read-only mount, so repository metadata lives in `.git-local`. Use:

```bash
./scripts/git.sh status
./scripts/git.sh log --oneline
```

For a normal working copy with standard `git` commands, clone this local repository to a writable destination:

```bash
git clone /path/to/rplidar_dinama/.git-local rplidar-lab
cd rplidar-lab
```

If using the source archive instead, extract it and run `git init -b main`, `git add .` and `git commit -m "Initial RPLIDAR Lab release"`. The source archive contains no local Git metadata or compiled binaries. To regenerate it from tracked files: `python3 scripts/package.py`.

No remote repository was created, no credentials were accessed and nothing was published. After you choose your repository host, add your remote and push the reviewed source yourself.

## License

Application code: [MIT](LICENSE). Vendor SDK: BSD-2-Clause. Manrope: SIL OFL 1.1. See [third-party notices](THIRD_PARTY_NOTICES.md). This independent project is not an official SLAMTEC product.
