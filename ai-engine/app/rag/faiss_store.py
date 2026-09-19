import json
import os
import re
import shutil
import threading
from pathlib import Path
from typing import Optional

import numpy as np

try:
    import faiss  # type: ignore

    HAS_FAISS = True
except Exception:  # noqa: BLE001  (ImportError, or DLL problems on Windows)
    faiss = None
    HAS_FAISS = False

BASE_DIR = Path(__file__).resolve().parents[1] / "data" / "faiss_indexes"
_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def validate_id(value: str) -> None:
    if not _ID.match(value or ""):
        raise ValueError("Invalid id")


def _empty() -> np.ndarray:
    return np.zeros((0, 0), dtype="float32")


class FaissStore:
    """One folder per project: chunks.json (text + metadata) and vectors.npy.
    Uses a FAISS inner-product index when available, plain numpy otherwise."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._cache: dict[str, dict] = {}
        BASE_DIR.mkdir(parents=True, exist_ok=True)

    @property
    def engine(self) -> str:
        return "faiss" if HAS_FAISS else "numpy"

    def _dir(self, pid: str) -> Path:
        validate_id(pid)
        return BASE_DIR / pid

    def _load(self, pid: str) -> dict:
        if pid in self._cache:
            return self._cache[pid]
        d = self._dir(pid)
        meta_path, vec_path = d / "chunks.json", d / "vectors.npy"
        if meta_path.exists() and vec_path.exists():
            entry = {
                "meta": json.loads(meta_path.read_text(encoding="utf-8")),
                "vectors": np.load(vec_path),
                "index": None,
            }
        else:
            entry = {"meta": [], "vectors": _empty(), "index": None}
        self._cache[pid] = entry
        return entry

    def _save(self, pid: str, entry: dict) -> None:
        d = self._dir(pid)
        if not entry["meta"]:
            shutil.rmtree(d, ignore_errors=True)
            return
        d.mkdir(parents=True, exist_ok=True)
        tmp_vec, tmp_meta = d / "vectors.tmp.npy", d / "chunks.tmp.json"
        np.save(tmp_vec, entry["vectors"])
        tmp_meta.write_text(json.dumps(entry["meta"], ensure_ascii=False), encoding="utf-8")
        os.replace(tmp_vec, d / "vectors.npy")
        os.replace(tmp_meta, d / "chunks.json")

    def add(
        self, pid: str, rid: str, source: str, chunks: list[str], vectors: np.ndarray
    ) -> None:
        """Add a requirement's chunks, replacing any earlier chunks for the same requirement."""
        validate_id(rid)
        with self._lock:
            entry = self._load(pid)
            keep = [i for i, m in enumerate(entry["meta"]) if m["requirement_id"] != rid]
            meta = [entry["meta"][i] for i in keep]
            dim = vectors.shape[1]
            old = entry["vectors"][keep] if keep else np.zeros((0, dim), dtype="float32")
            if keep and old.shape[1] != dim:
                raise ValueError(
                    "Embedding size changed since earlier indexing. Re-index every requirement."
                )
            new_meta = [
                {"requirement_id": rid, "source": source, "chunk_index": i, "text": t}
                for i, t in enumerate(chunks)
            ]
            entry["meta"] = meta + new_meta
            entry["vectors"] = np.vstack([old, vectors]).astype("float32")
            entry["index"] = None
            self._save(pid, entry)

    def remove_requirement(self, pid: str, rid: str) -> int:
        validate_id(rid)
        with self._lock:
            entry = self._load(pid)
            keep = [i for i, m in enumerate(entry["meta"]) if m["requirement_id"] != rid]
            removed = len(entry["meta"]) - len(keep)
            if removed == 0:
                return 0
            entry["meta"] = [entry["meta"][i] for i in keep]
            entry["vectors"] = entry["vectors"][keep] if keep else _empty()
            entry["index"] = None
            self._save(pid, entry)
            return removed

    def remove_project(self, pid: str) -> None:
        with self._lock:
            self._cache.pop(pid, None)
            shutil.rmtree(self._dir(pid), ignore_errors=True)

    def search(
        self,
        pid: str,
        query_vec: np.ndarray,
        top_k: int = 5,
        requirement_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        with self._lock:
            entry = self._load(pid)
            meta, vectors = entry["meta"], entry["vectors"]
            if not meta:
                return []

            q = np.asarray(query_vec, dtype="float32").reshape(1, -1)
            if q.shape[1] != vectors.shape[1]:
                raise ValueError("Query embedding size does not match the index. Re-index.")

            if requirement_ids:
                wanted = set(requirement_ids)
                idxs = [i for i, m in enumerate(meta) if m["requirement_id"] in wanted]
                if not idxs:
                    return []
                sims = vectors[idxs] @ q[0]
                order = np.argsort(-sims)[:top_k]
                pairs = [(idxs[j], float(sims[j])) for j in order]
            elif HAS_FAISS:
                if entry["index"] is None:
                    idx = faiss.IndexFlatIP(vectors.shape[1])
                    idx.add(np.ascontiguousarray(vectors, dtype="float32"))
                    entry["index"] = idx
                k = min(top_k, len(meta))
                scores, ids = entry["index"].search(q, k)
                pairs = [(int(i), float(s)) for i, s in zip(ids[0], scores[0]) if i >= 0]
            else:
                sims = vectors @ q[0]
                order = np.argsort(-sims)[:top_k]
                pairs = [(int(i), float(sims[i])) for i in order]

            return [{**meta[i], "score": s} for i, s in pairs]


store = FaissStore()