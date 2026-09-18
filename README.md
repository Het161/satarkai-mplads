# SatarkAI — MPLADS anomaly & oversight platform

**Smart India Hackathon 2026 · Problem Statement 26102 · MoSPI, Data
Informatics & Innovation Division**

AI-assisted monitoring for the Members of Parliament Local Area Development
Scheme: it reads sanctions, expenditure, payment stages, evidence uploads and
completion marking, and surfaces the works an officer should look at first.

> **AI flags, a human decides.** SatarkAI produces risk-prioritised, explainable
> prompts for review. It does not find fraud, close cases, or take action. Every
> alert carries its reason and the records behind it, and every officer action
> is recorded in an audit trail.

---

## Data provenance — read this first

**The dataset in this repository is synthetic.** It is generated locally by
`prisma/seed.ts` and is labelled as synthetic in the database (`DataSource`), in
a banner on every authenticated page, and here.

| | |
|---|---|
| **Real** | State, district and constituency names — used so the platform looks and behaves like the deployed thing. |
| **Fictional** | Every Member of Parliament, official, implementing agency and vendor. Every rupee figure, work, payment and date. |
| **Not reproduced** | Any official MPLADS record. No figure here is sourced from MoSPI. |

Planted anomalies are attached only to fictional entities. No real person or
organisation is associated with any risk signal in this build.

**Coverage gap.** The eSAKSHI portal holds MPLADS data from **1 April 2023**
onward. For the 17th Lok Sabha, FY 2019-20 to 2022-23 is not on the portal, and
Rajya Sabha details are unavailable before FY 2023-24. The seed mirrors that
window rather than fabricating earlier history, and the UI states the gap
wherever history is shown.

**Swapping in real data.** The pipeline is source-agnostic: the detectors read
Prisma models, not the seed. An eSAKSHI feed plugs in by writing to the same
`Work` / `Payment` / `Evidence` tables and inserting a `DataSource` row with
`kind = REAL`, `sourceUrl` and `fetchedAt`. Every figure in the UI renders its
source and date from that row, so real and synthetic data cannot be confused.

Reference portal: <https://mplads.mospi.gov.in/digigov/dashboard.html>

---

## Status

| Phase | Scope | State |
|-------|-------|-------|
| **1** | Repo, stack, design tokens, Prisma schema, auth + `scopeFor()` RBAC, seed with planted anomalies | **Done** |
| **2** | Eight rule detectors, alert generation with reason + evidence, alert queue | **Done** |
| **3** | FastAPI ML service — IsolationForest score + delay-risk, explainable, rules-only fallback, eval script | **Done** |
| 4 | Four role dashboards + single-work drill-down timeline | Not started |
| 5 | Review workflow, audit trail, notifications, CSV/PDF export | Not started |
| 6 | i18n (EN/HI), responsiveness, empty/loading/error states, documentation | Not started |

---

## Running it

Requires PostgreSQL and Node 18+. No network access is needed after install —
the font is self-hosted and the app reads only from the local database.

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and SESSION_SECRET
                              # openssl rand -base64 48

createdb satarkai
npm run db:push               # apply the schema
npm run db:seed               # generate the synthetic dataset
npm run detect                # run the detectors, populating the alert queue

npm run dev                   # http://localhost:3000
```

The model layer is optional and off by default. To enable it:

```bash
npm run ml:setup              # venv on Python 3.13 + pinned dependencies
npm run ml:serve              # in a second terminal
npm run detect:ml             # now includes the model and delay forecasts
```

### Demonstration accounts

Password for all: `satark@2026` (set via `SEED_PASSWORD`). Each account sees
only its own jurisdiction — that is the point of them.

| Email | Role | Sees |
|-------|------|------|
| `ministry@mospi.demo` | Ministry / Central Nodal Agency | Every state |
| `sna.gj@demo.gov` | State Nodal Authority | Gujarat, all districts |
| `district.gj-ahd@demo.gov` | District Authority | Ahmedabad district |
| `mp.gj@demo.gov` | Member of Parliament | Own recommended works |
| `ia.gj-ahd@demo.gov` | Implementing Agency | Own assigned works |

A per-state account exists for each of the six seeded states — substitute the
state code (`gj`, `mh`, `up`, `tn`, `wb`, `as`).

### Scripts

| Command | Does |
|---------|------|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:push` | Apply the Prisma schema |
| `npm run db:seed` | Regenerate the synthetic dataset (destructive) |
| `npm run db:reset` | Drop, re-push and re-seed |
| `npm run detect` | Run rules + statistics, reconcile the alert queue (no Python) |
| `npm run detect:ml` | As above, plus the model service |
| `npm run eval` | Score the detectors against the planted ground truth |
| `npm run ml:setup` / `ml:serve` / `ml:test` | The Python model service |
| `npm run check:baseline` | Verify the seed's clean baseline (see below) |
| `npm test` | RBAC isolation tests against the seeded database |
| `npm run typecheck` / `lint` | `tsc --noEmit` / `next lint` |

---

## How RBAC works

RBAC is **a server-side query filter**, not a UI concern.
[`scopeFor(user)`](src/lib/scope.ts) returns a `where` fragment per entity, and
every query that touches scheme data carries it:

```ts
const { user, scope } = await requireSession();
prisma.work.findMany({ where: scope.work });
prisma.work.count({ where: scoped(scope.work, { status: "IN_PROGRESS" }) });
```

Two properties make this hold up:

- **The failure mode is deny.** A user whose jurisdiction anchor is missing gets
  `DENY_ALL`, a fragment matching an impossible id. A broken account sees
  nothing; it never falls back to seeing everything.
- **`scoped()` rather than spread.** `{ ...scope.work, districtId: x }` looks
  equivalent but lets a colliding key overwrite the jurisdiction filter and
  silently unscope the query. `scoped()` puts both under `AND`, so a caller's
  filter can only narrow the result. The RBAC tests were written first and
  caught exactly this.

A cross-jurisdiction drill-down is **not found**, not refused — the id and the
scope sit in the same `WHERE`, so the page cannot confirm the record exists.

`npm test` proves all of it against the real seeded database: 46 tests in total,
covering each role's isolation, cross-jurisdiction drill-down, the
deny-by-default path for anchorless and unknown roles, the detector scoring
maths, the recall and precision claims above, and the ML layer's two guarantees
— that detection works with the service down, and that the delay model cannot
see its own answer.

---

## The seed, and why it is built in two passes

The seed's value rests on one invariant: **a work without a `PlantedAnomaly`
label must not trip any detector.** If the baseline leaks, Phase 3's precision
figure measures nothing, because an apparent false positive might just be a work
the generator made anomalous by accident.

So:

1. **A clean baseline.** Works complete inside the one-year window, payments
   trail progress and stay within the sanctioned amount, evidence is complete at
   every stage, recommendations stay inside the entitlement, and sanction dates
   keep clear of the financial-year boundary.
2. **Planted anomalies.** Selected works are mutated to violate exactly one
   rule, and the violation is written to `PlantedAnomaly` as ground truth.

`npm run check:baseline` re-implements the rule conditions independently of the
detectors — so the two cannot agree by sharing a bug — and reports any leak.

It also checks **chronology**, because a record can break no rule and still be
nonsense: a work completed before it was sanctioned, a vendor paid a year after
handover, evidence uploaded in the future. Planting moves dates around, and
every one of those errors appeared at some point during Phase 2. A reviewer who
finds one stops trusting every other figure on the page, so they are asserted
rather than assumed.

Current dataset: **912 works** across 6 states, 36 districts, 36 fictional MPs
and 108 fictional agencies, with 2,036 payment stages, 4,022 evidence records,
and **130 ground-truth labels covering all ten anomaly types**, spread across
every state rather than piled into one.

`PlantedAnomaly` exists only because the data is synthetic. A real feed has no
labels, which is precisely why the ML layer is unsupervised.

---

## The rule engine

Eight deterministic detectors, one per rule in
[`docs/SCHEME.md`](docs/SCHEME.md). Each reads its threshold from
[`src/lib/scheme.ts`](src/lib/scheme.ts) rather than inlining a number, so an
officer can see what fired and an administrator can retune it.

Every alert carries four things, because a signal nobody can check is not
oversight:

1. **A reason** — one sentence, in plain language, with the actual figures.
2. **The rule** — stated in words, including its threshold.
3. **The records** — the payment stages, peer works or other recommendations
   the rule read, with the breaching row marked.
4. **The score, itemised** — each weighted component, its basis, and its
   contribution, adding up in front of the reader.

The Anomaly-Priority Score (0–100) weighs *how badly the rule is broken*
against *how much money is exposed*. Value is log-scaled, so a ₹5 crore work
outranks a ₹5 lakh one without burying it a hundred places deeper.

The rules **partition rather than overlap**. A work finished but never marked
complete is not also reported as overdue; a work paid beyond its sanction is a
cost overrun, not additionally payment-ahead-of-progress. One work can still
raise several alerts when it genuinely breaks several rules — but a single
failure is reported once.

Re-running the engine is safe. An alert that still fires has its score and
evidence refreshed but **keeps its review state**, so an alert an officer marked
explained does not silently reopen. An alert that stops firing is withdrawn only
if nobody ever acted on it; once there is a decision on the record, the record
outranks the tidiness of the queue.

### Accuracy, and what the number is worth

`npm run eval` scores the detectors against the planted ground truth. All eight
currently sit at **100% precision and 100% recall** over 114 alerts.

**That figure measures internal consistency, not real-world accuracy.** The seed
and the detectors were built against the same definition of each rule, so a
perfect score is the expected result of both being correct — it says the rules
fire on what they are meant to and nothing else. It says nothing about how much
irregularity exists in real MPLADS execution, and it will not survive contact
with real data unchanged. Treat it as a regression test, which is what it is.

The number only means anything because the baseline is clean: see below.

### What the accuracy work actually found

Every gap the eval opened up turned out to be a modelling error, not a tuning
problem, and each was fixed at the source:

- **Duplicate detection matched boilerplate.** Comparing whole titles inside a
  district-and-work-type group scored "Covered Drainage Line at Ward No. 17,
  Surat" against "… at Ward No. 4, Surat" at 91% — two different drains in two
  different wards. The group had already controlled for type and district, so
  the only discriminating part was the location. `Work.locality` is now an
  explicit field, as it is in eSAKSHI, and the rule compares that.
- **Year-end clustering is a cluster, not a date filter.** Some sanctions always
  land in March. The rule compares each district-year's share of late sanctions
  against the evenly-spread rate and needs at least three works, so it reports
  crowding rather than a calendar.
- **Cluster members all scored alike.** Every work in a year-end cluster was
  scored by the cluster's total value, producing fifteen near-identical alerts
  that buried every other kind at the top of the queue. Each work is now scored
  by its own amount.
- **Cancelled recommendations release their funds**, so they are outside the
  entitlement total. The detector, the seed and the baseline check now use the
  same accounting.

## The model layer

Two things need scikit-learn, and they live in a separate FastAPI service
([`ml/`](ml/README.md)): the **multivariate anomaly score** and the
**delay-risk forecast**. Cost outliers and agency concentration do not — one is
a median-absolute-deviation test, the other a binomial tail probability — so
they run in-process. Adding a network hop and a second failure mode to compute a
median would buy nothing and would make the fallback poorer.

Feature engineering stays in TypeScript
([`src/lib/detectors/features.ts`](src/lib/detectors/features.ts)), shared with
the rule detectors, so there is one definition of "payment-to-progress gap" in
the codebase. The service receives work ids and numbers: no scheme logic, no
names, no personal data.

**The service never blocks the platform.** `ML_MODE=rules` skips it; `ML_MODE=ml`
calls it and treats any failure as "no model signals this run". The rule and
statistical detectors have already built a full queue by then. An oversight
platform that goes dark because a model server restarted is worse than one with
no model.

### Explanation by ablation

Neither model gives per-case attribution of its own, and a global
`feature_importances_` answers the wrong question — an officer needs to know why
*this* work was flagged. So each driver is measured with a counterfactual: had
this work been ordinary on one feature, the rest untouched, how much would its
score fall? That drop is the contribution, in the same units as the score.

Contributions do not sum to the total. Features interact, and presenting them as
if they added up would be a tidier story than the model supports.

### What the models found

| | |
|---|---|
| Multivariate anomalies flagged | 37 of 736 sanctioned works, at 5% contamination |
| Of those, also caught by a rule | 29 (78%) |
| Flagged by the model alone | 8 (22%) |
| Works planted as *unusual only in combination* | 12 |
| Found by the model | **12 (100% recall)** |
| Among the model's 8 solo flags | 7 of those 12, plus one cost outlier the statistical test narrowly missed |

The seed plants works placed deliberately *just inside* every threshold —
costly but under the outlier multiple, slow but inside the year, paid ahead but
under the payment gap, on a lumpy schedule no rule examines. Nothing fires.
Taken together they are plainly unusual, and everything-comfortably-under-every-
limit is what deliberate gaming actually looks like. Those works are the reason
to run a model at all, and the model finds all of them.

`npm run eval` deliberately does **not** report precision for this detector.
It is pointed at the cases no rule covers, so scoring it for failing to
reproduce the planted rule labels would report 0% for doing its job.

### Delay risk, and a leak that had to be fixed

Predicting whether a running work will pass 365 days from sanction. The label is
not a judgement but a date, which is what makes supervision defensible here.

The first version reported an **AUC of 0.98** against a 3% base rate. That was
not a good model — it was a leaking one. Built on the same features as the
anomaly detector, its input included `delayRatio`, "days past the deadline". It
was reading the answer.

The model now uses **only attributes fixed at the moment of sanction**: size,
units, how long the district took to sanction, the season, and the past record
of the agency, district and work type — where those rates count only works whose
outcome was already settled on that sanction date. The honest figure is
**AUC 0.75 against a 25% base rate**, and `tests/ml.test.ts` asserts that no
outcome-bearing feature can return.

Forecasts are stored and shown on their own page, and are **not** raised as
alerts. An alert says something has gone wrong and carries records that show it;
a forecast says something may go wrong. Treating the second as the first is how
a monitoring system starts accusing people of things that have not happened.

## Design

The "Audit" system: government-serious, dense, data-first. Ink, navy, slate on
paper; tabular figures for every money and count column; severity colour
(critical / high / medium / low / info) reserved for risk and never used
decoratively. WCAG AA, keyboard navigable, reduced-motion respected, and
readable at phone width — officials check these on phones.

## Stack

Next.js 14 (App Router) · TypeScript strict · Tailwind · PostgreSQL + Prisma ·
`jose` session cookies (httpOnly, `secure` in production, `sameSite=lax`,
configurable expiry) · bcrypt password hashing · Vitest.

The ML service (Phase 3) will be a separate Python/FastAPI process. `ML_MODE=rules`
is the default so the app runs with no Python setup at all, and falls back to
rules automatically if the service is unreachable. Nothing at demo time depends
on a network call.

## Limitations, stated plainly

- The dataset is synthetic. Detector accuracy on it says something about the
  detectors and nothing about real MPLADS execution.
- Thresholds other than the 365-day rule are review triggers chosen for this
  build. They need tuning against real reviewed outcomes.
- `IA_CONCENTRATION` and `COST_OUTLIER` are statistical signals. A dominant
  agency in a district may simply be the only one competent to do the work.
- No detector output is evidence of wrongdoing.
- The 100% rule-detector figure is a regression test against data built to the
  same rule definitions. It is not a claim about real-world accuracy.
- The delay model's AUC describes how well it recovers relationships this
  project wrote into the seed — agency reliability, work-type complexity,
  monsoon slippage. Real delay has its own structure, and the figure would not
  survive contact with it unchanged.
- The delay model sees nothing after sanction, because this dataset records only
  a work's current progress. A real eSAKSHI feed carries staged progress
  updates, which would let it use execution signals as they arrive without
  leaking.
- The synthetic baseline contains no naturally-overdue *running* works, so the
  overdue detector's precision is measured against planted cases only.

## Further reading

[`docs/SCHEME.md`](docs/SCHEME.md) — the workflow each detector attaches to, and
the citation behind every rule.
