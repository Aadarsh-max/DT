"""Retrain the severity model.  Run from the ai-engine folder:

    python scripts/train_severity_model.py
    python scripts/train_severity_model.py --csv path\\to\\your_labeled_bugs.csv

Use the same columns as training/severity_seed.csv. Restart uvicorn afterwards.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from app.ml import severity_model as sm  # noqa: E402
from app.ml.features import FEATURE_NAMES  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=str(sm.SEED_PATH))
    args = parser.parse_args()

    if not sm.HAS_XGB:
        print("xgboost is not installed. Run: pip install xgboost")
        return 1

    path = Path(args.csv)
    rows = sm.load_rows(path)
    X, y = sm.to_matrix(rows)
    counts = {label: int((y == i).sum()) for i, label in enumerate(sm.LABELS)}
    print(f"{len(rows)} rows from {path.name}. Class counts: {counts}")

    # 5-fold cross-validation, so you can see how well it generalises
    idx = np.random.default_rng(7).permutation(len(y))
    folds = np.array_split(idx, 5)
    correct = 0
    for k in range(5):
        test = folds[k]
        train = np.concatenate([folds[j] for j in range(5) if j != k])
        booster = sm.fit(X[train], y[train])
        dm = sm.xgb.DMatrix(X[test], feature_names=FEATURE_NAMES)
        correct += int((booster.predict(dm).argmax(axis=1) == y[test]).sum())
    print(f"5-fold cross-validation accuracy: {correct / len(y):.0%}")

    sm.train_and_save(path)
    print(f"Saved model to {sm.MODEL_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())