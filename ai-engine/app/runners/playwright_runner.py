import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

from app.utils.logger import get_logger

log = get_logger("playwright")

ENGINE_ROOT = Path(__file__).resolve().parents[2]
MARK = "@@RESULT@@"
SNAPSHOT_TTL = 300  # seconds

# At most two browsers at once
_sem = asyncio.Semaphore(2)
_snapshots: dict[str, tuple[float, dict]] = {}


class BrowserUnavailable(Exception):
    """Playwright or Chromium is not installed."""


class BrowserError(Exception):
    """The browser process failed."""


def _run_worker(payload: dict, timeout: int) -> dict:
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "app.runners.pw_worker"],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
            cwd=str(ENGINE_ROOT),
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
    except subprocess.TimeoutExpired as e:
        raise BrowserError("The browser did not respond in time") from e

    for line in reversed((proc.stdout or "").splitlines()):
        if line.startswith(MARK):
            try:
                return json.loads(line[len(MARK):])
            except json.JSONDecodeError:
                break

    tail = " | ".join((proc.stderr or proc.stdout or "no output").strip().splitlines()[-4:])
    raise BrowserError(f"The browser process crashed: {tail[:400]}")


async def _call(payload: dict, timeout: int) -> dict:
    payload = {**payload, "timeout": timeout - 20}
    async with _sem:
        result = await asyncio.to_thread(_run_worker, payload, timeout)

    if result.get("ok") is False:
        code = result.get("code")
        if code in ("BROWSER_MISSING", "NO_PLAYWRIGHT"):
            raise BrowserUnavailable(result["error"])
        if code in ("LAUNCH_FAILED", "WORKER_ERROR", "TIMEOUT"):
            raise BrowserError(result["error"])
    return result


async def check() -> dict:
    return await _call({"mode": "check"}, timeout=80)


async def snapshot(url: str) -> dict:
    """Read the interactive elements of the start page. Cached for a few minutes."""
    cached = _snapshots.get(url)
    if cached and time.monotonic() - cached[0] < SNAPSHOT_TTL:
        return cached[1]
    result = await _call({"mode": "snapshot", "url": url}, timeout=100)
    if result.get("ok"):
        _snapshots[url] = (time.monotonic(), result)
    return result


async def execute(
    *, base_url: str, plan: list[dict], headless: bool, screenshot_path: Optional[Path]
) -> dict:
    return await _call(
        {
            "mode": "execute",
            "base_url": base_url,
            "plan": plan,
            "headless": headless,
            "screenshot_path": str(screenshot_path) if screenshot_path else None,
            "step_timeout_ms": 8000,
        },
        timeout=170,
    )