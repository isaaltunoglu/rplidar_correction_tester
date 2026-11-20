# Manufacturer research and design decisions

Reviewed 2026-11-21. These are manufacturer sources, not seller specifications. Sources can change; the vendored SDK revision below is the stable code reference.

1. **SLAMTEC RPLIDAR SDK** — https://github.com/Slamtec/rplidar_sdk and pinned revision https://github.com/Slamtec/rplidar_sdk/tree/99478e5fb90de3b4a6db0080acacd373f8b36869. Device-info/health queries, supported scan-mode enumeration, typical/explicit scan start and HQ data decoding are based on the SDK APIs and examples. The SDK is BSD-2-Clause.
2. **Pinned driver API** — https://github.com/Slamtec/rplidar_sdk/blob/99478e5fb90de3b4a6db0080acacd373f8b36869/sdk/include/sl_lidar_driver.h. Scan modes expose an ID, nominal microseconds per sample and max distance. Motor capabilities distinguish none/PWM/RPM; the returned limit information is not assumed to be a universal PWM bound.
3. **Current A2 model comparison** — https://www.slamtec.com/en/lidar/a2spec. A2 variants differ in sample frequency, interface baud and range. This page describes newer A2M8 specifications than the old document below. No one fixed range/sample-rate pair is hardcoded as the connected device's specification.
4. **A2 product overview** — https://www.slamtec.com/en/lidar/a2/. Supports the full-rotation scanning concept. Therefore selecting front/rear 120° is a software analysis sector, not a laser steering command.
5. **Historical A2M8 v1.0 datasheet** — https://bucket.download.slamtec.com/d25d26d45180b88f3913796817e5db92e81cb823/LD208_SLAMTEC_rplidar_datasheet_A2M8_v1.0_en.pdf. Useful for understanding revision differences and target-dependent measurement conditions. Its older limits are not silently applied to newer devices. A model string alone cannot identify the exact performance revision.
6. **SLAMTEC interface protocol v2.4** — https://www.slamtec.ai/wp-content/uploads/2023/11/LR001_SLAMTEC_rplidar_protocol_v2.4_en.pdf. Defines command/response formats and invalid-distance/quality behavior. The UI avoids labeling Q as calibrated reflectivity and distinguishes invalid returns from empty space.
7. **SLAMTEC SDK guide v2.0** — https://www.slamtec.ai/wp-content/uploads/2023/11/LR002_SLAMTEC_rplidar_sdk_v2.0_en.pdf. Device information, health and scan frequency form part of instrument diagnostics rather than a full physical qualification.

## Resulting decisions

- Read model, firmware, health and supported modes from the device. Preserve raw angles and distances in exports.
- Enumerate USB candidates, verify them through a valid SDK information reply and retry on disconnect.
- Keep the reference frame explicit: front=0°, right=90°, rear=180°, left=270°; calibrate mounting using offset/reversal.
- Offer radial-distance/accuracy, repeatability, surface, mode, coverage and target-return experiments, documenting their limits.
- Refuse to treat a missing return as safe space or an unsynchronized browser timing interval as physical latency.
- Keep simulation visibly labeled and exported as synthetic evidence.

No manufacturer source establishes that this revised application has been physically tested. The user reports that the original application previously connected successfully; the device was unavailable for this implementation.
