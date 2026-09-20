import asyncio
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import httpx

from app.config import settings
from app.utils.logger import get_logger

log = get_logger("appium")

ENGINE_ROOT = Path(__file__).resolve().parents[2]
MARK = "@@RESULT@@"
SNAPSHOT_TTL = 300
SETUP_CODES = {"APPIUM_DOWN", "NO_DEVICE", "NO_CLIENT"}

# One device session at a time
_sem = asyncio.Semaphore(1)
_snapshots: dict[str, tuple[float, dict]] = {}


class AppiumUnavailable(Exception):
    """Appium, the device or the Python client is not ready."""


class AppiumError(Exception):
    """The device session failed."""


def _adb_path() -> Optional[str]:
    for root in (settings.android_home, os.environ.get("ANDROID_HOME"), os.environ.get("ANDROID_SDK_ROOT")):
        if root:
            for name in ("adb.exe", "adb"):
                p = Path(root) / "platform-tools" / name
                if p.is_file():
                    return str(p)
    return shutil.which("adb")


def list_devices() -> tuple[Optional[str], list[dict], Optional[str]]:
    adb = _adb_path()
    if not adb:
        return None, [], "adb was not found. Install Android platform-tools and set ANDROID_HOME."
    try:
        out = subprocess.run([adb, "devices", "-l"], capture_output=True, text=True, timeout=20).stdout
    except (subprocess.SubprocessError, OSError) as e:
        return adb, [], f"adb failed: {e}"

    devices = []
    for line in out.splitlines()[1:]:
        parts = line.split()
        if len(parts) < 2 or line.startswith("*"):
            continue
        model = next((p.split(":", 1)[1] for p in parts[2:] if p.startswith("model:")), "")
        devices.append({"serial": parts[0], "state": parts[1], "model": model})
    return adb, devices, None


async def _appium_status() -> dict:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(f"{settings.appium_url.rstrip('/')}/status")
        if r.status_code != 200:
            return {"up": False, "url": settings.appium_url, "error": f"HTTP {r.status_code}"}
        build = (r.json().get("value") or {}).get("build") or {}
        return {"up": True, "url": settings.appium_url, "version": build.get("version")}
    except httpx.HTTPError:
        return {"up": False, "url": settings.appium_url, "error": "not running"}


async def status() -> dict:
    (adb, devices, adb_error), appium = await asyncio.gather(
        asyncio.to_thread(list_devices), _appium_status()
    )
    return {
        "appium": appium,
        "adb": {"found": bool(adb), "error": adb_error},
        "devices": devices,
        "client": importlib.util.find_spec("appium") is not None,
    }


def _run_worker(payload: dict, timeout: int) -> dict:
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "app.runners.appium_worker"],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
            cwd=str(ENGINE_ROOT),
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
    except subprocess.TimeoutExpired as e:
        raise AppiumError("The device did not respond in time") from e

    for line in reversed((proc.stdout or "").splitlines()):
        if line.startswith(MARK):
            try:
                return json.loads(line[len(MARK):])
            except json.JSONDecodeError:
                break

    tail = " | ".join((proc.stderr or proc.stdout or "no output").strip().splitlines()[-4:])
    raise AppiumError(f"The Appium process crashed: {tail[:400]}")


async def _call(payload: dict, timeout: int) -> dict:
    payload = {**payload, "budget": timeout - 60}
    async with _sem:
        result = await asyncio.to_thread(_run_worker, payload, timeout)

    if result.get("ok") is False:
        if result.get("code") in SETUP_CODES:
            raise AppiumUnavailable(result["error"])
        raise AppiumError(result.get("error") or "The device session failed")
    return result


def _payload(target: dict) -> dict:
    return {
        "appium_url": settings.appium_url,
        "apk_path": target.get("apk_path"),
        "app_package": target.get("app_package"),
        "app_activity": target.get("app_activity"),
        "udid": target.get("udid"),
        "auto_grant": bool(target.get("auto_grant")),
    }


def _key(target: dict) -> str:
    apk = target.get("apk_path")
    stamp = os.path.getmtime(apk) if apk and os.path.exists(apk) else None
    return json.dumps([_payload(target), stamp], sort_keys=True)


async def snapshot(target: dict, fresh: bool = False) -> dict:
    """Start the app and read its first screen. Cached for a few minutes."""
    key = _key(target)
    cached = _snapshots.get(key)
    if not fresh and cached and time.monotonic() - cached[0] < SNAPSHOT_TTL:
        return cached[1]
    result = await _call({"mode": "snapshot", **_payload(target)}, timeout=300)
    _snapshots[key] = (time.monotonic(), result)
    return result


async def execute(target: dict, plan: list[dict]) -> dict:
    return await _call({"mode": "execute", "plan": plan, **_payload(target)}, timeout=300)