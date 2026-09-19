import re
import time
from typing import Any, Optional

import httpx

METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
KEEP_HEADERS = ("content-type", "content-length", "location", "cache-control", "server", "x-request-id")
BODY_LIMIT = 4000
OK, BAD = "\u2713", "\u2717"


def _first(d: dict, *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


def normalize(test_data: Optional[dict]) -> dict:
    d = test_data if isinstance(test_data, dict) else {}
    headers = _first(d, "headers")
    return {
        "method": str(_first(d, "method", "http_method") or "").strip().upper(),
        "endpoint": _first(d, "endpoint", "url", "path"),
        "headers": headers if isinstance(headers, dict) else {},
        "body": _first(d, "body", "payload", "json", "request_body"),
        "expected_status": _first(d, "expected_status", "expected_status_code", "status", "status_code"),
        "expected_contains": _first(d, "expected_contains", "expected_body_contains", "contains"),
    }


def _statuses(v: Any) -> Optional[list[int]]:
    if v is None:
        return None
    out = []
    for x in v if isinstance(v, (list, tuple)) else [v]:
        try:
            out.append(int(x))
        except (TypeError, ValueError):
            pass
    return out or None


def _url(base_url: Optional[str], endpoint: str) -> Optional[str]:
    if re.match(r"^https?://", endpoint, re.I):
        return endpoint
    if not base_url:
        return None
    return base_url.rstrip("/") + "/" + endpoint.lstrip("/")


def _mask(headers: dict) -> dict:
    return {
        k: ("***" if k.lower() in ("authorization", "cookie", "x-api-key") else v)
        for k, v in headers.items()
    }


async def run_api_case(
    *, base_url: Optional[str], test_data: Optional[dict], auth_token: Optional[str] = None
) -> dict:
    started = time.monotonic()
    logs: list[str] = []

    def done(status: str, error: Optional[str] = None, response: Optional[dict] = None) -> dict:
        return {
            "status": status,
            "duration_ms": int((time.monotonic() - started) * 1000),
            "error_message": error,
            "logs": logs,
            "screenshot_b64": None,
            "response": response,
        }

    c = normalize(test_data)
    if not c["endpoint"] or not c["method"]:
        msg = "No method and endpoint in this test case's test data. Edit the test case and add them."
        logs.append(f"- Skipped: {msg}")
        return done("SKIPPED", msg)
    if c["method"] not in METHODS:
        return done("ERROR", f"Unsupported HTTP method: {c['method']}")

    endpoint = str(c["endpoint"]).strip()
    if "{" in endpoint or re.search(r"/:[A-Za-z_]", endpoint):
        msg = "The endpoint contains a placeholder such as {id}. Edit the test case and use a real value."
        logs.append(f"- Skipped: {msg}")
        return done("SKIPPED", msg)

    url = _url(base_url, endpoint)
    if not url:
        return done("ERROR", "No API base URL was provided for a relative endpoint")

    headers = {str(k): str(v) for k, v in c["headers"].items()}
    if auth_token and not any(k.lower() == "authorization" for k in headers):
        headers["Authorization"] = f"Bearer {auth_token}"

    kwargs: dict = {"headers": headers}
    body = c["body"]
    if isinstance(body, (dict, list)):
        kwargs["json"] = body
    elif body is not None:
        kwargs["content"] = str(body)

    request = {
        "method": c["method"],
        "url": url,
        "headers": _mask(headers),
        "body": body if isinstance(body, (dict, list)) else (str(body)[:1000] if body is not None else None),
    }
    logs.append(f"\u2192 {c['method']} {url}")

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=8.0), follow_redirects=False
        ) as client:
            t0 = time.monotonic()
            r = await client.request(c["method"], url, **kwargs)
            elapsed = int((time.monotonic() - t0) * 1000)
    except httpx.ConnectError:
        msg = f"Could not connect to {url}. Is the server running?"
        logs.append(f"{BAD} {msg}")
        return done("ERROR", msg, {"request": request})
    except httpx.TimeoutException:
        msg = "The request timed out after 20 seconds"
        logs.append(f"{BAD} {msg}")
        return done("ERROR", msg, {"request": request})
    except (httpx.HTTPError, httpx.InvalidURL) as e:
        msg = f"Request failed: {type(e).__name__}: {str(e)[:150]}"
        logs.append(f"{BAD} {msg}")
        return done("ERROR", msg, {"request": request})

    text = r.text
    response = {
        "status": r.status_code,
        "elapsed_ms": elapsed,
        "headers": {k: r.headers[k] for k in KEEP_HEADERS if k in r.headers},
        "body": text[:BODY_LIMIT],
        "truncated": len(text) > BODY_LIMIT,
    }
    logs.append(f"\u2190 {r.status_code} in {elapsed} ms")

    problems: list[str] = []
    expected = _statuses(c["expected_status"])
    if expected:
        ok = r.status_code in expected
        shown = ", ".join(map(str, expected))
        logs.append(f"{OK if ok else BAD} Status {r.status_code} (expected {shown})")
        if not ok:
            problems.append(f"Expected status {shown} but got {r.status_code}")
    else:
        ok = 200 <= r.status_code < 300
        logs.append(f"{OK if ok else BAD} Status {r.status_code} (no expected status given, so 2xx is expected)")
        if not ok:
            problems.append(f"Got status {r.status_code}, expected a 2xx response")

    needles = c["expected_contains"]
    if needles is not None:
        for needle in needles if isinstance(needles, list) else [needles]:
            found = str(needle).lower() in text.lower()
            logs.append(f'{OK if found else BAD} Body contains "{needle}"')
            if not found:
                problems.append(f'Response body does not contain "{needle}"')

    if problems:
        return done("FAILED", "; ".join(problems), {"request": request, "response": response})
    return done("PASSED", None, {"request": request, "response": response})