import { COMPLETION_WINDOW_DAYS, financialYearEnd } from "../scheme";
import {
  daysBetween,
  num,
  totalPaid,
  type DetectorContext,
  type WorkRecord,
} from "./context";

/**
 * Feature engineering, defined once.
 *
 * These features feed both the statistical detectors (cost outliers, agency
 * concentration) and the IsolationForest in the Python service. Computing them
 * here rather than in Python means there is one definition of "payment-to-
 * progress gap" in the codebase — the rule engine and the model cannot drift
 * into disagreeing about what a number means, and the service stays a pure
 * model with no scheme knowledge and no personal data in it.
 *
 * Every feature is deliberately interpretable. An officer has to be able to
 * read "cost per unit is 3.4x the peer median" and judge it; a principal
 * component would score just as well and explain nothing.
 */

export const FEATURE_LABELS: Record<string, string> = {
  costPerUnitRatio: "Cost per unit against similar works",
  delayRatio: "Time past the one-year completion window",
  paymentProgressGap: "Payments released ahead of recorded progress",
  evidenceCompleteness: "Share of payment stages with asset evidence",
  sanctionToRecommendRatio: "Sanctioned amount against the amount recommended",
  iaDistrictShare: "Share of the district's work held by this agency",
  fyEndProximity: "How close the sanction was to the financial-year close",
  paymentIrregularity: "Unevenness of the payment schedule",
  sanctionLagRatio: "Time taken from recommendation to sanction",
  amountScale: "Size of the work against the entitlement",
  progressRate: "Progress achieved per month since sanction",
};

export const FEATURE_NAMES = Object.keys(FEATURE_LABELS);

export type FeatureVector = {
  workId: string;
  values: number[];
  /** Kept alongside for the peer statistics and the UI. */
  costPerUnit: number;
  peerMedianCostPerUnit: number;
  peerCount: number;
};

/** Median of a numeric array. Returns 0 for an empty one. */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Median absolute deviation, scaled to be comparable with a standard
 * deviation. Used instead of mean and standard deviation because a handful of
 * extreme works would drag those towards themselves and hide the very outliers
 * we are looking for.
 */
export function mad(xs: number[], med: number): number {
  if (xs.length === 0) return 0;
  return 1.4826 * median(xs.map((x) => Math.abs(x - med)));
}

/** Peer group for cost comparison: same work type, within the same state. */
function peerKey(w: WorkRecord): string {
  return `${w.district.stateId}|${w.workType}`;
}

/**
 * Minimum comparable works before a peer group is worth judging against, and
 * the point at which a state group falls back to the national one.
 *
 * This is deliberately a single constant rather than one threshold for
 * choosing the group and another for using it. When they differ, a state group
 * that is large enough to be *selected* but too small to be *judged* leaves the
 * work silently unassessed — which is exactly what happened here, and it cost
 * the cost-outlier detector most of its recall without any error being raised.
 */
export const MIN_PEERS = 15;

export type PeerStats = {
  byState: Map<string, number[]>;
  byType: Map<string, number[]>;
};

export function buildPeerStats(works: WorkRecord[]): PeerStats {
  const byState = new Map<string, number[]>();
  const byType = new Map<string, number[]>();

  for (const w of works) {
    const cpu = costPerUnit(w);
    if (cpu <= 0) continue;
    (byState.get(peerKey(w)) ?? byState.set(peerKey(w), []).get(peerKey(w))!).push(cpu);
    (byType.get(w.workType) ?? byType.set(w.workType, []).get(w.workType)!).push(cpu);
  }

  return { byState, byType };
}

export function costPerUnit(w: WorkRecord): number {
  const amount = num(w.sanctionedAmount) || num(w.recommendedAmount);
  const units = Math.max(1, w.unitCount ?? 1);
  return amount / units;
}

export function peersFor(
  w: WorkRecord,
  stats: PeerStats,
): { values: number[]; scope: "state" | "national" } {
  const inState = stats.byState.get(peerKey(w)) ?? [];
  if (inState.length >= MIN_PEERS) return { values: inState, scope: "state" };
  return { values: stats.byType.get(w.workType) ?? [], scope: "national" };
}

/**
 * Share of a district's sanctioned value held by each implementing agency.
 * A dominant agency is a signal worth a look, not an accusation — a district
 * may have exactly one body competent to build a health sub-centre.
 */
export function agencyShares(works: WorkRecord[]): Map<string, number> {
  const districtTotals = new Map<string, number>();
  const agencyTotals = new Map<string, number>();

  for (const w of works) {
    if (!w.iaId || !w.sanctionedAt || w.status === "CANCELLED") continue;
    const amount = num(w.sanctionedAmount);
    districtTotals.set(w.districtId, (districtTotals.get(w.districtId) ?? 0) + amount);
    const key = `${w.districtId}|${w.iaId}`;
    agencyTotals.set(key, (agencyTotals.get(key) ?? 0) + amount);
  }

  const shares = new Map<string, number>();
  for (const [key, total] of agencyTotals) {
    const districtId = key.split("|")[0];
    const districtTotal = districtTotals.get(districtId) ?? 0;
    shares.set(key, districtTotal > 0 ? total / districtTotal : 0);
  }
  return shares;
}

/** Unevenness of the payment schedule, 0 (perfectly even) to 1 (lumpy). */
function paymentIrregularity(w: WorkRecord): number {
  if (w.payments.length < 2) return 0;
  const amounts = w.payments.map((p) => num(p.amount));
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  if (mean <= 0) return 0;
  const variance =
    amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.min(1, cv);
}

export function buildFeatures(ctx: DetectorContext): FeatureVector[] {
  const stats = buildPeerStats(ctx.works);
  const shares = agencyShares(ctx.works);
  const out: FeatureVector[] = [];

  for (const w of ctx.works) {
    // A recommendation with no sanction has almost none of these features and
    // would only add noise to the model.
    if (!w.sanctionedAt || w.status === "CANCELLED") continue;

    const sanctioned = num(w.sanctionedAmount);
    const recommended = num(w.recommendedAmount);
    const paid = totalPaid(w);
    const age = Math.max(1, daysBetween(w.sanctionedAt, ctx.now));

    const cpu = costPerUnit(w);
    const peers = peersFor(w, stats);
    const peerMedian = median(peers.values);

    const endDate = w.completedAt ?? ctx.now;
    const overdueBy = Math.max(
      0,
      daysBetween(w.sanctionedAt, endDate) - COMPLETION_WINDOW_DAYS,
    );

    const fyClose = financialYearEnd(w.financialYear);
    const daysToClose = daysBetween(w.sanctionedAt, fyClose);

    const stagesWithEvidence = w.payments.filter((p) => p.evidence.length > 0).length;

    const values = [
      // costPerUnitRatio
      peerMedian > 0 ? cpu / peerMedian : 1,
      // delayRatio
      overdueBy / COMPLETION_WINDOW_DAYS,
      // paymentProgressGap
      sanctioned > 0 ? paid / sanctioned - w.progressPct / 100 : 0,
      // evidenceCompleteness
      w.payments.length > 0 ? stagesWithEvidence / w.payments.length : 1,
      // sanctionToRecommendRatio
      recommended > 0 ? sanctioned / recommended : 1,
      // iaDistrictShare
      w.iaId ? (shares.get(`${w.districtId}|${w.iaId}`) ?? 0) : 0,
      // fyEndProximity — 1 when sanctioned on the last day of the year, 0 a
      // quarter or more before it.
      daysToClose >= 0 && daysToClose <= 90 ? 1 - daysToClose / 90 : 0,
      // paymentIrregularity
      paymentIrregularity(w),
      // sanctionLagRatio
      daysBetween(w.recommendedAt, w.sanctionedAt) / 180,
      // amountScale — log-scaled against the ₹5 crore annual entitlement
      Math.log10(Math.max(1, sanctioned)) / Math.log10(50_000_000),
      // progressRate — percentage points of progress per 30 days
      (w.progressPct / age) * 30,
    ];

    out.push({
      workId: w.id,
      values,
      costPerUnit: cpu,
      peerMedianCostPerUnit: peerMedian,
      peerCount: peers.values.length,
    });
  }

  return out;
}

/**
 * Whether a work's outcome against the one-year window is already settled, and
 * which way it went. Used to label the training set for delay prediction — the
 * label is a date arithmetic, not a judgement, which is what makes supervised
 * learning defensible here at all.
 */
export function delayOutcome(
  w: WorkRecord,
  now: Date,
): { settled: boolean; late: boolean } {
  if (!w.sanctionedAt || w.status === "CANCELLED") {
    return { settled: false, late: false };
  }

  const finished = w.markedCompleteAt ?? w.completedAt;
  if (finished) {
    return {
      settled: true,
      late: daysBetween(w.sanctionedAt, finished) > COMPLETION_WINDOW_DAYS,
    };
  }

  // Not finished, but already past the window — the outcome is settled even
  // though the work continues.
  if (daysBetween(w.sanctionedAt, now) > COMPLETION_WINDOW_DAYS) {
    return { settled: true, late: true };
  }

  return { settled: false, late: false };
}

// ---------------------------------------------------------------------------
// Delay prediction: a separate, leak-free feature set
// ---------------------------------------------------------------------------

/**
 * Why this exists separately from `buildFeatures`.
 *
 * The anomaly features describe a work as it stands today, which is right for
 * spotting something already odd. Several of them are useless — worse, actively
 * misleading — for *predicting* delay, because they encode the outcome:
 * `delayRatio` is literally "days past the deadline", and a model trained on it
 * scores near-perfectly by reading the answer off its own input.
 *
 * That is exactly what happened here. The first delay model reported an AUC of
 * 0.98 against a 3% base rate, which is not a good model, it is a leaking one.
 *
 * So delay prediction uses only what is knowable **when the work is
 * sanctioned** — nothing that moves afterwards. The historical rates are
 * computed from works whose outcome was already settled on that date, so no
 * example can learn from its own future or from works that had not finished
 * yet. The resulting model is far less confident, and honestly so.
 *
 * A real eSAKSHI feed carries staged progress updates, which would let a model
 * use execution signals as they arrive without leaking. This dataset records
 * only a work's current progress, so that is left for when real data is wired
 * in — see README.
 */

export const DELAY_FEATURE_LABELS: Record<string, string> = {
  amountScale: "Size of the work",
  unitCount: "Number of units",
  sanctionLagRatio: "Time the district took to sanction",
  fyEndProximity: "Sanctioned near the financial-year close",
  sanctionMonth: "Month of sanction",
  sanctionToRecommendRatio: "Sanctioned amount against the amount recommended",
  agencyPriorLateRate: "This agency's past record on the one-year window",
  agencyPriorCount: "How many past works that record rests on",
  districtPriorLateRate: "This district's past record",
  workTypePriorLateRate: "Past record for this type of work",
};

export const DELAY_FEATURE_NAMES = Object.keys(DELAY_FEATURE_LABELS);

export type DelayFeatureRow = {
  workId: string;
  values: number[];
  /** Present only for works whose outcome is already settled. */
  late: boolean | null;
};

/**
 * The date on which a work's outcome against the one-year window became known:
 * the day it finished, or the day the window closed, whichever came first.
 * A work still running inside its window has no such date yet.
 */
function outcomeKnownAt(w: WorkRecord): { at: Date; late: boolean } | null {
  if (!w.sanctionedAt || w.status === "CANCELLED") return null;

  const deadline = new Date(
    w.sanctionedAt.getTime() + COMPLETION_WINDOW_DAYS * 86_400_000,
  );
  const finished = w.markedCompleteAt ?? w.completedAt;

  if (finished && finished <= deadline) return { at: finished, late: false };
  if (finished) return { at: deadline, late: true };
  return { at: deadline, late: true };
}

export function buildDelayFeatures(
  ctx: DetectorContext,
): { train: DelayFeatureRow[]; predict: DelayFeatureRow[] } {
  const candidates = ctx.works.filter(
    (w) => w.sanctionedAt !== null && w.status !== "CANCELLED",
  );

  // Precompute each work's settled outcome and the date it became known.
  const settled = new Map<string, { at: Date; late: boolean }>();
  for (const w of candidates) {
    const o = outcomeKnownAt(w);
    // Only count it as settled if that date has actually passed.
    if (o && o.at <= ctx.now) settled.set(w.id, o);
  }

  /** Late rate among works in `group` whose outcome was known before `asOf`. */
  const priorRate = (
    group: WorkRecord[],
    asOf: Date,
    excludeId: string,
  ): { rate: number; count: number } => {
    let total = 0;
    let late = 0;
    for (const other of group) {
      if (other.id === excludeId) continue;
      const o = settled.get(other.id);
      if (!o || o.at >= asOf) continue;
      total++;
      if (o.late) late++;
    }
    return { rate: total > 0 ? late / total : 0, count: total };
  };

  const byAgency = new Map<string, WorkRecord[]>();
  const byDistrict = new Map<string, WorkRecord[]>();
  const byType = new Map<string, WorkRecord[]>();
  for (const w of candidates) {
    if (w.iaId) (byAgency.get(w.iaId) ?? byAgency.set(w.iaId, []).get(w.iaId)!).push(w);
    (byDistrict.get(w.districtId) ?? byDistrict.set(w.districtId, []).get(w.districtId)!).push(w);
    (byType.get(w.workType) ?? byType.set(w.workType, []).get(w.workType)!).push(w);
  }

  const train: DelayFeatureRow[] = [];
  const predict: DelayFeatureRow[] = [];

  for (const w of candidates) {
    const sanctionedAt = w.sanctionedAt!;
    const sanctioned = num(w.sanctionedAmount);
    const recommended = num(w.recommendedAmount);

    const agency = w.iaId
      ? priorRate(byAgency.get(w.iaId) ?? [], sanctionedAt, w.id)
      : { rate: 0, count: 0 };
    const district = priorRate(byDistrict.get(w.districtId) ?? [], sanctionedAt, w.id);
    const type = priorRate(byType.get(w.workType) ?? [], sanctionedAt, w.id);

    const fyClose = financialYearEnd(w.financialYear);
    const daysToClose = daysBetween(sanctionedAt, fyClose);

    const values = [
      Math.log10(Math.max(1, sanctioned)) / Math.log10(50_000_000),
      w.unitCount ?? 1,
      daysBetween(w.recommendedAt, sanctionedAt) / 180,
      daysToClose >= 0 && daysToClose <= 90 ? 1 - daysToClose / 90 : 0,
      (sanctionedAt.getUTCMonth() + 1) / 12,
      recommended > 0 ? sanctioned / recommended : 1,
      agency.rate,
      Math.min(1, agency.count / 20),
      district.rate,
      type.rate,
    ];

    const outcome = settled.get(w.id);
    if (outcome) {
      train.push({ workId: w.id, values, late: outcome.late });
    } else if (w.status === "IN_PROGRESS" || w.status === "SANCTIONED") {
      predict.push({ workId: w.id, values, late: null });
    }
  }

  return { train, predict };
}
