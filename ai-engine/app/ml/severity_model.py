import csv
import math
import threading
from pathlib import Path
from typing import Any, Optional

import numpy as np

from app.ml.features import FEATURE_NAMES, extract
from app.utils.logger import get_logger

log = get_logger("severity")

try:
    import xgboost as xgb

    HAS_XGB = True
except Exception:  # noqa: BLE001
    xgb = None
    HAS_XGB = False

LABELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
ROOT = Path(__file__).resolve().parents[2]
SEED_PATH = ROOT / "training" / "severity_seed.csv"
MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "severity_xgb.json"

PARAMS = {
    "objective": "multi:softprob",
    "num_class": 4,
    "max_depth": 3,
    "eta": 0.2,
    "subsample": 0.9,
    "seed": 7,
    "eval_metric": "mlogloss",
}
ROUNDS = 60


def load_rows(path: Path = SEED_PATH) -> list[dict]:
    rows: list[dict] = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            sev = (r.get("severity") or "").strip().upper()
            if sev not in LABELS:
                continue
            rows.append(
                {
                    "type": r["type"],
                    "priority": r["priority"],
                    "module": r["module"],
                    "title": r["title"],
                    "error": r["error"],
                    "steps": int(r.get("steps") or 0),
                    "page_errors": int(r.get("page_errors") or 0),
                    "label": LABELS.index(sev),
                }
            )
    return rows


def to_matrix(rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    X = np.array([extract(r) for r in rows], dtype="float32")
    y = np.array([r["label"] for r in rows], dtype="int32")
    return X, y


def fit(X: np.ndarray, y: np.ndarray):
    dtrain = xgb.DMatrix(X, label=y, feature_names=FEATURE_NAMES)
    return xgb.train(PARAMS, dtrain, num_boost_round=ROUNDS)


def train_and_save(path: Path = SEED_PATH):
    X, y = to_matrix(load_rows(path))
    booster = fit(X, y)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(MODEL_PATH))
    return booster


def _rules_probs(f: list[float]) -> list[float]:
    """Fallback when XGBoost is unavailable: a simple score turned into a probability spread."""
    d = dict(zip(FEATURE_NAMES, f))
    s = (
        0.7
        + 0.4 * d["priority"]
        + 0.9 * d["critical_module"]
        + 0.6 * d["security_words"]
        + 0.5 * d["money_words"]
        + 1.0 * d["http_5xx"]
        + 0.5 * d["crash_words"]
        + 0.2 * d["page_errors"]
        - 0.9 * d["cosmetic_words"]
    )
    s = max(0.0, min(3.0, s))
    w = [math.exp(-((i - s) ** 2) / 0.5) for i in range(4)]
    total = sum(w)
    return [x / total for x in w]


class SeverityModel:
    def __init__(self) -> None:
        self._booster: Optional[Any] = None
        self._loaded = False
        self._lock = threading.Lock()

    def _ensure(self) -> None:
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            self._loaded = True
            if not HAS_XGB:
                log.warning("xgboost is not installed. Using rule-based severity.")
                return
            try:
                if MODEL_PATH.exists():
                    booster = xgb.Booster()
                    booster.load_model(str(MODEL_PATH))
                    self._booster = booster
                elif SEED_PATH.exists():
                    log.info("No trained severity model found. Training from the seed file.")
                    self._booster = train_and_save()
            except Exception as e:  # noqa: BLE001
                log.warning("Could not load the severity model (%s). Using rules.", e)
                self._booster = None

    @property
    def source(self) -> str:
        self._ensure()
        return "xgboost" if self._booster is not None else "rules"

    def predict(self, bug: dict) -> dict:
        self._ensure()
        f = extract(bug)
        probs: Optional[list[float]] = None
        source = "rules"

        if self._booster is not None:
            try:
                dm = xgb.DMatrix(np.array([f], dtype="float32"), feature_names=FEATURE_NAMES)
                probs = [float(p) for p in self._booster.predict(dm)[0]]
                source = "xgboost"
            except Exception as e:  # noqa: BLE001
                log.warning("XGBoost prediction failed (%s). Using rules.", e)
        if probs is None:
            probs = _rules_probs(f)

        best = int(np.argmax(probs))
        score = sum(i * p for i, p in enumerate(probs)) / 3.0
        return {
            "severity": LABELS[best],
            "score": round(float(score), 3),
            "probs": {LABELS[i]: round(p, 3) for i, p in enumerate(probs)},
            "source": source,
        }


severity_model = SeverityModel()