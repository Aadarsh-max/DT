import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.execute import CaseResult
from app.rag.faiss_store import validate_id
from app.runners import appium_runner as am
from app.runners.mobile_script_builder import ScriptError, build_plan
from app.utils.logger import get_logger

log = get_logger("mobile")
router = APIRouter(prefix="/mobile", tags=["mobile"])

PKG = r"^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$"


class Target(BaseModel):
    apk_path: Optional[str] = None
    app_package: Optional[str] = Field(default=None, pattern=PKG)
    app_activity: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_.$]{1,200}$")
    udid: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9._:\-]{1,64}$")
    auto_grant: bool = False


class PreflightBody(BaseModel):
    target: Target


class CaseBody(BaseModel):
    run_id: str
    case_id: str
    title: str
    steps: list[str] = []
    preconditions: Optional[str] = None
    expected_result: Optional[str] = None
    test_data: Optional[dict] = None
    target: Target


def _check_target(t: Target) -> dict:
    if not t.apk_path and not t.app_package:
        raise HTTPException(422, "Give an APK file or the package name of an installed app.")
    if t.apk_path:
        p = Path(t.apk_path)
        if p.suffix.lower() != ".apk" or not p.is_file():
            raise HTTPException(422, "The APK file was not found on the machine that runs the AI engine.")
    return t.model_dump()


@router.get("/status")
async def status() -> dict:
    return await am.status()


@router.post("/preflight")
async def preflight(body: PreflightBody) -> dict:
    target = _check_target(body.target)
    try:
        snap = await am.snapshot(target, fresh=True)
    except (am.AppiumUnavailable, am.AppiumError) as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "package": snap.get("package")}


@router.post("/case", response_model=CaseResult)
async def mobile_case(body: CaseBody) -> CaseResult:
    try:
        validate_id(body.run_id)
        validate_id(body.case_id)
    except ValueError as e:
        raise HTTPException(400, "Invalid run or case id") from e
    target = _check_target(body.target)

    started = time.monotonic()
    logs: list[str] = []

    def early(message: str) -> CaseResult:
        logs.append(f"\u2717 {message}")
        return CaseResult(
            status="ERROR",
            duration_ms=int((time.monotonic() - started) * 1000),
            error_message=message,
            logs=logs,
        )

    try:
        snap = await am.snapshot(target)
    except (am.AppiumUnavailable, am.AppiumError) as e:
        return early(str(e))

    try:
        plan, warnings = await build_plan(
            title=body.title,
            steps=body.steps,
            preconditions=body.preconditions,
            expected_result=body.expected_result,
            test_data=body.test_data,
            package=snap.get("package") or target.get("app_package"),
            snapshot=snap,
        )
    except ScriptError as e:
        return early(str(e))
    except Exception as e:  # noqa: BLE001  (Ollama or Groq failures, rate limits)
        return early(f"Could not build the test script: {str(e)[:200]}")
    logs.append(f"Planned {len(plan)} device actions")

    try:
        res = await am.execute(target, plan)
    except (am.AppiumUnavailable, am.AppiumError) as e:
        return early(str(e))

    logs.extend(res.get("logs", []))
    return CaseResult(
        status=res["status"],
        duration_ms=res["duration_ms"],
        error_message=res.get("error"),
        logs=logs,
        screenshot_b64=res.get("screenshot_b64") if res["status"] != "PASSED" else None,
        response={
            "plan": plan,
            "warnings": warnings,
            "final_package": res.get("final_package"),
            "page_errors": [],
        },
    )