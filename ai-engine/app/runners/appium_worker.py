"""Appium (Android), in its own process.

Same idea as pw_worker.py: a hang or crash here cannot take the API down, and there is no event loop
to clash with uvicorn. Protocol: one JSON object on stdin, one line "@@RESULT@@{json}" on stdout.
Do not import anything from `app` here."""
import base64
import json
import re
import sys
import time
import xml.etree.ElementTree as ET

MARK = "@@RESULT@@"
KEYS = {"back": 4, "home": 3, "enter": 66, "search": 84, "tab": 61, "delete": 67, "menu": 82, "recent": 187}
LOWER, UPPER = "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


class SetupError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


class CheckFailed(Exception):
    """An assertion did not hold: the app behaved differently from the expectation."""


class NotFound(Exception):
    """An element could not be located."""


def _clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def _norm(s):
    return _clean(s).lower()


def _detail(e, n=260):
    msg = str(e)
    m = re.search(r"Original error: (.*)", msg)
    text = (m.group(1) if m else (msg.strip().splitlines() or [type(e).__name__])[0]).strip()
    return text[:n]


def _session_error(e):
    low = str(e).lower()
    if any(x in low for x in ("connection refused", "max retries exceeded", "failed to establish", "newconnectionerror", "connectionreset", "actively refused")):
        return SetupError("APPIUM_DOWN", "Could not reach the Appium server. Start it in a separate terminal with: appium")
    if "could not find a connected android device" in low or "no devices" in low:
        return SetupError("NO_DEVICE", "No Android device was found. Connect a phone or start an emulator, then check that `adb devices` lists it.")
    if "unauthorized" in low:
        return SetupError("NO_DEVICE", "The phone has not authorized this computer. Unlock it and accept the USB debugging prompt.")
    return SetupError("SESSION_FAILED", f"Could not start the app on the device: {_detail(e)}")


def _start(p):
    try:
        from appium import webdriver
        from appium.options.android import UiAutomator2Options
    except ImportError:
        raise SetupError("NO_CLIENT", "The Appium Python client is not installed. Run: pip install Appium-Python-Client") from None

    caps = {
        "platformName": "Android",
        "automationName": "UiAutomator2",
        "newCommandTimeout": 180,
        "autoGrantPermissions": bool(p.get("auto_grant")),
        "uiautomator2ServerLaunchTimeout": 90000,
        "adbExecTimeout": 60000,
        "disableWindowAnimation": True,
    }
    if p.get("udid"):
        caps["udid"] = p["udid"]
    if p.get("apk_path"):
        caps["app"] = p["apk_path"]
    if p.get("app_package"):
        caps["appPackage"] = p["app_package"]
    if p.get("app_activity"):
        caps["appActivity"] = p["app_activity"]

    options = UiAutomator2Options()
    options.load_capabilities(caps)
    try:
        return webdriver.Remote(p["appium_url"], options=options)
    except Exception as e:  # noqa: BLE001
        raise _session_error(e) from e


def _quit(driver):
    try:
        driver.quit()
    except Exception:  # noqa: BLE001
        pass


def _package(driver):
    try:
        return driver.current_package or ""
    except Exception:  # noqa: BLE001
        return ""


# ───────── reading the screen ─────────

def _parse(src):
    return ET.fromstring(re.sub(r"^<\?xml[^>]*\?>", "", (src or "").strip()))


def _screen_text(driver):
    parts = []
    for n in _parse(driver.page_source).iter():
        for k in ("text", "content-desc", "hint"):
            if n.get(k):
                parts.append(n.get(k))
    return _norm(" ".join(parts))


def _kind(cls, editable, checkable):
    if editable:
        return "input"
    if checkable:
        return "checkbox"
    if "Button" in cls:
        return "button"
    return "tappable"


def _elements(src):
    elements, labels = [], []
    for n in _parse(src).iter():
        if n.tag == "hierarchy" or n.get("displayed") == "false":
            continue
        if (n.get("package") or "") == "com.android.systemui":
            continue
        cls = (n.get("class") or "").split(".")[-1]
        text, desc, hint = _clean(n.get("text")), _clean(n.get("content-desc")), _clean(n.get("hint"))
        rid = (n.get("resource-id") or "").split("/")[-1]
        editable = cls in ("EditText", "AutoCompleteTextView")
        checkable = n.get("checkable") == "true"
        if editable or checkable or n.get("clickable") == "true":
            if text or desc or hint or rid:
                if len(elements) < 50:
                    elements.append(
                        {"kind": _kind(cls, editable, checkable), "text": text[:60], "desc": desc[:60], "hint": hint[:60], "id": rid[:60]}
                    )
        elif text and len(labels) < 20:
            labels.append(text[:60])
    return elements, labels


# ───────── locating elements ─────────

def _jre(s):
    """A case-insensitive 'contains' regex, escaped for a Java string literal."""
    rx = "(?i).*" + re.escape(_clean(s)) + ".*"
    return rx.replace("\\", "\\\\").replace('"', '\\"')


def _candidates(t, pkg):
    from appium.webdriver.common.appiumby import AppiumBy

    by, v = t.get("by", "text"), _clean(t.get("value", ""))

    def ui(expr):
        return (AppiumBy.ANDROID_UIAUTOMATOR, f"new UiSelector().{expr}")

    if by == "id":
        return [(AppiumBy.ID, v if ":" in v else f"{pkg}:id/{v}")]

    text = ui(f'textMatches("{_jre(v)}")')
    desc = ui(f'descriptionMatches("{_jre(v)}")')
    needle = v.lower().replace("'", "")
    hint = (AppiumBy.XPATH, f"//*[contains(translate(@hint,'{UPPER}','{LOWER}'),'{needle}')]") if needle else None
    order = {"text": [text, desc, hint], "desc": [desc, text], "hint": [hint, text]}.get(by, [text, desc, hint])
    return [c for c in order if c]


def _describe(t):
    return f'{t.get("by")} "{t.get("value")}"'


def _find(driver, target, pkg, timeout):
    cands = _candidates(target, pkg)
    end = time.monotonic() + timeout
    while True:
        for by, val in cands:
            try:
                for el in driver.find_elements(by, val)[:5]:
                    if el.is_displayed():
                        return el
            except Exception:  # noqa: BLE001
                continue
        if time.monotonic() >= end:
            raise NotFound(f"Could not find element: {_describe(target)}")
        time.sleep(0.4)


def _poll(check, timeout, message):
    end = time.monotonic() + timeout
    while True:
        try:
            if check():
                return
        except Exception:  # noqa: BLE001
            pass
        if time.monotonic() >= end:
            raise CheckFailed(message)
        time.sleep(0.4)


# ───────── actions ─────────

def _act(driver, a, ctx, timeout):
    kind = a["action"]
    target = a.get("target")
    value = str(a.get("value") or "")
    check_t = min(timeout, 6)

    if kind == "wait":
        try:
            ms = int(float(value or 500))
        except ValueError:
            ms = 500
        time.sleep(min(max(ms, 0), 3000) / 1000)
    elif kind == "press":
        driver.press_keycode(KEYS[value])
        time.sleep(0.6)
    elif kind == "swipe":
        size = driver.get_window_size()
        w, h = size["width"], size["height"]
        driver.execute_script(
            "mobile: swipeGesture",
            {"left": int(w * 0.1), "top": int(h * 0.25), "width": int(w * 0.8), "height": int(h * 0.5), "direction": value, "percent": 0.8},
        )
        time.sleep(0.6)
    elif kind == "rotate":
        driver.orientation = "LANDSCAPE" if value == "landscape" else "PORTRAIT"
        ctx["rotated"] = True
        time.sleep(1.2)
    elif kind == "deeplink":
        args = {"url": value}
        if ctx.get("pkg"):
            args["package"] = ctx["pkg"]
        driver.execute_script("mobile: deepLink", args)
        time.sleep(1.5)
    elif kind == "notifications":
        driver.open_notifications()
        time.sleep(1.2)
    elif kind == "expect_text":
        needle = _norm(value)
        _poll(lambda: needle in _screen_text(driver), check_t, f'Expected the screen to show "{value}", but it did not')
    elif kind == "expect_package":
        _poll(lambda: value.lower() in _package(driver).lower(), check_t, f'Expected the foreground app to be "{value}", but it is "{_package(driver)}"')
    elif kind == "expect_visible":
        try:
            _find(driver, target, ctx["pkg"], check_t)
        except NotFound:
            raise CheckFailed(f"Expected {_describe(target)} to be visible, but it was not found") from None
    elif kind == "expect_not_visible":
        end = time.monotonic() + check_t
        while True:
            seen = False
            for by, val in _candidates(target, ctx["pkg"]):
                try:
                    if any(el.is_displayed() for el in driver.find_elements(by, val)[:5]):
                        seen = True
                        break
                except Exception:  # noqa: BLE001
                    pass
            if not seen:
                return
            if time.monotonic() >= end:
                raise CheckFailed(f"Expected {_describe(target)} to be hidden, but it is visible")
            time.sleep(0.4)
    else:
        el = _find(driver, target, ctx["pkg"], timeout)
        if kind == "tap":
            el.click()
            time.sleep(0.7)
        elif kind == "long_press":
            driver.execute_script("mobile: longClickGesture", {"elementId": el.id, "duration": 1200})
            time.sleep(0.7)
        elif kind == "type":
            el.click()
            el.clear()
            el.send_keys(value)
        elif kind == "clear":
            el.clear()
        else:
            raise ValueError(f"Unknown action: {kind}")


# ───────── modes ─────────

def do_snapshot(p):
    try:
        driver = _start(p)
    except SetupError as e:
        return {"ok": False, "code": e.code, "error": str(e)}
    try:
        time.sleep(3)
        elements, labels = _elements(driver.page_source)
        return {"ok": True, "package": _package(driver), "elements": elements, "labels": labels}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "code": "SESSION_FAILED", "error": f"Could not read the screen: {_detail(e)}"}
    finally:
        _quit(driver)


def do_execute(p):
    started = time.monotonic()
    deadline = started + float(p.get("budget", 150))
    try:
        driver = _start(p)
    except SetupError as e:
        return {"ok": False, "code": e.code, "error": str(e)}

    plan = p["plan"]
    logs, status, error, shot = [], "PASSED", None, None
    ctx = {"pkg": "", "rotated": False}
    try:
        time.sleep(2)
        ctx["pkg"] = _package(driver) or p.get("app_package") or ""
        logs.append(f"Started the app ({ctx['pkg'] or 'unknown package'})")

        for i, act in enumerate(plan, 1):
            label = act.get("desc") or act["action"]
            if time.monotonic() > deadline:
                status, error = "ERROR", "The test ran out of time"
                logs.append(f"\u2717 {error}")
                break
            try:
                _act(driver, act, ctx, 8)
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
                status, error = "ERROR", f"Step {i} ({label}) failed: {_detail(e)}"
                logs.append(f"\u2717 {error}")
                break

        if status != "PASSED":
            try:
                shot = driver.get_screenshot_as_base64()
            except Exception:  # noqa: BLE001
                shot = None
        final = _package(driver)
    finally:
        if ctx["rotated"]:
            try:
                driver.orientation = "PORTRAIT"
            except Exception:  # noqa: BLE001
                pass
        _quit(driver)

    return {
        "ok": True,
        "status": status,
        "error": error,
        "logs": logs,
        "final_package": final,
        "screenshot_b64": shot,
        "duration_ms": int((time.monotonic() - started) * 1000),
    }


MODES = {"snapshot": do_snapshot, "execute": do_execute}


def main():
    try:
        payload = json.loads(sys.stdin.read())
        result = MODES[payload["mode"]](payload)
    except Exception as e:  # noqa: BLE001
        result = {"ok": False, "code": "WORKER_ERROR", "error": f"{type(e).__name__}: {_detail(e)}"}
    sys.stdout.write("\n" + MARK + json.dumps(result) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()