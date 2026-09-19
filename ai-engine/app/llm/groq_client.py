from typing import Optional

from groq import AsyncGroq

from app.config import settings
from app.utils.logger import get_logger

log = get_logger("groq")


class GroqClient:
    def __init__(self) -> None:
        self._client: Optional[AsyncGroq] = (
            AsyncGroq(api_key=settings.groq_api_key) if settings.groq_api_key else None
        )

    @property
    def configured(self) -> bool:
        return self._client is not None

    async def chat(
        self,
        messages: list[dict],
        json_mode: bool = False,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        model: Optional[str] = None,
    ) -> str:
        if not self._client:
            raise RuntimeError("GROQ_API_KEY is not set")

        kwargs: dict = {
            "model": model or settings.groq_model,
            "messages": messages,
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        resp = await self._client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    async def close(self) -> None:
        if self._client:
            await self._client.close()


groq_client = GroqClient()