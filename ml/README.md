# SatarkAI model service

A small FastAPI service holding the two things that genuinely need
scikit-learn. Everything else in the platform runs without it.

```bash
npm run ml:setup     # venv on Python 3.13 + pinned dependencies
npm run ml:serve     # http://127.0.0.1:8000  (docs at /docs)
npm run ml:test      # pytest
```

Then, from the project root:

```bash
npm run detect:ml    # rules + statistics + model
npm run detect       # rules + statistics only — no Python needed
```

## What is here, and what is deliberately not

| | Where | Why |
|---|---|---|
| **Multivariate anomaly** (IsolationForest) | here | Needs a fitted model |
| **Delay-risk prediction** (gradient boosting) | here | Needs a fitted model |
| Cost outliers | TypeScript | A median-absolute-deviation test. Adding a network hop and a second failure mode to compute a median would buy nothing |
| Agency concentration | TypeScript | A binomial tail probability, same reasoning |
| Feature engineering | TypeScript | One definition of each feature, shared with the rule detectors, so the rules and the model cannot drift into disagreeing about what a number means |

A consequence worth stating: this service receives work ids and numbers. It
holds no scheme logic, no names, and no personal data.

## The service never blocks the platform

`ML_MODE=rules` (the default) skips it entirely. `ML_MODE=ml` calls it and
treats any failure — unreachable, slow, malformed — as "no model signals this
run", not an error. The rule and statistical detectors have already produced a
full alert queue by the time it is called.

That is not only demo insurance. An oversight platform that goes dark because a
model server restarted is worse than one with no model at all.

## Explanation by ablation

Neither model gives per-case feature attribution of its own, and a global
`feature_importances_` answers the wrong question — an officer needs to know why
*this* work was flagged, not which feature matters on average.

So each driver is measured with a counterfactual: if this work had been ordinary
on one feature — that feature replaced by the population median, the rest
untouched — how much would its score fall? That drop is the feature's
contribution, stated in the same units as the score, so a reviewer can check the
arithmetic.

Contributions do not sum to the total. Features interact, and presenting them as
though they add up would be a tidier story than the model supports.

## Anomaly detection: why unsupervised

There is no labelled corpus of MPLADS irregularity. Nobody has handed us ten
thousand works marked "this one was a problem". Training a classifier would mean
inventing those labels, and the model would then only rediscover whatever
assumption produced them.

IsolationForest asks a question that needs no labels: how few random splits does
it take to separate this work from the rest? Works unusual across several
dimensions at once — costly for their type *and* slow *and* thinly documented —
are isolated quickly, and that combination is exactly what a single-rule
detector cannot see.

`contamination` (default 0.05) sets what share of the population is treated as
outlying. It is a review-capacity decision — how many cases can land on
someone's desk — not a statistical one, so the caller owns it.

## Delay risk: why it uses so few features

This is the one supervised model, and it can be supervised because the label is
not a judgement — it is a date. A work either reached completion within 365 days
of sanction or it did not.

It uses **only attributes fixed at the moment of sanction**: size, units, how
long the district took to sanction, the season, and the past record of the
agency, district and work type. Those historical rates count only works whose
outcome was already settled on the sanction date, so no example learns from its
own future or from works that had not finished yet.

That restriction exists because the first version did not have it. Built on the
same features as the anomaly model, it reported an **AUC of 0.98** — which was
not a good model but a leaking one: `delayRatio`, "days past the deadline", was
in its input. It was reading the answer.

With the leak removed the honest figure is around **0.75 against a 25% base
rate**, and `tests/ml.test.ts` now asserts that no outcome-bearing feature can
return to the delay feature set.

Predictions are stored and displayed; they are **not** raised as alerts. An
alert says something has gone wrong and carries records that show it. A forecast
says something may go wrong. Treating the second as the first is how a
monitoring system starts accusing people of things that have not happened.

## Limits worth stating

- Accuracy figures describe behaviour on a **synthetic** dataset whose delay
  structure this project wrote. They say the model recovers relationships that
  are genuinely there; they say nothing about real MPLADS execution.
- The delay model sees nothing after sanction. A real eSAKSHI feed carries
  staged progress updates, which would let it use execution signals as they
  arrive without leaking. This dataset records only a work's current progress,
  so that is left for when real data is wired in.
- `contamination` fixes roughly how many works are flagged. It does not adapt to
  how many are actually unusual.
- Nothing here is evidence of wrongdoing.
