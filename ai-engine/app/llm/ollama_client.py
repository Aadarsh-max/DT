from typing import Optional

import httpx

from app.config import settings
from app.utils.logger import get_logger

log = get_logger("ollama")


class OllamaClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.ollama_base_url,
            timeout=httpx.Timeout(300.0, connect=5.0),
        )

    async def is_up(self) -> bool:
        try:
            r = await self._client.get("/api/tags", timeout=5.0)
            return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    async def list_models(self) -> list[str]:
        r = await self._client.get("/api/tags", timeout=10.0)
        r.raise_for_status()
        return [m["name"] for m in r.json().get("models", [])]

    async def has_model(self, name: str) -> bool:
        try:
            installed = await self.list_models()
        except Exception:  # noqa: BLE001
            return False
        wanted = {name, f"{name}:latest"}
        return any(m in wanted for m in installed)

    async def chat(
        self,
        model: str,
        messages: list[dict],
        json_mode: bool = False,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> str:
        options: dict = {"num_ctx": settings.ollama_num_ctx, "temperature": temperature}
        if max_tokens:
            options["num_predict"] = max_tokens

        payload: dict = {
            "model": model,
            "messages": messages,
            "stream": False,
            "keep_alive": settings.ollama_keep_alive,
            "options": options,
        }
        if json_mode:
            payload["format"] = "json"
        if model.startswith("qwen3"):
            payload["think"] = False  # thinking mode is slow and unnecessary here

        r = await self._client.post("/api/chat", json=payload)
        if r.status_code != 200:
            log.error("Ollama chat failed: %s %s", r.status_code, r.text[:300])
            r.raise_for_status()
        return r.json()["message"]["content"]

    async def embed(self, texts: list[str], model: Optional[str] = None) -> list[list[float]]:
        r = await self._client.post(
            "/api/embed",
            json={
                "model": model or settings.ollama_model_embed,
                "input": texts,
                "keep_alive": settings.ollama_keep_alive,
            },
        )
        r.raise_for_status()
        return r.json()["embeddings"]

    async def close(self) -> None:
        await self._client.aclose()


ollama = OllamaClient()