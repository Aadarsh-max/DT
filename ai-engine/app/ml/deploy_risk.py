"""Deployment failure risk.

This is a transparent heuristic, NOT a trained forecast: there is no production outcome data to
learn from. Every term below is shown to the user together with its effect."""
import math
from typing import Any

from app.reports.insights import to_float, to_int

BASE = -2.5  # a spotless run still carries a small residual risk (about 8%)


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def _level(p: float) -> tuple[str, str]:
    if p < 0.20:
        return "low", "Low risk"
    if p < 0.45:
        return "moderate", "Moderate risk"
    if p < 0.70:
        return "high", "High risk"
    return "veryhigh", "Very high risk"


def estimate(f: dict[str, Any]) -> dict[str, Any]:
    executed = to_int(f.get("executed"))
    if executed <= 0:
        return {
            "level": "nodata",
            "label": "No data",
            "probability": None,
            "confidence": "none",
            "factors": [],
            "positives": [],
            "notes": ["No test was executed in this run, so there is nothing to base an estimate on."],
            "method": "heuristic",
        }

    failed, errors = to_int(f.get("failed")), to_int(f.get("errors"))
    bugs = f.get("openBugs") if isinstance(f.get("openBugs"), dict) else {}
    crit, high = to_int(bugs.get("CRITICAL")), to_int(bugs.get("HIGH"))
    cov = to_float(f["coverage"]) if f.get("coverage") is not None else None
    cur, prev = f.get("passRate"), f.get("previousPassRate")
    drop = max(0.0, to_float(prev) - to_float(cur)) / 100.0 if cur is not None and prev is not None else 0.0
    failed_share, error_share = failed / executed, errors / executed

    terms = [
        ("failed", "Failed tests", 4.0 * failed_share, f"{failed} of {executed} executed tests failed"),
        ("errors", "Tests that could not run", 1.5 * error_share, f"{errors} of {executed} tests ended in Error"),
        ("critical", "Open critical bugs", 0.9 * min(crit, 3), f"{crit} open critical bug(s) in the project"),
        ("high", "Open high severity bugs", 0.35 * min(high, 4), f"{high} open high severity bug(s) in the project"),
        (
            "coverage",
            "Low test coverage",
            0.02 * max(0.0, 70.0 - cov) if cov is not None else 0.0,
            f"Coverage is {cov:.0f}%" if cov is not None else "",
        ),
        ("trend", "Pass rate dropped", 2.0 * drop, f"Pass rate fell {drop * 100:.1f} points since the previous run"),
    ]

    z = BASE + sum(t[2] for t in terms)
    p = _sigmoid(z)

    factors = []
    for key, label, value, detail in terms:
        points = (p - _sigmoid(z - value)) * 100  # what this factor adds, in percentage points
        if points >= 0.5:
            factors.append({"key": key, "label": label, "detail": detail, "points": round(points, 1)})
    factors.sort(key=lambda x: -x["points"])

    positives = []
    if failed == 0:
        positives.append("No failed tests in this run")
    if crit == 0 and high == 0:
        positives.append("No open critical or high severity bugs")
    if cov is not None and cov >= 80:
        positives.append(f"Coverage is {cov:.0f}%")
    if cur is not None and prev is not None and drop == 0:
        positives.append("The pass rate did not drop since the previous run")

    runs = to_int(f.get("runsAnalysed"))
    notes: list[str] = []
    if error_share >= 0.5:
        confidence = "low"
        notes.append(f"{errors} of {executed} tests could not run, so this estimate is unreliable.")
    elif executed < 10:
        confidence = "low"
        notes.append(f"Only {executed} test(s) were executed, so this estimate is rough.")
    elif executed < 30 or runs < 3:
        confidence = "medium"
    else:
        confidence = "high"

    level, label = _level(p)
    return {
        "level": level,
        "label": label,
        "probability": round(p * 100, 1),
        "confidence": confidence,
        "factors": factors,
        "positives": positives,
        "notes": notes,
        "method": "heuristic",
    }