"""Rule-based parts of a report: health rating, caveats, a fallback summary, and cleaning of AI text.
Nothing here calls an AI model."""
from typing import Any, Optional


def to_int(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def to_float(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _run(facts: dict) -> dict:
    r = facts.get("run")
    return r if isinstance(r, dict) else {}


def _severity(facts: dict) -> dict:
    b = facts.get("bugs")
    sev = b.get("bySeverity") if isinstance(b, dict) else None
    return sev if isinstance(sev, dict) else {}


def compute_health(facts: dict) -> dict:
    run = _run(facts)
    executed = to_int(run.get("executed"))
    if executed == 0:
        return {"level": "nodata", "label": "No data", "reasons": ["No test was executed in this run."]}

    rate = to_float(run.get("passRate"))
    errors = to_int(run.get("errors"))
    sev = _severity(facts)
    crit, high = to_int(sev.get("CRITICAL")), to_int(sev.get("HIGH"))

    if errors / executed >= 0.5:
        return {
            "level": "inconclusive",
            "label": "Inconclusive",
            "reasons": [
                f"{errors} of {executed} tests could not be carried out, "
                "so this run says little about the application."
            ],
        }

    risk: list[str] = []
    attention: list[str] = []
    if rate < 60:
        risk.append(f"Pass rate is {rate:.1f}%, below 60%.")
    if crit:
        risk.append(f"{crit} critical bug(s) were found in this run.")
    if 60 <= rate < 85:
        attention.append(f"Pass rate is {rate:.1f}%, below 85%.")
    if high:
        attention.append(f"{high} high severity bug(s) were found in this run.")
    if errors / executed >= 0.3:
        attention.append(f"{errors} of {executed} tests could not be carried out.")

    if risk:
        return {"level": "risk", "label": "At risk", "reasons": risk + attention}
    if attention:
        return {"level": "attention", "label": "Needs attention", "reasons": attention}
    return {
        "level": "healthy",
        "label": "Healthy",
        "reasons": [f"Pass rate is {rate:.1f}% with no critical or high severity bugs."],
    }


def build_caveats(facts: dict) -> list[str]:
    run = _run(facts)
    executed = to_int(run.get("executed"))
    errors = to_int(run.get("errors"))
    skipped = to_int(run.get("skipped"))
    out: list[str] = []

    if executed and errors / executed >= 0.3:
        out.append(
            f"{errors} of {executed} executed tests ended in Error, which means the test could not be "
            "carried out (for example an element was not found). Errors are not counted as bugs. "
            "Check that the target URL matches the requirements the tests were written from."
        )
    if 0 < executed < 5:
        out.append(f"Only {executed} test(s) were executed, so the percentages are not very meaningful.")
    coverage = run.get("coverage")
    if coverage is not None and to_float(coverage) < 50:
        out.append(f"Coverage is {to_float(coverage):.1f}%: many test cases in the project were not part of this run.")
    if skipped:
        out.append(f"{skipped} test(s) were skipped (for example API cases without an endpoint in their test data).")
    return out


def fallback_sections(facts: dict, health: dict) -> dict:
    run = _run(facts)
    executed = to_int(run.get("executed"))
    total = to_int(run.get("total"))
    passed, failed = to_int(run.get("passed")), to_int(run.get("failed"))
    errors, skipped = to_int(run.get("errors")), to_int(run.get("skipped"))
    rate = to_float(run.get("passRate"))
    target = run.get("targetUrl")
    bugs = facts.get("bugs") if isinstance(facts.get("bugs"), dict) else {}
    sev = _severity(facts)

    parts = [f"Run {run.get('code', '')} executed {executed} of {total} test cases"]
    if target:
        parts[0] += f" against {target}"
    parts[0] += "."
    if executed:
        parts.append(
            f"{passed} passed, {failed} failed and {errors} could not be carried out, "
            f"a pass rate of {rate:.1f}%."
        )
    prev = facts.get("previous")
    if isinstance(prev, dict) and prev.get("passRate") is not None and executed:
        delta = rate - to_float(prev["passRate"])
        parts.append(f"That is {delta:+.1f} points compared with {prev.get('code', 'the previous run')}.")
    parts.append(f"Overall health is rated \"{health['label']}\".")

    findings: list[str] = []
    rows = [
        r for r in facts.get("byModule") or []
        if isinstance(r, dict) and r.get("passRate") is not None
    ]
    if rows:
        worst = min(rows, key=lambda r: to_float(r["passRate"]))
        if to_float(worst["passRate"]) < 100:
            findings.append(
                f"The weakest feature area is {worst.get('name')} with a {to_float(worst['passRate']):.1f}% pass rate."
            )
    bug_total = to_int(bugs.get("total"))
    if bug_total:
        listed = ", ".join(f"{to_int(sev.get(k))} {k.lower()}" for k in ("CRITICAL", "HIGH", "MEDIUM", "LOW") if sev.get(k))
        findings.append(f"{bug_total} bug(s) were recorded from this run" + (f" ({listed})." if listed else "."))
    if errors:
        findings.append(f"{errors} test(s) ended in Error and are not counted as application defects.")
    if not findings:
        findings.append("No failures or bugs were recorded in this run.")

    risks: list[str] = []
    if to_int(sev.get("CRITICAL")):
        risks.append(f"{to_int(sev.get('CRITICAL'))} critical bug(s) may block a release.")
    if to_int(sev.get("HIGH")):
        risks.append(f"{to_int(sev.get('HIGH'))} high severity bug(s) affect important behaviour.")
    if executed and errors / executed >= 0.3:
        risks.append("A large share of tests could not run, so real defects may be hidden.")

    recs: list[str] = []
    if bug_total:
        recs.append("Review the recorded bugs, starting with the highest severity.")
    if errors:
        recs.append("Check the tests that ended in Error: confirm the target URL and adjust the test steps.")
    if failed:
        recs.append("Investigate the failed tests listed in this report and fix the application or the test.")
    recs.append("Run the tests again after fixes to confirm the results.")

    return {
        "executive_summary": " ".join(parts),
        "key_findings": findings[:5],
        "risks": risks[:4],
        "recommendations": recs[:5],
    }


def _list(v: Any, limit: int, max_len: int = 300) -> list[str]:
    if isinstance(v, str):
        v = [v]
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for x in v:
        if isinstance(x, dict):
            x = " ".join(str(y) for y in x.values())
        s = str(x).strip()
        if s:
            out.append(s[:max_len])
    return out[:limit]


def clean_sections(data: Any) -> Optional[dict]:
    if not isinstance(data, dict):
        return None
    summary = str(data.get("executive_summary") or "").strip()
    if len(summary) < 20:
        return None
    return {
        "executive_summary": summary[:1500],
        "key_findings": _list(data.get("key_findings"), 5),
        "risks": _list(data.get("risks"), 4),
        "recommendations": _list(data.get("recommendations"), 5),
    }