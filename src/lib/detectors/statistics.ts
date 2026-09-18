import { formatINR, formatINRExact } from "../format";
import { num, type DetectorContext, type WorkRecord } from "./context";
import {
  agencyShares,
  buildPeerStats,
  costPerUnit,
  mad,
  median,
  MIN_PEERS,
  peersFor,
} from "./features";
import { makeFinding, ratioComponent, valueComponent, type Finding } from "./types";

/**
 * Cost outliers and agency concentration.
 *
 * These sit under the "ML" heading in the problem statement, and they are
 * genuinely statistical rather than rule-based — nothing here is a fixed
 * dates-and-amounts test. But neither needs a trained model: one is a robust
 * dispersion test, the other is a share of a total. Routing them through a
 * Python service would add a dependency and a failure mode to buy nothing, and
 * would make the rules-only fallback poorer for no reason.
 *
 * So they run in-process, and the service is reserved for the two things that
 * actually need scikit-learn: the multivariate IsolationForest score and the
 * delay-risk model.
 */

// ---------------------------------------------------------------------------
// COST_OUTLIER — cost per unit far from comparable works
// ---------------------------------------------------------------------------

/**
 * Minimum modified z-score before a work is called an outlier. 3.5 is the
 * conventional threshold for the median-absolute-deviation test; it is strict
 * enough that ordinary variation between districts does not trip it.
 */
const OUTLIER_Z = 3.5;

/**
 * Below this many comparable works, dispersion means very little.
 *
 * A robust z-score computed from nine works is itself noisy: the median
 * absolute deviation can come out small by chance, and a perfectly ordinary
 * work then reads as four deviations out. This is the same constant that
 * decides when a state peer group gives way to the national one, so a group
 * can never be large enough to select but too small to judge.
 */
const MIN_PEERS_TO_JUDGE = MIN_PEERS;

/**
 * A work must also simply *be* expensive, not merely statistically unusual.
 *
 * Construction costs vary with terrain, specification and the year of pricing,
 * so a work at 1.8x its peers is ordinary however confident the arithmetic
 * sounds. Requiring both tests to pass keeps the queue to works an officer
 * would recognise as worth a question.
 */
const MIN_COST_MULTIPLE = 2.5;

export function detectCostOutlier(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];
  const stats = buildPeerStats(ctx.works);

  for (const w of ctx.works) {
    if (w.status === "CANCELLED") continue;

    const cpu = costPerUnit(w);
    if (cpu <= 0) continue;

    const peers = peersFor(w, stats);
    // Exclude this work from its own comparison group, or a single extreme
    // value drags the median it is being measured against.
    const others = peers.values.filter((v) => v !== cpu);
    if (others.length < MIN_PEERS_TO_JUDGE) continue;

    const med = median(others);
    const dispersion = mad(others, med);
    if (med <= 0 || dispersion <= 0) continue;

    const z = (cpu - med) / dispersion;
    const multiple = cpu / med;

    // Only unusually *expensive* works are flagged. An unusually cheap work is
    // worth knowing about too, but it is a different question — quality, not
    // cost — and conflating them would muddle the queue.
    if (z < OUTLIER_Z || multiple < MIN_COST_MULTIPLE) continue;

    const excess = (cpu - med) * Math.max(1, w.unitCount ?? 1);
    const unitWord = (w.unitCount ?? 1) > 1 ? `each of ${w.unitCount} units` : "the work";

    out.push(
      makeFinding(
        w.id,
        "COST_OUTLIER",
        `At ${formatINR(cpu)} for ${unitWord}, this costs ${multiple.toFixed(1)} times the ${formatINR(med)} typical of ${others.length} comparable ${w.workType.toLowerCase()} works ${peers.scope === "state" ? `in ${w.district.state.name}` : "nationally"}. There may be a sound reason — terrain, specification, or the year it was priced — which is why this is a question rather than a finding.`,
        {
          rule: `Cost per unit more than ${OUTLIER_Z} robust standard deviations above the median for comparable works of the same type — and at least ${MIN_COST_MULTIPLE}x that median — measured against at least ${MIN_PEERS_TO_JUDGE} comparable works using the median absolute deviation, so that a few extreme works cannot hide the rest.`,
          facts: [
            { label: "Cost per unit", value: formatINRExact(cpu) },
            { label: "Typical for comparable works", value: formatINRExact(med) },
            { label: "Multiple of typical", value: `${multiple.toFixed(1)}x` },
            { label: "Robust z-score", value: z.toFixed(1) },
            { label: "Comparable works", value: `${others.length} (${peers.scope === "state" ? w.district.state.name : "national"})` },
            { label: "Units", value: `${w.unitCount ?? 1}` },
            { label: "Excess over typical", value: formatINRExact(excess) },
          ],
          rows: [
            {
              label: w.workCode,
              flagged: true,
              values: [
                { label: "Work", value: w.title },
                { label: "Type", value: w.workType },
                { label: "District", value: w.district.name },
                { label: "Sanctioned", value: formatINRExact(num(w.sanctionedAmount)) },
                { label: "Agency", value: w.ia?.name ?? "Not designated" },
              ],
            },
          ],
        },
        [
          {
            label: "How far from comparable works",
            weight: 0.6,
            // Ten robust deviations out saturates the component.
            value: ratioComponent(z, 10),
            basis: `${z.toFixed(1)} robust standard deviations above the median`,
          },
          {
            label: "Amount above the typical cost",
            weight: 0.4,
            value: valueComponent(excess),
            basis: `${formatINR(excess)} more than comparable works`,
          },
        ],
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// IA_CONCENTRATION — one agency holding a disproportionate share of a district
// ---------------------------------------------------------------------------

/** Below this, a district has too few works for a share to mean anything. */
const MIN_WORKS_IN_DISTRICT = 8;

/**
 * How unlikely a concentration has to be before it is worth an officer's time.
 *
 * A flat "more than 45% of the district" threshold sounds decisive and is
 * nearly meaningless: in a district with three agencies and twenty works, one
 * agency clearing 45% happens constantly by chance, and flagging it produces a
 * page of alerts that are all noise. What matters is not the share but whether
 * the share is *surprising* — so the test asks how often an assignment this
 * lopsided would arise if works were handed out without favour.
 */
const CONCENTRATION_P_VALUE = 0.01;

/** Even an improbable split is uninteresting if the agency holds little value. */
const MIN_VALUE_SHARE = 0.4;

const logGamma = (x: number): number => {
  // Lanczos approximation; ample for the factorials of a district's work count.
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
};

const logChoose = (n: number, k: number): number =>
  logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);

/**
 * P(X >= k) for X ~ Binomial(n, p) — the chance of seeing at least this many
 * works land with one agency if each work were assigned independently and
 * evenly among the district's agencies.
 */
export function binomialTailProbability(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let total = 0;
  for (let i = k; i <= n; i++) {
    total += Math.exp(
      logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p),
    );
  }
  return Math.min(1, Math.max(0, total));
}

export function detectAgencyConcentration(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];
  const shares = agencyShares(ctx.works);

  // Group the live, sanctioned works by district so each concentration is
  // reported once, against the district's largest example.
  const byDistrict = new Map<string, WorkRecord[]>();
  for (const w of ctx.works) {
    if (!w.iaId || !w.sanctionedAt || w.status === "CANCELLED") continue;
    const g = byDistrict.get(w.districtId) ?? [];
    g.push(w);
    byDistrict.set(w.districtId, g);
  }

  for (const [districtId, works] of byDistrict) {
    if (works.length < MIN_WORKS_IN_DISTRICT) continue;

    const agencyCount = new Set(works.map((w) => w.iaId)).size;
    // One agency holding everything is not concentration if it is the only one.
    if (agencyCount < 2) continue;

    // Find the agency with the largest share of the district's sanctioned value.
    let dominantId: string | null = null;
    let dominantShare = 0;
    for (const w of works) {
      const share = shares.get(`${districtId}|${w.iaId}`) ?? 0;
      if (share > dominantShare) {
        dominantShare = share;
        dominantId = w.iaId;
      }
    }

    if (!dominantId || dominantShare < MIN_VALUE_SHARE) continue;

    const theirs = works.filter((w) => w.iaId === dominantId);

    // Would this many works land with one agency by chance? If an even-handed
    // district would produce a split this lopsided more than once in a hundred,
    // there is nothing here to explain.
    const pValue = binomialTailProbability(theirs.length, works.length, 1 / agencyCount);
    if (pValue > CONCENTRATION_P_VALUE) continue;

    const theirValue = theirs.reduce((s, w) => s + num(w.sanctionedAmount), 0);
    const districtValue = works.reduce((s, w) => s + num(w.sanctionedAmount), 0);
    const agency = theirs[0].ia!;
    const district = theirs[0].district;

    // Attach to the agency's largest work, so the alert has a concrete anchor.
    const anchor = [...theirs].sort(
      (a, b) => num(b.sanctionedAmount) - num(a.sanctionedAmount),
    )[0];

    // An even split across the district's agencies would give each this share.
    const evenShare = 1 / agencyCount;

    out.push(
      makeFinding(
        anchor.id,
        "IA_CONCENTRATION",
        `${agency.name} is the designated agency on ${theirs.length} of ${works.length} sanctioned works in ${district.name}, holding ${Math.round(dominantShare * 100)}% of the district's sanctioned value where an even split between the ${agencyCount} available agencies would give ${Math.round(evenShare * 100)}%. A split this lopsided would arise by chance about ${formatPValue(pValue)} of the time. This may simply be the district's capable body for this kind of work; it is a pattern to understand, not a finding against anyone.`,
        {
          rule: `One implementing agency holding at least ${Math.round(MIN_VALUE_SHARE * 100)}% of a district's sanctioned value, where that many works landing with one agency would occur by chance less than ${CONCENTRATION_P_VALUE * 100}% of the time. Districts with fewer than ${MIN_WORKS_IN_DISTRICT} sanctioned works, or only one agency, are not tested — there is nothing to compare against.`,
          facts: [
            { label: "Implementing agency", value: agency.name },
            { label: "Agency type", value: agency.type },
            { label: "District", value: district.name },
            { label: "Works held", value: `${theirs.length} of ${works.length}` },
            { label: "Value held", value: formatINRExact(theirValue) },
            { label: "District total", value: formatINRExact(districtValue) },
            { label: "Share of district value", value: `${Math.round(dominantShare * 100)}%` },
            { label: "Agencies active in the district", value: `${agencyCount}` },
            { label: "Even share would be", value: `${Math.round(evenShare * 100)}%` },
            { label: "Probability this is chance", value: formatPValue(pValue) },
          ],
          rows: theirs
            .sort((a, b) => num(b.sanctionedAmount) - num(a.sanctionedAmount))
            .slice(0, 12)
            .map((w) => ({
              label: w.workCode,
              flagged: w.id === anchor.id,
              values: [
                { label: "Work", value: w.title },
                { label: "Type", value: w.workType },
                { label: "Sanctioned", value: formatINRExact(num(w.sanctionedAmount)) },
                { label: "Status", value: w.status },
              ],
            })),
          relatedWorkIds: theirs.filter((w) => w.id !== anchor.id).map((w) => w.id),
        },
        [
          {
            label: "How unlikely the split is",
            weight: 0.3,
            // A one-in-ten-thousand split saturates the component.
            value: ratioComponent(
              Math.log10(1 / Math.max(pValue, 1e-9)),
              4,
            ),
            basis: `would arise by chance about ${formatPValue(pValue)} of the time`,
          },
          {
            label: "Degree of concentration",
            weight: 0.3,
            // Measured from the even split upwards: holding 50% of a
            // two-agency district is unremarkable; holding 50% of a
            // six-agency one is not.
            value: ratioComponent(dominantShare - evenShare, 1 - evenShare),
            basis: `${Math.round(dominantShare * 100)}% held where an even share is ${Math.round(evenShare * 100)}%`,
          },
          {
            label: "Value concentrated",
            weight: 0.4,
            value: valueComponent(theirValue),
            basis: `${formatINR(theirValue)} with one agency`,
          },
        ],
      ),
    );
  }

  return out;
}

function formatPValue(p: number): string {
  if (p < 0.0001) return "less than 1 in 10,000";
  if (p < 0.001) return "about 1 in 1,000";
  if (p < 0.01) return "about 1 in 100";
  return `${(p * 100).toFixed(1)}%`;
}

export const STATISTICAL_DETECTORS = [
  { type: "COST_OUTLIER" as const, run: detectCostOutlier },
  { type: "IA_CONCENTRATION" as const, run: detectAgencyConcentration },
];
