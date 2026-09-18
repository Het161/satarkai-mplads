/**
 * The feedback loop, read back.
 *
 * Run: npm run tune
 *
 * Every alert an officer concludes writes a DetectorOutcome: the detector, the
 * score it carried, and what the officer decided. This script reads that table
 * and asks the question a tuning pass actually needs answered — at what score
 * did each rule start being explained away?
 *
 * It deliberately does NOT change anything. A detector that retunes itself from
 * reviewer behaviour learns to stop reporting whatever is inconvenient, and
 * nobody is accountable for the change. This prints a recommendation; a person
 * edits THRESHOLDS in src/lib/scheme.ts, and that edit sits in the git history
 * with their name on it.
 */

import { prisma } from "../src/lib/db";
import { ALERT_TYPE_LABELS } from "../src/lib/scheme";

const pct = (n: number) => `${Math.round(n * 100)}%`;

async function main() {
  const outcomes = await prisma.detectorOutcome.findMany();

  if (outcomes.length === 0) {
    console.log("No concluded reviews yet.\n");
    console.log(
      "An officer marking an alert as explained or escalating it writes a row here.",
    );
    console.log(
      "Until there are some, there is nothing to tune against — which is the point:",
    );
    console.log(
      "thresholds should move because reviewers found them wrong, not because they",
    );
    console.log("looked wrong to whoever wrote them.");
    return;
  }

  const byType = new Map<string, typeof outcomes>();
  for (const o of outcomes) {
    const bucket = byType.get(o.type) ?? [];
    bucket.push(o);
    byType.set(o.type, bucket);
  }

  console.log(`Reviewer outcomes across ${outcomes.length} concluded alerts\n`);
  console.log(
    "Detector                        Closed  Explained  Escalated   Explained-away rate   Median score",
  );
  console.log("-".repeat(104));

  const recommendations: string[] = [];

  for (const [type, rows] of [...byType.entries()].sort()) {
    const explained = rows.filter((r) => r.resolution === "EXPLAINED");
    const escalated = rows.filter((r) => r.resolution === "ESCALATED");
    const rate = explained.length / rows.length;
    const scores = rows.map((r) => r.score).sort((a, b) => a - b);
    const median = scores[Math.floor(scores.length / 2)];

    console.log(
      `${(ALERT_TYPE_LABELS[type as keyof typeof ALERT_TYPE_LABELS] ?? type).padEnd(30)}` +
        `${String(rows.length).padStart(6)}  ${String(explained.length).padStart(9)}  ` +
        `${String(escalated.length).padStart(9)}   ${pct(rate).padStart(19)}   ${String(median).padStart(12)}`,
    );

    // Only worth saying anything once there is enough to say it about.
    if (rows.length < 10) continue;

    if (rate >= 0.7) {
      const explainedScores = explained.map((r) => r.score).sort((a, b) => b - a);
      const p90 = explainedScores[Math.floor(explainedScores.length * 0.1)] ?? 0;
      recommendations.push(
        `${type}: ${pct(rate)} of concluded alerts were explained away, with explained cases ` +
          `reaching a score of ${p90}. The rule may be firing on ordinary cases — worth reading ` +
          `the reviewers' notes before deciding whether the threshold or the rule itself is wrong.`,
      );
    } else if (rate <= 0.2 && escalated.length >= 5) {
      recommendations.push(
        `${type}: only ${pct(rate)} were explained away and ${escalated.length} were escalated. ` +
          `This rule is finding real cases; a looser threshold might surface more of them.`,
      );
    }
  }

  const hours = outcomes.map((o) => o.hoursToDecide).sort((a, b) => a - b);
  const medianHours = hours[Math.floor(hours.length / 2)];
  console.log("-".repeat(104));
  console.log(
    `Median time from detection to decision: ${medianHours.toFixed(1)} hours across all detectors.`,
  );

  if (recommendations.length > 0) {
    console.log("\nWorth a look:\n");
    for (const r of recommendations) console.log(`  - ${r}\n`);
  } else {
    console.log(
      "\nNo detector has enough concluded reviews yet to say anything useful about its threshold.",
    );
  }

  console.log(
    "\nNothing was changed. Thresholds live in src/lib/scheme.ts and move only when a person moves them.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
