from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.ml.deploy_risk import estimate

router = APIRouter(prefix="/risk", tags=["risk"])


class RiskBody(BaseModel):
    facts: dict[str, Any]


@router.post("/estimate")
async def estimate_risk(body: RiskBody) -> dict:
    return estimate(body.facts)