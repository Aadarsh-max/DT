import asyncio

import httpx
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.ml.duplicate_detector import duplicate_index
from app.rag.embedder import embed_texts
from app.rag.faiss_store import validate_id
from app.schemas.bug import DuplicateCheckBody

router = APIRouter(prefix="/duplicates", tags=["duplicates"])


def _check_ids(*ids: str) -> None:
    try:
        for i in ids:
            validate_id(i)
    except ValueError as e:
        raise HTTPException(400, "Invalid project or bug id") from e


@router.post("/check")
async def check(body: DuplicateCheckBody) -> dict:
    """Finds similar earlier bugs, then (by default) adds this bug to the index."""
    _check_ids(body.project_id, body.bug_id)
    try:
        vec = (await embed_texts([body.text]))[0]
    except httpx.HTTPError as e:
        raise HTTPException(
            502, f"Embedding failed. Is Ollama running with {settings.ollama_model_embed}? ({type(e).__name__})"
        ) from e

    matches = await asyncio.to_thread(
        duplicate_index.search, body.project_id, vec, body.bug_id, body.top_k
    )
    if body.index:
        await asyncio.to_thread(duplicate_index.add, body.project_id, body.bug_id, body.text, vec)
    return {"matches": matches, "threshold": settings.duplicate_threshold, "indexed": body.index}


# Declared before the two-segment route so "project" is never read as a project id
@router.delete("/project/{project_id}")
async def delete_project(project_id: str) -> dict:
    _check_ids(project_id)
    await asyncio.to_thread(duplicate_index.remove_project, project_id)
    return {"ok": True}


@router.delete("/{project_id}/{bug_id}")
async def delete_bug(project_id: str, bug_id: str) -> dict:
    _check_ids(project_id, bug_id)
    await asyncio.to_thread(duplicate_index.remove, project_id, bug_id)
    return {"ok": True}