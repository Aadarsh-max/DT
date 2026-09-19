import httpx
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from app.llm.prompts.testgen import TYPE_QUERY, build_context, build_messages
from app.llm.router import run_llm
from app.rag.faiss_store import validate_id
from app.rag.retriever import retrieve
from app.schemas.testcase import GeneratedTestCase, GenerateBody, GenerateResponse
from app.utils.json_repair import extract_items
from app.utils.logger import get_logger

log = get_logger("testgen")
router = APIRouter(prefix="/testgen", tags=["testgen"])


def _parse(text: str, count: int, avoid: list[str]) -> list[GeneratedTestCase]:
    seen = {a.strip().lower() for a in avoid}
    out: list[GeneratedTestCase] = []
    for raw in extract_items(text):
        try:
            case = GeneratedTestCase.model_validate(raw)
        except ValidationError:
            continue
        if not case.steps or not case.expected_result:
            continue
        key = case.title.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(case)
    return out[:count]


@router.post("/generate", response_model=GenerateResponse)
async def generate(body: GenerateBody) -> GenerateResponse:
    try:
        validate_id(body.project_id)
        for rid in body.requirement_ids or []:
            validate_id(rid)
    except ValueError as e:
        raise HTTPException(400, "Invalid project or requirement id") from e

    query = TYPE_QUERY[body.test_type]
    if body.module:
        query = f"{body.module} {query}"

    try:
        chunks = await retrieve(body.project_id, query, top_k=5, requirement_ids=body.requirement_ids)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Embedding failed. Is Ollama running? ({type(e).__name__})") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    if not chunks:
        raise HTTPException(422, "No indexed requirements found for this project.")

    messages = build_messages(
        test_type=body.test_type,
        count=body.count,
        project_name=body.project_name,
        platform=body.platform,
        context=build_context(chunks),
        module=body.module,
        base_url=body.base_url,
        avoid_titles=body.avoid_titles,
    )

    cases: list[GeneratedTestCase] = []
    result = None
    for attempt in (1, 2):
        try:
            result = await run_llm(
                "testgen",
                messages,
                json_mode=True,
                temperature=0.3 if attempt == 1 else 0.5,
                max_tokens=1800,
            )
        except (httpx.HTTPError, RuntimeError) as e:
            raise HTTPException(502, f"The AI model failed: {type(e).__name__} {e}".strip()) from e
        except Exception as e:  # noqa: BLE001  (Groq SDK errors)
            raise HTTPException(502, f"The AI model failed: {str(e)[:200]}") from e

        cases = _parse(result.text, body.count, body.avoid_titles)
        if cases:
            break
        log.warning("Attempt %d returned no usable %s cases", attempt, body.test_type)

    if not cases or result is None:
        raise HTTPException(
            502, "The model did not return usable test cases. Try again or lower the count."
        )

    log.info("%s: %d cases via %s (%s)", body.test_type, len(cases), result.provider, result.model)
    return GenerateResponse(
        test_cases=cases,
        provider=result.provider,
        model=result.model,
        chunks_used=len(chunks),
    )