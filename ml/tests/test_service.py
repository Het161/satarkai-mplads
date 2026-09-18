"""Tests for the model service.

Focused on the properties that would be silently wrong otherwise: that the
service refuses to guess when it has too little to go on, that scores are on
the scale they claim, and that the explanations actually correspond to what
drove each result.

Run: ml/.venv/bin/python -m pytest ml/tests -q
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import anomaly, delay  # noqa: E402

FEATURES = ["a", "b", "c"]
LABELS = {"a": "Feature A", "b": "Feature B", "c": "Feature C"}


def ordinary_rows(n: int, seed: int = 0) -> list[tuple[str, list[float]]]:
    rng = np.random.default_rng(seed)
    return [
        (f"w{i}", list(rng.normal(0.5, 0.1, size=3)))
        for i in range(n)
    ]


class TestAnomaly:
    def test_declines_on_too_few_rows(self):
        result = anomaly.run(FEATURES, LABELS, ordinary_rows(5), 0.05, 42)
        assert result["flagged"] == 0
        assert result["results"] == []

    def test_scores_sit_on_the_zero_to_hundred_scale(self):
        rows = ordinary_rows(200)
        result = anomaly.run(FEATURES, LABELS, rows, 0.05, 42)
        for r in result["results"]:
            assert 0 <= r["score"] <= 100

    def test_finds_a_planted_outlier(self):
        rows = ordinary_rows(200)
        rows.append(("odd", [9.0, 9.0, 9.0]))
        result = anomaly.run(FEATURES, LABELS, rows, 0.05, 42)
        flagged = {r["work_id"] for r in result["results"]}
        assert "odd" in flagged

    def test_explains_the_outlier_by_the_features_that_made_it_one(self):
        rows = ordinary_rows(200)
        # Unusual on 'b' alone.
        rows.append(("odd", [0.5, 9.0, 0.5]))
        result = anomaly.run(FEATURES, LABELS, rows, 0.05, 42)
        odd = next(r for r in result["results"] if r["work_id"] == "odd")
        assert odd["drivers"], "an alert with no drivers tells an officer nothing"
        assert odd["drivers"][0]["feature"] == "b"
        assert odd["drivers"][0]["label"] == "Feature B"
        assert odd["drivers"][0]["contribution"] > 0

    def test_contamination_controls_how_much_lands_on_a_desk(self):
        rows = ordinary_rows(400)
        few = anomaly.run(FEATURES, LABELS, rows, 0.02, 42)["flagged"]
        many = anomaly.run(FEATURES, LABELS, rows, 0.15, 42)["flagged"]
        assert few < many

    def test_is_deterministic_for_a_fixed_seed(self):
        rows = ordinary_rows(200)
        a = anomaly.run(FEATURES, LABELS, rows, 0.05, 42)
        b = anomaly.run(FEATURES, LABELS, rows, 0.05, 42)
        assert [r["work_id"] for r in a["results"]] == [
            r["work_id"] for r in b["results"]
        ]
        assert [r["score"] for r in a["results"]] == [r["score"] for r in b["results"]]


class TestDelay:
    @staticmethod
    def training_set(n: int, seed: int = 0):
        """Feature 'a' genuinely predicts lateness; 'b' and 'c' are noise."""
        rng = np.random.default_rng(seed)
        rows = []
        for i in range(n):
            a = rng.uniform(0, 1)
            late = rng.uniform(0, 1) < a  # higher 'a', more likely late
            rows.append((f"t{i}", [a, rng.normal(), rng.normal()], late))
        return rows

    def test_refuses_rather_than_guessing_on_a_tiny_set(self):
        train = self.training_set(20)
        result = delay.run(FEATURES, LABELS, train, [("p1", [0.5, 0, 0])], 42)
        assert result["results"] == []
        assert result["evaluation"]["roc_auc"] is None

    def test_refuses_when_nothing_was_ever_late(self):
        train = [(f"t{i}", [0.5, 0.0, 0.0], False) for i in range(200)]
        result = delay.run(FEATURES, LABELS, train, [("p1", [0.5, 0, 0])], 42)
        assert result["results"] == []

    def test_reports_held_out_performance_and_the_base_rate(self):
        train = self.training_set(400)
        result = delay.run(FEATURES, LABELS, train, [("p1", [0.9, 0, 0])], 42)
        ev = result["evaluation"]
        assert ev["tested_on"] > 0
        assert ev["trained_on"] + ev["tested_on"] == len(train)
        assert 0 <= ev["base_rate"] <= 1
        # The signal is real, so the model should clear chance comfortably.
        assert ev["roc_auc"] > 0.7

    def test_ranks_a_risky_work_above_a_safe_one(self):
        train = self.training_set(400)
        result = delay.run(
            FEATURES,
            LABELS,
            train,
            [("risky", [0.95, 0, 0]), ("safe", [0.05, 0, 0])],
            42,
        )
        by_id = {r["work_id"]: r for r in result["results"]}
        assert by_id["risky"]["probability"] > by_id["safe"]["probability"]

    def test_bands_are_ordered_and_cover_the_range(self):
        assert delay.band_for(0.95) == "VERY_HIGH"
        assert delay.band_for(0.60) == "HIGH"
        assert delay.band_for(0.30) == "MODERATE"
        assert delay.band_for(0.01) == "LOW"

    def test_probabilities_are_probabilities(self):
        train = self.training_set(400)
        result = delay.run(
            FEATURES, LABELS, train, [(f"p{i}", [i / 20, 0, 0]) for i in range(20)], 42
        )
        for r in result["results"]:
            assert 0.0 <= r["probability"] <= 1.0


if __name__ == "__main__":
    sys.exit(pytest.main([str(Path(__file__).parent), "-q"]))
