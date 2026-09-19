from typing import Any, Optional

from pydantic import BaseModel, Field


class BugInput(BaseModel):
    project_id: str
    title: str
    module: Optional[str] = None
    test_type: str = "FUNCTIONAL"
    priority: str = "MEDIUM"
    result_status: str = "FAILED"
    steps: list[str] = Field(default_factory=list)
    expected_result: Optional[str] = None
    error_message: Optional[str] = None
    logs: Optional[str] = None
    response: Optional[dict[str, Any]] = None


class AnalyzeResponse(BaseModel):
    title: Optional[str] = None
    explanation: Optional[str] = None
    recommended_fix: Optional[str] = None
    confidence: Optional[int] = None
    severity: str
    severity_score: float
    severity_probs: dict[str, float]
    severity_source: str
    provider: Optional[str] = None
    model: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)


class FixBody(BaseModel):
    project_id: str
    title: str
    module: Optional[str] = None
    error_message: Optional[str] = None
    explanation: Optional[str] = None
    requirement_ids: list[str] = Field(min_length=1)


class FixResponse(BaseModel):
    summary: str
    patch: str
    files: list[str]
    warnings: list[str]
    chunks_used: int
    provider: str
    model: str


class DuplicateCheckBody(BaseModel):
    project_id: str
    bug_id: str
    text: str = Field(min_length=3, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)
    index: bool = True