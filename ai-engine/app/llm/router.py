from dataclasses import dataclass

import httpx

from app.config import settings
from app.llm.groq_client import groq_client
from app.llm.ollama_client import ollama
from app.utils.logger import get_logger

log = get_logger("llm-router")


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str


def _route(task: str) -> tuple[str, str]:
    """Which provider and model handles which task."""
    if task == "testgen":
        provider = settings.testgen_provider.strip().lower()
        return provider, settings.ollama_model_testgen
    if task == "code_fix":
        return "ollama", settings.ollama_model_code
    # bug_explain, report, chat
    return "groq", settings.groq_model


async def run_llm(
    task: str,
    messages: list[dict],
    *,
    json_mode: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> LLMResult:
    provider, model = _route(task)

    if provider == "ollama":
        try:
            text = await ollama.chat(
                model,
                messages,
                json_mode=json_mode,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return LLMResult(text, "ollama", model)
        except httpx.HTTPError as e:
            if not groq_client.configured:
                raise
            log.warning(
                "Ollama failed for '%s' (%s: %s). Falling back to Groq.",
                task, type(e).__name__, e,
            )

    if not groq_client.configured:
        raise RuntimeError("GROQ_API_KEY is not set")

    # gpt-oss spends part of the budget on reasoning, so give it extra room
    text = await groq_client.chat(
        messages,
        json_mode=json_mode,
        temperature=temperature,
        max_tokens=max_tokens + 2000,
    )
    return LLMResult(text, "groq", settings.groq_model)