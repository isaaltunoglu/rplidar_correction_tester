# Handoff

The application is now RPLIDAR Lab: Python standard-library local HTTP/SSE service, a checked C++ SDK adapter and a self-contained Turkish browser interface. Start without hardware with `./start.sh --demo`; start USB discovery with `./start.sh`.

Implemented: dynamic USB candidate discovery/baud probing/reconnect, stale-data clearing, source generations, device capability/health inspection, selectable scan modes, conditional RPM control, arbitrary front/rear sectors and mounting calibration, filters, point inspection, six experimental protocols, bounded recording/replay, CSV/JSON/PNG exports and a printable HTML report with raw experiment evidence available separately.

Application runtime requires no pip/npm installation. The SDK is vendored as source at revision `99478e5fb90de3b4a6db0080acacd373f8b36869`. Build source in `rplidar_sdk/sdk` is included; upstream app samples, nested history and prebuilt binaries are not included in the release. The pre-existing root `lidar_bridge` binary is retained locally but ignored and unused; the launcher builds `build/lidar_bridge` from the revised source.

The 20 unit checks, DOM regression workflows and real Chrome browser integration now pass. Browser artifacts cover desktop (1512×1100) and mobile (390×844), live simulation, target accuracy experiment, exports, replay, disconnected hardware, pause/resume and stale-data clearing. The simulator's nominal 1,000 mm target is software evidence only. Physical USB and sensor behavior remain unverified. See `VALIDATION.md` and `UI_REVIEW.md` for the final evidence and review scope.

The access restriction was lifted and the complete history moved from `.git-local` to standard `.git`. Use normal `git` commands. Original nested SDK Git metadata is preserved at `.git/vendor-sdk-history` and is not distributed. `scripts/package.py` packages tracked source into `dist/` with a SHA-256 checksum; generated artifacts, binaries and local Git metadata are excluded.

Continue from the current files; do not restore hardcoded A2M8 performance labels, fake healthy states, automatic fault resets, or claims that missing returns prove free space. The exact connected hardware revision remains unknown.
