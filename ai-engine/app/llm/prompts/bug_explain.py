import json
from typing import Any, Optional

SYSTEM_PROMPT = """You are a senior QA engineer who explains failed automated tests to developers in plain language.

Rules:
- Use ONLY the evidence provided. Do not invent code, files or causes that the evidence does not support.
- Say what was expected, what actually happened, and the most likely reason. If the evidence is thin, say the cause is uncertain.
- recommended_fix: 1 to 3 concrete sentences a developer can act on. No code blocks.
- title: a short bug title (max 90 characters) describing the defect in the application, not the test.
- confidence: an integer from 0 to 100 for how well the evidence supports your explanation. Lower it when you are guessing.
- Respond with JSON only, in exactly this shape:
{"title":"...","explanation":"...","recommended_fix":"...","confidence":70}"""


def _clip(text: Optional[str], n: int) -> str:
    t = (text or "").strip()
    return t if len(t) <= n else t[:n] + "..."


def _tail(text: Optional[str], n: int) -> str:
    t = (text or "").strip()
    return t if len(t) <= n else "..." + t[-n:]


def build_explain_messages(
    *,
    title: str,
    module: Optional[str],
    test_type: str,
    steps: list[str],
    expected_result: Optional[str],
    error_message: Optional[str],
    logs: Optional[str],
    response: Optional[dict[str, Any]],
) -> list[dict]:
    lines = [f"TEST: {_clip(title, 200)}", f"TYPE: {test_type}"]
    if module:
        lines.append(f"FEATURE AREA: {module}")
    if steps:
        lines.append("STEPS:")
        lines += [f"{i}. {_clip(s, 200)}" for i, s in enumerate(steps[:15], 1)]
    lines.append(f"EXPECTED RESULT: {_clip(expected_result, 400) or 'not specified'}")
    lines.append(f"FAILURE MESSAGE: {_clip(error_message, 500) or 'none'}")

    resp = response or {}
    req, res = resp.get("request"), resp.get("response")
    if isinstance(req, dict):
        lines.append(f"HTTP REQUEST: {req.get('method')} {req.get('url')}")
        if req.get("body") is not None:
            lines.append("REQUEST BODY: " + _clip(json.dumps(req["body"], default=str), 400))
    if isinstance(res, dict):
        lines.append(f"HTTP RESPONSE STATUS: {res.get('status')}")
        lines.append("RESPONSE BODY: " + _clip(str(res.get("body") or ""), 600))
    if resp.get("final_url"):
        lines.append(f"FINAL PAGE URL: {resp['final_url']}")
    if resp.get("page_errors"):
        lines.append("PAGE JAVASCRIPT ERRORS: " + _clip("; ".join(map(str, resp["page_errors"][:3])), 400))
    if logs:
        lines.append("EXECUTION LOG (end):\n" + _tail(logs, 1200))
    lines.append("\nReturn the JSON now.")

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(lines)},
    ]