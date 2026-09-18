"""Per-case explanation by ablation.

An IsolationForest gives no feature attribution of its own, and a global
`feature_importances_` answers the wrong question — an officer needs to know why
*this* work was flagged, not which feature matters on average.

So each driver is measured by asking a counterfactual: if this work had been
ordinary on one feature — that feature replaced by the population median, the
rest untouched — how much would its score fall? That drop is the feature's
contribution. It is simple, it is honest about what it measures, and it is
stated in the same units as the score, so a reviewer can check the arithmetic.

The contributions do not have to sum to the score. Features interact, and
pretending otherwise would be a neater story than the model supports.
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np


def ablation_drivers(
    row: np.ndarray,
    baseline_score: float,
    medians: np.ndarray,
    feature_names: list[str],
    feature_labels: dict[str, str],
    rescore: Callable[[np.ndarray], float],
    top_n: int = 3,
    min_contribution: float = 1.0,
) -> list[dict]:
    """Rank the features that pushed one row's score up.

    `rescore` must map a single feature vector to the same 0-100 scale as
    `baseline_score`.
    """
    contributions: list[dict] = []

    for i, name in enumerate(feature_names):
        # A feature already at the median cannot be what singled this work out.
        if np.isclose(row[i], medians[i]):
            continue

        counterfactual = row.copy()
        counterfactual[i] = medians[i]
        drop = baseline_score - rescore(counterfactual)

        if drop < min_contribution:
            continue

        contributions.append(
            {
                "feature": name,
                "label": feature_labels.get(name, name),
                "value": float(row[i]),
                "peer_median": float(medians[i]),
                "contribution": round(float(drop), 1),
            }
        )

    contributions.sort(key=lambda d: d["contribution"], reverse=True)
    return contributions[:top_n]
