import re
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

TestType = Literal["FUNCTIONAL", "BOUNDARY", "NEGATIVE", "SECURITY", "API", "MOBILE"]
Platform = Literal["WEB", "API", "MOBILE"]
Priority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

_PRIORITY_ALIASES = {
    "MED": "MEDIUM", "NORMAL": "MEDIUM", "URGENT": "CRITICAL", "BLOCKER": "CRITICAL",
    "MAJOR": "HIGH", "MINOR": "LOW", "P0": "CRITICAL", "P1": "HIGH", "P2": "MEDIUM", "P3": "LOW",
}
_LEADING_NUM = re.compile(r"^\s*(?:step\s*)?\d+\s*[\.\):\-]\s*", re.I)


def _text(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, (list, tuple)):
        v = "; ".join(str(x).strip() for x in v if str(x).strip())
    elif isinstance(v, dict):
        v = "; ".join(f"{k}: {x}" for k, x in v.items())
    v = str(v).strip()
    return v or None


class GenerateBody(BaseModel):
    project_id: str
    test_type: TestType
    count: int = Field(default=3, ge=1, le=8)
    platform: Platform = "WEB"
    project_name: str = ""
    base_url: Optional[str] = None
    module: Optional[str] = Field(default=None, max_length=100)
    requirement_ids: Optional[list[str]] = None
    avoid_titles: list[str] = Field(default_factory=list)


class GeneratedTestCase(BaseModel):
    title: str
    description: Optional[str] = None
    module: Optional[str] = None
    priority: Priority = "MEDIUM"
    preconditions: Optional[str] = None
    steps: list[str] = Field(default_factory=list)
    expected_result: Optional[str] = None
    test_data: Optional[dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            raise ValueError("test case must be an object")
        d = dict(data)
        for alias, real in (
            ("expectedResult", "expected_result"),
            ("expected", "expected_result"),
            ("expected_results", "expected_result"),
            ("testData", "test_data"),
            ("name", "title"),
            ("test_steps", "steps"),
            ("precondition", "preconditions"),
        ):
            if real not in d and alias in d:
                d[real] = d[alias]
        return d

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v: Any) -> str:
        t = _text(v)
        if not t or len(t) < 3:
            raise ValueError("title too short")
        return t[:200]

    @field_validator("description", "preconditions", "expected_result", mode="before")
    @classmethod
    def _long_text(cls, v: Any) -> Optional[str]:
        t = _text(v)
        return t[:2000] if t else None

    @field_validator("module", mode="before")
    @classmethod
    def _module(cls, v: Any) -> Optional[str]:
        t = _text(v)
        return t[:80] if t else None

    @field_validator("priority", mode="before")
    @classmethod
    def _priority(cls, v: Any) -> str:
        s = str(v or "MEDIUM").strip().upper()
        s = _PRIORITY_ALIASES.get(s, s)
        return s if s in {"LOW", "MEDIUM", "HIGH", "CRITICAL"} else "MEDIUM"

    @field_validator("steps", mode="before")
    @classmethod
    def _steps(cls, v: Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            v = re.split(r"\n+", v)
        if not isinstance(v, (list, tuple)):
            v = [v]
        out: list[str] = []
        for item in v:
            if isinstance(item, dict):
                item = (
                    item.get("step")
                    or item.get("action")
                    or item.get("description")
                    or " ".join(str(x) for x in item.values())
                )
            s = _LEADING_NUM.sub("", str(item)).strip()
            if s:
                out.append(s[:500])
        return out[:30]

    @field_validator("test_data", mode="before")
    @classmethod
    def _test_data(cls, v: Any) -> Optional[dict]:
        if v is None or v == "" or v == [] or v == {}:
            return None
        return v if isinstance(v, dict) else {"value": v}


class GenerateResponse(BaseModel):
    test_cases: list[GeneratedTestCase]
    provider: str
    model: str
    chunks_used: int