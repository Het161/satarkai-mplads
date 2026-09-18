"""Delay-risk prediction: will this in-progress work breach the one-year window?

This is the one genuinely supervised model in the platform, and it can be
supervised because the label is not a judgement — it is a date. A work either
reached completion within 365 days of sanction or it did not. No one has to
decide what counts.

The two populations are disjoint by construction: the model trains only on
works whose outcome is settled, and predicts only on works still running. A
work cannot appear in both.

Every response carries held-out performance alongside the base rate, because a
prediction that does no better than "assume the usual share will be late" is
not worth acting on, and the officer reading it deserves to know which they
have.
"""

from __future__ import annotations

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from .explain import ablation_drivers

MODEL_VERSION = "hist-gradient-boosting-1.0"

#: Probability bands. Deliberately coarse — a predicted probability of 0.63
#: invites false precision, while "high risk" invites a phone call.
BANDS = [
    (0.75, "VERY_HIGH"),
    (0.50, "HIGH"),
    (0.25, "MODERATE"),
    (0.00, "LOW"),
]


def band_for(probability: float) -> str:
    for threshold, name in BANDS:
        if probability >= threshold:
            return name
    return "LOW"


def run(
    feature_names: list[str],
    feature_labels: dict[str, str],
    train_rows: list[tuple[str, list[float], bool]],
    predict_rows: list[tuple[str, list[float]]],
    random_state: int,
) -> dict:
    X = np.nan_to_num(
        np.asarray([r[1] for r in train_rows], dtype=float), nan=0.0, posinf=0.0, neginf=0.0
    )
    y = np.asarray([1 if r[2] else 0 for r in train_rows], dtype=int)

    positives = int(y.sum())
    base_rate = float(y.mean()) if len(y) else 0.0

    # Refuse rather than guess. A model trained on a handful of examples, or on
    # a set where nothing was ever late, would produce confident nonsense.
    if len(y) < 60 or positives < 10 or positives == len(y):
        return {
            "model_version": MODEL_VERSION,
            "evaluation": {
                "trained_on": len(y),
                "tested_on": 0,
                "positives_in_training": positives,
                "roc_auc": None,
                "precision": None,
                "recall": None,
                "base_rate": base_rate,
            },
            "results": [],
        }

    # Hold out a stratified fifth, so the reported numbers describe works the
    # model has not seen.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state, stratify=y
    )

    model = HistGradientBoostingClassifier(
        max_iter=200,
        learning_rate=0.08,
        max_depth=4,
        random_state=random_state,
    )
    model.fit(X_train, y_train)

    proba_test = model.predict_proba(X_test)[:, 1]
    pred_test = (proba_test >= 0.5).astype(int)

    evaluation = {
        "trained_on": int(len(y_train)),
        "tested_on": int(len(y_test)),
        "positives_in_training": int(y_train.sum()),
        "roc_auc": (
            float(roc_auc_score(y_test, proba_test)) if len(set(y_test)) > 1 else None
        ),
        "precision": float(precision_score(y_test, pred_test, zero_division=0)),
        "recall": float(recall_score(y_test, pred_test, zero_division=0)),
        "base_rate": base_rate,
    }

    # Refit on everything now that performance has been measured honestly.
    final = HistGradientBoostingClassifier(
        max_iter=200,
        learning_rate=0.08,
        max_depth=4,
        random_state=random_state,
    )
    final.fit(X, y)

    medians = np.median(X, axis=0)

    def rescore(row: np.ndarray) -> float:
        return float(final.predict_proba(row.reshape(1, -1))[0, 1] * 100.0)

    results = []
    for work_id, values in predict_rows:
        row = np.nan_to_num(
            np.asarray(values, dtype=float), nan=0.0, posinf=0.0, neginf=0.0
        )
        probability = float(final.predict_proba(row.reshape(1, -1))[0, 1])

        drivers = ablation_drivers(
            row=row,
            baseline_score=probability * 100.0,
            medians=medians,
            feature_names=feature_names,
            feature_labels=feature_labels,
            rescore=rescore,
            min_contribution=0.5,
        )

        results.append(
            {
                "work_id": work_id,
                "probability": round(probability, 4),
                "band": band_for(probability),
                "drivers": drivers,
            }
        )

    results.sort(key=lambda r: r["probability"], reverse=True)

    return {
        "model_version": MODEL_VERSION,
        "evaluation": evaluation,
        "results": results,
    }
