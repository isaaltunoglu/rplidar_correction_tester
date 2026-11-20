# Handoff

The application is now RPLIDAR Lab: Python standard-library local HTTP/SSE service, a checked C++ SDK adapter and a self-contained Turkish browser interface. Start without hardware with `./start.sh --demo`; start USB discovery with `./start.sh`.

Implemented: dynamic USB candidate discovery/baud probing/reconnect, stale-data clearing, source generations, device capability/health inspection, selectable scan modes, conditional RPM control, arbitrary front/rear sectors and mounting calibration, filters, point inspection, six experimental protocols, bounded recording/replay, CSV/JSON/PNG exports and a printable HTML report with raw experiment evidence available separately.

Application runtime requires no pip/npm installation. The SDK is vendored as source at revision `99478e5fb90de3b4a6db0080acacd373f8b36869`. Build source in `rplidar_sdk/sdk` is included; upstream app samples, nested history and prebuilt binaries are not included in the release. The pre-existing root `lidar_bridge` binary is retained locally but ignored and unused; the launcher builds `build/lidar_bridge` from the revised source.

Checks completed and outstanding are detailed in `VALIDATION.md`. In particular, browser capture and the visual finish review remain unverified because this environment cannot create sockets or launch Chrome. The optional browser test and CI workflow are ready for a normal environment. No physical sensor was requested or used, and no public publication occurred.

The root `.git` mount is read-only. Local project history is in `.git-local` and accessible through `scripts/git.sh`. Original nested SDK Git metadata is preserved at `.git-local/vendor-sdk-history`. Clone `.git-local` to obtain a standard working copy elsewhere. `scripts/package.py` packages tracked source into `dist/` with a SHA-256 checksum; generated outputs and local Git metadata are excluded.

Continue from the current files; do not restore hardcoded A2M8 performance labels, fake healthy states, automatic fault resets, or claims that missing returns prove free space. The exact connected hardware revision remains unknown.
