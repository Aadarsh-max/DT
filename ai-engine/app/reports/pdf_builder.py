import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.reports.insights import to_float, to_int
from app.runners import playwright_runner as pw

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

HEALTH_COLOR = {
    "healthy": "#16a34a",
    "attention": "#d97706",
    "risk": "#dc2626",
    "inconclusive": "#6b7280",
    "nodata": "#6b7280",
}
RADIUS = 54
CIRC = 2 * math.pi * RADIUS


def _pct(v) -> str:
    return "—" if v is None else f"{to_float(v):.1f}%"


def _when(iso: Optional[str]) -> str:
    if not iso:
        return "—"
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00")).strftime("%d %b %Y, %H:%M UTC")
    except ValueError:
        return str(iso)


def _rows(rows) -> list[dict]:
    out = []
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        total = max(to_int(r.get("total")), 1)
        passed, failed = to_int(r.get("passed")), to_int(r.get("failed"))
        errors, skipped = to_int(r.get("errors")), to_int(r.get("skipped"))
        out.append(
            {
                "name": str(r.get("name") or "General"),
                "total": to_int(r.get("total")),
                "passed": passed,
                "failed": failed,
                "errors": errors,
                "skipped": skipped,
                "rate": _pct(r.get("passRate")),
                "w_passed": round(passed / total * 100, 1),
                "w_failed": round(failed / total * 100, 1),
                "w_errors": round(errors / total * 100, 1),
                "w_skipped": round(skipped / total * 100, 1),
            }
        )
    return out


def _arcs(run: dict) -> list[dict]:
    parts = [
        ("Passed", to_int(run.get("passed")), "#22c55e"),
        ("Failed", to_int(run.get("failed")), "#ef4444"),
        ("Error", to_int(run.get("errors")), "#f59e0b"),
        ("Skipped", to_int(run.get("skipped")), "#9ca3af"),
    ]
    total = sum(v for _, v, _ in parts)
    arcs, offset = [], 0.0
    for label, value, color in parts:
        length = (value / total * CIRC) if total else 0.0
        arcs.append(
            {
                "label": label,
                "value": value,
                "color": color,
                "len": f"{length:.2f}",
                "gap": f"{CIRC - length:.2f}",
                "offset": f"{-offset:.2f}",
            }
        )
        offset += length
    return arcs


def build_html(
    *,
    title: str,
    facts: dict,
    sections: dict,
    health: dict,
    caveats: list[str],
    provider: Optional[str],
    model: Optional[str],
    ai_written: bool,
) -> str:
    run = facts.get("run") if isinstance(facts.get("run"), dict) else {}
    project = facts.get("project") if isinstance(facts.get("project"), dict) else {}
    prev = facts.get("previous") if isinstance(facts.get("previous"), dict) else None
    bugs = facts.get("bugs") if isinstance(facts.get("bugs"), dict) else {}
    sev = bugs.get("bySeverity") if isinstance(bugs.get("bySeverity"), dict) else {}

    note = None
    if prev and prev.get("passRate") is not None and run.get("passRate") is not None:
        note = f"{to_float(run['passRate']) - to_float(prev['passRate']):+.1f} pts vs {prev.get('code', 'previous run')}"

    coverage = run.get("coverage")
    kpis = [
        {"label": "Pass rate", "value": _pct(run.get("passRate")), "note": note},
        {"label": "Executed", "value": to_int(run.get("executed")), "note": f"of {to_int(run.get('total'))} planned"},
        {"label": "Passed", "value": to_int(run.get("passed")), "note": None},
        {"label": "Failed", "value": to_int(run.get("failed")), "note": "a check did not hold"},
        {"label": "Errors", "value": to_int(run.get("errors")), "note": "could not be carried out"},
        {"label": "Skipped", "value": to_int(run.get("skipped")), "note": None},
        {"label": "Bugs found", "value": to_int(bugs.get("total")), "note": None},
        {"label": "Coverage", "value": _pct(coverage) if coverage is not None else "—", "note": None},
    ]

    bug_items = [b for b in (bugs.get("items") or []) if isinstance(b, dict)]
    bug_rows = [
        {
            "code": b.get("code", ""),
            "title": str(b.get("title", ""))[:110],
            "severity": str(b.get("severity", "MEDIUM")),
            "status": str(b.get("status", "")),
            "module": b.get("module") or "—",
        }
        for b in bug_items[:10]
    ]
    bug_total = to_int(bugs.get("total"))

    failures = [f for f in (facts.get("failures") or []) if isinstance(f, dict)]
    failure_rows = [
        {
            "title": str(f.get("title", ""))[:110],
            "type": str(f.get("type", "")),
            "status": str(f.get("status", "")),
            "message": str(f.get("message") or "")[:200],
        }
        for f in failures[:12]
    ]
    failure_total = to_int(run.get("failed")) + to_int(run.get("errors"))

    template = _env.get_template("report.html")
    return template.render(
        title=title,
        project_name=project.get("name", ""),
        run=run,
        run_when=_when(run.get("startedAt")),
        health=health,
        health_color=HEALTH_COLOR.get(health.get("level"), "#6b7280"),
        kpis=kpis,
        caveats=caveats,
        sections=sections,
        arcs=_arcs(run),
        pass_rate=_pct(run.get("passRate")),
        by_type=_rows(facts.get("byType")),
        by_module=_rows(facts.get("byModule"))[:12],
        bug_rows=bug_rows,
        bug_total=bug_total,
        bug_more=max(0, bug_total - len(bug_rows)),
        sev_chips=[
            {"key": k, "label": k.title(), "count": to_int(sev.get(k))}
            for k in ("CRITICAL", "HIGH", "MEDIUM", "LOW")
            if to_int(sev.get(k))
        ],
        failure_rows=failure_rows,
        failure_more=max(0, failure_total - len(failure_rows)),
        generated=datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"),
        provider=provider,
        model=model,
        ai_written=ai_written,
    )


async def render_pdf(html: str) -> bytes:
    return await pw.render_pdf(html)