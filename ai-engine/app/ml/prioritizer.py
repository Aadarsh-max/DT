"""Smart test prioritization: which test cases are most likely to catch a real bug.

Rules always work. When a project has enough history, an XGBoost model trained on its own
results is blended in. Nothing is saved to disk: it retrains in milliseconds on every request."""
from typing import Any

import numpy as np

from app.ml.features import PRIORITY, TYPES
from app.utils.logger import get_logger

log = get_logger("prioritizer")

try:
    import xgboost as xgb

    HAS_XGB = True
except Exception:  # noqa: BLE001
    xgb = None
    HAS_XGB = False

STATUSES = {"PASSED", "FAILED", "ERROR", "SKIPPED"}
MAX_HISTORY = 20
MIN_SAMPLES = 40
MIN_EACH_CLASS = 5
PRIORITY_NAME = {2: "high", 3: "critical"}

FEATURES = [f"type_{t.lower()}" for t in TYPES] + [
    "priority",
    "runs",
    "fail_rate",
    "error_rate",
    "last_failed",
    "last_errored",
    "since_fail",
]


def _prio(c: dict) -> int:
    return PRIORITY.get(str(c.get("priority") or "MEDIUM").upper(), 1)


def _feat(c: dict, real: list[str]) -> list[float]:
    n = len(real)
    since = 10
    for i, s in enumerate(reversed(real)):
        if s == "FAILED":
            since = min(i, 10)
            break
    kind = str(c.get("type") or "FUNCTIONAL").upper()
    return [
        *[1.0 if kind == t else 0.0 for t in TYPES],
        float(_prio(c)),
        float(min(n, MAX_HISTORY)),
        real.count("FAILED") / n if n else 0.0,
        real.count("ERROR") / n if n else 0.0,
        1.0 if real and real[-1] == "FAILED" else 0.0,
        1.0 if real and real[-1] == "ERROR" else 0.0,
        float(since),
    ]


def _heuristic(c: dict, real: list[str]) -> tuple[float, list[str]]:
    pr = _prio(c)
    reasons: list[str] = []
    p = 0.10 + 0.07 * pr
    if pr in PRIORITY_NAME:
        reasons.append(f"{PRIORITY_NAME[pr]} priority")

    n = len(real)
    if n == 0:
        p += 0.15
        reasons.append("never run")
    else:
        failed = real.count("FAILED")
        p += 0.5 * failed / n
        if failed:
            reasons.append(f"failed in {failed} of {n} run{'s' if n != 1 else ''}")
        if real[-1] == "FAILED":
            p += 0.2
            reasons.append("failed in the last run")
        elif real[-1] == "ERROR":
            p += 0.05
            reasons.append("errored in the last run")

    if c.get("open_bug"):
        p += 0.15
        reasons.append("has an open bug")
    return min(0.98, max(0.02, p)), reasons


def _train(prepared: list) -> tuple[Any, int, int]:
    """Each past execution is a sample: features from the runs before it, label = it failed."""
    if not HAS_XGB:
        return None, 0, 0
    X: list[list[float]] = []
    y: list[int] = []
    for c, _, real in prepared:
        for i in range(1, len(real)):
            X.append(_feat(c, real[:i]))
            y.append(1 if real[i] == "FAILED" else 0)

    positives = sum(y)
    if len(y) < MIN_SAMPLES or positives < MIN_EACH_CLASS or len(y) - positives < MIN_EACH_CLASS:
        return None, len(y), positives
    try:
        dm = xgb.DMatrix(np.array(X, dtype="float32"), label=np.array(y), feature_names=FEATURES)
        params = {
            "objective": "binary:logistic",
            "max_depth": 3,
            "eta": 0.2,
            "subsample": 0.9,
            "seed": 7,
            "eval_metric": "logloss",
        }
        return xgb.train(params, dm, num_boost_round=40), len(y), positives
    except Exception as e:  # noqa: BLE001
        log.warning("Prioritizer training failed (%s). Using rules.", e)
        return None, len(y), positives


def rank(cases: list[dict]) -> dict:
    prepared = []
    for c in cases:
        hist = [s for s in (c.get("history") or []) if s in STATUSES][-MAX_HISTORY:]  # oldest to newest
        real = [s for s in hist if s != "SKIPPED"]
        prepared.append((c, hist, real))

    booster, samples, positives = _train(prepared)

    model_p: dict[int, float] = {}
    if booster is not None:
        idx = [i for i, (_, _, real) in enumerate(prepared) if real]
        if idx:
            X = np.array([_feat(prepared[i][0], prepared[i][2]) for i in idx], dtype="float32")
            preds = booster.predict(xgb.DMatrix(X, feature_names=FEATURES))
            model_p = {i: float(p) for i, p in zip(idx, preds)}

    out = []
    for i, (c, hist, real) in enumerate(prepared):
        if hist and not real:
            score, reasons = 0.03, ["skipped every time so far"]
        else:
            h, reasons = _heuristic(c, real)
            score = 0.7 * model_p[i] + 0.3 * h if i in model_p else h
        out.append({"id": c["id"], "score": round(score, 3), "reasons": reasons})

    out.sort(key=lambda r: -r["score"])  # stable: ties keep the incoming (priority) order
    return {
        "ranked": out,
        "method": "xgboost" if booster is not None else "rules",
        "samples": samples,
        "positives": positives,
    }