import asyncio
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import settings
from app.rag.chunker import chunk_text
from app.rag.embedder import embed_texts
from app.rag.faiss_store import HAS_FAISS, store, validate_id
from app.rag.loader import SUPPORTED_EXTS, LoaderError, fetch_url, load_file
from app.rag.retriever import retrieve
from app.utils.logger import get_logger

log = get_logger("requirements")
router = APIRouter(prefix="/requirements", tags=["requirements"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_CHUNKS = 1500


class IndexUrlBody(BaseModel):
    project_id: str
    requirement_id: str
    url: str


class SearchBody(BaseModel):
    project_id: str
    query: str = Field(min_length=2, max_length=500)
    top_k: int = Field(default=5, ge=1, le=20)
    requirement_ids: Optional[list[str]] = None


def _check_ids(*ids: str) -> None:
    try:
        for i in ids:
            validate_id(i)
    except ValueError as e:
        raise HTTPException(400, "Invalid project or requirement id") from e


async def _index(project_id: str, requirement_id: str, source: str, text: str) -> dict:
    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(422, "No text content found to index.")
    if len(chunks) > MAX_CHUNKS:
        raise HTTPException(
            413, f"Document is too large ({len(chunks)} chunks). Split it into smaller files."
        )

    try:
        vectors = await embed_texts(chunks)
    except httpx.HTTPError as e:
        log.error("Embedding failed: %s", e)
        raise HTTPException(
            502, f"Embedding failed. Is Ollama running with {settings.ollama_model_embed}? ({e})"
        ) from e

    try:
        await asyncio.to_thread(store.add, project_id, requirement_id, source, chunks, vectors)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    log.info("Indexed %s: %d chunks (%s)", source, len(chunks), store.engine)
    return {"chunk_count": len(chunks), "char_count": len(text), "engine": store.engine}


@router.get("/status")
async def status() -> dict:
    return {
        "engine": store.engine,
        "faiss_installed": HAS_FAISS,
        "embed_model": settings.ollama_model_embed,
    }


@router.post("/index-file")
async def index_file(
    project_id: str = Form(...),
    requirement_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    _check_ids(project_id, requirement_id)
    name = file.filename or "upload"
    ext = Path(name).suffix.lower()
    if ext not in SUPPORTED_EXTS:
        raise HTTPException(415, f"Unsupported file type '{ext}'.")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is larger than 15 MB.")

    try:
        text = await asyncio.to_thread(load_file, name, data)
    except LoaderError as e:
        raise HTTPException(422, str(e)) from e

    return await _index(project_id, requirement_id, name, text)


@router.post("/index-url")
async def index_url(body: IndexUrlBody) -> dict:
    _check_ids(body.project_id, body.requirement_id)
    try:
        text = await fetch_url(body.url)
    except LoaderError as e:
        raise HTTPException(422, str(e)) from e
    return await _index(body.project_id, body.requirement_id, body.url, text)


@router.post("/search")
async def search(body: SearchBody) -> dict:
    _check_ids(body.project_id)
    try:
        results = await retrieve(
            body.project_id, body.query, body.top_k, body.requirement_ids
        )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Embedding failed. Is Ollama running? ({e})") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"results": results, "engine": store.engine}


# Declared before the two-segment route so "project" is never read as a project id
@router.delete("/project/{project_id}")
async def delete_project_index(project_id: str) -> dict:
    _check_ids(project_id)
    await asyncio.to_thread(store.remove_project, project_id)
    return {"ok": True}


@router.delete("/{project_id}/{requirement_id}")
async def delete_requirement_index(project_id: str, requirement_id: str) -> dict:
    _check_ids(project_id, requirement_id)
    removed = await asyncio.to_thread(store.remove_requirement, project_id, requirement_id)
    return {"ok": True, "removed": removed}