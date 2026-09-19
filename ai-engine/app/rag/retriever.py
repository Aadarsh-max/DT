from typing import Optional

from app.rag.embedder import embed_texts
from app.rag.faiss_store import store


async def retrieve(
    project_id: str,
    query: str,
    top_k: int = 5,
    requirement_ids: Optional[list[str]] = None,
) -> list[dict]:
    qvec = (await embed_texts([query]))[0]
    return store.search(project_id, qvec, top_k, requirement_ids)