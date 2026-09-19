from fastapi import APIRouter

from app.config import settings
from app.llm.groq_client import groq_client
from app.llm.ollama_client import ollama
from app.schemas.common import HealthResponse, ServiceStatus

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    # Ollama
    up = await ollama.is_up()
    if up:
        installed = {}
        for name in (
            settings.ollama_model_testgen,
            settings.ollama_model_code,
            settings.ollama_model_embed,
        ):
            installed[name] = await ollama.has_model(name)
        ollama_status = ServiceStatus(
            ok=all(installed.values()),
            detail="running" if all(installed.values()) else "some models missing",
            extra={"models": installed},
        )
    else:
        ollama_status = ServiceStatus(ok=False, detail="Ollama not reachable")

    # Groq (config check only, so health polling never burns free-tier quota)
    groq_status = ServiceStatus(
        ok=groq_client.configured,
        detail=settings.groq_model if groq_client.configured else "GROQ_API_KEY missing",
    )

    return HealthResponse(
        ok=ollama_status.ok and groq_status.ok,
        ollama=ollama_status,
        groq=groq_status,
    )