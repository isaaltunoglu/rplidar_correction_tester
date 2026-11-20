# RPLIDAR Lab

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A professor evaluating a previously connected SLAMTEC LiDAR and students running reproducible experiments. The user explicitly delegated implementation and research without questions.

The primary interface must also work for a first-time user with no LiDAR, statistics or file-format knowledge. The user explicitly requested plain Turkish instructions, guided experiments and explanations of recording, replay and JSON contents.

## Product Purpose

A local instrument for inspecting full scans, selecting front/rear angular sectors, evaluating distance repeatability, comparing surfaces and scan modes, and exporting measurements with their settings.

## Operating Context

Existing Python standard-library HTTP server, local C++ SLAMTEC SDK bridge and a browser UI. Current hardware is unavailable. Linux is the native hardware target of the existing bridge.

## Capabilities and Constraints

Preserve existing SDK connection and scan decoding. Automatically discover USB serial devices and reconnect. Clearly distinguish physical measurements, simulation and replay. Physical coverage stays 360 degrees; angular selection is a software filter. No SLAM, collision safety or device performance certification claims. Exact sensor model and supported capabilities must come from the device, not the old A2M8 page title.

## Evidence on Hand

Existing server.py, lidar_bridge.cpp, index.html, and vendor SDK at revision 99478e5fb90de3b4a6db0080acacd373f8b36869. User reports that the previous program connected and ran. No new physical measurements are available.

## Product Principles

- Make data provenance and stale/disconnected states visible.
- Keep acquisition independent of browser rendering and analysis.
- Record experiment settings with exported results.
- Work locally without a cloud service or frontend build step.

- Present a short beginner workflow first; keep specialist settings and raw data available through labelled disclosure.
- Explain what each saved file contains and how to use it before asking the user to download or import it.
