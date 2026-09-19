import base64
import shutil
from pathlib import Path
from typing import Optional

from app.rag.faiss_store import validate_id

BASE_DIR = Path(__file__).resolve().parents[1] / "data" / "screenshots"


def path_for(run_id: str, case_id: str) -> Path:
    validate_id(run_id)
    validate_id(case_id)
    folder = BASE_DIR / run_id
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{case_id}.png"


def read_b64(path: Path) -> Optional[str]:
    try:
        if path.exists() and path.stat().st_size > 0:
            return base64.b64encode(path.read_bytes()).decode("ascii")
    except OSError:
        pass
    return None


def clear_run(run_id: str) -> None:
    validate_id(run_id)
    shutil.rmtree(BASE_DIR / run_id, ignore_errors=True)