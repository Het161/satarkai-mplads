"""SatarkAI model service.

Two endpoints, both stateless and both explainable:

  POST /anomaly/score   IsolationForest over engineered features, returning a
                        0-100 unusualness score and the features that drove it.
  POST /delay/predict   Probability that an in-progress work breaches the
                        one-year completion window, with held-out performance.

The service is optional by design. The Next.js application runs with
ML_MODE=rules and never calls it; when ML_MODE=ml it calls the service and
falls back to the deterministic detectors if it is unreachable. Nothing in a
demo depends on this process being up.

Run: ml/.venv/bin/uvicorn app.main:app --port 8000   (from the ml/ directory)
"""

from __future__ import annotations

import platform

import sklearn
from fastapi import FastAPI

from . import anomaly, delay
from .schemas import (
    AnomalyRequest,
    AnomalyResponse,
    DelayRequest,
    DelayResponse,
    Health,
)

app = FastAPI(
    title="SatarkAI model service",
    version="1.0",
    description=(
        "Risk signals for human review under the MPLADS scheme. "
        "Outputs are prompts for an officer to examine, never findings of fraud."
    ),
)


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(
        status="ok",
        model_version=f"{anomaly.MODEL_VERSION} / {delay.MODEL_VERSION}",
        sklearn_version=sklearn.__version__,
        python_version=platform.python_version(),
    )


@app.post("/anomaly/score", response_model=AnomalyResponse)
def score_anomalies(request: AnomalyRequest) -> AnomalyResponse:
    payload = anomaly.run(
        feature_names=request.feature_names,
        feature_labels=request.feature_labels,
        rows=[(r.work_id, r.values) for r in request.rows],
        contamination=request.contamination,
        random_state=request.random_state,
    )
    return AnomalyResponse(**payload)


@app.post("/delay/predict", response_model=DelayResponse)
def predict_delay(request: DelayRequest) -> DelayResponse:
    payload = delay.run(
        feature_names=request.feature_names,
        feature_labels=request.feature_labels,
        train_rows=[(r.work_id, r.values, r.late) for r in request.train],
        predict_rows=[(r.work_id, r.values) for r in request.predict],
        random_state=request.random_state,
    )
    return DelayResponse(**payload)
