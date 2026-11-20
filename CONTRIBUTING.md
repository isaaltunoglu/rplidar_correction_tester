# Contributing

Use Python 3.10+, Node.js 20+, a C++17 compiler and GNU Make. No Python or npm package is required at application runtime. The optional DOM check uses LinkeDOM; real browser checks use Python Playwright.

1. Keep acquisition, pure analysis and presentation separate.
2. Run `make`, `make test`, and `npm install && npm run test:dom`.
3. With Playwright installed, run `python3 tests/browser_smoke.py`. Inspect the generated desktop/mobile screenshots, keyboard focus, labels and error states.
4. Describe sensor model, firmware, USB adapter, SDK mode, operating system and physical setup for hardware-related changes. Clearly label simulated or replayed evidence.
5. Preserve source provenance and avoid turning missing returns into claims of clear space. Never change USB speed persistently or reset a faulted device automatically.

Do not commit serial captures from private environments, credentials, binaries, local history directories or generated artifacts. A floor plan or point cloud can reveal a private space.

See `docs/ARCHITECTURE.md`, `docs/EXPERIMENTS.md` and `docs/VALIDATION.md` before changing measurement definitions.
