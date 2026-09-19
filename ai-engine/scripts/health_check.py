"""Run from the ai-engine folder:  python scripts/health_check.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.llm.groq_client import groq_client  # noqa: E402
from app.llm.ollama_client import ollama  # noqa: E402


def line(ok: bool, label: str, detail: str = "") -> None:
    tag = "[ OK ]" if ok else "[FAIL]"
    print(f"{tag} {label} {detail}".rstrip())


async def main() -> int:
    failures = 0

    # Ollama server
    up = await ollama.is_up()
    line(up, "Ollama server", settings.ollama_base_url)
    if not up:
        failures += 1
        print("       -> Start Ollama, then re-run.")
    else:
        for name in (
            settings.ollama_model_testgen,
            settings.ollama_model_code,
            settings.ollama_model_embed,
        ):
            has = await ollama.has_model(name)
            line(has, f"Model {name}", "" if has else f"-> run: ollama pull {name}")
            failures += 0 if has else 1

        try:
            vec = await ollama.embed(["health check"])
            line(bool(vec and vec[0]), "Embedding test", f"dim={len(vec[0])}")
        except Exception as e:  # noqa: BLE001
            line(False, "Embedding test", str(e))
            failures += 1

    # Groq
    if not groq_client.configured:
        line(False, "Groq", "GROQ_API_KEY missing in .env")
        failures += 1
    else:
        try:
            reply = await groq_client.chat(
                [{"role": "user", "content": "Reply with the single word: pong"}],
                max_tokens=200,
            )
            line(True, f"Groq {settings.groq_model}", f"reply={reply.strip()[:30]!r}")
        except Exception as e:  # noqa: BLE001
            line(False, "Groq", str(e)[:200])
            failures += 1

    print("\nAll good." if failures == 0 else f"\n{failures} check(s) failed.")
    await ollama.close()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))