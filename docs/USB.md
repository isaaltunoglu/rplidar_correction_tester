# USB discovery and first-run permissions

The supported hardware target is Linux. Python simulation can run on other systems; the existing POSIX bridge and macOS serial discovery are provided without a verified macOS hardware claim. Windows native hardware integration is not implemented.

The service scans stable `/dev/serial/by-id/` links first, then `/dev/ttyUSB*`, `/dev/ttyACM*` and macOS USB serial names. Symlinks pointing to the same device are deduplicated. SLAMTEC/RPLIDAR names, CP210x `10c4:ea60` and FTDI `0403:6001` identify **candidates**, not confirmed LiDARs. Other adapter types can be selected explicitly in the UI. The bridge tries `115200`, `256000`, `460800`, `1000000` baud until a valid SDK device-information reply is received; it does not persist a new baud rate on the device.

On Linux, the kernel's CP210x/FTDI driver usually supplies the serial node. If the UI reports permission denied, inspect its ownership:

```bash
ls -l /dev/ttyUSB*
id -nG
```

Join the group that actually owns the port, commonly `dialout` on Debian/Ubuntu or `uucp` on Arch. For example, **only if that is the group shown above**:

```bash
sudo usermod -aG dialout "$USER"
# Or, on a system whose serial group is uucp:
# sudo usermod -aG uucp "$USER"
```

Log out and back in after a group change. Do not run the application as root or use world-writable `chmod 777` device permissions. These are documented administrator actions, not commands the app executes. Existing access from a previous working session may already be sufficient.

If another program owns the port, close that program. USB power, adapter cable, serial ownership and a device internal fault cannot be fixed by choosing a different plot sector. The activity log reports handshake attempts, errors and command acknowledgements. A stalled active stream becomes stale after three seconds; repeated SDK timeouts end the session and trigger discovery again. When paused, no scan-data timeout is expected; the device node is still monitored for removal.

Multiple matching adapters are tried in turn until one speaks the SLAMTEC protocol. A successful first device becomes the active instrument. Simultaneous multi-LiDAR acquisition is not implemented. For repeatable tests, select the stable by-id path in the UI or use `LIDAR_PORT`.
