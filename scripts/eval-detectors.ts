/**
 * Score the detectors against the planted ground truth.
 *
 * Run: npm run eval   (after npm run detect)
 *
 * What the numbers mean, stated honestly:
 *
 *  - The dataset is synthetic, so these figures describe the detectors, not
 *    real MPLADS execution. They say "the rule fires on what it was meant to
 *    fire on and little else" — nothing about how much fraud exists.
 *  - A true positive is an alert of type T on a work labelled T. An alert of
 *    type T on a work labelled something else counts against precision, even
 *    when the work is genuinely anomalous — the stricter reading.
 *  - Some false positives are real findings rather than mistakes: the
 *    generator can produce a work that breaches a rule by chance. The
 *    unlabelled-baseline check (npm run check:baseline) exists to keep that
 *    number near zero, and any that remain are listed below so they can be
 *    read rather than hidden in an average.
 */

import type { AlertType } from "@prisma/client";

import { prisma } from "../src/lib/db";
import { ALERT_TYPE_LABELS } from "../src/lib/scheme";

type Row = {
  type: AlertType;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
};

const pct = (n: number) => (Number.isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`);

async function main() {
  const [alerts, planted] = await Promise.all([
    prisma.alert.findMany({
      select: {
        workId: true,
        type: true,
        score: true,
        work: { select: { workCode: true, mpId: true, financialYear: true } },
      },
    }),
    prisma.plantedAnomaly.findMany({
      select: {
        workId: true,
        type: true,
        work: { select: { workCode: true, mpId: true, financialYear: true } },
      },
    }),
  ]);

  if (alerts.length === 0) {
    console.error("No alerts in the database. Run `npm run detect` first.");
    process.exit(1);
  }

  /**
   * Most rules concern one work, so a work id identifies the case.
   *
   * ENTITLEMENT_BREACH does not: the anomaly is that a Member over-committed a
   * *financial year*, and pinning it to one of that year's works is a
   * presentation choice. The rule engine tags the recommendation that carried
   * the year past the limit; the seed tags the one it inflated. Both point at
   * the same breach, so matching them by work id would score a disagreement
   * about labelling as a detection error. This rule is therefore matched at
   * the granularity it actually operates on — the Member and the year.
   */
  const caseKey = (
    row: { workId: string; work: { mpId: string; financialYear: string } },
    type: string,
  ) =>
    type === "ENTITLEMENT_BREACH"
      ? `${type}|${row.work.mpId}|${row.work.financialYear}`
      : `${type}|${row.workId}`;

  const alertSet = new Set(alerts.map((a) => caseKey(a, a.type)));
  const plantedSet = new Set(planted.map((p) => caseKey(p, p.type)));

  // Only the rule-based types are in scope for Phase 2. COST_OUTLIER,
  // IA_CONCENTRATION and ML_ANOMALY arrive with the ML service in Phase 3, and
  // scoring them now would report a guaranteed zero that means nothing.
  const RULE_TYPES: AlertType[] = [
    "OVERDUE",
    "PAYMENT_AHEAD",
    "COST_OVERRUN",
    "ENTITLEMENT_BREACH",
    "MISSING_EVIDENCE",
    "STUCK_UNMARKED",
    "DUPLICATE",
    "FY_END_SPIKE",
  ];

  const rows: Row[] = [];
  const falsePositives: { type: string; workCode: string }[] = [];
  const falseNegatives: { type: string; workCode: string }[] = [];

  for (const type of RULE_TYPES) {
    const detected = alerts.filter((a) => a.type === type);
    const expected = planted.filter((p) => p.type === type);

    let tp = 0;
    for (const a of detected) {
      if (plantedSet.has(caseKey(a, type))) tp++;
      else falsePositives.push({ type, workCode: a.work.workCode });
    }
    for (const p of expected) {
      if (!alertSet.has(caseKey(p, type))) {
        falseNegatives.push({ type, workCode: p.work.workCode });
      }
    }

    const fp = detected.length - tp;
    const fn = expected.length - tp;
    const precision = detected.length ? tp / detected.length : NaN;
    const recall = expected.length ? tp / expected.length : NaN;
    const f1 =
      Number.isNaN(precision) || Number.isNaN(recall) || precision + recall === 0
        ? NaN
        : (2 * precision * recall) / (precision + recall);

    rows.push({ type, tp, fp, fn, precision, recall, f1 });
  }

  // ---- report --------------------------------------------------------------
  console.log("Rule detectors vs planted ground truth\n");
  console.log(
    "Detector                        TP    FP    FN   Precision   Recall      F1",
  );
  console.log("-".repeat(78));
  for (const r of rows) {
    console.log(
      `${ALERT_TYPE_LABELS[r.type].padEnd(30)}` +
        `${String(r.tp).padStart(4)}  ${String(r.fp).padStart(4)}  ${String(r.fn).padStart(4)}` +
        `   ${pct(r.precision).padStart(9)}  ${pct(r.recall).padStart(7)}  ${pct(r.f1).padStart(6)}`,
    );
  }

  const tp = rows.reduce((s, r) => s + r.tp, 0);
  const fp = rows.reduce((s, r) => s + r.fp, 0);
  const fn = rows.reduce((s, r) => s + r.fn, 0);
  const microP = tp + fp ? tp / (tp + fp) : NaN;
  const microR = tp + fn ? tp / (tp + fn) : NaN;
  console.log("-".repeat(78));
  console.log(
    `${"Overall (micro-averaged)".padEnd(30)}${String(tp).padStart(4)}  ${String(fp).padStart(4)}  ${String(fn).padStart(4)}` +
      `   ${pct(microP).padStart(9)}  ${pct(microR).padStart(7)}`,
  );

  if (falsePositives.length) {
    console.log(`\nFalse positives (${falsePositives.length}) — alerts on works not labelled for that rule:`);
    for (const f of falsePositives.slice(0, 25)) {
      console.log(`  ${f.type.padEnd(20)} ${f.workCode}`);
    }
    if (falsePositives.length > 25) {
      console.log(`  … and ${falsePositives.length - 25} more`);
    }
  }

  if (falseNegatives.length) {
    console.log(`\nFalse negatives (${falseNegatives.length}) — planted anomalies no detector caught:`);
    for (const f of falseNegatives.slice(0, 25)) {
      console.log(`  ${f.type.padEnd(20)} ${f.workCode}`);
    }
    if (falseNegatives.length > 25) {
      console.log(`  … and ${falseNegatives.length - 25} more`);
    }
  }

  console.log(
    "\nThe dataset is synthetic. These figures describe detector behaviour, not real MPLADS execution.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
