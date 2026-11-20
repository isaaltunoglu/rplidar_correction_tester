import io
import json
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import server


class ManagerTests(unittest.TestCase):
    def test_disconnection_clears_data_and_identity(self):
        m = server.LidarManager(start=False)
        m.status["scanning"] = True
        m.ingest({"type": "device_info", "model": "test"}, 0)
        m.ingest(server.simulated_scan(1), 0)
        self.assertIsNotNone(m.snapshot()["latest_scan"])
        m.disconnected("gone")
        state = m.snapshot()
        self.assertIsNone(state["latest_scan"])
        self.assertIsNone(state["device_info"])
        self.assertFalse(state["status"]["scanning"])

    def test_generation_rejects_late_packets(self):
        m = server.LidarManager(start=False)
        m.configure("demo")
        m.ingest({"type": "device_info", "model": "old"}, 0)
        self.assertIsNone(m.device_info)
        m.ingest({"type": "device_info", "model": "new"}, 1)
        self.assertEqual(m.device_info["model"], "new")

    def test_source_and_command_validation(self):
        m = server.LidarManager(start=False)
        for source in ["bad", None, 2]:
            with self.assertRaises(ValueError):
                m.configure(source)
        with self.assertRaises(ValueError):
            m.configure("hardware", baud=True)
        with self.assertRaises(ValueError):
            m.configure("hardware", port="/etc/passwd")
        with self.assertRaises(ValueError):
            m.control("resume")
        with self.assertRaises(ValueError):
            m.control("motor", -1)

    def test_demo_pause_resume_and_shutdown(self):
        m = server.LidarManager(source="demo")
        try:
            for _ in range(30):
                if m.snapshot()["latest_scan"]:
                    break
                time.sleep(0.02)
            self.assertEqual(m.snapshot()["latest_scan"]["source"], "demo")
            m.control("pause")
            seq = m.snapshot()["latest_scan"]["seq"]
            time.sleep(0.2)
            self.assertEqual(m.snapshot()["latest_scan"]["seq"], seq)
            m.control("resume")
            time.sleep(0.2)
            self.assertGreater(m.snapshot()["latest_scan"]["seq"], seq)
            m.configure("idle")
            time.sleep(0.2)
            self.assertFalse(m.snapshot()["status"]["scanning"])
            self.assertIsNone(m.snapshot()["latest_scan"])
        finally:
            m.shutdown()
        self.assertFalse(m.thread.is_alive())

    def test_simulated_target_has_expected_range_and_is_deterministic(self):
        s = server.simulated_scan(4, "target")
        self.assertEqual(s, server.simulated_scan(4, "target"))
        front = [p[1] for p in s["points"] if p[0] < 2 or p[0] > 358]
        self.assertTrue(all(970 < d < 1030 for d in front))

    def test_usb_dedup_and_candidate_detection(self):
        with (
            patch.object(
                server.glob,
                "glob",
                side_effect=lambda p: (
                    ["/dev/serial/by-id/slamtec"]
                    if "by-id" in p
                    else ["/dev/ttyUSB0"]
                    if "ttyUSB" in p
                    else []
                ),
            ),
            patch.object(server.os.path, "realpath", return_value="/dev/ttyUSB0"),
            patch.object(server.os.path, "exists", return_value=True),
            patch.object(server.os, "access", return_value=True),
        ):
            ports = server.discover_ports()
        self.assertEqual(len(ports), 1)
        self.assertTrue(ports[0]["candidate"])


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.manager = server.LidarManager(start=False)
        self.srv = SimpleNamespace(
            manager=self.manager, server_port=8080, stream_slots=threading.BoundedSemaphore(8)
        )

    def request(self, path, method="GET", body=None, headers=None):
        # Exercise the real HTTP parser/handler without opening an OS socket.
        payload = (body or "").encode()
        request_headers = {
            "Host": "127.0.0.1:8080",
            "Connection": "close",
            "Content-Length": str(len(payload)),
            **(headers or {}),
        }
        request = (
            f"{method} {path} HTTP/1.1\r\n"
            + "".join(f"{k}: {v}\r\n" for k, v in request_headers.items())
            + "\r\n"
        ).encode() + payload

        class MemorySocket:
            def __init__(self):
                self.output = bytearray()

            def makefile(self, *_):
                return io.BytesIO(request)

            def sendall(self, data):
                self.output.extend(data)

            def settimeout(self, _):
                pass

        sock = MemorySocket()
        server.Handler(sock, ("127.0.0.1", 1234), self.srv)
        head, _, data = bytes(sock.output).partition(b"\r\n\r\n")
        lines = head.decode().split("\r\n")
        status = int(lines[0].split()[1])
        headers = dict(line.split(": ", 1) for line in lines[1:] if ": " in line)
        return status, headers, data

    def headers(self):
        return {
            "Origin": f"http://127.0.0.1:{self.srv.server_port}",
            "Content-Type": "application/json",
        }

    def test_static_assets_and_state(self):
        status, headers, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn(b"RPLIDAR Lab", body)
        self.assertIn("Content-Security-Policy", headers)
        status, _, body = self.request("/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["source"], "hardware")

    def test_private_paths_are_not_served(self):
        for path in [
            "/server.py",
            "/.git/config",
            "/rplidar_sdk/LICENSE",
            "/../server.py",
            "/web/../../server.py",
        ]:
            self.assertEqual(self.request(path)[0], 404)

    def test_origin_and_host_guard(self):
        self.assertEqual(
            self.request(
                "/api/source",
                "POST",
                "{}",
                {"Content-Type": "application/json", "Origin": "https://evil.example"},
            )[0],
            403,
        )
        self.assertEqual(self.request("/api/state", headers={"Host": "evil.example"})[0], 403)

    def test_malformed_and_oversized_requests(self):
        for data in ["{", "[]", "null", '{"source":"unknown"}']:
            self.assertEqual(self.request("/api/source", "POST", data, self.headers())[0], 400)
        self.assertEqual(self.request("/api/source", "POST", "x" * 4097, self.headers())[0], 413)
        self.assertEqual(
            self.request("/api/control", "POST", '{"action":"resume"}', self.headers())[0], 400
        )

    def test_source_transition(self):
        status, _, body = self.request("/api/source", "POST", '{"source":"demo"}', self.headers())
        self.assertEqual(status, 202)
        self.assertEqual(json.loads(body)["generation"], self.manager.generation)
        self.assertEqual(self.manager.source, "demo")
        self.manager.configure("hardware")


if __name__ == "__main__":
    unittest.main()
