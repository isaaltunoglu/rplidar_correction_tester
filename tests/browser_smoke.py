"""Beginner workflows in real Chrome; all acquisition evidence is synthetic."""

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


def wait_live(page):
    condition = """() => document.querySelector('#plotEmpty').hidden &&
      document.querySelector('#metricPoints').textContent !== '—'"""
    page.wait_for_function(condition)
    page.wait_for_timeout(250)
    page.wait_for_function(condition)


def capture(page, name, live=False):
    page.evaluate("() => document.fonts.ready")
    page.evaluate("() => { document.activeElement?.blur(); window.scrollTo(0,0); }")
    page.wait_for_timeout(350)
    page.locator("#toast").wait_for(state="hidden", timeout=10000)
    if live:
        wait_live(page)
    page.screenshot(path=str(OUT / name), full_page=True, animations="disabled")
    assert page.locator("#toast").is_hidden()


try:
    line = proc.stdout.readline()
    match = re.search(r"http://localhost:(\d+)", line)
    if not match:
        raise RuntimeError("Server did not start: " + line)
    url = match.group(0)
    with sync_playwright() as p:
        kwargs = {"headless": True}
        if os.environ.get("CHROME_PATH"):
            kwargs["executable_path"] = os.environ["CHROME_PATH"]
        browser = p.chromium.launch(**kwargs)
        desktop = browser.new_page(viewport={"width": 1512, "height": 1100}, device_scale_factor=1)
        errors = []
        desktop.on("pageerror", lambda error: errors.append(str(error)))
        desktop.goto(url)
        wait_live(desktop)
        assert "SENSÖRSÜZ ÖRNEK" in desktop.locator("#noticeText").inner_text()
        assert not desktop.locator("#technicalReadings").evaluate("(e)=>e.open")
        assert not desktop.locator(".advanced-settings").evaluate("(e)=>e.open")
        desktop.locator('.preset[data-center="180"]').click()
        assert "Arka taraf" in desktop.locator("#selectedDirection").inner_text()
        desktop.locator('.preset[data-center="0"][data-width="120"]').click()
        desktop.locator("#radarCanvas").focus()
        desktop.keyboard.press("ArrowRight")
        assert "Mesafe:" in desktop.locator("#pointReadout").inner_text()
        capture(desktop, "desktop-live.png", live=True)
        desktop.locator("#technicalReadings>summary").click()
        with desktop.expect_download() as dl:
            desktop.locator("#exportCSV").click()
        dl.value.save_as(str(OUT / "sector.csv"))
        desktop.locator("#technicalReadings>summary").click()
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
        capture(desktop, "desktop-recordings.png")
        # All six tests have concrete preparation steps, without needing advanced controls.
        desktop.locator('[data-page="experiments"]').click()
        for kind in ["accuracy", "repeatability", "surface", "frequency", "coverage", "obstacle"]:
            desktop.locator("#guidedTrialSelect").select_option(kind)
            assert desktop.locator("#trialSteps li").count() == 3
        desktop.locator("#guidedTrialSelect").select_option("accuracy")
        assert desktop.locator("#guidedReference").is_visible()
        desktop.locator("#prepareDemoTarget").click()
        desktop.wait_for_function(
            "()=>document.querySelector('#prepareDemoTarget').textContent.includes('hedef hazır')"
        )
        assert "Gerçek nesne koymanız gerekmez" in desktop.locator("#trialSteps").inner_text()
        wait_live(desktop)
        desktop.locator("#guidedReference").fill("100")
        assert desktop.locator("#trialReference").input_value() == "1000"
        desktop.locator("#trialDuration").fill("3")
        desktop.locator("#trialStart").click()
        assert desktop.locator("#guidedTrialSelect").is_disabled()
        desktop.wait_for_function(
            "()=>document.querySelector('#trialState').textContent==='Tamamlandı'", timeout=10000
        )
        assert "Sensörsüz örnek" in desktop.locator("#trialResults").inner_text()
        assert "cm" in desktop.locator("#trialResults").inner_text()
        assert "Karşılaştırma" in desktop.locator("#trialResults").inner_text()
        capture(desktop, "desktop-experiment.png")
        with desktop.expect_download() as dl:
            desktop.locator("#simpleReport").click()
        report = OUT / "report.html"
        dl.value.save_as(str(report))
        assert "oynatılabilir bir kayıt değildir" in report.read_text()
        desktop.locator(".test-history>summary").click()
        with desktop.expect_download() as dl:
            desktop.locator("[data-result]").click()
        experiment = OUT / "experiment.json"
        dl.value.save_as(str(experiment))
        trial = json.loads(experiment.read_text())
        assert 980 < trial["result"]["mean"] < 1020
        assert trial["completion"] == "complete" and trial["source"] == "demo"
        desktop.locator(".test-history>summary").click()
        desktop.locator('[data-page="recordings"]').click()
        # Watch an in-memory recording directly; no JSON step is required.
        desktop.locator("#watchRecording").click()
        desktop.wait_for_function(
            "()=>document.querySelector('#noticeText').textContent.includes('KAYITTAN İZLEME')"
        )
        assert desktop.locator("#replayCanvas").is_visible()
        assert "saniyelik kayıt" in desktop.locator("#replayFacts").inner_text()
        desktop.locator("#replaySpeed").select_option("0.25")
        desktop.locator("#replayPlay").click()
        desktop.wait_for_timeout(200)
        desktop.locator("#replayPlay").click()
        desktop.locator("#replayRestart").click()
        assert desktop.locator("#replayScrub").input_value() == "0"
        capture(desktop, "desktop-replay-player.png")
        # JSON kinds are intentionally distinguished to prevent confusing test data with recordings.
        desktop.locator("#recordingFile").set_input_files(str(experiment))
        desktop.wait_for_function(
            "()=>document.querySelector('#toast').textContent.includes('test veya tek ölçüm dosyası')"
        )
        desktop.locator("#recordingFile").set_input_files(str(recording))
        desktop.wait_for_function(
            "()=>document.querySelector('#replayFilename').textContent==='demo-recording.json'"
        )
        desktop.locator("#viewReplay").click()
        wait_live(desktop)
        capture(desktop, "desktop-replay.png", live=True)
        desktop.locator('[data-page="device"]').click()
        capture(desktop, "desktop-device.png")
        desktop.locator('[data-page="live"]').click()
        desktop.locator("#sourceSelect").select_option("hardware")
        desktop.wait_for_function(
            "()=>document.querySelector('#sourceSelect').value==='hardware'&&!document.querySelector('#plotEmpty').hidden"
        )
        assert desktop.locator("#proximity").get_attribute("data-state") == "unknown"
        capture(desktop, "desktop-disconnected.png")
        mobile = browser.new_page(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
        )
        mobile.on("pageerror", lambda error: errors.append(str(error)))
        mobile.goto(url)
        mobile.locator("#tryDemo").click()
        wait_live(mobile)
        assert mobile.evaluate("document.documentElement.scrollWidth<=innerWidth")
        capture(mobile, "mobile-live.png", live=True)
        for name in ["experiments", "recordings", "device"]:
            mobile.locator(f'[data-page="{name}"]').click()
            if name == "recordings":
                assert mobile.locator("#watchRecording").is_disabled()
            assert mobile.evaluate("document.documentElement.scrollWidth<=innerWidth"), name
            if name == "experiments":
                mobile.locator("#prepareDemoTarget").click()
                mobile.wait_for_function(
                    "()=>document.querySelector('#prepareDemoTarget').textContent.includes('hedef hazır')"
                )
                assert mobile.evaluate("document.documentElement.scrollWidth<=innerWidth")
            capture(mobile, f"mobile-{name}.png")
        mobile.locator('[data-page="live"]').click()
        mobile.locator("#pauseButton").click()
        mobile.wait_for_function(
            "()=>document.querySelector('#plotEmpty h2').textContent==='Ölçüm durduruldu.'"
        )
        assert mobile.locator("#plotDemo").is_hidden()
        capture(mobile, "mobile-paused.png")
        mobile.locator("#pauseButton").click()
        wait_live(mobile)
        proc.send_signal(signal.SIGSTOP)
        try:
            mobile.wait_for_function(
                "()=>!document.querySelector('#plotEmpty').hidden", timeout=7000
            )
            assert mobile.locator("#proximity").get_attribute("data-state") == "unknown"
            assert mobile.locator("#recordButton").is_disabled()
            capture(mobile, "mobile-stale.png")
        finally:
            proc.send_signal(signal.SIGCONT)
        wait_live(mobile)
        assert not errors, errors
        (OUT / "checks.json").write_text(
            json.dumps(
                {
                    "source": "demo",
                    "desktop": [1512, 1100],
                    "mobile": [390, 844],
                    "page_errors": errors,
                    "target_mean_mm": trial["result"]["mean"],
                    "flows": [
                        "progressive disclosure",
                        "front/rear selection",
                        "point inspection in cm",
                        "all six guided protocols",
                        "cm-to-mm conversion",
                        "guided test and readable report",
                        "recording export",
                        "watch without downloading",
                        "inline replay and rewind",
                        "wrong JSON kind recovery",
                        "recording file import",
                        "pause/resume",
                        "stale clearing",
                        "mobile overflow",
                    ],
                    "physical_sensor_verified": False,
                },
                indent=2,
            )
        )
        browser.close()
    print("Beginner browser workflows passed:", OUT)
finally:
    if proc.poll() is None:
        proc.send_signal(signal.SIGCONT)
        proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
