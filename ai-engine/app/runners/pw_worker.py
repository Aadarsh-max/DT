"""Playwright, in its own process.

Why a separate process: on Windows, `uvicorn --reload` installs an asyncio event loop that cannot
start subprocesses, and Playwright needs to. A plain Python process has no such limit, and a
browser crash cannot take the API down.

Protocol: one JSON object on stdin, one line "@@RESULT@@{json}" on stdout.
Do not import anything from `app` here, so startup stays fast.
"""
import asyncio
import json
import re
import sys
import time
from urllib.parse import urljoin, urlparse

MARK = "@@RESULT@@"
VIEWPORT = {"width": 1280, "height": 800}

SNAPSHOT_JS = r"""
() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const labelOf = (el) => {
    let t = '';
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) t = l.innerText;
    }
    if (!t) {
      const p = el.closest('label');
      if (p) t = p.innerText;
    }
    return (el.getAttribute('aria-label') || t || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  };
  const out = [];
  const sel = 'a[href],button,input,select,textarea,[role=button],[role=link],[role=tab],[role=checkbox]';
  document.querySelectorAll(sel).forEach((el) => {
    if (out.length >= 60 || !visible(el)) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' && el.type === 'hidden') return;
    out.push({
      tag,
      type: el.type || null,
      role: el.getAttribute('role') || null,
      label: labelOf(el),
      text: (el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 60),
      placeholder: el.getAttribute('placeholder') || null,
      href: tag === 'a' ? (el.getAttribute('href') || '').slice(0, 80) : null,
    });
  });
  const headings = Array.from(document.querySelectorAll('h1,h2'))
    .slice(0, 6)
    .map((h) => h.innerText.trim().slice(0, 80))
    .filter(Boolean);
  return { elements: out, headings };
}
"""


class CheckFailed(Exception):
    """An assertion did not hold: the app behaved differently from the expectation."""


class NotFound(Exception):
    """An element could not be located."""


def _short(e, n=220):
    text = str(e).strip()
    first = text.splitlines()[0] if text else type(e).__name__
    return first[:n]


def _norm(s):
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _import_playwright():
    try:
        from playwright.async_api import async_playwright

        return async_playwright
    except ImportError:
        return None


NO_PLAYWRIGHT = {
    "ok": False,
    "code": "NO_PLAYWRIGHT",
    "error": "Playwright is not installed. Run: pip install playwright",
}


def _launch_failure(e):
    msg = str(e)
    if "Executable doesn't exist" in msg or "playwright install" in msg:
        return {
            "ok": False,
            "code": "BROWSER_MISSING",
            "error": "Chromium is not installed. Run: python -m playwright install chromium",
        }
    return {"ok": False, "code": "LAUNCH_FAILED", "error": f"Could not start the browser: {_short(e)}"}


async def _settle(page, idle=False):
    try:
        await page.wait_for_load_state("load", timeout=5000)
    except Exception:  # noqa: BLE001
        pass
    if idle:
        try:
            await page.wait_for_load_state("networkidle", timeout=2500)
        except Exception:  # noqa: BLE001
            pass


async def _after_action(page):
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=3000)
    except Exception:  # noqa: BLE001
        pass
    await asyncio.sleep(0.4)


# ───────── locating elements ─────────

def _describe(t):
    role = f"/{t['role']}" if t.get("role") else ""
    return f'{t.get("by")}{role} "{t.get("value")}"'


def _candidates(page, t):
    by, v, role = t.get("by", "text"), t.get("value", ""), t.get("role")
    rx = re.compile(re.escape(v), re.I)
    out = []

    def add(fn):
        try:
            out.append(fn())
        except Exception:  # noqa: BLE001
            pass

    if by == "css":
        add(lambda: page.locator(v))
        return out
    if by == "testid":
        add(lambda: page.get_by_test_id(v))
        return out

    order = {
        "role": ["role", "text", "label", "placeholder"],
        "label": ["label", "placeholder", "textbox", "text"],
        "placeholder": ["placeholder", "label", "textbox", "text"],
        "text": ["text", "button", "link", "label"],
    }.get(by, ["text", "label", "placeholder"])

    for kind in order:
        if kind == "role" and role:
            add(lambda: page.get_by_role(role, name=rx))
        elif kind == "text":
            add(lambda: page.get_by_text(rx))
        elif kind == "label":
            add(lambda: page.get_by_label(rx))
        elif kind == "placeholder":
            add(lambda: page.get_by_placeholder(rx))
        elif kind in ("textbox", "button", "link"):
            add(lambda k=kind: page.get_by_role(k, name=rx))
    return out


async def _first_visible(locator):
    n = await locator.count()
    for i in range(min(n, 5)):
        el = locator.nth(i)
        if await el.is_visible():
            return el
    return None


async def _find(page, target, timeout_ms):
    cands = _candidates(page, target)
    deadline = time.monotonic() + timeout_ms / 1000
    while True:
        for loc in cands:
            try:
                el = await _first_visible(loc)
                if el is not None:
                    return el
            except Exception:  # noqa: BLE001
                continue
        if time.monotonic() >= deadline:
            raise NotFound(f"Could not find element: {_describe(target)}")
        await asyncio.sleep(0.25)


async def _poll(check, timeout_ms, message):
    deadline = time.monotonic() + timeout_ms / 1000
    while True:
        try:
            if await check():
                return
        except Exception:  # noqa: BLE001  (page may be navigating)
            pass
        if time.monotonic() >= deadline:
            raise CheckFailed(message)
        await asyncio.sleep(0.3)


# ───────── actions ─────────

async def _act(page, a, base_url, t):
    kind = a["action"]
    target = a.get("target")
    value = str(a.get("value") or "")
    check_t = min(t, 5000)

    if kind == "goto":
        url = urljoin(base_url, value)
        if urlparse(url).scheme not in ("http", "https"):
            raise ValueError("Only http and https addresses can be opened")
        await page.goto(url, wait_until="domcontentloaded")
        await _settle(page, idle=True)
        return

    if kind == "wait":
        try:
            ms = int(float(value or 500))
        except ValueError:
            ms = 500
        await asyncio.sleep(min(max(ms, 0), 3000) / 1000)
        return

    if kind == "press":
        if target:
            el = await _find(page, target, t)
            await el.press(value)
        else:
            await page.keyboard.press(value)
        await _after_action(page)
        return

    if kind == "expect_text":
        needle = _norm(value)

        async def has_text():
            return needle in _norm(await page.locator("body").inner_text())

        await _poll(has_text, check_t, f'Expected the page to show "{value}", but it did not')
        return

    if kind == "expect_url":
        needle = value.lower()
        await _poll(
            lambda: _async(needle in page.url.lower()),
            check_t,
            f'Expected the URL to contain "{value}", but it is {page.url}',
        )
        return

    if kind == "expect_title":
        needle = _norm(value)

        async def has_title():
            return needle in _norm(await page.title())

        await _poll(has_title, check_t, f'Expected the page title to contain "{value}"')
        return

    if kind == "expect_visible":
        try:
            await _find(page, target, check_t)
        except NotFound:
            raise CheckFailed(f"Expected {_describe(target)} to be visible, but it was not found") from None
        return

    if kind == "expect_not_visible":
        deadline = time.monotonic() + check_t / 1000
        while True:
            seen = False
            for loc in _candidates(page, target):
                try:
                    if await _first_visible(loc) is not None:
                        seen = True
                        break
                except Exception:  # noqa: BLE001
                    pass
            if not seen:
                return
            if time.monotonic() >= deadline:
                raise CheckFailed(f"Expected {_describe(target)} to be hidden, but it is visible")
            await asyncio.sleep(0.25)

    el = await _find(page, target, t)
    if kind == "click":
        await el.click()
        await _after_action(page)
    elif kind == "fill":
        await el.fill(value)
    elif kind == "select":
        try:
            await el.select_option(label=value)
        except Exception:  # noqa: BLE001
            await el.select_option(value=value)
    elif kind == "check":
        await el.check()
    elif kind == "uncheck":
        await el.uncheck()
    elif kind == "hover":
        await el.hover()
        await asyncio.sleep(0.2)
    else:
        raise ValueError(f"Unknown action: {kind}")


async def _async(value):
    return value


# ───────── modes ─────────

async def do_check(_p):
    ap = _import_playwright()
    if ap is None:
        return NO_PLAYWRIGHT
    async with ap() as pw:
        try:
            browser = await pw.chromium.launch(headless=True)
        except Exception as e:  # noqa: BLE001
            return _launch_failure(e)
        try:
            page = await browser.new_page()
            await page.set_content("<title>ok</title>")
            return {"ok": True, "version": browser.version}
        finally:
            await browser.close()


async def do_snapshot(p):
    ap = _import_playwright()
    if ap is None:
        return NO_PLAYWRIGHT
    url = p["url"]
    async with ap() as pw:
        try:
            browser = await pw.chromium.launch(headless=True)
        except Exception as e:  # noqa: BLE001
            return _launch_failure(e)
        try:
            ctx = await browser.new_context(viewport=VIEWPORT, ignore_https_errors=True)
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:  # noqa: BLE001
                return {"ok": False, "code": "UNREACHABLE", "error": f"Could not open {url}: {_short(e)}"}
            await _settle(page, idle=True)
            data = await page.evaluate(SNAPSHOT_JS)
            return {"ok": True, "title": await page.title(), "url": page.url, **data}
        finally:
            await browser.close()


async def do_execute(p):
    ap = _import_playwright()
    if ap is None:
        return NO_PLAYWRIGHT

    plan = p["plan"]
    base_url = p["base_url"]
    step_timeout = int(p.get("step_timeout_ms", 8000))
    logs, page_errors = [], []
    status, error = "PASSED", None
    started = time.monotonic()
    final_url = base_url

    async with ap() as pw:
        try:
            browser = await pw.chromium.launch(headless=bool(p.get("headless", True)))
        except Exception as e:  # noqa: BLE001
            return _launch_failure(e)

        try:
            ctx = await browser.new_context(viewport=VIEWPORT, ignore_https_errors=True)
            page = await ctx.new_page()
            page.set_default_timeout(step_timeout)
            page.set_default_navigation_timeout(30000)
            page.on("pageerror", lambda e: page_errors.append(str(e)[:200]))

            try:
                await page.goto(base_url, wait_until="domcontentloaded")
                await _settle(page, idle=True)
                logs.append(f"Opened {page.url}")
            except Exception as e:  # noqa: BLE001
                status = "ERROR"
                error = f"Could not open {base_url}: {_short(e)}"
                logs.append(f"\u2717 {error}")

            if status == "PASSED":
                for i, act in enumerate(plan, 1):
                    label = act.get("desc") or act["action"]
                    try:
                        await _act(page, act, base_url, step_timeout)
                        logs.append(f"\u2713 {i}. {label}")
                    except CheckFailed as e:
                        status, error = "FAILED", str(e)
                        logs.append(f"\u2717 {i}. {label}: {error}")
                        break
                    except NotFound as e:
                        status, error = "ERROR", str(e)
                        logs.append(f"\u2717 {i}. {label}: {error}")
                        break
                    except Exception as e:  # noqa: BLE001
                        status, error = "ERROR", f"Step {i} ({label}) failed: {_short(e)}"
                        logs.append(f"\u2717 {error}")
                        break

            final_url = page.url
            if page_errors:
                logs.append(f"Page reported {len(page_errors)} JavaScript error(s): {page_errors[0]}")

            shot = p.get("screenshot_path")
            if status != "PASSED" and shot:
                try:
                    await page.screenshot(path=shot)
                except Exception:  # noqa: BLE001
                    pass
        finally:
            await browser.close()

    return {
        "ok": True,
        "status": status,
        "error": error,
        "logs": logs,
        "final_url": final_url,
        "page_errors": page_errors[:5],
        "duration_ms": int((time.monotonic() - started) * 1000),
    }


MODES = {"check": do_check, "snapshot": do_snapshot, "execute": do_execute}


def main():
    try:
        payload = json.loads(sys.stdin.read())
        handler = MODES[payload["mode"]]
        result = asyncio.run(asyncio.wait_for(handler(payload), timeout=payload.get("timeout", 100)))
    except asyncio.TimeoutError:
        result = {"ok": False, "code": "TIMEOUT", "error": "The browser step timed out"}
    except Exception as e:  # noqa: BLE001
        result = {"ok": False, "code": "WORKER_ERROR", "error": f"{type(e).__name__}: {_short(e)}"}
    # ensure_ascii keeps the output safe on any Windows console encoding
    sys.stdout.write("\n" + MARK + json.dumps(result) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()