from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.llm.prompts.chat import build_chat_messages
from app.llm.router import run_llm
from app.rag.faiss_store import validate_id
from app.rag.retriever import retrieve
from app.utils.logger import get_logger

log = get_logger("chat")
router = APIRouter(prefix="/chat", tags=["chat"])

MIN_SCORE = 0.35  # below this an excerpt is more likely noise than help


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class AskBody(BaseModel):
    project_id: str
    message: str = Field(min_length=1, max_length=2000)
    context: str = Field(default="", max_length=12000)
    history: list[Turn] = Field(default_factory=list, max_length=20)


@router.post("/ask")
async def ask(body: AskBody) -> dict:
    try:
        validate_id(body.project_id)
    except ValueError as e:
        raise HTTPException(400, "Invalid project id") from e

    chunks: list[dict] = []
    try:
        found = await retrieve(body.project_id, body.message, top_k=3)
        chunks = [c for c in found if c["score"] >= MIN_SCORE]
    except Exception as e:  # noqa: BLE001  (no index yet, or Ollama is off: chat still works)
        log.info("Skipping requirement excerpts: %s", type(e).__name__)

    messages = build_chat_messages(
        question=body.message,
        context=body.context,
        chunks=chunks,
        history=[t.model_dump() for t in body.history],
    )

    try:
        result = await run_llm("chat", messages, json_mode=False, temperature=0.3, max_tokens=700)
    except RuntimeError as e:
        raise HTTPException(503, f"The assistant needs a Groq API key in ai-engine/.env ({e})") from e
    except Exception as e:  # noqa: BLE001  (rate limits, network)
        raise HTTPException(502, f"The assistant failed: {str(e)[:200]}") from e

    answer = result.text.strip()
    if not answer:
        raise HTTPException(502, "The model returned an empty answer. Try again.")

    sources = list(dict.fromkeys(c["source"] for c in chunks))
    return {"answer": answer, "sources": sources, "provider": result.provider, "model": result.model}