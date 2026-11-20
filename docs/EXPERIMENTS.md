# Reproducible experiments

Every trial freezes sector/filter/orientation settings. Store target material, reference method, illumination, mode, mounting and conditions in the notes. Compare trials only when the intended independent variable changes. A software test or a synthetic scene does not establish hardware accuracy.

## Definitions

For each received revolution, select valid points inside both the configured sector and the narrow target beam. Apply distance/Q filters and orientation first. The median target distance is **one sample per revolution**, avoiding falsely treating all neighboring angular points as independent temporal measurements.

For valid target medians `x_i`, sample standard deviation is `sqrt(sum((x_i - mean)^2)/(n-1))`; fewer than two samples produce no SD. Reference bias is `mean(x_i-reference)`; RMSE is `sqrt(mean((x_i-reference)^2))`. P95 absolute error uses the nearest-rank method. These statistics do not include the uncertainty of the external reference.

Target hit rate = revolutions with a valid target median / all received revolutions. Within-tolerance rate = received revolutions whose target median lies within the chosen reference ± tolerance / all received revolutions. Missing target revolutions remain in the denominator. This is not physical detection probability: the SSE stream may omit scans if the browser cannot keep up, and background returns in the same beam can masquerade as a target unless range-gated.

Angular occupancy = occupied 1° bins / ceil(selected angular width), capped at 100%. This is a diagnostic, not a manufacturer resolution specification. Invalid zero-distance returns count in native `raw_count`, not `points`. Q can be synthetic/constant in compressed modes and cannot be interpreted as calibrated material reflectivity.

A trial needs at least five received scans to be complete. Distance-based interpretation additionally needs at least five valid target medians. A disconnect, source change, cancellation, stale data or raw-evidence limit marks a trial incomplete; the available evidence remains downloadable. Host timestamps and trial time are not synchronized measurement-trigger timestamps.

## Suggested matrix

| Question          | Controlled conditions                                         | Variable                                 | Examine                                                  |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| Distance accuracy | Perpendicular matte target, fixed beam, known radial distance | Several measured reference distances     | Bias, RMSE, P95 error, hit rate                          |
| Repeatability     | Fixed sensor/target, mode, range and lighting                 | Independent repeated runs                | Sample SD of revolution medians                          |
| Surface behavior  | Same distance, incidence angle and lighting                   | White, dark, shiny, translucent material | Valid target rate, range spread; Q only with mode caveat |
| Scan performance  | Same environment and stable motor                             | Each device-reported mode                | Mean/min/max/SD of SDK Hz, received frames               |
| Angular coverage  | Same sensor position and environment                          | Front/rear 120°, 180°, 360°              | Occupied angular bins, missing returns                   |
| Target continuity | Narrow beam and range gate around target                      | Target position/material                 | Return continuity in received revolutions                |

For close-range behavior, repeat distance trials progressively nearer the device, using the correct model datasheet rather than the default 150 mm software filter. For maximum-range checks, enlarge the software range filter and view, then test several known reference distances and target materials. Neither the UI slider maximum nor a scan mode's reported max distance is proof that a target is detectable at that range.

For angular discrimination, place two known targets at a fixed range with a measured lateral separation and inspect the raw angular samples; record the setup and export the scan. The application does not automatically certify minimum angular resolution from scene point density.

For moving-target exploration, use the moving synthetic scene or a physical target and inspect repeated recordings. No calibrated trigger input exists, so end-to-end physical latency is not measured. Power consumption, laser optical power, temperature limits, eye-safety compliance and production suitability require separate instruments/evidence and are outside these software experiments.

## Professor review sequence

Use `docs/QUICKSTART_TR.md` for a complete sensor-free walkthrough. Start with the 1,000 mm synthetic target to demonstrate the method, not to validate the device. Later physical runs should be separately labeled and retain device identity, actual scan mode and external reference details. Download each experiment JSON for raw evidence; the printable HTML report summarizes all trials in the current browser session.
