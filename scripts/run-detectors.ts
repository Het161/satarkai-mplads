/**
 * Run the rule engine over the whole dataset and reconcile the alert queue.
 *
 * Run: npm run detect
 *
 * Phase 5 will schedule this; for now it is a deliberate, auditable command.
 * Re-running is safe — see src/lib/detectors/persist.ts for what happens to
 * alerts an officer has already acted on.
 */

import { prisma } from "../src/lib/db";
import { buildContext } from "../src/lib/detectors/context";
import { persistFindings } from "../src/lib/detectors/persist";
import { RULE_DETECTORS } from "../src/lib/detectors/rules";
import { ALERT_TYPE_LABELS } from "../src/lib/scheme";
import type { Finding } from "../src/lib/detectors/types";

async function main() {
  const started = Date.now();
  const ctx = await buildContext();
  console.log(
    `loaded ${ctx.works.length} works and ${ctx.entitlements.length} entitlements\n`,
  );

  const findings: Finding[] = [];
  for (const detector of RULE_DETECTORS) {
    const t0 = Date.now();
    const found = detector.run(ctx);
    findings.push(...found);
    console.log(
      `  ${ALERT_TYPE_LABELS[detector.type].padEnd(30)} ${String(found.length).padStart(4)} findings   ${Date.now() - t0}ms`,
    );
  }

  console.log(`\n${findings.length} findings total`);

  const bySeverity = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `by severity: ${(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const)
      .filter((s) => bySeverity[s])
      .map((s) => `${s}=${bySeverity[s]}`)
      .join("  ")}`,
  );

  const summary = await persistFindings(findings);
  console.log(
    `\nalerts: ${summary.created} created, ${summary.updated} updated, ${summary.removed} withdrawn, ${summary.retained} retained (already actioned)`,
  );
  console.log(`done in ${Date.now() - started}ms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
