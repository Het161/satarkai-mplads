# The MPLADS workflow, and where each detector attaches to it

Every rule in SatarkAI has to trace back to something the scheme actually does.
This file records the workflow the platform models and the step each detector
reads, so a reviewer can check a rule against the scheme rather than against our
opinion of it.

**Reference:** MPLADS eSAKSHI portal —
<https://mplads.mospi.gov.in/digigov/dashboard.html>

---

## The workflow

| # | Step | Actor | What the data records |
|---|------|-------|----------------------|
| 1 | **Entitlement** | Central Nodal Agency (MoSPI) | Each Hon'ble MP receives an annual entitlement through online authorisation at the start of the financial year or tenure. `Entitlement.amountAuthorised` |
| 2 | **Recommendation** | Member of Parliament | The MP recommends eligible developmental works in their constituency and earmarks funds against their entitlement. The total recommended is the MP's utilisation of allocated funds. `Work.recommendedAt`, `Work.recommendedAmount` |
| 3 | **Sanction** | District Authority (NDA/IDA) | Feasibility checks, then sanction of the work and designation of an Implementing Agency. `Work.sanctionedAt`, `Work.sanctionedAmount`, `Work.iaId` |
| 4 | **Completion window** | — | Sanctioned works are **generally required to be completed within one year of sanction**. `Work.expectedCompletionAt = sanctionedAt + 365 days` |
| 5 | **Execution & payment** | Implementing Agency | The IA raises vendor payment requests at stages set in the sanction order. Expenditure shown against a work is the total of vendor payments released. `Payment` |
| 6 | **Evidence** | Implementing Agency | Photographs of the asset at different stages of completion, plus documents such as the sanction order, uploaded at each payment stage. `Evidence` |
| 7 | **Completion marking** | Implementing Agency | The final step is the IA marking the work complete. **Only works marked complete appear as completed** on the public dashboard. District Authorities are continuously pursued to get IAs to mark completion — works left unmarked are an acknowledged problem, not a hypothetical one. `Work.markedCompleteAt` |
| 8 | **Currency** | All | Data is real-time; each stakeholder updates through their own login. |

## Stakeholders

These five are the scheme's actual roles, and they are exactly the roles
`scopeFor()` grants jurisdiction to:

- **Central Nodal Agency (MoSPI)** — national
- **State Nodal Authority** — one state
- **District Authority (NDA/IDA)** — one district
- **Member of Parliament** — own recommended works
- **Implementing Agency** — own assigned works

---

## Detectors and the step each reads

### Rule-based — deterministic and citable

| Detector | Step | Condition |
|----------|------|-----------|
| `OVERDUE` | 4 | Sanctioned more than 365 days ago and not marked complete — the one-year guideline is breached. |
| `PAYMENT_AHEAD` | 5 | Cumulative vendor payments released are disproportionate to recorded work progress. |
| `COST_OVERRUN` | 3, 5 | Total payments exceed the sanctioned amount beyond a configurable threshold. |
| `ENTITLEMENT_BREACH` | 1, 2 | An MP's total recommended amount for a financial year exceeds their annual entitlement. |
| `MISSING_EVIDENCE` | 6 | A payment stage was released with no asset photograph or document on record. |
| `STUCK_UNMARKED` | 7 | Work is complete on the ground but the IA never marked completion, so it never shows as completed. |
| `DUPLICATE` | 2, 3 | Near-identical work description, same district, overlapping period. |
| `FY_END_SPIKE` | 3, 5 | Abnormal clustering of sanctions or payments in the closing weeks of a financial year. |

All eight are implemented in
[`src/lib/detectors/rules.ts`](../src/lib/detectors/rules.ts). Two design rules
apply across them:

- **They partition rather than overlap.** A finished-but-unmarked work is
  reported as `STUCK_UNMARKED`, not additionally as `OVERDUE`; a work paid past
  its sanction is a `COST_OVERRUN`, not additionally `PAYMENT_AHEAD`. One work
  can raise several alerts when it genuinely breaks several rules, but a single
  failure is reported once.
- **Cluster rules compare against a baseline.** `FY_END_SPIKE` does not flag
  every March sanction — some always land there. It compares each
  district-year's share of late sanctions against the evenly-spread rate and
  requires at least three works, so it reports crowding rather than a date.

### ML-based — explainable, unsupervised

No labelled corpus of MPLADS fraud exists, so nothing here is trained on
"known fraud". These are unsupervised outlier signals with the drivers exposed.

| Detector | Basis |
|----------|-------|
| `COST_OUTLIER` | Cost per unit far from the peer distribution for the same work type within a district or state. |
| `IA_CONCENTRATION` | One implementing agency or vendor holding a disproportionate share of a district's works or value. A signal for review, not an accusation. |
| `ML_ANOMALY` | IsolationForest over engineered features — cost versus peers, delay days, payment-to-progress ratio, evidence completeness, agency concentration, timing — producing an Anomaly-Priority Score of 0 to 100. |

### Predictive

Delay-risk prediction for in-progress works: the likelihood of breaching the
one-year window, from days since sanction, progress rate, agency history and
work type, returned as a risk band with its top drivers.

---

## Thresholds

Every threshold lives in [`src/lib/scheme.ts`](../src/lib/scheme.ts), not inline
in a detector, so a reviewer can see what fired and an administrator can revise
it. The 365-day window is the scheme's own rule; the rest are review triggers
chosen for this build and meant to be tuned against real outcomes.

---

## What the platform does not do

It does not decide that fraud occurred. Every output is a risk-prioritised
prompt for a human officer, carrying its reason and the records behind it. An
officer acknowledges, seeks clarification, marks the case explained, or
escalates — and every one of those actions is recorded in the audit trail.
Nothing is auto-closed, auto-punished, or reported as fraud by the system.

## Known data coverage gap

eSAKSHI holds MPLADS data **from 1 April 2023 onward**. For the 17th Lok Sabha,
FY 2019-20 to 2022-23 is not on the portal, and Rajya Sabha details are
unavailable before FY 2023-24. The platform labels this wherever history is
shown rather than presenting a partial series as a complete one.
