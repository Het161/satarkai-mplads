# SIH 2026 deck — prompt for Claude Design

Paste everything below the line into Claude Design (or any Claude session with
the `design` skill). It produces the six-slide SatarkAI deck in the same visual
family as TechnoVerse's AnnaSetu deck, so both submissions look like they came
from one team.

**Two figures to confirm before submitting** — run `npm run detect` and
`npm run detect:ml`, and correct them in the prompt if they differ:

- total alerts without Python (last seen: **140**) and with the model (**180**)
- the README and `docs/assets/architecture.svg` currently say *134 of 174*,
  which is from an earlier seed. Regenerate with
  `python3 scripts/build-diagrams.py` after fixing.

Also confirm **Team ID** and whether the problem statement ID is written
`26102` or `SIH26102` on the SIH portal.

---

# Build a 6-slide Smart India Hackathon 2026 deck

You are producing the official idea-submission deck for **Team TechnoVerse**,
problem statement **26102** (Ministry of Statistics and Programme
Implementation). The project is **SatarkAI** — an AI-assisted anomaly, fraud and
inefficiency detection platform for the MPLADS scheme.

Make **six artboards at 1920 × 1080 (16:9)**, one per slide, laid out on a
single canvas in order.

This deck must match an existing deck by the same team, so the chrome below is
not a suggestion — copy it exactly.

---

## Submission details

| Field | Value |
|---|---|
| Problem Statement ID | **26102** |
| Theme | Smart Automation |
| Category | Software |
| Organisation | Ministry of Statistics and Programme Implementation (MoSPI) |
| Department | Data Informatics & Innovation Division (DIID) |
| Problem Statement Title | Development of an AI-powered system to detect anomalies, fraud, and inefficiencies in MPLAD Scheme implementation |
| Team Name | **TechnoVerse** |
| Team ID | 125990 |
| Project Name | **SatarkAI** (सतर्क — "vigilant") |
| Tagline | Catching what a rule-by-rule check cannot see |

---

## Visual system — copy this exactly

**Slide chrome, on every slide except the title page:**

- **Team badge, top-left:** the word `TechnoVerse` inside a thin purple-outlined
  ellipse (~#8B7BD8, 1.5px stroke, no fill). Roughly 280 × 90 px at 1920 wide.
- **Slide title, centred at top:** ALL CAPS, **serif** (Times New Roman / Georgia
  style), heavy weight, ~64px, near-black. Wide letter-spacing.
- **SIH 2026 logo block, top-right:** the SIH brain-bulb mark with
  "SMART INDIA HACKATHON 2026" set in two or three lines beside it.
- **Footer bar, full width:** solid blue (#1B6FC4), ~52px tall. Centred white
  text `@SIH Idea submission`. Slide number in white, bold, at the right edge.
- **Canvas:** white. All content sits between the title and the footer bar.

**Colour palette** — this is the product's own "Audit" system, so use it rather
than inventing one:

| Role | Hex |
|---|---|
| Ink (primary text) | `#0B1220` |
| Navy (headings, structure) | `#12356B` |
| Slate (secondary text) | `#45536B` |
| Hairline / borders | `#DCE3EC` |
| Paper (panel fills) | `#F6F8FB` |
| Accent blue | `#2a78d6` |
| Accent aqua | `#1baf7a` |
| Accent violet | `#7C6CE0` |
| Accent orange | `#eb6834` |
| Critical (risk only) | `#B3261E` |
| High (risk only) | `#D97706` |

**One hard rule about colour:** the critical/high reds and ambers are *severity*
colours. Use them only where the meaning is genuinely risk or a warning. Never
as decoration, never as "the third card's colour".

**Body type:** a clean sans (Inter / Segoe UI / Helvetica). Tabular figures for
every number. Dense and data-first — this is a government oversight tool, not a
consumer app. No gradients on text, no drop shadows, no 3D bevels, no clip-art.

**Panel style:** white or `#F6F8FB` cards, 1px `#DCE3EC` border, 8px radius,
generous internal padding. Section headings inside cards in ALL CAPS, ~13px,
letter-spaced, coloured by the accent for that card.

---

## Slide 1 — TITLE PAGE

Centre-top: `SMART INDIA HACKATHON 2026` (serif, ALL CAPS, very large), then
`TITLE PAGE` beneath it, same treatment, slightly smaller.

Left column, bulleted, generous line spacing — bold the label, regular the value:

- **Problem Statement ID:** 26102
- **Theme:** Smart Automation
- **Category:** Software
- **Org.:** Ministry of Statistics and Programme Implementation
- **Problem Statement Title:** Development of an AI-powered system to detect
  anomalies, fraud, and inefficiencies in MPLAD Scheme implementation
- **Team Name:** TechnoVerse
- **Team ID:** 125990

Right side: the large SIH 2026 brain-bulb graphic inside its faint grey hexagon
frame, filling roughly the right 40% of the slide.

No footer bar on this slide.

---

## Slide 2 — SATARKAI (सतर्क)

Title: `SATARKAI (सतर्क)` — serif, ALL CAPS, with the Devanagari in brackets.
Subtitle directly beneath, regular weight: *AI-Assisted Anomaly Detection &
Oversight for MPLADS*.

Layout: **three journey panels across the left 72%, one summary panel on the right 28%.**

Each of the three panels has a bold heading and a vertical flow of labelled
steps with small icons and downward arrows between them — the same shape as a
phone-screen walkthrough, but these are desktop oversight screens, so draw them
as browser-window frames (a thin bar with three dots at the top) rather than
phone bezels.

**Panel 1 — "See What Needs Attention"**
Steps, top to bottom:
1. 📊 Role dashboard opens
2. 🔢 Alerts ranked 0–100
3. 🎯 Highest priority first
4. 🔍 Filter by type, severity, state
5. 📍 Scoped to your jurisdiction

Caption strip beneath, dark navy fill, white text:
*Five roles. Each sees only its own jurisdiction.*

**Panel 2 — "Understand Why It Was Flagged"**
Steps:
1. 📄 The reason, in plain words
2. ⚖️ The rule, with its threshold
3. 🗂️ The records it read
4. 🧮 The score, itemised
5. 🕐 Pinned to the step on the timeline

Caption strip:
*An officer should be able to disagree from this page alone.*

**Panel 3 — "Decide, and Be Accountable"**
Steps:
1. ✅ Acknowledge
2. ❓ Seek clarification
3. 📝 Mark as explained
4. ⬆️ Escalate
5. 🔒 Recorded in the audit trail

Caption strip:
*Nothing closes itself. Every decision carries a name.*

**Right summary panel** — heading in large bold text:
**"Every alert tells the officer exactly why."**

Four small cards below it, 2 × 2, each with an icon, a bold label and one line:

| Card | Label | Line |
|---|---|---|
| ⚖️ | **Rule** | the scheme rule + its threshold |
| 🗂️ | **Evidence** | the exact records it read |
| 🧮 | **Score** | each weighted part, shown |
| 👤 | **Decision** | who decided, and why |

Beneath the three panels, a status strip mirroring the reference deck's
"NOT STARTED → INITIATED → PAID" chip row — here:

`AWAITING REVIEW` → `ACKNOWLEDGED` → `EXPLAINED / ESCALATED`

in grey → blue → green chips, with a caption:
*The detection engine never changes review state. Only a person does.*

---

## Slide 3 — TECHNICAL APPROACH FLOW

Four regions across the slide.

**Left ~28% — the architecture flow**, boxes joined by arrows, top to bottom:

```
[ OFFICER / MP / AGENCY ]   [ CLI: detect · eval · tune ]
              ↓                          ↓
        ┌──────────────────────────────────────┐
        │          APPLICATION LAYER           │
        │   Next.js 14 · Server Components     │
        └──────────────────────────────────────┘
          ↓                ↓               ↓
 [ PostgreSQL ]   [ Rule engine +  ]  [ Review workflow ]
 [  + Prisma   ]  [ statistical     ]  [ + audit trail  ]
                  [ detectors       ]
       ↑                  ↓
 [ eSAKSHI feed ]   [ Model service  ] ---- optional ---→ [ Rules-only fallback ]
 [ (pluggable)  ]   [ FastAPI +      ]
 [ DataSource   ]   [ scikit-learn   ]
```

Style the "Model service" box with a **dashed** border and the "Rules-only
fallback" box in orange, to make the optionality visible at a glance.

**Middle ~36% — three feature cards**, stacked, each with a large icon on the
left, a bold title and two lines of body:

1. **🛡️ Jurisdiction as a query filter** *(violet card)*
   RBAC is a `where` fragment carried by every query, not a hidden button. A
   missing jurisdiction yields `DENY_ALL` — the failure mode is *see nothing*,
   never *see everything*.

2. **🧾 Every alert is a reviewable case** *(green card)*
   Reason, rule, records and an itemised score ship with each alert. Evidence
   rows mark exactly which one breaches.

3. **🔒 Append-only accountability** *(orange card)*
   State change, action record and audit entry are written in one transaction.
   No transition returns an alert to untouched.

**Right ~24% — "AI Mini-card"**, styled exactly like the reference deck's:

> **AI Mini-card**
> **Multivariate Anomaly Detection**
> Model: `IsolationForest` (unsupervised)
>
> **Inputs (11 features):**
> a 4 × 3 grid of small icons with one-or-two-word labels —
> Cost vs peers · Delay · Payment gap · Evidence · Sanction ratio · Agency share
> · Year-end · Schedule shape · Sanction lag · Work size · Progress rate
>
> **Output: 0–100 unusualness + top 3 drivers**
>
> *Explained by ablation. ML unavailable → rules + statistics continue.*

Add a second, smaller mini-card beneath if it fits:

> **Delay-Risk Prediction**
> Model: `HistGradientBoostingClassifier`
> Sanction-time attributes only
> **AUC 0.75** vs a 25% base rate

**Bottom strip**, full width, matching the reference deck's tech-stack bar:

`Compact Tech Stack:` **Next.js 14 | TypeScript | PostgreSQL | Prisma | Python/FastAPI | scikit-learn | Playwright | Vitest**

with a small badge at the right: **`ML_MODE=rules`** — *works with zero Python*

---

## Slide 4 — FEASIBILITY AND VIABILITY

Heading inside the content area: **Solution Roadmap & Validation**.
Add the same small illustration motif the reference deck uses (a figure with a
phone) in the top-right of the content area — here, an official at a desk.

**Green-bordered panel, left ~62%: ● BUILT / CURRENT SOLUTION**
Two bullet columns:

*Column A*
- Five role dashboards (Ministry, State, District, MP, Agency)
- Jurisdiction-scoped RBAC on every query
- 8 rule detectors traced to scheme rules
- 2 statistical tests (cost outliers, agency concentration)
- IsolationForest multivariate detection

*Column B*
- Delay-risk early warning
- Review workflow + append-only audit trail
- CSV and PDF case-note export
- Notifications (in-app, email, SMS/IVR stubbed)
- English & हिन्दी · WCAG 2.1 AA

**Grey-bordered panel, right ~34%: ● PILOT VALIDATION**
- Detector precision against reviewed outcomes
- Threshold calibration per district
- Officer review time per alert
- False-positive rate in the field
- Agency response to clarification requests
- Escalation pathway in practice
- eSAKSHI feed integration

**Blue-bordered panel, full width: ● FUTURE INNOVATION** — three columns:

| **Vendor Network Analysis** | **Geo-Verification of Assets** | **Cross-Scheme Duplicate Check** |
|---|---|---|
| Graph analysis across vendors, agencies and districts to surface shared-beneficiary patterns a single-district view cannot see. | Compare uploaded asset photographs and coordinates against the sanctioned location. | Match MPLADS works against other schemes funding the same asset. |

**Bottom strip: ● FUTURE INTEGRATION**
`Live eSAKSHI feed · PFMS payment reconciliation · CAG audit hand-off · State portal interoperability · Production SMS & IVR`

---

## Slide 5 — IMPACT AND BENEFITS

Heading: **Stakeholder Benefits, Model Benchmark & Pilot Metrics**.

**Three stakeholder columns across the top.** Each: a coloured heading, four
sub-headed paragraphs, and a coloured summary line at the foot of the card.

**MINISTRY / MoSPI** *(green card)*
- **National Triage** — See which states carry the most risk, ranked, instead of reading every work.
- **Where Money Is Waiting** — Recommended vs sanctioned vs actually released, at every level.
- **Evidence of Oversight** — Every decision recorded, visible upward by jurisdiction.
- **Detector Tuning** — Reviewer outcomes feed a tuning pass; a person changes the threshold.

Summary line: *Scheme-wide visibility. Nothing hidden upward.*

**STATE & DISTRICT AUTHORITIES** *(blue card)*
- **Which District to Chase** — Districts ranked against each other on the measures that prompt a call.
- **What Can Be Fixed Today** — Payment stages missing evidence; works finished but unmarked.
- **Agency Performance** — Completion rate, overdue works and evidence completeness per agency.
- **A Trail That Protects You** — Your reasoning is on the record, in your own words.

Summary line: *Targeted action. Defensible decisions.*

**MPs & IMPLEMENTING AGENCIES** *(navy card)*
- **What the Entitlement Bought** — Authorised vs recommended vs sanctioned vs paid, year by year.
- **What Is Running Late** — Delayed works named in plain language, no jargon, no scores.
- **Outstanding Actions** — Photographs to upload; works to mark complete.
- **No Accusation** — An agency cannot close an alert about itself.

Summary line: *Clear answers. Fair process.*

**Bottom-left panel — MODEL BENCHMARK** *(mirror the reference deck's before→after treatment)*

> **Delay-Risk Model — leak found and fixed**
> **AUC 0.98** ← first version, *leaking* (days-past-deadline was in its input)
> ↓
> **AUC 0.75** ← sanction-time attributes only, against a 25% base rate
> **A test now blocks the leak returning.**
> *Synthetic data. Field validation pending.*

**Bottom-right panel — PILOT SUCCESS METRICS** — three large figures:

| **100%** | **12 / 12** | **0** |
|---|---|---|
| Rule-detector precision & recall *(regression test on planted ground truth)* | Multivariate-only anomalies found by the model *breaking no single rule* | WCAG 2.1 AA violations across all pages |

Caption beneath, small and grey:
*Measured on synthetic data built to the same rule definitions. Field validation pending.*

---

## Slide 6 — RESEARCH AND REFERENCES

**Comparison table across the top** — same shape as the reference deck, with the
rightmost column highlighted in navy with white header text:

| Capability | eSAKSHI portal | Generic BI dashboard | **SatarkAI** |
|---|---|---|---|
| Record of works & payments | ✅ Complete | Imports it | **Reads it as evidence** |
| Rule-based irregularity detection | ❌ | Manual thresholds | ✅ **8 rules traced to the scheme** |
| Multivariate anomaly detection | ❌ | ❌ | ✅ **Combinations no rule covers** |
| Delay early warning | ❌ | ❌ | ✅ **Forecast + drivers** |
| Explainable alerts | ❌ | Score only | ✅ **Reason, rule, records, score** |
| Jurisdiction-scoped access | Login-based | Usually UI-only | ✅ **Server-side query filter** |
| Review workflow + audit trail | ❌ | ❌ | ✅ **Append-only, named** |

Caption beneath the table, italic:
*Every alert carries the rule it applied, the records it read and the arithmetic behind its score.*

**"Future Scope" — three cards** with icons:

| 👥 **Vendor Network Analysis** | 📷 **Geo-Verification of Assets** | 🔗 **Cross-Scheme Duplicate Check** |
|---|---|---|
| Shared-beneficiary patterns across districts | Photograph & coordinate matching | Same asset funded twice, across schemes |

**Bottom row — three labelled blocks:**

| 📄 **Official Sources** | 💻 **Prototype** | 👥 **Validation** |
|---|---|---|
| MPLADS eSAKSHI portal · MPLADS Guidelines · MoSPI · SIH Problem Statement 26102 | Working web application, 5 role dashboards, 112 automated tests | Synthetic dataset with planted ground truth; field validation planned during pilot |

**Final line, full width, links underlined in blue:**

*Working prototype is running locally. | GitHub repo is private. | MPLADS eSAKSHI portal is the source of our scheme model.*

---

## Locked fact sheet — use these, do not invent others

**The scheme**
- ₹5 crore annual entitlement per Member of Parliament
- Sanctioned works to be completed **within one year of sanction**
- Only works an agency **marks complete** appear as completed
- eSAKSHI holds data from **1 April 2023** onward
- Five roles: Ministry/CNA · State Nodal Authority · District Authority · MP · Implementing Agency

**The dataset (synthetic)**
- 968 works · 2,162 payments · 4,274 evidence files
- 146 ground-truth labels · 6 states · 36 districts
- 36 fictional MPs · 108 fictional agencies

**Detection**
- 8 rule detectors · 2 statistical tests · 1 IsolationForest · 1 delay model
- Rule detectors: **100% precision, 100% recall** (118 alerts) — a *regression test*
- IsolationForest: 40 flagged, 32 also caught by rules, **8 flagged by the model alone**
- **12 of 12** multivariate-only anomalies found — works breaking no single rule
- 7 of those 8 solo flags were exactly those planted cases
- Delay model: **AUC 0.75**, 25% base rate (first version leaked at 0.98)
- Alerts without Python: **~140** · with the model: **~180** *(confirm before submitting)*

**Engineering**
- 79 unit/integration + 21 end-to-end + 12 Python tests = **112**
- **Zero** WCAG 2.1 AA violations, checked by axe on every page
- English and हिन्दी · `<html lang>` follows the choice
- Stack: Next.js 14 · TypeScript · Tailwind · PostgreSQL · Prisma · Recharts ·
  FastAPI · scikit-learn · Python 3.13 · Playwright · Vitest · axe-core

---

## Tone — this is what makes the deck different

The single most distinctive thing about this project is that **it does not
oversell itself**. Carry that into the deck; do not sand it off.

1. **"AI flags. A human decides."** should appear on the deck. No output is a
   finding of fraud. Nothing is auto-closed, auto-reported or auto-punished.
2. **Say the data is synthetic** on any slide that shows a metric. The words
   *"Synthetic data. Field validation pending."* belong under the benchmark
   figures, exactly as the reference deck says *"Synthetic test data. Field
   validation pending."*
3. **Frame 100% honestly.** It is a regression test against data built to the
   same rule definitions — not a real-world accuracy claim. Label it that way.
4. **The AUC 0.98 → 0.75 story is a strength, not an embarrassment.** A team
   that finds its own leak and reports the lower number is the team you trust.
   Present it as *"leak found and fixed"*.
5. **Never name a real MP, official, agency or vendor.** Every person in this
   project's data is invented, and that was a deliberate choice.

---

## Do not

- Do not invent metrics, percentages, user counts, cost savings or timelines.
  If a number is not in the fact sheet, leave it out.
- Do not claim the system detects fraud. It produces prompts for human review.
- Do not use severity red or amber decoratively.
- Do not use stock photography, 3D bevels, drop shadows or clip-art.
- Do not put more than ~45 words in any single card.
- Do not drop the team badge, the footer bar or the slide numbers.
- Do not present synthetic figures as official MoSPI data anywhere.
