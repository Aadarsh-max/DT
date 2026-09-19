import numpy as np

from app.llm.ollama_client import ollama

BATCH_SIZE = 16


async def embed_texts(texts: list[str]) -> np.ndarray:
    """Embed with bge-m3 through Ollama. Returns L2-normalised float32 vectors."""
    vectors: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        vectors.extend(await ollama.embed(texts[i : i + BATCH_SIZE]))

    arr = np.asarray(vectors, dtype="float32")
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return arr / norms