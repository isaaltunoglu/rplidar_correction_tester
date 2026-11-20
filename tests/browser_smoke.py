"""Real browser integration and screenshots. Requires Playwright (dev only).
Run: python3 tests/browser_smoke.py
Never interprets simulation as physical LiDAR verification.
"""

import json
import os
import re
import signal
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/browser"
OUT.mkdir(parents=True, exist_ok=True)
proc = subprocess.Popen(
    [sys.executable, "server.py", "--demo", "--port", "0"],
    cwd=ROOT,
    stdout=subprocess.PIPE,
    text=True,
)
try:
    line = proc.stdout.readline()
    match = re.search(r"http://localhost:(\d+)", line)
    if not match:
        raise RuntimeError("Server did not start: " + line)
    url = match.group(0)
    with sync_playwright() as p:
        kwargs = dict(headless=True)
        if os.environ.get("CHROME_PATH"):
            kwargs["executable_path"] = os.environ["CHROME_PATH"]
        browser = p.chromium.launch(**kwargs)
        desktop = browser.new_page(viewport=dict(width=1512, height=1100), device_scale_factor=1)
        errors = []
        desktop.on("pageerror", lambda error: errors.append(str(error)))
        desktop.goto(url)
        desktop.wait_for_function("document.querySelector('#metricPoints').textContent !== '—'")
        desktop.evaluate("document.fonts.ready")
        assert "SİMÜLASYON" in desktop.locator("#noticeText").inner_text()
        desktop.locator('.preset[data-center="180"][data-width="120"]').click()
        assert desktop.locator("#centerLabel").inner_text() == "180° · Arka"
        desktop.locator('.preset[data-center="0"][data-width="120"]').click()
        desktop.screenshot(path=str(OUT / "desktop-live.png"), full_page=True)
        with desktop.expect_download() as dl:
            desktop.locator("#exportCSV").click()
        dl.value.save_as(str(OUT / "sector.csv"))
        desktop.locator("#recordButton").click()
        desktop.wait_for_timeout(500)
        assert desktop.locator("#sectorWidth").is_disabled()
        desktop.locator("#recordButton").click()
        desktop.locator('[data-page="recordings"]').click()
        with desktop.expect_download() as dl:
            desktop.locator("#downloadRecording").click()
        recording = OUT / "demo-recording.json"
        dl.value.save_as(str(recording))
        assert json.loads(recording.read_text())["source"] == "demo"
        desktop.screenshot(path=str(OUT / "desktop-recordings.png"), full_page=True)
        desktop.locator('[data-page="experiments"]').click()
        desktop.locator("#trialDuration").fill("3")
        desktop.locator("#trialLabel").fill("Simülasyon · otomatik kontrol")
        desktop.locator("#trialStart").click()
        desktop.wait_for_function(
            "document.querySelector('#trialState').textContent==='Tamamlandı'", timeout=10000
        )
        assert "SİMÜLASYON" in desktop.locator("#trialResults").inner_text()
        desktop.screenshot(path=str(OUT / "desktop-experiment.png"), full_page=True)
        with desktop.expect_download() as dl:
            desktop.locator("#exportReport").click()
        dl.value.save_as(str(OUT / "report.html"))
        desktop.locator('[data-page="recordings"]').click()
        desktop.locator("#recordingFile").set_input_files(str(recording))
        desktop.wait_for_function(
            "document.querySelector('#noticeText').textContent.includes('TEKRAR OYNATMA')"
        )
        desktop.locator("#viewReplay").click()
        assert desktop.locator("#sourceSelect").input_value() == "replay"
        desktop.locator('[data-page="device"]').click()
        desktop.screenshot(path=str(OUT / "desktop-device.png"), full_page=True)
        desktop.locator('[data-page="live"]').click()
        desktop.locator("#sourceSelect").select_option("hardware")
        desktop.wait_for_function(
            "document.querySelector('#sourceSelect').value==='hardware' && !document.querySelector('#plotEmpty').hidden"
        )
        assert desktop.locator("#proximity").get_attribute("data-state") == "unknown"
        desktop.screenshot(path=str(OUT / "desktop-disconnected.png"), full_page=True)
        # One desktop/mobile inspection batch, no iterative screenshot loop.
        mobile = browser.new_page(
            viewport=dict(width=390, height=844),
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
        )
        mobile.on("pageerror", lambda error: errors.append(str(error)))
        mobile.goto(url)
        mobile.locator("#tryDemo").click()
        mobile.wait_for_function("document.querySelector('#metricPoints').textContent !== '—'")
        mobile.evaluate("document.fonts.ready")
        assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), (
            "Mobile horizontal overflow"
        )
        mobile.screenshot(path=str(OUT / "mobile-live.png"), full_page=True)
        for name in ["experiments", "recordings", "device"]:
            mobile.locator(f'[data-page="{name}"]').click()
            assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), (
                f"Mobile overflow: {name}"
            )
        mobile.screenshot(path=str(OUT / "mobile-device.png"), full_page=True)
        assert not errors, errors
        browser.close()
    print("Browser flows and desktop/mobile screenshots passed:", OUT)
finally:
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
