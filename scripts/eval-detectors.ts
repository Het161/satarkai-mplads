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
        work: { select: { workCode: true, mpId: true, financialYear: true, districtId: true } },
      },
    }),
    prisma.plantedAnomaly.findMany({
      select: {
        workId: true,
        type: true,
        work: { select: { workCode: true, mpId: true, financialYear: true, districtId: true } },
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
   * Two rules do not, and matching them by work id would score a disagreement
   * about labelling as a detection error:
   *
   * ENTITLEMENT_BREACH concerns a Member's *financial year*. The engine tags
   * the recommendation that carried the year past the limit; the seed tags the
   * one it inflated. Both point at the same breach.
   *
   * IA_CONCENTRATION concerns an *agency within a district*. The engine anchors
   * it on that agency's largest work so the alert has somewhere to live; the
   * seed anchors it on the first work it reassigned. Again, one finding, two
   * reasonable places to hang it.
   *
   * Each is therefore matched at the granularity it actually operates on.
   */
  const caseKey = (
    row: {
      workId: string;
      work: { mpId: string; financialYear: string; districtId: string };
    },
    type: string,
  ) => {
    if (type === "ENTITLEMENT_BREACH") {
      return `${type}|${row.work.mpId}|${row.work.financialYear}`;
    }
    if (type === "IA_CONCENTRATION") return `${type}|${row.work.districtId}`;
    return `${type}|${row.workId}`;
  };

  const alertSet = new Set(alerts.map((a) => caseKey(a, a.type)));
  const plantedSet = new Set(planted.map((p) => caseKey(p, p.type)));

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

  /**
   * The statistical and model detectors are scored separately, because
   * precision means something different for them.
   *
   * A rule detector is either right or wrong: a work is past 365 days or it is
   * not. A dispersion test is not — it answers "is this unusual?", and an
   * unusual work that nobody planted is a genuine finding, not a mistake.
   * Folding the two into one average would let the looser measure flatter or
   * spoil the stricter one, so they are reported apart and read differently.
   */
  const STATISTICAL_TYPES: AlertType[] = ["COST_OUTLIER", "IA_CONCENTRATION"];

  const rows: Row[] = [];
  const statRows: Row[] = [];
  const falsePositives: { type: string; workCode: string }[] = [];
  const falseNegatives: { type: string; workCode: string }[] = [];

  const scoreType = (type: AlertType, collectMisses: boolean): Row => {
    const detected = alerts.filter((a) => a.type === type);
    const expected = planted.filter((p) => p.type === type);

    let tp = 0;
    for (const a of detected) {
      if (plantedSet.has(caseKey(a, type))) tp++;
      else if (collectMisses) falsePositives.push({ type, workCode: a.work.workCode });
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

    return { type, tp, fp, fn, precision, recall, f1 };
  };

  for (const type of RULE_TYPES) rows.push(scoreType(type, true));
  for (const type of STATISTICAL_TYPES) statRows.push(scoreType(type, false));

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

  const table = (label: string, rs: Row[]) => {
    if (rs.every((r) => r.tp + r.fp + r.fn === 0)) return;
    console.log(`\n${label}\n`);
    console.log(
      "Detector                        TP    FP    FN   Precision   Recall      F1",
    );
    console.log("-".repeat(78));
    for (const r of rs) {
      console.log(
        `${ALERT_TYPE_LABELS[r.type].padEnd(30)}` +
          `${String(r.tp).padStart(4)}  ${String(r.fp).padStart(4)}  ${String(r.fn).padStart(4)}` +
          `   ${pct(r.precision).padStart(9)}  ${pct(r.recall).padStart(7)}  ${pct(r.f1).padStart(6)}`,
      );
    }
  };

  table(
    "Statistical detectors — 'FP' here means flagged but not planted, which for an\noutlier test may be a real finding rather than an error. Read recall first.",
    statRows,
  );
  reportModelOverlap(alerts, planted, plantedSet, caseKey);

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

/**
 * ML_ANOMALY is reported differently, because precision against the planted
 * labels would be the wrong measure of it.
 *
 * Every other detector answers a question with a right answer: a work is past
 * 365 days or it is not. The IsolationForest answers "is this combination of
 * characteristics unusual?", and it is pointed at exactly the cases no single
 * rule covers. Scoring it for failing to reproduce the planted labels would
 * report 0% precision for doing its job, and would push anyone tuning it
 * towards making it a worse, more redundant detector.
 *
 * What is worth knowing is the overlap: how much of the model's output the
 * rules already found, and how much is genuinely new. The new ones are the
 * reason to run a model at all — and they are also the ones a human most needs
 * to check, since nothing corroborates them.
 */
function reportModelOverlap(
  alerts: {
    workId: string;
    type: AlertType;
    score: number;
    work: { workCode: string; mpId: string; financialYear: string; districtId: string };
  }[],
  planted: { workId: string; type: AlertType }[],
  plantedSet: Set<string>,
  caseKey: (row: { workId: string; work: { mpId: string; financialYear: string; districtId: string } }, type: string) => string,
) {
  const model = alerts.filter((a) => a.type === "ML_ANOMALY");
  if (model.length === 0) {
    console.log(
      "\nMultivariate anomaly: not run. Start the model service and use `npm run detect:ml`.",
    );
    return;
  }

  const flaggedByRules = new Set(
    alerts.filter((a) => a.type !== "ML_ANOMALY").map((a) => a.workId),
  );

  let corroborated = 0;
  let novel = 0;
  let carriesPlantedLabel = 0;

  for (const a of model) {
    if (flaggedByRules.has(a.workId)) corroborated++;
    else novel++;
    // Does this work carry *any* planted label, of any type?
    const anyLabel = [
      "OVERDUE", "PAYMENT_AHEAD", "COST_OVERRUN", "ENTITLEMENT_BREACH",
      "MISSING_EVIDENCE", "STUCK_UNMARKED", "DUPLICATE", "FY_END_SPIKE",
      "COST_OUTLIER", "IA_CONCENTRATION",
    ].some((t) => plantedSet.has(caseKey(a, t)));
    if (anyLabel) carriesPlantedLabel++;
  }

  console.log("\nMultivariate anomaly (IsolationForest)\n");
  console.log(
    "Precision against the planted labels is not reported: this detector looks for",
  );
  console.log(
    "combinations no single rule covers, so reproducing those labels is not its job.",
  );
  console.log("");
  console.log(`  flagged                              ${String(model.length).padStart(4)}`);
  console.log(
    `  also flagged by a rule detector       ${String(corroborated).padStart(4)}   (${Math.round((corroborated / model.length) * 100)}% — the model agrees with the rules)`,
  );
  console.log(
    `  flagged by the model alone            ${String(novel).padStart(4)}   (${Math.round((novel / model.length) * 100)}% — nothing else points at these)`,
  );
  console.log(
    `  carrying a planted label of any type  ${String(carriesPlantedLabel).padStart(4)}`,
  );
  console.log(
    `  median score                          ${String(
      [...model].sort((a, b) => a.score - b.score)[Math.floor(model.length / 2)].score,
    ).padStart(4)}`,
  );

  // The measure that does mean something: the seed plants works that are
  // unusual in combination while breaking no single rule — the case this
  // detector exists for. Does it find them?
  const multivariatePlants = planted.filter((p) => p.type === "ML_ANOMALY");
  if (multivariatePlants.length > 0) {
    const flaggedIds = new Set(model.map((a) => a.workId));
    const found = multivariatePlants.filter((p) => flaggedIds.has(p.workId)).length;
    const soloIds = new Set(
      model.filter((a) => !flaggedByRules.has(a.workId)).map((a) => a.workId),
    );
    const soloAreMultivariate = multivariatePlants.filter((p) =>
      soloIds.has(p.workId),
    ).length;

    console.log("\n  Works planted as unusual-in-combination only — breaking no single");
    console.log("  rule, which is the case this detector exists for:");
    console.log(
      `    planted                             ${String(multivariatePlants.length).padStart(4)}`,
    );
    console.log(
      `    found by the model                  ${String(found).padStart(4)}   (${Math.round((found / multivariatePlants.length) * 100)}% recall)`,
    );
    console.log(
      `    among the model's solo flags        ${String(soloAreMultivariate).padStart(4)} of ${soloIds.size}`,
    );
  }
  console.log(
    "\nThe works flagged by the model alone are the reason to run it, and also the",
  );
  console.log(
    "ones most needing a human look: no rule corroborates them.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
