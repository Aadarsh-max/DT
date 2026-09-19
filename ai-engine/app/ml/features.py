import re
from typing import Any, Optional

TYPES = ["FUNCTIONAL", "BOUNDARY", "NEGATIVE", "SECURITY", "API"]
PRIORITY = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}

CRITICAL_MODULES = (
    "login", "auth", "password", "payment", "checkout", "admin", "session", "order", "security", "account",
)
SECURITY_WORDS = (
    "sql", "injection", "xss", "csrf", "token", "unauthor", "forbidden", "bypass", "lockout", "locked",
    "brute", "password", "session", "permission", "role", "privilege", "expire", "exposes", "without",
)
MONEY_WORDS = ("payment", "checkout", "order", "price", "total", "refund", "charge", "cart", "invoice")
CRASH_WORDS = (
    "exception", "crash", "traceback", "internal server", "server error", "timeout", "timed out",
    "undefined", "null",
)
COSMETIC_WORDS = (
    "typo", "wording", "tooltip", "footer", "banner", "heading", "format", "colour", "color", "spacing",
    "theme", "differs", "alignment", "wraps", "cut off", "layout", "page title",
)

FEATURE_NAMES = [f"type_{t.lower()}" for t in TYPES] + [
    "priority",
    "is_api",
    "critical_module",
    "security_words",
    "money_words",
    "http_5xx",
    "http_4xx",
    "status_mismatch",
    "crash_words",
    "cosmetic_words",
    "step_count",
    "page_errors",
]

_STATUS_PATTERNS = (re.compile(r"but got (\d{3})"), re.compile(r"got status (\d{3})"))


def _has(text: str, words: tuple[str, ...]) -> bool:
    return any(w in text for w in words)


def http_status(b: dict[str, Any]) -> Optional[int]:
    raw = b.get("http_status")
    if raw:
        try:
            return int(raw)
        except (TypeError, ValueError):
            pass
    error = str(b.get("error") or "").lower()
    for pattern in _STATUS_PATTERNS:
        m = pattern.search(error)
        if m:
            return int(m.group(1))
    return None


def extract(b: dict[str, Any]) -> list[float]:
    """Turns one bug into a fixed-length numeric vector (see FEATURE_NAMES)."""
    title = f"{b.get('title') or ''} {b.get('module') or ''}".lower()
    error = str(b.get("error") or "").lower()
    both = f"{title} {error}"
    kind = str(b.get("type") or "FUNCTIONAL").upper()
    status = http_status(b)
    cosmetic = _has(title, COSMETIC_WORDS) or "page title to contain" in error

    return [
        *[1.0 if kind == t else 0.0 for t in TYPES],
        float(PRIORITY.get(str(b.get("priority") or "MEDIUM").upper(), 1)),
        1.0 if kind == "API" else 0.0,
        1.0 if _has(title, CRITICAL_MODULES) else 0.0,
        1.0 if _has(both, SECURITY_WORDS) else 0.0,
        1.0 if _has(title, MONEY_WORDS) else 0.0,
        1.0 if status and status >= 500 else 0.0,
        1.0 if status and 400 <= status < 500 else 0.0,
        1.0 if "expected status" in error else 0.0,
        1.0 if _has(both, CRASH_WORDS) else 0.0,
        1.0 if cosmetic else 0.0,
        min(float(b.get("steps") or 0), 10.0) / 10.0,
        min(float(b.get("page_errors") or 0), 3.0),
    ]