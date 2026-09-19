import asyncio
import difflib
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException

from app.llm.prompts.bug_explain import build_explain_messages
from app.llm.prompts.code_fix import build_code_context, build_fix_messages
from app.llm.router import run_llm
from app.ml.severity_model import HAS_XGB, severity_model
from app.rag.faiss_store import validate_id
from app.rag.retriever import retrieve
from app.schemas.bug import AnalyzeResponse, BugInput, FixBody, FixResponse
from app.utils.json_repair import loads_lenient
from app.utils.logger import get_logger
from app.config import settings

log = get_logger("bugs")
router = APIRouter(prefix="/bugs", tags=["bugs"])


def _s(value: Any, limit: int) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        value = " ".join(str(v) for v in value)
    text = str(value).strip()
    return text[:limit] if text else None


def _normalize(b: BugInput) -> dict:
    resp = b.response or {}
    res = resp.get("response") if isinstance(resp.get("response"), dict) else {}
    return {
        "title": b.title,
        "module": b.module,
        "type": b.test_type,
        "priority": b.priority,
        "error": b.error_message,
        "steps": len(b.steps),
        "page_errors": len(resp.get("page_errors") or []),
        "http_status": res.get("status"),
    }


def _check_ids(*ids: str) -> None:
    try:
        for i in ids:
            validate_id(i)
    except ValueError as e:
        raise HTTPException(400, "Invalid project or requirement id") from e


@router.get("/status")
async def status() -> dict:
    return {
        "severity_source": severity_model.source,
        "xgboost_installed": HAS_XGB,
        "duplicate_threshold": settings.duplicate_threshold,
    }


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: BugInput) -> AnalyzeResponse:
    _check_ids(body.project_id)

    sev = await asyncio.to_thread(severity_model.predict, _normalize(body))

    warnings: list[str] = []
    title = explanation = fix = None
    confidence: Optional[int] = None
    provider = model = None

    try:
        result = await run_llm(
            "bug_explain",
            build_explain_messages(
                title=body.title,
                module=body.module,
                test_type=body.test_type,
                steps=body.steps,
                expected_result=body.expected_result,
                error_message=body.error_message,
                logs=body.logs,
                response=body.response,
            ),
            json_mode=True,
            temperature=0.2,
            max_tokens=900,
        )
        provider, model = result.provider, result.model
        data = loads_lenient(result.text)
        if not isinstance(data, dict):
            raise ValueError("the model did not return a JSON object")

        title = _s(data.get("title"), 200)
        explanation = _s(data.get("explanation"), 1500)
        fix = _s(data.get("recommended_fix"), 1000)
        try:
            confidence = max(20, min(95, int(round(float(data.get("confidence"))))))
        except (TypeError, ValueError):
            confidence = None
        if not explanation:
            warnings.append("The model returned no explanation. Try re-analyzing.")
    except Exception as e:  # noqa: BLE001  (Groq errors, rate limits, bad JSON)
        log.warning("Explanation failed: %s", e)
        warnings.append(f"AI explanation failed: {str(e)[:200]}")

    return AnalyzeResponse(
        title=title,
        explanation=explanation,
        recommended_fix=fix,
        confidence=confidence,
        severity=sev["severity"],
        severity_score=sev["score"],
        severity_probs=sev["probs"],
        severity_source=sev["source"],
        provider=provider,
        model=model,
        warnings=warnings,
    )


# ───────── code fix ─────────

def _locate(chunk_text: str, before: str) -> Optional[str]:
    """Finds `before` in the real code: exact match first, then ignoring indentation."""
    if before in chunk_text:
        return before
    want = [line.strip() for line in before.strip("\n").split("\n")]
    if not want or not any(want):
        return None
    lines = chunk_text.split("\n")
    n = len(want)
    for i in range(len(lines) - n + 1):
        if [line.strip() for line in lines[i : i + n]] == want:
            return "\n".join(lines[i : i + n])
    return None


def _diff(file: str, before: str, after: str) -> str:
    return "\n".join(
        difflib.unified_diff(
            before.split("\n"), after.split("\n"),
            fromfile=f"a/{file}", tofile=f"b/{file}", lineterm="", n=3,
        )
    )


@router.post("/fix", response_model=FixResponse)
async def suggest_fix(body: FixBody) -> FixResponse:
    _check_ids(body.project_id, *body.requirement_ids)

    query = " ".join(p for p in (body.title, body.module, body.error_message) if p)[:500]
    try:
        chunks = await retrieve(body.project_id, query, top_k=4, requirement_ids=body.requirement_ids)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Embedding failed. Is Ollama running? ({type(e).__name__})") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    if not chunks:
        raise HTTPException(422, "No indexed source code found. Upload code as a requirement of type Source code.")

    context, used = build_code_context(chunks)
    messages = build_fix_messages(
        title=body.title,
        module=body.module,
        error_message=body.error_message,
        explanation=body.explanation,
        context=context,
    )

    try:
        result = await run_llm("code_fix", messages, json_mode=True, temperature=0.1, max_tokens=1500)
    except (httpx.HTTPError, RuntimeError) as e:
        raise HTTPException(502, f"The code model failed: {type(e).__name__} {e}".strip()) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"The code model failed: {str(e)[:200]}") from e

    try:
        data = loads_lenient(result.text)
    except ValueError as e:
        raise HTTPException(502, "The code model did not return usable JSON. Try again.") from e
    if not isinstance(data, dict):
        raise HTTPException(502, "The code model did not return usable JSON. Try again.")

    summary = _s(data.get("summary"), 300) or "Suggested change"
    warnings: list[str] = []
    diffs: list[str] = []
    files: list[str] = []

    for change in (data.get("changes") or [])[:5]:
        if not isinstance(change, dict):
            continue
        try:
            idx = int(change.get("chunk")) - 1
        except (TypeError, ValueError):
            idx = -1
        before, after = change.get("before"), change.get("after")
        if not (0 <= idx < len(used)) or not isinstance(before, str) or not isinstance(after, str):
            warnings.append("A proposed change was malformed and was dropped.")
            continue

        real = _locate(used[idx]["text"], before)
        if real is None:
            warnings.append("A proposed change did not match your real code and was dropped.")
            continue
        if real.strip() == after.strip():
            continue

        file = used[idx]["source"]
        diffs.append(_diff(file, real, after))
        if file not in files:
            files.append(file)

    if not diffs:
        raise HTTPException(
            502,
            "The model did not propose a change that matches your code, so nothing was suggested. "
            "Try again, or upload the relevant file on its own.",
        )

    header = [f"# {summary}", "# Line numbers are relative to the indexed excerpt, not the whole file."]
    header += [f"# Note: {w}" for w in dict.fromkeys(warnings)]
    log.info("Fix suggested via %s: %d change(s) in %s", result.provider, len(diffs), files)

    return FixResponse(
        summary=summary,
        patch="\n".join(header) + "\n\n" + "\n\n".join(diffs),
        files=files,
        warnings=warnings,
        chunks_used=len(used),
        provider=result.provider,
        model=result.model,
    )