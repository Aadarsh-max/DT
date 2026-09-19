import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.prioritizer import HAS_XGB, rank
from app.rag.faiss_store import validate_id

router = APIRouter(prefix="/prioritize", tags=["prioritize"])


class CaseIn(BaseModel):
    id: str
    type: str = "FUNCTIONAL"
    priority: str = "MEDIUM"
    module: Optional[str] = None
    open_bug: bool = False
    history: list[str] = Field(default_factory=list)  # oldest to newest


class RankBody(BaseModel):
    project_id: str
    cases: list[CaseIn] = Field(min_length=1, max_length=1000)


@router.post("/rank")
async def rank_cases(body: RankBody) -> dict:
    try:
        validate_id(body.project_id)
    except ValueError as e:
        raise HTTPException(400, "Invalid project id") from e
    result = await asyncio.to_thread(rank, [c.model_dump() for c in body.cases])
    return {**result, "xgboost_installed": HAS_XGB}