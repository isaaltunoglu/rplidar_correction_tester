# Third-party software

The project MIT license applies to RPLIDAR Lab application code, not to these dependencies.

- **SLAMTEC RPLIDAR SDK**, Shanghai Slamtec Co., Ltd. and RoboPeak Team, BSD-2-Clause. Vendored source: `rplidar_sdk/`; full license: `rplidar_sdk/LICENSE`. Upstream: https://github.com/Slamtec/rplidar_sdk. Pinned source revision: `99478e5fb90de3b4a6db0080acacd373f8b36869`. Native adapter links the SDK statically; retain the vendor notice with binary distributions. Vendor application samples and optional Windows dependencies remain under their own upstream notices; they are not required by this application.
- **Manrope**, Mikhail Sharanda and contributors, SIL Open Font License 1.1. Locally served font: `assets/fonts/manrope.ttf`; license: `assets/fonts/OFL.txt`. Source: https://github.com/google/fonts/tree/main/ofl/manrope.
- **LinkeDOM** (development tests only), ISC. Install from npm to run the optional DOM integration check; its dependencies retain their own licenses.
- **Playwright** (optional browser tests only), Apache-2.0. Browser binaries and OS dependencies are installed separately for development/CI.

RPLIDAR and SLAMTEC are names of their respective owners. This independent application does not claim manufacturer endorsement.
