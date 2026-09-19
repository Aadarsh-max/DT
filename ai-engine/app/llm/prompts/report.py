import json

SYSTEM_PROMPT = """You are a senior QA lead writing the narrative of a test report for project stakeholders (managers and clients), not engineers.

Rules:
- Use ONLY the figures in FACTS. Never invent numbers, features, causes or dates. If something is not in FACTS, do not mention it.
- "Error" results mean a test could not be carried out (for example an element was not found). They are NOT application defects and NOT bugs. Mention them separately.
- Do not repeat tables. Interpret: what the numbers mean, what matters most, what to do next.
- Plain, professional language. No markdown and no bullet characters inside the strings.
- executive_summary: 3 to 5 sentences.
- key_findings: 3 to 5 short strings. risks: 0 to 4 short strings (an empty list if the facts support none). recommendations: 3 to 5 short, actionable strings.
- When many tests ended in Error, or a target URL is given that may not match the requirements, say the most likely cause is that the tests ran against the wrong application, and recommend confirming the target URL first. Do not present failures from such a run as confirmed defects.
- Respond with JSON only, in exactly this shape:
{"executive_summary":"...","key_findings":["..."],"risks":["..."],"recommendations":["..."]}"""


def _trim(facts: dict) -> dict:
    f = {k: v for k, v in facts.items() if k != "generatedAt"}
    f["byModule"] = (facts.get("byModule") or [])[:8]
    bugs = dict(facts.get("bugs") or {})
    bugs["items"] = (bugs.get("items") or [])[:8]
    f["bugs"] = bugs
    f["failures"] = [
        {**x, "message": str(x.get("message") or "")[:160]} for x in (facts.get("failures") or [])[:10]
    ]
    return f


def build_report_messages(facts: dict, health: dict, caveats: list[str]) -> list[dict]:
    lines = [f"OVERALL HEALTH (rule-based): {health['label']}. " + " ".join(health.get("reasons", []))]
    if caveats:
        lines.append("CAVEATS: " + " ".join(caveats))
    lines.append("FACTS:\n" + json.dumps(_trim(facts), separators=(",", ":"), default=str))
    lines.append("\nReturn the JSON now.")
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(lines)},
    ]