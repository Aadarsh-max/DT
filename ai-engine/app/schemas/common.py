from typing import Any, Optional

from pydantic import BaseModel


class ServiceStatus(BaseModel):
    ok: bool
    detail: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


class HealthResponse(BaseModel):
    ok: bool
    service: str = "ai-engine"
    ollama: ServiceStatus
    groq: ServiceStatus


class ErrorResponse(BaseModel):
    success: bool = False
    message: str