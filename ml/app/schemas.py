"""Request and response shapes for the SatarkAI model service.

The service is deliberately *only* the model. Feature engineering lives in
TypeScript alongside the rule detectors (src/lib/detectors/features.ts), so
there is one definition of "payment-to-progress gap" rather than two that can
drift apart. The caller sends named feature vectors; this service fits, scores
and explains.

That also means the service holds no scheme knowledge and no personal data —
it receives work ids and numbers, nothing else.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class FeatureRow(BaseModel):
    work_id: str
    values: list[float]


class LabelledRow(FeatureRow):
    """A work whose outcome is already known, used for training."""

    late: bool


class AnomalyRequest(BaseModel):
    feature_names: list[str]
    #: Plain-language name per feature, shown to the officer reading the alert.
    feature_labels: dict[str, str] = Field(default_factory=dict)
    rows: list[FeatureRow]
    #: Share of the population the model should treat as outlying. This is a
    #: review-capacity decision, not a statistical one — it sets how many cases
    #: land on someone's desk — so the caller owns it.
    contamination: float = Field(default=0.05, gt=0.0, le=0.5)
    random_state: int = 42


class Driver(BaseModel):
    feature: str
    label: str
    value: float
    #: The population median for this feature, for comparison.
    peer_median: float
    #: How many points of the score this feature accounts for, by ablation.
    contribution: float


class AnomalyResult(BaseModel):
    work_id: str
    #: 0-100, higher is more unusual.
    score: int
    is_anomaly: bool
    drivers: list[Driver]


class AnomalyResponse(BaseModel):
    model_version: str
    trained_on: int
    contamination: float
    flagged: int
    results: list[AnomalyResult]


class DelayRequest(BaseModel):
    feature_names: list[str]
    feature_labels: dict[str, str] = Field(default_factory=dict)
    #: Works whose outcome is settled — they either met the one-year window or
    #: did not. These train the model.
    train: list[LabelledRow]
    #: Works still in progress, which the model has not seen.
    predict: list[FeatureRow]
    random_state: int = 42


class DelayEvaluation(BaseModel):
    """Held-out performance. Reported so the prediction can be judged."""

    trained_on: int
    tested_on: int
    positives_in_training: int
    roc_auc: float | None
    precision: float | None
    recall: float | None
    #: Share of training works that breached the window — the base rate a
    #: prediction has to beat to be worth anything.
    base_rate: float


class DelayResult(BaseModel):
    work_id: str
    #: Probability of breaching the one-year completion window.
    probability: float
    band: str
    drivers: list[Driver]


class DelayResponse(BaseModel):
    model_version: str
    evaluation: DelayEvaluation
    results: list[DelayResult]


class Health(BaseModel):
    status: str
    model_version: str
    sklearn_version: str
    python_version: str
