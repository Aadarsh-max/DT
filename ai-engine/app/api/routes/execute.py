import time
from typing import Literal, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.rag.faiss_store import validate_id
from app.runners import playwright_runner as pw
from app.runners import screenshot
from app.runners.api_runner import run_api_case
from app.runners.script_builder import ScriptError, build_plan
from app.utils.logger import get_logger

log = get_logger("execute")
router = APIRouter(prefix="/execute", tags=["execute"])


class PreflightBody(BaseModel):
    url: str
    need_browser: bool = False


class ApiCaseBody(BaseModel):
    base_url: Optional[str] = None
    test_data: dict
    auth_token: Optional[str] = None


class UiCaseBody(BaseModel):
    run_id: str
    case_id: str
    title: str
    steps: list[str] = []
    preconditions: Optional[str] = None
    expected_result: Optional[str] = None
    test_data: Optional[dict] = None
    base_url: str
    headless: bool = True


class CaseResult(BaseModel):
    status: Literal["PASSED", "FAILED", "ERROR", "SKIPPED"]
    duration_ms: int
    error_message: Optional[str] = None
    logs: list[str] = []
    screenshot_b64: Optional[str] = None
    response: Optional[dict] = None


def _check_ids(*ids: str) -> None:
    try:
        for i in ids:
            validate_id(i)
    except ValueError as e:
        raise HTTPException(400, "Invalid run or case id") from e


def _check_http_url(url: str) -> None:
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.netloc:
        raise HTTPException(422, "Only http and https URLs are supported")


@router.get("/status")
async def status() -> dict:
    """Is the browser usable? Never raises, so it is safe to poll."""
    try:
        info = await pw.check()
        return {"playwright": True, "browser": bool(info.get("ok")), "version": info.get("version")}
    except pw.BrowserUnavailable as e:
        return {"playwright": False, "browser": False, "error": str(e)}
    except pw.BrowserError as e:
        return {"playwright": True, "browser": False, "error": str(e)}


@router.post("/preflight")
async def preflight(body: PreflightBody) -> dict:
    _check_http_url(body.url)
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=6.0), follow_redirects=True, verify=False
        ) as client:
            r = await client.get(body.url)
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"Could not reach {body.url} ({type(e).__name__}). Is it running?"}

    if body.need_browser:
        try:
            await pw.check()
        except (pw.BrowserUnavailable, pw.BrowserError) as e:
            raise HTTPException(503, str(e)) from e
    return {"ok": True, "status": r.status_code}


@router.post("/api-case", response_model=CaseResult)
async def api_case(body: ApiCaseBody) -> CaseResult:
    if body.base_url:
        _check_http_url(body.base_url)
    result = await run_api_case(
        base_url=body.base_url, test_data=body.test_data, auth_token=body.auth_token
    )
    return CaseResult(**result)


@router.post("/ui-case", response_model=CaseResult)
async def ui_case(body: UiCaseBody) -> CaseResult:
    _check_ids(body.run_id, body.case_id)
    _check_http_url(body.base_url)
    started = time.monotonic()
    logs: list[str] = []

    def early(status: str, message: str) -> CaseResult:
        logs.append(f"\u2717 {message}")
        return CaseResult(
            status=status,
            duration_ms=int((time.monotonic() - started) * 1000),
            error_message=message,
            logs=logs,
        )

    # 1. Read the start page
    try:
        snap = await pw.snapshot(body.base_url)
    except pw.BrowserUnavailable as e:
        raise HTTPException(503, str(e)) from e
    except pw.BrowserError as e:
        return early("ERROR", str(e))
    if not snap.get("ok"):
        return early("ERROR", snap.get("error") or "Could not open the page")

    # 2. Turn the steps into browser actions
    try:
        plan, warnings = await build_plan(
            title=body.title,
            steps=body.steps,
            preconditions=body.preconditions,
            expected_result=body.expected_result,
            test_data=body.test_data,
            base_url=body.base_url,
            snapshot=snap,
        )
    except ScriptError as e:
        return early("ERROR", str(e))
    except Exception as e:  # noqa: BLE001  (Ollama or Groq failures, rate limits)
        return early("ERROR", f"Could not build the test script: {str(e)[:200]}")
    logs.append(f"Planned {len(plan)} browser actions")

    # 3. Run them
    shot = screenshot.path_for(body.run_id, body.case_id)
    try:
        res = await pw.execute(
            base_url=body.base_url, plan=plan, headless=body.headless, screenshot_path=shot
        )
    except pw.BrowserUnavailable as e:
        raise HTTPException(503, str(e)) from e
    except pw.BrowserError as e:
        return early("ERROR", str(e))
    if not res.get("ok"):
        return early("ERROR", res.get("error") or "The browser run failed")

    logs.extend(res.get("logs", []))
    return CaseResult(
        status=res["status"],
        duration_ms=res["duration_ms"],
        error_message=res.get("error"),
        logs=logs,
        screenshot_b64=screenshot.read_b64(shot) if res["status"] != "PASSED" else None,
        response={
            "plan": plan,
            "warnings": warnings,
            "final_url": res.get("final_url"),
            "page_errors": res.get("page_errors", []),
        },
    )


@router.delete("/screenshots/{run_id}")
async def clear_screenshots(run_id: str) -> dict:
    _check_ids(run_id)
    screenshot.clear_run(run_id)
    return {"ok": True}