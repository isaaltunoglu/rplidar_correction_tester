#!/usr/bin/env python3
"""Local, dependency-free acquisition service for RPLIDAR Lab."""

from __future__ import annotations

import argparse
import glob
import json
import math
import mimetypes
import os
import random
import selectors
import signal
import subprocess
import threading
import time
import webbrowser
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BRIDGE = ROOT / "build/lidar_bridge"
VERSION = "1.0.0"
# CP210x is the common SLAMTEC adapter. A USB ID is a candidate, never proof.
USB_IDS = {("10c4", "ea60"), ("0403", "6001")}


def discover_ports() -> list[dict]:
    """Enumerate actual serial nodes, deduplicate stable symlinks, no port opens."""
    paths = sorted(glob.glob("/dev/serial/by-id/*")) + sorted(
        glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*") + glob.glob("/dev/cu.usb*")
    )
    result, seen = [], set()
    for path in paths:
        real = os.path.realpath(path)
        if real in seen or not os.path.exists(real):
            continue
        seen.add(real)
        vid = pid = product = ""
        node = Path("/sys/class/tty") / Path(real).name / "device"
        try:
            for parent in node.resolve().parents:
                if (parent / "idVendor").is_file():
                    vid = (parent / "idVendor").read_text().strip().lower()
                    pid = (parent / "idProduct").read_text().strip().lower()
                    if (parent / "product").is_file():
                        product = (parent / "product").read_text().strip()
                    break
        except OSError:
            pass
        known = (
            (vid, pid) in USB_IDS
            or "slamtec" in (path + product).lower()
            or "rplidar" in (path + product).lower()
        )
        result.append(
            dict(
                path=path,
                real_path=real,
                label=product or Path(path).name,
                vid=vid,
                pid=pid,
                candidate=known,
                accessible=os.access(real, os.R_OK | os.W_OK),
            )
        )
    return result


def simulated_scan(seq: int, scene: str = "room") -> dict:
    """Synthetic ray/rectangle/circle intersections; never physical evidence."""
    rng = random.Random(seq)
    points = []
    now = seq / 10
    for angle in range(0, 360):
        rad = math.radians(angle)
        dx, dy = math.sin(rad), math.cos(rad)
        distance = min(
            3200 / abs(dx) if abs(dx) > 1e-8 else math.inf,
            2400 / abs(dy) if abs(dy) > 1e-8 else math.inf,
        )
        if scene == "target" and min(angle, 360 - angle) <= 8:
            distance = 1000 / max(dy, 0.01)
        if scene == "moving":
            cx, cy, radius = 1000 * math.sin(now * 0.65), 1050 + 500 * math.cos(now * 0.4), 230
            projection = cx * dx + cy * dy
            disc = projection**2 - (cx * cx + cy * cy - radius**2)
            if disc >= 0 and projection > 0:
                distance = min(distance, projection - math.sqrt(disc))
        if scene == "dropout" and (50 < angle < 120 or rng.random() < 0.12):
            continue
        if rng.random() < 0.012:
            continue
        points.append([angle, round(max(1, distance + rng.gauss(0, 5)), 2), rng.randint(24, 47)])
    return dict(type="scan", seq=seq, hz=10.0, mode="Synthetic", raw_count=360, points=points)


class LidarManager:
    def __init__(self, source="hardware", port=None, baud=0, start=True):
        self.lock = threading.RLock()
        self.cond = threading.Condition(self.lock)
        self.wake = threading.Event()
        self.running = True
        self.source, self.port, self.baud = source, port, baud
        self.scene = "room"
        self.generation = 0
        self.revision = 0
        self.frame_id = 0
        self.proc = None
        self.latest_scan = None
        self.device_info = None
        self.status = dict(scanning=False, connection="searching", mode=None)
        self.error = None
        self.last_command = None
        self.ports = []
        self.events = deque(maxlen=60)
        self.started = time.time()
        self.last_scan_time = None
        self.thread = threading.Thread(target=self._worker, daemon=True, name="lidar-acquisition")
        if start:
            self.thread.start()

    def _notify(self):
        self.revision += 1
        self.cond.notify_all()

    def _event(self, message, level="info"):
        if self.events and self.events[-1]["message"] == message:
            return
        self.events.append(dict(timestamp=time.time(), message=message, level=level))

    def snapshot(self):
        with self.lock:
            age = (
                None
                if self.last_scan_time is None
                else round(time.monotonic() - self.last_scan_time, 3)
            )
            return dict(
                version=VERSION,
                source=self.source,
                generation=self.generation,
                revision=self.revision,
                device_info=self.device_info,
                status=dict(self.status),
                latest_scan=self.latest_scan,
                error=self.error,
                ports=list(self.ports),
                events=list(self.events),
                scan_age_s=age,
                last_command=self.last_command,
                selection=dict(port=self.port, baud=self.baud, scene=self.scene),
            )

    def configure(self, source, port=None, baud=0, scene="room"):
        if source not in ("hardware", "demo", "idle") or scene not in (
            "room",
            "target",
            "moving",
            "dropout",
        ):
            raise ValueError("Geçersiz veri kaynağı veya senaryo.")
        if type(baud) is not int or baud not in (0, 115200, 256000, 460800, 1000000):
            raise ValueError("Geçersiz baud hızı.")
        available = {p["path"] for p in discover_ports()}
        if port and port not in available and port != os.environ.get("LIDAR_PORT"):
            raise ValueError("Port mevcut cihaz listesinde bulunamadı. Yeniden tarayın.")
        with self.cond:
            self.source, self.port, self.baud, self.scene = source, port, baud, scene
            self.generation += 1
            self.latest_scan = self.device_info = self.last_scan_time = None
            self.error = None
            self.last_command = None
            self.status = dict(scanning=False, connection="searching", mode=None)
            self._event("Veri kaynağı: " + source)
            self._notify()
        self.wake.set()

    def control(self, action, value=None):
        with self.cond:
            if self.source == "demo":
                if action not in ("pause", "resume", "health"):
                    raise ValueError("Bu kontrol fiziksel cihaz gerektirir.")
                if action != "health":
                    self.status["scanning"] = action == "resume"
                    self.status["connection"] = "connected"
                self.last_command = dict(command=action, ok=True, simulated=True)
                self._notify()
                return
            commands = dict(pause="PAUSE", resume="RESUME", health="HEALTH")
            if action == "mode":
                modes = (self.device_info or {}).get("scan_modes", [])
                if type(value) is not int or value not in [m["id"] for m in modes]:
                    raise ValueError("Cihaz bu tarama modunu bildirmedi.")
                cmd = f"MODE {value}"
            elif action == "motor":
                motor = (self.device_info or {}).get("motor", {})
                if (
                    not motor.get("adjustable")
                    or type(value) is not int
                    or not motor["min"] <= value <= motor["max"]
                ):
                    raise ValueError("Desteklenen motor aralığı dışında veya ayarlanamayan cihaz.")
                cmd = f"MOTOR {value}"
            elif action in commands:
                cmd = commands[action]
            else:
                raise ValueError("Bilinmeyen komut.")
            if not self.device_info or not self.proc or self.proc.poll() is not None:
                raise ValueError("Cihaz bağlı değil. USB otomatik algılama bekleniyor.")
            if (
                self.last_command
                and self.last_command.get("pending")
                and time.monotonic() - self.last_command["sent_at"] < 10
            ):
                raise ValueError("Önceki cihaz komutunun yanıtı bekleniyor.")
            try:
                self.proc.stdin.write((cmd + "\n").encode())
                self.proc.stdin.flush()
            except (OSError, ValueError) as exc:
                raise ValueError("Cihaza komut gönderilemedi.") from exc
            self.last_command = dict(command=cmd, pending=True, sent_at=time.monotonic())
            self._notify()

    def ingest(self, msg, generation):
        with self.cond:
            if generation != self.generation:
                return
            kind = msg.get("type")
            if kind == "device_info":
                self.device_info = msg
                self.error = None
                self.status["connection"] = "connected"
                self._event("Cihaz tanındı: " + str(msg.get("model", "RPLIDAR")))
            elif kind == "status":
                self.status.update(msg)
                if not msg.get("scanning"):
                    self.latest_scan = None
            elif kind == "scan":
                if not self.status.get("scanning"):
                    return
                self.frame_id += 1
                self.last_scan_time = time.monotonic()
                self.latest_scan = {
                    **msg,
                    "frame_id": self.frame_id,
                    "generation": generation,
                    "source": self.source,
                    "timestamp": time.time(),
                }
                self.error = None
                self.status["connection"] = "connected"
            elif kind == "health":
                if self.device_info:
                    self.device_info = {
                        **self.device_info,
                        "health_status": msg.get("health_status"),
                        "health_error": msg.get("health_error"),
                    }
            elif kind == "error":
                self.error = str(msg.get("message", "SDK error"))
                self._event(self.error, "error")
            elif kind == "command":
                self.last_command = {**msg, "pending": False}
                self._event(
                    ("Komut tamamlandı: " if msg.get("ok") else "Komut reddedildi: ")
                    + str(msg.get("command")),
                    "info" if msg.get("ok") else "error",
                )
            self._notify()

    def disconnected(self, message):
        with self.cond:
            self.latest_scan = self.device_info = self.last_scan_time = None
            self.status = dict(scanning=False, connection="searching", mode=None)
            self.error = message
            self._event(message, "warning")
            self._notify()

    def _stop_bridge(self):
        with self.lock:
            proc = self.proc
            self.proc = None
        if not proc:
            return
        try:
            if proc.poll() is None:
                proc.stdin.write(b"QUIT\n")
                proc.stdin.flush()
                proc.wait(timeout=3)
        except (OSError, ValueError, subprocess.TimeoutExpired):
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        finally:
            if proc.stdin:
                proc.stdin.close()
            if proc.stdout:
                proc.stdout.close()

    def _hardware_session(self, path, generation):
        proc = subprocess.Popen(
            [str(BRIDGE), path, str(self.baud)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
        )
        with self.lock:
            self.proc = proc
        buffer = b""
        start = time.monotonic()
        with selectors.DefaultSelector() as selector:
            selector.register(proc.stdout, selectors.EVENT_READ)
            while self.running and generation == self.generation and proc.poll() is None:
                if not os.path.exists(path):
                    break
                for key, _ in selector.select(timeout=0.1):
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        return
                    buffer += chunk
                    if len(buffer) > 2_000_000:
                        raise ValueError("SDK frame exceeds limit")
                    while b"\n" in buffer:
                        line, buffer = buffer.split(b"\n", 1)
                        try:
                            self.ingest(json.loads(line), generation)
                        except (ValueError, UnicodeDecodeError):
                            continue
                with self.cond:
                    if not self.device_info and time.monotonic() - start > 25:
                        break
                    if (
                        self.status["scanning"]
                        and self.last_scan_time
                        and time.monotonic() - self.last_scan_time > 3
                    ):
                        if self.status["connection"] != "stale":
                            self.status["connection"] = "stale"
                            self.latest_scan = None
                            self.error = "Üç saniyedir yeni tarama yok. Bağlantı yeniden denenecek."
                            self._notify()

    def _worker(self):
        next_discovery = 0
        cursor, demo_seq, seen_generation = 0, 0, -1
        try:
            while self.running:
                with self.lock:
                    source, generation = self.source, self.generation
                if generation != seen_generation:
                    seen_generation = generation
                    demo_seq = 0
                    if source == "demo":
                        with self.cond:
                            if generation != self.generation:
                                continue
                            self.device_info = dict(
                                model="Sanal oda",
                                technology="Ray casting · sentetik",
                                serial=None,
                                scan_modes=[],
                                motor=dict(adjustable=False),
                                health_status=None,
                            )
                            self.status = dict(
                                scanning=True, connection="connected", mode="Synthetic"
                            )
                            self._event("Simülasyon açık. Veriler sensörden gelmiyor.", "warning")
                            self._notify()
                if time.monotonic() >= next_discovery:
                    ports = discover_ports()
                    with self.cond:
                        if ports != self.ports:
                            self.ports = ports
                            self._notify()
                    next_discovery = time.monotonic() + 2
                if source == "idle":
                    self.wake.wait(0.2)
                    self.wake.clear()
                    continue
                if source == "demo":
                    with self.lock:
                        scanning = self.status["scanning"]
                        scene = self.scene
                    if scanning:
                        demo_seq += 1
                        self.ingest(simulated_scan(demo_seq, scene), generation)
                    self.wake.wait(0.1)
                    self.wake.clear()
                    continue
                candidates = [
                    p
                    for p in self.ports
                    if (p["path"] == self.port if self.port else p["candidate"])
                ]
                if self.port and not candidates and os.path.exists(self.port):
                    candidates = [
                        dict(path=self.port, accessible=os.access(self.port, os.R_OK | os.W_OK))
                    ]
                if not BRIDGE.exists():
                    self.disconnected(
                        "Yerel adaptör derlenmemiş. ./start.sh ile başlatın; simülasyon derleme gerektirmez."
                    )
                elif candidates:
                    candidate = candidates[cursor % len(candidates)]
                    cursor += 1
                    if not candidate["accessible"]:
                        self.disconnected(
                            "USB seri port izni yok. docs/USB.md içindeki kullanıcı grubu adımlarını uygulayın."
                        )
                    else:
                        with self.cond:
                            self.status["connection"] = "connecting"
                            self.error = None
                            self._event("SDK el sıkışması: " + candidate["path"])
                            self._notify()
                        try:
                            self._hardware_session(candidate["path"], generation)
                        except (OSError, ValueError) as exc:
                            with self.cond:
                                self._event(str(exc), "error")
                        finally:
                            self._stop_bridge()
                            if generation == self.generation:
                                self.disconnected(
                                    "Cihaz yanıt vermiyor veya bağlantı kesildi. USB otomatik olarak yeniden aranıyor."
                                )
                else:
                    self.disconnected(
                        "USB LiDAR bekleniyor. Cihaz takıldığında otomatik bağlantı denenecek."
                    )
                self.wake.wait(2)
                self.wake.clear()
        finally:
            self._stop_bridge()

    def shutdown(self):
        self.running = False
        self.wake.set()
        with self.cond:
            self.cond.notify_all()
        if self.thread.is_alive():
            self.thread.join(timeout=8)


class LabServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, manager):
        self.manager = manager
        self.stream_slots = threading.BoundedSemaphore(8)
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        pass

    def _local_host(self):
        host = self.headers.get("Host", "")
        return host in {
            f"localhost:{self.server.server_port}",
            f"127.0.0.1:{self.server.server_port}",
        }

    def reply(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self._local_host():
            return self.reply(403, dict(error="Local host required"))
        path = urlsplit(self.path).path
        if path == "/api/state":
            return self.reply(200, self.server.manager.snapshot())
        if path == "/api/stream":
            return self.stream()
        allowed = {
            "/": "index.html",
            "/index.html": "index.html",
            "/web/app.js": "web/app.js",
            "/web/core.js": "web/core.js",
            "/web/styles.css": "web/styles.css",
            "/assets/fonts/manrope.ttf": "assets/fonts/manrope.ttf",
            "/favicon.svg": "assets/favicon.svg",
        }
        if path not in allowed:
            return self.reply(404, dict(error="Not found"))
        try:
            data = (ROOT / allowed[path]).read_bytes()
        except OSError:
            return self.reply(404, dict(error="Not found"))
        self.send_response(200)
        self.send_header(
            "Content-Type", mimetypes.guess_type(allowed[path])[0] or "application/octet-stream"
        )
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        self.end_headers()
        self.wfile.write(data)

    def stream(self):
        if not self.server.stream_slots.acquire(blocking=False):
            return self.reply(503, dict(error="Too many stream clients"))
        manager = self.server.manager
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            self.connection.settimeout(5)
            last_revision = -1
            while manager.running:
                with manager.cond:
                    if manager.revision == last_revision:
                        manager.cond.wait(timeout=1)
                    payload = manager.snapshot()
                scan = payload.pop("latest_scan")
                # State metadata every change, scan only once per received frame.
                if payload["revision"] != last_revision:
                    payload["type"] = "state"
                    if scan and scan.get("frame_id") != getattr(self, "_last_frame", None):
                        payload["scan"] = scan
                        self._last_frame = scan["frame_id"]
                    self.wfile.write(
                        (
                            "data: "
                            + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                            + "\n\n"
                        ).encode()
                    )
                    last_revision = payload["revision"]
                else:
                    self.wfile.write(b": heartbeat\n\n")
                self.wfile.flush()
        except (OSError, TimeoutError):
            pass
        finally:
            self.close_connection = True
            self.server.stream_slots.release()

    def do_POST(self):
        host = self.headers.get("Host", "")
        if not self._local_host() or self.headers.get("Origin") != "http://" + host:
            self.close_connection = True
            return self.reply(403, dict(error="Same-origin local request required"))
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            self.close_connection = True
            return self.reply(415, dict(error="application/json required"))
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                self.close_connection = True
                return self.reply(413, dict(error="Body limit: 4096 bytes"))
            self.connection.settimeout(5)
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("JSON object required")
            if self.path == "/api/source":
                self.server.manager.configure(
                    body.get("source"),
                    body.get("port") or None,
                    body.get("baud", 0),
                    body.get("scene", "room"),
                )
            elif self.path == "/api/control":
                self.server.manager.control(body.get("action"), body.get("value"))
            else:
                return self.reply(404, dict(error="Not found"))
            return self.reply(
                202, dict(ok=True, accepted=True, generation=self.server.manager.generation)
            )
        except (ValueError, TypeError) as exc:
            return self.reply(400, dict(error=str(exc)))
        except TimeoutError:
            self.close_connection = True
            return self.reply(408, dict(error="Request timeout"))


def main():
    parser = argparse.ArgumentParser(description="RPLIDAR Lab local acquisition server")
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--open", action="store_true", help="Open the browser")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    args = parser.parse_args()
    manager = LidarManager(
        "demo" if args.demo else "hardware",
        os.environ.get("LIDAR_PORT"),
        int(os.environ.get("LIDAR_BAUD", "0")),
    )
    try:
        server = LabServer(("127.0.0.1", args.port), manager)
    except OSError as exc:
        manager.shutdown()
        raise SystemExit(f"Sunucu açılamadı: {exc}. Başka port için --port 8081 kullanın.")

    def stop(*_):
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    url = f"http://localhost:{server.server_port}"
    print(f"RPLIDAR Lab {VERSION} · {url}\nKaynak: {manager.source} · Çıkış: Ctrl+C", flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        manager.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
