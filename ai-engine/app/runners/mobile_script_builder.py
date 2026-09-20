import json
import re
from typing import Any, Optional

from app.llm.router import run_llm
from app.utils.json_repair import extract_items
from app.utils.logger import get_logger

log = get_logger("mobile-script")

ALLOWED = {
    "tap", "long_press", "type", "clear", "swipe", "press", "rotate", "deeplink", "notifications", "wait",
    "expect_text", "expect_visible", "expect_not_visible", "expect_package",
}
NEED_TARGET = {"tap", "long_press", "type", "clear", "expect_visible", "expect_not_visible"}
NEED_VALUE = {"type", "swipe", "press", "rotate", "deeplink", "expect_text", "expect_package"}
KEYS = {"back", "home", "enter", "search", "tab", "delete", "menu", "recent"}
DIRECTIONS = {"up", "down", "left", "right"}
BY_ALIASES = {
    "text": "text", "label": "text", "role": "text", "name": "text",
    "desc": "desc", "content-desc": "desc", "description": "desc", "accessibility": "desc",
    "id": "id", "resource-id": "id", "resource_id": "id",
    "hint": "hint", "placeholder": "hint",
}
DEEPLINK = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*://\S{1,480}$")
ID_OK = re.compile(r"^[A-Za-z0-9_.:/$\-]{1,120}$")
MAX_ACTIONS = 40

SYSTEM = """You convert ONE manual Android app test case into a list of device actions for Appium.

Respond with JSON only, in exactly this shape:
{"actions":[{"action":"type","target":{"by":"hint","value":"Email"},"value":"a@b.com","desc":"Type the email"}]}

Allowed actions:
- tap, long_press, clear (need target)
- type (needs target and value)
- swipe (value = the finger direction: up, down, left or right; up scrolls the content down)
- press (value = back, home, enter, search, tab, delete, menu or recent)
- rotate (value = landscape or portrait)
- deeplink (value = the exact URI from the steps, for example myapp://cart)
- notifications (opens the notification shade)
- wait (value = milliseconds, max 3000)
- expect_visible, expect_not_visible (need target)
- expect_text (value = 1 to 4 words that appear on the screen)
- expect_package (value = the package name that must be in the foreground)

target.by is one of: text, desc, id, hint.
- text = the visible text of a button or label. desc = the accessibility description. hint = the placeholder of an input. id = a resource id from SCREEN ELEMENTS.
- Prefer names that appear in SCREEN ELEMENTS.

Rules:
- The app is already open on its first screen. Do not add a step that launches it.
- Keep the order of the steps, one action per step.
- Use values from TEST DATA when given, otherwise realistic values that fit the test.
- End with 1 to 3 expect_* actions that check the EXPECTED RESULT. Only check things the expected result states or clearly implies.
- desc is a short description, at most 10 words."""


class ScriptError(Exception):
    """The AI could not produce a usable script."""


def format_elements(snap: dict, limit: int = 40) -> str:
    lines = []
    for el in (snap.get("elements") or [])[:limit]:
        parts = [el.get("kind") or "element"]
        if el.get("text"):
            parts.append(f'"{el["text"][:50]}"')
        if el.get("desc"):
            parts.append(f'desc="{el["desc"][:50]}"')
        if el.get("hint"):
            parts.append(f'hint="{el["hint"][:40]}"')
        if el.get("id"):
            parts.append(f'id={el["id"][:40]}')
        lines.append("- " + " ".join(parts))
    if snap.get("labels"):
        lines.append("Other visible text: " + "; ".join(snap["labels"][:12]))
    return "\n".join(lines) or "(no elements were found on the first screen)"


def _messages(*, title, steps, preconditions, expected_result, test_data, package, snapshot, reminder="") -> list[dict]:
    lines = [f"TEST CASE: {title}"]
    if preconditions:
        lines.append(f"PRECONDITIONS: {preconditions[:300]}")
    lines.append("STEPS:")
    lines += [f"{i}. {s[:200]}" for i, s in enumerate(steps[:20], 1)]
    lines.append(f"EXPECTED RESULT: {(expected_result or 'not specified')[:300]}")
    if test_data:
        lines.append(f"TEST DATA: {json.dumps(test_data)[:400]}")
    lines.append(f"APP PACKAGE: {package or 'unknown'}")
    lines.append("SCREEN ELEMENTS (first screen):\n" + format_elements(snapshot))
    lines.append("\nReturn the JSON now. " + reminder + "/no_think")
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "\n".join(lines)}]


def _norm_target(t: Any) -> Optional[dict]:
    if isinstance(t, str):
        t = {"by": "text", "value": t}
    if not isinstance(t, dict):
        return None
    value = t.get("value") or t.get("name") or t.get("text") or t.get("label") or t.get("selector")
    value = re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""
    if not value:
        return None
    by = BY_ALIASES.get(str(t.get("by") or t.get("type") or "text").lower(), "text")
    if by == "id" and not ID_OK.match(value):
        return None
    return {"by": by, "value": value[:200]}


def sanitize(raw: list[dict]) -> tuple[list[dict], list[str]]:
    plan: list[dict] = []
    warnings: list[str] = []
    for i, item in enumerate(raw, 1):
        action = str(item.get("action", "")).strip().lower()
        if action not in ALLOWED:
            warnings.append(f"Dropped unknown action #{i}: {action or '(empty)'}")
            continue

        target = _norm_target(item.get("target"))
        value = item.get("value")
        value = str(value).strip() if value is not None else ""

        if action in NEED_TARGET and target is None:
            warnings.append(f"Dropped {action} #{i}: no target")
            continue
        if action in NEED_VALUE and not value:
            warnings.append(f"Dropped {action} #{i}: no value")
            continue
        if action == "press" and value.lower() not in KEYS:
            warnings.append(f"Dropped press #{i}: unknown key")
            continue
        if action == "swipe" and value.lower() not in DIRECTIONS:
            warnings.append(f"Dropped swipe #{i}: bad direction")
            continue
        if action == "rotate" and value.lower() not in ("landscape", "portrait"):
            warnings.append(f"Dropped rotate #{i}: bad orientation")
            continue
        if action == "deeplink" and not DEEPLINK.match(value):
            warnings.append(f"Dropped deeplink #{i}: not a valid URI")
            continue

        entry: dict = {"action": action, "desc": str(item.get("desc") or action)[:80]}
        if action in NEED_TARGET:
            entry["target"] = target
        if action in NEED_VALUE or action == "wait":
            entry["value"] = value.lower() if action in ("press", "swipe", "rotate") else value[:500]
        plan.append(entry)

    return plan[:MAX_ACTIONS], warnings


def has_assertion(plan: list[dict]) -> bool:
    return any(a["action"].startswith("expect_") for a in plan)


async def build_plan(
    *, title, steps, preconditions, expected_result, test_data, package, snapshot
) -> tuple[list[dict], list[str]]:
    reminder = ""
    for attempt in (1, 2):
        result = await run_llm(
            "script",
            _messages(
                title=title, steps=steps, preconditions=preconditions, expected_result=expected_result,
                test_data=test_data, package=package, snapshot=snapshot, reminder=reminder,
            ),
            json_mode=True,
            temperature=0.1 if attempt == 1 else 0.4,
            max_tokens=1500,
        )
        plan, warnings = sanitize(extract_items(result.text, key="actions"))
        if plan and has_assertion(plan):
            log.info("Mobile plan for '%s': %d actions via %s", title[:50], len(plan), result.provider)
            return plan, warnings
        reminder = "The previous answer was unusable or had no expect_* action. Include at least one. "

    raise ScriptError(
        "The AI could not turn these steps into a runnable script with a check for the expected result. "
        "Try editing the test case to be more specific."
    )