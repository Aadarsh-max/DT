import json
from typing import Any, Optional

from app.llm.router import run_llm
from app.utils.json_repair import extract_items
from app.utils.logger import get_logger

log = get_logger("script-builder")

ALLOWED = {
    "goto", "click", "fill", "select", "check", "uncheck", "hover", "press", "wait",
    "expect_visible", "expect_not_visible", "expect_text", "expect_url", "expect_title",
}
NEED_TARGET = {"click", "fill", "select", "check", "uncheck", "hover", "expect_visible", "expect_not_visible"}
NEED_VALUE = {"goto", "fill", "select", "press", "expect_text", "expect_url", "expect_title"}
ROLES = {
    "button", "link", "textbox", "checkbox", "radio", "combobox", "heading", "tab", "menuitem",
    "option", "searchbox", "switch", "img", "listitem", "alert", "dialog", "navigation",
}
BYS = {"role", "label", "placeholder", "text", "css", "testid"}
MAX_ACTIONS = 40

SYSTEM = """You convert ONE manual web test case into a list of browser actions for Playwright.

Respond with JSON only, in exactly this shape:
{"actions":[{"action":"fill","target":{"by":"label","value":"Email"},"value":"a@b.com","desc":"Type the email"}]}

Allowed actions:
- goto (value = a path such as "/login", or a full URL)
- click, hover, check, uncheck (need target)
- fill, select (need target and value)
- press (value = a key such as "Enter"; target optional)
- wait (value = milliseconds, max 3000)
- expect_visible, expect_not_visible (need target)
- expect_text (value = text that must appear on the page)
- expect_url (value = text the URL must contain)
- expect_title (value = text the page title must contain)

target.by is one of: role, label, placeholder, text, css, testid.
- role also needs "role" (button, link, textbox, checkbox, radio, combobox, heading, tab, menuitem) and "value" = the visible name.
- label = the visible field label. placeholder = the placeholder text. text = visible text.
- Prefer names that appear in PAGE ELEMENTS. Use css only when nothing else fits.

Rules:
- The start page is already open. Do not begin with goto unless the test needs a different page.
- Keep the order of the steps, one action per step.
- Use values from TEST DATA when given, otherwise realistic values that fit the test.
- End with 1 to 3 expect_* actions that check the EXPECTED RESULT. Only check text, URLs or elements the expected result states or clearly implies. expect_text values must be 1 to 4 words that would appear verbatim on the page.
- desc is a short description, at most 10 words."""

ROLE_OF = {"a": "link", "button": "button", "textarea": "textbox", "select": "combobox"}


class ScriptError(Exception):
    """The AI could not produce a usable script."""


def _role_guess(el: dict) -> str:
    tag, typ = el.get("tag"), (el.get("type") or "").lower()
    if el.get("role"):
        return el["role"]
    if tag == "input":
        if typ in ("submit", "button", "reset"):
            return "button"
        if typ in ("checkbox", "radio"):
            return typ
        return "textbox"
    return ROLE_OF.get(tag, tag or "element")


def format_elements(snap: dict, limit: int = 40) -> str:
    lines = []
    if snap.get("title"):
        lines.append(f'Page title: "{snap["title"][:80]}"')
    if snap.get("headings"):
        lines.append("Headings: " + "; ".join(h[:60] for h in snap["headings"][:4]))
    for el in (snap.get("elements") or [])[:limit]:
        parts = [_role_guess(el)]
        if el.get("text"):
            parts.append(f'"{el["text"][:50]}"')
        if el.get("label") and el.get("label") != el.get("text"):
            parts.append(f'label="{el["label"][:50]}"')
        if el.get("placeholder"):
            parts.append(f'placeholder="{el["placeholder"][:40]}"')
        if el.get("href"):
            parts.append(f"href={el['href'][:50]}")
        lines.append("- " + " ".join(parts))
    return "\n".join(lines) or "(no interactive elements were found)"


def _messages(
    *, title, steps, preconditions, expected_result, test_data, base_url, snapshot, reminder=""
) -> list[dict]:
    lines = [f"TEST CASE: {title}"]
    if preconditions:
        lines.append(f"PRECONDITIONS: {preconditions[:300]}")
    lines.append("STEPS:")
    lines += [f"{i}. {s[:200]}" for i, s in enumerate(steps[:20], 1)]
    lines.append(f"EXPECTED RESULT: {(expected_result or 'not specified')[:300]}")
    if test_data:
        lines.append(f"TEST DATA: {json.dumps(test_data)[:400]}")
    lines.append(f"START PAGE: {base_url}")
    lines.append("PAGE ELEMENTS:\n" + format_elements(snapshot))
    lines.append("\nReturn the JSON now. " + reminder + "/no_think")
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "\n".join(lines)}]


def _norm_target(t: Any) -> Optional[dict]:
    if isinstance(t, str):
        t = {"by": "text", "value": t}
    if not isinstance(t, dict):
        return None
    value = t.get("value") or t.get("name") or t.get("text") or t.get("selector") or t.get("label")
    value = str(value).strip() if value is not None else ""
    if not value:
        return None
    by = str(t.get("by") or t.get("type") or "text").lower()
    role = str(t.get("role") or "").lower()
    if by not in BYS:
        by = "text"
    if by == "role" and role not in ROLES:
        by, role = "text", ""
    out = {"by": by, "value": value[:200]}
    if by == "role":
        out["role"] = role
    return out


def sanitize(raw: list[dict]) -> tuple[list[dict], list[str]]:
    plan: list[dict] = []
    warnings: list[str] = []
    for i, item in enumerate(raw, 1):
        action = str(item.get("action", "")).strip().lower()
        if action not in ALLOWED:
            warnings.append(f"Dropped unknown action #{i}: {action or '(empty)'}")
            continue

        target = _norm_target(item.get("target") if "target" in item else item.get("selector"))
        value = item.get("value")
        value = str(value).strip() if value is not None else ""

        if action in NEED_TARGET and target is None:
            warnings.append(f"Dropped {action} #{i}: no target")
            continue
        if action in NEED_VALUE and value == "" and action != "fill":
            warnings.append(f"Dropped {action} #{i}: no value")
            continue
        if action == "goto" and "://" in value and not value.lower().startswith(("http://", "https://")):
            warnings.append(f"Dropped goto #{i}: unsupported address")
            continue

        entry: dict = {"action": action, "desc": str(item.get("desc") or action)[:80]}
        if target is not None and (action in NEED_TARGET or action == "press"):
            entry["target"] = target
        if action in NEED_VALUE or action == "wait":
            entry["value"] = value[:300]
        plan.append(entry)

    return plan[:MAX_ACTIONS], warnings


def has_assertion(plan: list[dict]) -> bool:
    return any(a["action"].startswith("expect_") for a in plan)


async def build_plan(
    *,
    title: str,
    steps: list[str],
    preconditions: Optional[str],
    expected_result: Optional[str],
    test_data: Optional[dict],
    base_url: str,
    snapshot: dict,
) -> tuple[list[dict], list[str]]:
    reminder = ""
    warnings: list[str] = []
    for attempt in (1, 2):
        messages = _messages(
            title=title, steps=steps, preconditions=preconditions,
            expected_result=expected_result, test_data=test_data,
            base_url=base_url, snapshot=snapshot, reminder=reminder,
        )
        result = await run_llm(
            "script", messages, json_mode=True,
            temperature=0.1 if attempt == 1 else 0.4, max_tokens=1500,
        )
        plan, warnings = sanitize(extract_items(result.text, key="actions"))
        if plan and has_assertion(plan):
            log.info("Plan for '%s': %d actions via %s", title[:50], len(plan), result.provider)
            return plan, warnings
        reminder = "The previous answer was unusable or had no expect_* action. Include at least one. "

    raise ScriptError(
        "The AI could not turn these steps into a runnable script with a check for the expected result. "
        "Try editing the test case to be more specific."
    )