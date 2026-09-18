import { COMPLETION_WINDOW_DAYS, THRESHOLDS, financialYearEnd } from "../scheme";
import { formatDate, formatINR, formatINRExact } from "../format";
import {
  daysBetween,
  isFinishedButUnmarked,
  isLive,
  num,
  totalPaid,
  type DetectorContext,
  type WorkRecord,
} from "./context";
import {
  makeFinding,
  ratioComponent,
  valueComponent,
  type Finding,
} from "./types";

/**
 * The eight deterministic detectors.
 *
 * Each one maps to a step of the real eSAKSHI workflow (see docs/SCHEME.md) and
 * reads its threshold from `THRESHOLDS`, never from a number inlined here — so
 * an officer can see what fired, and an administrator can retune it.
 *
 * The rules are written to partition rather than overlap. A work that is
 * finished-but-unmarked is not also reported as overdue; a work paid beyond its
 * sanction is reported as a cost overrun, not additionally as payment-ahead.
 * Duplicate alerts on one work would just make the queue noisier, and would
 * make the accuracy numbers in `npm run eval` impossible to read.
 */

// ---------------------------------------------------------------------------
// 1. OVERDUE — past the scheme's one-year completion guideline
// ---------------------------------------------------------------------------

export function detectOverdue(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];

  for (const w of ctx.works) {
    if (!isLive(w) || w.markedCompleteAt) continue;
    // Finished on the ground but unmarked is a different failure — the work is
    // done and the *record* is stale. detectStuckUnmarked owns those.
    if (isFinishedButUnmarked(w)) continue;

    const age = daysBetween(w.sanctionedAt!, ctx.now);
    const overdueBy = age - COMPLETION_WINDOW_DAYS;
    if (overdueBy <= 0) continue;

    const sanctioned = num(w.sanctionedAmount);

    out.push(
      makeFinding(
        w.id,
        "OVERDUE",
        `Sanctioned ${age} days ago and still not marked complete — ${overdueBy} days past the scheme's one-year completion guideline, with progress recorded at ${w.progressPct}%.`,
        {
          rule: `A sanctioned work is generally required to be completed within ${COMPLETION_WINDOW_DAYS} days of sanction.`,
          facts: [
            { label: "Sanctioned on", value: formatDate(w.sanctionedAt) },
            { label: "Due for completion", value: formatDate(w.expectedCompletionAt) },
            { label: "Days past the guideline", value: `${overdueBy}` },
            { label: "Recorded progress", value: `${w.progressPct}%` },
            { label: "Sanctioned amount", value: formatINRExact(sanctioned) },
            { label: "Released to vendors", value: formatINRExact(totalPaid(w)) },
            { label: "Implementing agency", value: w.ia?.name ?? "Not designated" },
          ],
        },
        [
          {
            label: "Extent of delay",
            weight: 0.5,
            // A year past the deadline saturates the component.
            value: ratioComponent(overdueBy, 365),
            basis: `${overdueBy} days past the ${COMPLETION_WINDOW_DAYS}-day guideline`,
          },
          {
            label: "Work left undone",
            weight: 0.2,
            value: 100 - w.progressPct,
            basis: `${w.progressPct}% recorded progress`,
          },
          {
            label: "Value at stake",
            weight: 0.3,
            value: valueComponent(sanctioned),
            basis: `${formatINR(sanctioned)} sanctioned`,
          },
        ],
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// 2. PAYMENT_AHEAD — money released well beyond recorded physical progress
// ---------------------------------------------------------------------------

export function detectPaymentAhead(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];

  for (const w of ctx.works) {
    if (!isLive(w) || w.payments.length === 0) continue;
    if (w.progressPct >= 100) continue; // nothing is "ahead" of finished work

    const sanctioned = num(w.sanctionedAmount);
    if (sanctioned <= 0) continue;

    const paid = totalPaid(w);
    const paidShare = paid / sanctioned;

    // Paid beyond the sanction is a cost overrun, and detectCostOverrun reports
    // it with the right framing. Here the concern is sequencing, not total.
    if (paidShare > 1 + THRESHOLDS.costOverrunPct) continue;

    const gap = paidShare - w.progressPct / 100;
    if (gap <= THRESHOLDS.paymentAheadOfProgressPct) continue;

    const flaggedStage = w.payments[w.payments.length - 1];

    out.push(
      makeFinding(
        w.id,
        "PAYMENT_AHEAD",
        `${Math.round(paidShare * 100)}% of the sanctioned amount has been released to the vendor against ${w.progressPct}% recorded progress — a gap of ${Math.round(gap * 100)} percentage points.`,
        {
          rule: `Payments released should track recorded progress. Flagged when the released share exceeds recorded progress by more than ${Math.round(THRESHOLDS.paymentAheadOfProgressPct * 100)} percentage points.`,
          facts: [
            { label: "Sanctioned amount", value: formatINRExact(sanctioned) },
            { label: "Released to vendors", value: formatINRExact(paid) },
            { label: "Released as share of sanction", value: `${Math.round(paidShare * 100)}%` },
            { label: "Recorded progress", value: `${w.progressPct}%` },
            { label: "Gap", value: `${Math.round(gap * 100)} percentage points` },
            { label: "Implementing agency", value: w.ia?.name ?? "Not designated" },
          ],
          rows: w.payments.map((p) => ({
            label: `Stage ${p.stageNo}`,
            flagged: p.id === flaggedStage.id,
            values: [
              { label: "Amount", value: formatINRExact(num(p.amount)) },
              { label: "Released", value: formatDate(p.releasedAt) },
              { label: "Vendor", value: p.vendorName ?? "—" },
              { label: "Voucher", value: p.voucherRef ?? "—" },
            ],
          })),
        },
        [
          {
            label: "Size of the gap",
            weight: 0.6,
            // A 60-point gap — say 80% paid on 20% done — saturates.
            value: ratioComponent(gap, 0.6),
            basis: `${Math.round(gap * 100)} points between payment and progress`,
          },
          {
            label: "Value released",
            weight: 0.4,
            value: valueComponent(paid),
            basis: `${formatINR(paid)} already released`,
          },
        ],
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// 3. COST_OVERRUN — expenditure beyond the sanctioned amount
// ---------------------------------------------------------------------------

export function detectCostOverrun(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];

  for (const w of ctx.works) {
    if (!isLive(w) || w.payments.length === 0) continue;

    const sanctioned = num(w.sanctionedAmount);
    if (sanctioned <= 0) continue;

    const paid = totalPaid(w);
    const overrun = paid - sanctioned;
    const overrunPct = overrun / sanctioned;
    if (overrunPct <= THRESHOLDS.costOverrunPct) continue;

    // Name the stage that carried the cumulative total past the sanction.
    let running = 0;
    const breachStageId = w.payments.find((p) => {
      running += num(p.amount);
      return running > sanctioned;
    })?.id;

    out.push(
      makeFinding(
        w.id,
        "COST_OVERRUN",
        `Vendor payments of ${formatINR(paid)} have been released against a sanctioned amount of ${formatINR(sanctioned)} — an overrun of ${Math.round(overrunPct * 100)}%, or ${formatINR(overrun)}.`,
        {
          rule: `Total vendor payments should not exceed the sanctioned amount. Flagged above ${Math.round(THRESHOLDS.costOverrunPct * 100)}%.`,
          facts: [
            { label: "Sanctioned amount", value: formatINRExact(sanctioned) },
            { label: "Released to vendors", value: formatINRExact(paid) },
            { label: "Overrun", value: `${formatINRExact(overrun)} (${Math.round(overrunPct * 100)}%)` },
            { label: "Recorded progress", value: `${w.progressPct}%` },
            { label: "Work status", value: w.status },
            { label: "Implementing agency", value: w.ia?.name ?? "Not designated" },
          ],
          rows: w.payments.map((p) => ({
            label: `Stage ${p.stageNo}`,
            flagged: p.id === breachStageId,
            values: [
              { label: "Amount", value: formatINRExact(num(p.amount)) },
              { label: "Released", value: formatDate(p.releasedAt) },
              { label: "Vendor", value: p.vendorName ?? "—" },
              { label: "Voucher", value: p.voucherRef ?? "—" },
            ],
          })),
        },
        [
          {
            label: "Size of the overrun",
            weight: 0.6,
            // 50% over the sanction saturates the component.
            value: ratioComponent(overrunPct, 0.5),
            basis: `${Math.round(overrunPct * 100)}% above the sanctioned amount`,
          },
          {
            label: "Excess amount",
            weight: 0.4,
            value: valueComponent(overrun),
            basis: `${formatINR(overrun)} beyond sanction`,
          },
        ],
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// 4. ENTITLEMENT_BREACH — an MP's recommendations exceed the annual entitlement
// ---------------------------------------------------------------------------

export function detectEntitlementBreach(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];

  const byMpFy = new Map<string, WorkRecord[]>();
  for (const w of ctx.works) {
    if (w.status === "CANCELLED") continue;
    const key = `${w.mpId}|${w.financialYear}`;
    const bucket = byMpFy.get(key) ?? [];
    bucket.push(w);
    byMpFy.set(key, bucket);
  }

  for (const ent of ctx.entitlements) {
    const bucket = byMpFy.get(`${ent.mpId}|${ent.financialYear}`);
    if (!bucket) continue;

    const authorised = num(ent.amountAuthorised);
    const total = bucket.reduce((s, w) => s + num(w.recommendedAmount), 0);
    const excess = total - authorised;
    if (excess <= authorised * THRESHOLDS.entitlementBreachPct) continue;

    // Attach the alert to the recommendation that carried the year past the
    // entitlement — chronologically the first one that could not be funded.
    const ordered = [...bucket].sort(
      (a, b) => a.recommendedAt.getTime() - b.recommendedAt.getTime(),
    );
    let running = 0;
    const breaching =
      ordered.find((w) => {
        running += num(w.recommendedAmount);
        return running > authorised;
      }) ?? ordered[ordered.length - 1];

    out.push(
      makeFinding(
        breaching.id,
        "ENTITLEMENT_BREACH",
        `Recommendations by ${ent.mp.name} for FY ${ent.financialYear} total ${formatINR(total)} against an annual entitlement of ${formatINR(authorised)} — ${formatINR(excess)} beyond what was authorised. This recommendation is the one that carried the year past the limit.`,
        {
          rule: "The total amount an MP recommends and earmarks in a financial year cannot exceed the entitlement authorised for that year.",
          facts: [
            { label: "Member of Parliament", value: ent.mp.name },
            { label: "Financial year", value: ent.financialYear },
            { label: "Entitlement authorised", value: formatINRExact(authorised) },
            { label: "Total recommended", value: formatINRExact(total) },
            { label: "Excess", value: formatINRExact(excess) },
            { label: "Works recommended", value: `${bucket.length}` },
          ],
          rows: ordered.map((w) => ({
            label: w.workCode,
            flagged: w.id === breaching.id,
            values: [
              { label: "Work", value: w.title },
              { label: "Recommended", value: formatDate(w.recommendedAt) },
              { label: "Amount", value: formatINRExact(num(w.recommendedAmount)) },
              { label: "District", value: w.district.name },
            ],
          })),
          relatedWorkIds: ordered.map((w) => w.id),
        },
        [
          {
            label: "Size of the breach",
            weight: 0.6,
            // 25% beyond the entitlement saturates.
            value: ratioComponent(excess / authorised, 0.25),
            basis: `${Math.round((excess / authorised) * 100)}% above the entitlement`,
          },
          {
            label: "Excess amount",
            weight: 0.4,
            value: valueComponent(excess),
            basis: `${formatINR(excess)} beyond entitlement`,
          },
        ],
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// 5. MISSING_EVIDENCE — a payment stage released without asset evidence
// ---------------------------------------------------------------------------

export function detectMissingEvidence(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];

  for (const w of ctx.works) {
    if (w.payments.length === 0) continue;

    const bare = w.payments.filter((p) => p.evidence.length === 0);
    if (bare.length === 0) continue;

    const bareValue = bare.reduce((s, p) => s + num(p.amount), 0);
    const paid = totalPaid(w);
    const bareShare = paid > 0 ? bareValue / paid : 0;

    out.push(
      makeFinding(
        w.id,
        "MISSING_EVIDENCE",
        `${bare.length} of ${w.payments.length} payment stages, totalling ${formatINR(bareValue)}, were released with no asset photograph or supporting document on record.`,
        {
          rule: "Implementing agencies upload photographs of the asset, and supporting documents, at each payment stage set in the sanction order.",
          facts: [
            { label: "Stages without evidence", value: `${bare.length} of ${w.payments.length}` },
            { label: "Value released without evidence", value: formatINRExact(bareValue) },
            { label: "Total released", value: formatINRExact(paid) },
            { label: "Share undocumented", value: `${Math.round(bareShare * 100)}%` },
            { label: "Implementing agency", value: w.ia?.name ?? "Not designated" },
          ],
          rows: w.payments.map((p) => ({
            label: `Stage ${p.stageNo}`,
            flagged: p.evidence.length === 0,
            values: [
              { label: "Amount", value: formatINRExact(num(p.amount)) },
              { label: "Released", value: formatDate(p.releasedAt) },
              {
                label: "Evidence",
                value:
                  p.evidence.length === 0
                    ? "None on record"
                    : p.evidence.map((e) => e.kind.toLowerCase()).join(", "),
              },
              { label: "Vendor", value: p.vendorName ?? "—" },
            ],
          })),
        },
        [
          {
            label: "Share of spend undocumented",
            weight: 0.6,
            value: Math.round(bareShare * 100),
            basis: `${Math.round(bareShare * 100)}% of released value has no evidence`,
          },
          {
            label: "Value undocumented",
            weight: 0.4,
            value: valueComponent(bareValue),
            basis: `${formatINR(bareValue)} released without evidence`,
          },
        ],
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// 6. STUCK_UNMARKED — complete on the ground, never marked complete
// ---------------------------------------------------------------------------

export function detectStuckUnmarked(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];

  for (const w of ctx.works) {
    if (!isLive(w) || !isFinishedButUnmarked(w)) continue;

    const stale = daysBetween(w.completedAt!, ctx.now);
    if (stale <= 0) continue;

    const sanctioned = num(w.sanctionedAmount);

    out.push(
      makeFinding(
        w.id,
        "STUCK_UNMARKED",
        `Recorded at 100% progress and complete since ${formatDate(w.completedAt)}, but the implementing agency has not marked it complete — ${stale} days pending, so it does not appear as a completed work.`,
        {
          rule: "The final step is the implementing agency marking the work complete. Only works marked complete are shown as completed, so an unmarked work understates what has actually been delivered.",
          facts: [
            { label: "Complete on the ground", value: formatDate(w.completedAt) },
            { label: "Marked complete by agency", value: "Not marked" },
            { label: "Days pending", value: `${stale}` },
            { label: "Recorded progress", value: `${w.progressPct}%` },
            { label: "Sanctioned amount", value: formatINRExact(sanctioned) },
            { label: "Released to vendors", value: formatINRExact(totalPaid(w)) },
            { label: "Implementing agency", value: w.ia?.name ?? "Not designated" },
          ],
        },
        [
          {
            label: "How long it has been pending",
            weight: 0.6,
            // Half a year unmarked saturates.
            value: ratioComponent(stale, 180),
            basis: `${stale} days since the work was finished`,
          },
          {
            label: "Value not reflected as delivered",
            weight: 0.4,
            value: valueComponent(sanctioned),
            basis: `${formatINR(sanctioned)} of completed work shown as incomplete`,
          },
        ],
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// 7. DUPLICATE — near-identical work, same district, overlapping period
// ---------------------------------------------------------------------------

/** Character-trigram Dice coefficient: robust to small wording changes. */
export function similarity(a: string, b: string): number {
  const grams = (s: string): Set<string> => {
    const t = ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
    const out = new Set<string>();
    for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  return (2 * shared) / (ga.size + gb.size);
}

const DUPLICATE_WINDOW_DAYS = 365;

export function detectDuplicate(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];

  // Compare only within district + work type: two community halls in different
  // states are not duplicates however similarly they are named.
  const groups = new Map<string, WorkRecord[]>();
  for (const w of ctx.works) {
    if (w.status === "CANCELLED") continue;
    const key = `${w.districtId}|${w.workType}`;
    const g = groups.get(key) ?? [];
    g.push(w);
    groups.set(key, g);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort(
      (a, b) => a.recommendedAt.getTime() - b.recommendedAt.getTime(),
    );

    for (let i = 1; i < ordered.length; i++) {
      const later = ordered[i];
      let best: { work: WorkRecord; sim: number } | null = null;

      for (let j = 0; j < i; j++) {
        const earlier = ordered[j];
        const apart = daysBetween(earlier.recommendedAt, later.recommendedAt);
        if (apart > DUPLICATE_WINDOW_DAYS) continue;

        // Compare the LOCATION, not the whole title.
        //
        // Titles inside one group are mostly the work type and district name
        // repeated — shared boilerplate that makes every pair look similar.
        // Matching on it flags "Covered Drainage Line at Ward No. 17, Surat"
        // against "Covered Drainage Line at Ward No. 4, Surat" at 91%, which
        // is two different drains in two different wards. What makes a
        // duplicate a duplicate is that it is the same asset in the same
        // place, so the locality is what gets compared.
        const sim = similarity(later.locality, earlier.locality);
        if (sim < THRESHOLDS.duplicateSimilarity) continue;
        if (!best || sim > best.sim) best = { work: earlier, sim };
      }

      if (!best) continue;

      const apart = daysBetween(best.work.recommendedAt, later.recommendedAt);
      const amount = num(later.recommendedAmount);
      const samePlace = best.sim >= 0.999;

      out.push(
        makeFinding(
          later.id,
          "DUPLICATE",
          `${samePlace ? "The same" : "A near-identical"} work — ${later.workType.toLowerCase()} at ${later.locality}, ${later.district.name} — was already recommended ${apart} days earlier as ${best.work.workCode}. The two may be the same asset recommended twice.`,
          {
            rule: `Works of the same type in the same district, at a location matching above ${Math.round(THRESHOLDS.duplicateSimilarity * 100)}%, recommended within ${DUPLICATE_WINDOW_DAYS} days of each other.`,
            facts: [
              { label: "Work type", value: later.workType },
              { label: "District", value: later.district.name },
              { label: "Location match", value: samePlace ? "Identical location" : `${Math.round(best.sim * 100)}% similar` },
              { label: "Recommended apart", value: `${apart} days` },
              { label: "Combined amount", value: formatINRExact(amount + num(best.work.recommendedAmount)) },
            ],
            rows: [best.work, later].map((w) => ({
              label: w.workCode,
              flagged: w.id === later.id,
              values: [
                { label: "Title", value: w.title },
                { label: "Location", value: w.locality },
                { label: "Recommended", value: formatDate(w.recommendedAt) },
                { label: "Amount", value: formatINRExact(num(w.recommendedAmount)) },
                { label: "Status", value: w.status },
                { label: "Agency", value: w.ia?.name ?? "Not designated" },
              ],
            })),
            relatedWorkIds: [best.work.id],
            },
          [
            {
              label: "How closely the locations match",
              weight: 0.45,
              // Rescale from the threshold upward: 82% is the floor, so
              // scoring it as 82/100 would overstate a borderline pair.
              value: ratioComponent(
                best.sim - THRESHOLDS.duplicateSimilarity,
                1 - THRESHOLDS.duplicateSimilarity,
              ),
              basis: samePlace
                ? "identical location"
                : `${Math.round(best.sim * 100)}% location similarity`,
            },
            {
              label: "How close together",
              weight: 0.2,
              value: 100 - ratioComponent(apart, DUPLICATE_WINDOW_DAYS),
              basis: `recommended ${apart} days apart`,
            },
            {
              label: "Amount at risk of double funding",
              weight: 0.35,
              value: valueComponent(amount),
              basis: `${formatINR(amount)} on the later recommendation`,
            },
          ],
        ),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 8. FY_END_SPIKE — sanctions crowded into the closing weeks of a financial year
// ---------------------------------------------------------------------------

export function detectFyEndSpike(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];
  const windowDays = THRESHOLDS.fyEndWindowDays;

  // A date filter alone is not a spike — some sanctions always land in March.
  // Compare each district-year's share against the share you would expect if
  // sanctions were spread evenly, and flag only genuine crowding.
  const expectedShare = windowDays / 365;

  const groups = new Map<string, WorkRecord[]>();
  for (const w of ctx.works) {
    if (!w.sanctionedAt || w.status === "CANCELLED") continue;
    const key = `${w.districtId}|${w.financialYear}`;
    const g = groups.get(key) ?? [];
    g.push(w);
    groups.set(key, g);
  }

  for (const group of groups.values()) {
    const fy = group[0].financialYear;
    const close = financialYearEnd(fy);

    const inWindow = group.filter((w) => {
      const toClose = daysBetween(w.sanctionedAt!, close);
      return toClose >= 0 && toClose <= windowDays;
    });

    if (inWindow.length < 3) continue; // too few to call a pattern
    const share = inWindow.length / group.length;
    if (share < expectedShare * 3) continue;

    const clusterValue = inWindow.reduce((s, w) => s + num(w.sanctionedAmount), 0);
    const district = group[0].district;

    for (const w of inWindow) {
      out.push(
        makeFinding(
          w.id,
          "FY_END_SPIKE",
          `One of ${inWindow.length} works sanctioned in ${district.name} within the last ${windowDays} days of FY ${fy} — ${Math.round(share * 100)}% of the district's sanctions that year, against about ${Math.round(expectedShare * 100)}% if they were spread evenly.`,
          {
            rule: `Sanctions clustering into the final ${windowDays} days of a financial year, at more than three times the evenly-spread rate, with at least three works involved.`,
            facts: [
              { label: "District", value: district.name },
              { label: "Financial year", value: fy },
              { label: "Sanctioned in the closing window", value: `${inWindow.length} of ${group.length} works` },
              { label: "Share of the year's sanctions", value: `${Math.round(share * 100)}%` },
              { label: "Expected if spread evenly", value: `about ${Math.round(expectedShare * 100)}%` },
              { label: "Value sanctioned in the window", value: formatINRExact(clusterValue) },
              { label: "This work sanctioned on", value: formatDate(w.sanctionedAt) },
            ],
            rows: inWindow.map((c) => ({
              label: c.workCode,
              flagged: c.id === w.id,
              values: [
                { label: "Work", value: c.title },
                { label: "Sanctioned", value: formatDate(c.sanctionedAt) },
                { label: "Amount", value: formatINRExact(num(c.sanctionedAmount)) },
                { label: "Agency", value: c.ia?.name ?? "Not designated" },
              ],
            })),
            relatedWorkIds: inWindow.filter((c) => c.id !== w.id).map((c) => c.id),
            },
          [
            {
              label: "Degree of crowding",
              weight: 0.5,
              // Six times the even rate saturates.
              value: ratioComponent(share / expectedShare, 6),
              basis: `${Math.round(share / expectedShare)}x the evenly-spread rate`,
            },
            {
              // This work's own amount, not the cluster's total. Scoring every
              // member of a cluster by the cluster's value gives them all
              // near-identical scores, and fifteen indistinguishable rows then
              // bury every other kind of alert at the top of the queue. The
              // cluster is what makes it suspicious; the work's own value is
              // what decides where it sits among its peers.
              label: "Value sanctioned in the window",
              weight: 0.5,
              value: valueComponent(num(w.sanctionedAmount)),
              basis: `${formatINR(num(w.sanctionedAmount))} of a ${formatINR(clusterValue)} year-end cluster`,
            },
          ],
        ),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------

export const RULE_DETECTORS = [
  { type: "OVERDUE" as const, run: detectOverdue },
  { type: "PAYMENT_AHEAD" as const, run: detectPaymentAhead },
  { type: "COST_OVERRUN" as const, run: detectCostOverrun },
  { type: "ENTITLEMENT_BREACH" as const, run: detectEntitlementBreach },
  { type: "MISSING_EVIDENCE" as const, run: detectMissingEvidence },
  { type: "STUCK_UNMARKED" as const, run: detectStuckUnmarked },
  { type: "DUPLICATE" as const, run: detectDuplicate },
  { type: "FY_END_SPIKE" as const, run: detectFyEndSpike },
];

export function runRuleDetectors(ctx: DetectorContext): Finding[] {
  return RULE_DETECTORS.flatMap((d) => d.run(ctx));
}
