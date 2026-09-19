from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ReportBody(BaseModel):
    title: str = Field(default="Test report", max_length=200)
    facts: dict[str, Any]


class ReportSections(BaseModel):
    executive_summary: str
    key_findings: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class Health(BaseModel):
    level: Literal["healthy", "attention", "risk", "inconclusive", "nodata"]
    label: str
    reasons: list[str] = Field(default_factory=list)


class ReportResponse(BaseModel):
    sections: ReportSections
    health: Health
    caveats: list[str] = Field(default_factory=list)
    ai_written: bool
    provider: Optional[str] = None
    model: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    pdf_b64: str