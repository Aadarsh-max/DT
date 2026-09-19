import json
import os
import shutil
import threading
from pathlib import Path
from typing import Optional

import numpy as np

from app.rag.faiss_store import validate_id

BASE_DIR = Path(__file__).resolve().parents[1] / "data" / "bug_index"


class DuplicateIndex:
    """One folder per project: meta.json (bug ids and short texts) and vectors.npy.
    Plain numpy is enough here, since a project has hundreds of bugs, not millions."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._cache: dict[str, dict] = {}
        BASE_DIR.mkdir(parents=True, exist_ok=True)

    def _dir(self, pid: str) -> Path:
        validate_id(pid)
        return BASE_DIR / pid

    def _load(self, pid: str) -> dict:
        if pid in self._cache:
            return self._cache[pid]
        d = self._dir(pid)
        meta_path, vec_path = d / "meta.json", d / "vectors.npy"
        if meta_path.exists() and vec_path.exists():
            entry = {
                "meta": json.loads(meta_path.read_text(encoding="utf-8")),
                "vectors": np.load(vec_path),
            }
        else:
            entry = {"meta": [], "vectors": np.zeros((0, 0), dtype="float32")}
        self._cache[pid] = entry
        return entry

    def _save(self, pid: str, entry: dict) -> None:
        d = self._dir(pid)
        if not entry["meta"]:
            shutil.rmtree(d, ignore_errors=True)
            return
        d.mkdir(parents=True, exist_ok=True)
        tmp_vec, tmp_meta = d / "vectors.tmp.npy", d / "meta.tmp.json"
        np.save(tmp_vec, entry["vectors"])
        tmp_meta.write_text(json.dumps(entry["meta"], ensure_ascii=False), encoding="utf-8")
        os.replace(tmp_vec, d / "vectors.npy")
        os.replace(tmp_meta, d / "meta.json")

    def add(self, pid: str, bug_id: str, text: str, vec: np.ndarray) -> None:
        validate_id(bug_id)
        with self._lock:
            e = self._load(pid)
            vec = np.asarray(vec, dtype="float32").reshape(1, -1)
            keep = [i for i, m in enumerate(e["meta"]) if m["bug_id"] != bug_id]
            meta = [e["meta"][i] for i in keep]
            old = e["vectors"][keep] if keep else np.zeros((0, vec.shape[1]), dtype="float32")
            if old.shape[1] != vec.shape[1]:  # embedding model changed: start over
                meta, old = [], np.zeros((0, vec.shape[1]), dtype="float32")
            e["meta"] = meta + [{"bug_id": bug_id, "text": text[:300]}]
            e["vectors"] = np.vstack([old, vec])
            self._save(pid, e)

    def search(
        self, pid: str, vec: np.ndarray, exclude_id: Optional[str] = None, top_k: int = 5
    ) -> list[dict]:
        with self._lock:
            e = self._load(pid)
            if not e["meta"]:
                return []
            q = np.asarray(vec, dtype="float32").reshape(-1)
            if q.shape[0] != e["vectors"].shape[1]:
                return []
            sims = e["vectors"] @ q
            out: list[dict] = []
            for i in np.argsort(-sims):
                m = e["meta"][int(i)]
                if m["bug_id"] == exclude_id:
                    continue
                out.append({"bug_id": m["bug_id"], "score": round(float(sims[i]), 4), "text": m["text"]})
                if len(out) >= top_k:
                    break
            return out

    def remove(self, pid: str, bug_id: str) -> None:
        validate_id(bug_id)
        with self._lock:
            e = self._load(pid)
            keep = [i for i, m in enumerate(e["meta"]) if m["bug_id"] != bug_id]
            if len(keep) == len(e["meta"]):
                return
            e["meta"] = [e["meta"][i] for i in keep]
            e["vectors"] = e["vectors"][keep] if keep else np.zeros((0, 0), dtype="float32")
            self._save(pid, e)

    def remove_project(self, pid: str) -> None:
        with self._lock:
            self._cache.pop(pid, None)
            shutil.rmtree(self._dir(pid), ignore_errors=True)


duplicate_index = DuplicateIndex()