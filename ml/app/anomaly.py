"""Multivariate anomaly scoring with IsolationForest.

Why unsupervised: there is no labelled corpus of MPLADS irregularity to learn
from. Nobody has handed us ten thousand works marked "this one was a problem".
Training a classifier would mean inventing those labels, and the model would
then only rediscover whatever assumption produced them.

IsolationForest instead asks a question that needs no labels: how few random
splits does it take to isolate this work from the rest? Works that are unusual
across several dimensions at once — costly for their type *and* slow *and*
thinly documented — get isolated quickly, and that is exactly the combination a
single-rule detector cannot see.

The output is a prompt for review. It is not evidence, and the service says so
in every response it produces.
"""

from __future__ import annotations

import numpy as np
from sklearn.ensemble import IsolationForest

from .explain import ablation_drivers

MODEL_VERSION = "isolation-forest-1.0"


class AnomalyModel:
    """Fit on the population being scored, which is the normal use here.

    IsolationForest is unsupervised, so fitting and scoring the same set is not
    leakage — there are no labels to leak. It is how the method is meant to be
    used: the population defines what "usual" means.
    """

    def __init__(self, contamination: float, random_state: int) -> None:
        self.contamination = contamination
        self.forest = IsolationForest(
            n_estimators=300,
            contamination=contamination,
            random_state=random_state,
            # Every feature is considered at every split; with a dozen
            # interpretable features there is nothing to gain from sampling.
            max_features=1.0,
            bootstrap=False,
        )
        self.medians: np.ndarray | None = None
        self._raw_min = 0.0
        self._raw_max = 1.0

    def fit(self, X: np.ndarray) -> None:
        self.forest.fit(X)
        self.medians = np.median(X, axis=0)

        # score_samples is higher for *more normal* points, so negate it to get
        # "unusualness", then fix the range from the training population so a
        # score means the same thing for every work in a run.
        raw = -self.forest.score_samples(X)
        self._raw_min = float(raw.min())
        self._raw_max = float(raw.max())

    def score_0_100(self, X: np.ndarray) -> np.ndarray:
        raw = -self.forest.score_samples(X)
        span = self._raw_max - self._raw_min
        if span <= 0:
            return np.full(raw.shape, 50.0)
        scaled = (raw - self._raw_min) / span
        return np.clip(scaled, 0.0, 1.0) * 100.0

    def score_one(self, row: np.ndarray) -> float:
        return float(self.score_0_100(row.reshape(1, -1))[0])

    def is_anomaly(self, X: np.ndarray) -> np.ndarray:
        return self.forest.predict(X) == -1


def run(
    feature_names: list[str],
    feature_labels: dict[str, str],
    rows: list[tuple[str, list[float]]],
    contamination: float,
    random_state: int,
) -> dict:
    work_ids = [r[0] for r in rows]
    X = np.asarray([r[1] for r in rows], dtype=float)

    # Guard the degenerate cases rather than letting sklearn raise: a demo
    # database that has just been reset should not take the service down.
    if X.shape[0] < 20:
        return {
            "model_version": MODEL_VERSION,
            "trained_on": int(X.shape[0]),
            "contamination": contamination,
            "flagged": 0,
            "results": [],
        }

    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    model = AnomalyModel(contamination=contamination, random_state=random_state)
    model.fit(X)

    scores = model.score_0_100(X)
    flags = model.is_anomaly(X)
    assert model.medians is not None

    results = []
    for i, work_id in enumerate(work_ids):
        if not flags[i]:
            continue
        drivers = ablation_drivers(
            row=X[i],
            baseline_score=float(scores[i]),
            medians=model.medians,
            feature_names=feature_names,
            feature_labels=feature_labels,
            rescore=model.score_one,
        )
        results.append(
            {
                "work_id": work_id,
                "score": int(round(float(scores[i]))),
                "is_anomaly": True,
                "drivers": drivers,
            }
        )

    results.sort(key=lambda r: r["score"], reverse=True)

    return {
        "model_version": MODEL_VERSION,
        "trained_on": int(X.shape[0]),
        "contamination": contamination,
        "flagged": len(results),
        "results": results,
    }
