import base64
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.llm.prompts.report import build_report_messages
from app.llm.router import run_llm
from app.reports.insights import build_caveats, clean_sections, compute_health, fallback_sections
from app.reports.pdf_builder import build_html, render_pdf
from app.runners import playwright_runner as pw
from app.schemas.report import ReportBody, ReportResponse, ReportSections
from app.utils.json_repair import loads_lenient
from app.utils.logger import get_logger

log = get_logger("report")
router = APIRouter(prefix="/report", tags=["report"])


@router.post("/generate", response_model=ReportResponse)
async def generate(body: ReportBody) -> ReportResponse:
    facts = body.facts
    if not isinstance(facts.get("run"), dict):
        raise HTTPException(422, "The report data is missing the run summary.")

    health = compute_health(facts)
    caveats = build_caveats(facts)

    warnings: list[str] = []
    sections: Optional[dict] = None
    provider = model = None

    try:
        result = await run_llm(
            "report",
            build_report_messages(facts, health, caveats),
            json_mode=True,
            temperature=0.3,
            max_tokens=1200,
        )
        sections = clean_sections(loads_lenient(result.text))
        if sections:
            provider, model = result.provider, result.model
        else:
            warnings.append("The model returned no usable summary, so a rule-based summary was used.")
    except Exception as e:  # noqa: BLE001  (missing key, rate limits, bad JSON)
        log.warning("Report narrative failed: %s", e)
        warnings.append(f"The AI narrative failed ({str(e)[:160]}), so a rule-based summary was used.")

    ai_written = sections is not None
    if sections is None:
        sections = fallback_sections(facts, health)

    html = build_html(
        title=body.title,
        facts=facts,
        sections=sections,
        health=health,
        caveats=caveats,
        provider=provider,
        model=model,
        ai_written=ai_written,
    )
    try:
        pdf = await render_pdf(html)
    except pw.BrowserUnavailable as e:
        raise HTTPException(503, str(e)) from e
    except pw.BrowserError as e:
        raise HTTPException(502, str(e)) from e

    log.info("Report '%s': %d KB, narrative via %s", body.title[:40], len(pdf) // 1024, provider or "rules")
    return ReportResponse(
        sections=ReportSections(**sections),
        health=health,
        caveats=caveats,
        ai_written=ai_written,
        provider=provider,
        model=model,
        warnings=warnings,
        pdf_b64=base64.b64encode(pdf).decode("ascii"),
    )