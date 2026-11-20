# Security

RPLIDAR Lab is a local research tool. The service binds to `127.0.0.1`, allows only its explicit static assets, validates local Host and POST Origin headers, bounds JSON control requests, and limits SSE clients. It has no authentication for multiple users on the same computer; do not expose it through a public proxy.

A serial adapter ID is only a discovery hint. Only a successful vendor SDK device-information exchange establishes a connected LiDAR. Automatic discovery probes known CP210x/FTDI candidates; an explicitly selected existing serial port may also be probed. Other devices using those adapters can receive probe bytes. Use a dedicated USB adapter when testing.

Recordings may describe a private physical environment. Review captures before sharing. Imported recordings have a file, frame and point-count limit and are validated before use. Reports escape user-provided text.

For a suspected vulnerability, contact the repository maintainer privately using the repository host's security reporting feature if enabled. Do not attach private scans or secrets to a public issue. A hosted reporting channel has not been configured by this local change.
