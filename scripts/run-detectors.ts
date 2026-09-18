/**
 * Run the detection pipeline and reconcile the alert queue.
 *
 * Run: npm run detect          (rules + statistics; no Python needed)
 *      npm run detect:ml       (also calls the model service)
 *
 * Three layers, in order of how much they need:
 *
 *   1. Rule detectors     — deterministic, citable, always run.
 *   2. Statistical        — robust dispersion and share tests, always run.
 *   3. Model service      — IsolationForest and delay risk, only when
 *                           ML_MODE=ml and the service answers.
 *
 * Layer 3 failing is not an error. The queue is already complete without it;
 * the run reports what the model would have added and carries on.
 *
 * Phase 5 will schedule this. For now it is a deliberate, auditable command.
 */

import { prisma } from "../src/lib/db";
import { buildContext } from "../src/lib/detectors/context";
import {
  checkMlService,
  detectMlAnomalies,
  predictDelayRisk,
} from "../src/lib/detectors/ml";
import { persistFindings } from "../src/lib/detectors/persist";
import { RULE_DETECTORS } from "../src/lib/detectors/rules";
import { STATISTICAL_DETECTORS } from "../src/lib/detectors/statistics";
import { ALERT_TYPE_LABELS } from "../src/lib/scheme";
import { env } from "../src/lib/env";
import type { Finding } from "../src/lib/detectors/types";

async function main() {
  const started = Date.now();
  const ctx = await buildContext();
  console.log(
    `loaded ${ctx.works.length} works and ${ctx.entitlements.length} entitlements`,
  );
  console.log(`ML_MODE=${env.mlMode}\n`);

  const findings: Finding[] = [];

  console.log("rule detectors");
  for (const detector of [...RULE_DETECTORS, ...STATISTICAL_DETECTORS]) {
    const t0 = Date.now();
    const found = detector.run(ctx);
    findings.push(...found);
    console.log(
      `  ${ALERT_TYPE_LABELS[detector.type].padEnd(32)} ${String(found.length).padStart(4)}   ${Date.now() - t0}ms`,
    );
  }

  // ---- model service -------------------------------------------------------
  console.log("\nmodel service");
  const health = await checkMlService();
  if (health.ok) {
    console.log(`  reachable: ${health.data.model_version}`);
  } else {
    console.log(`  not used: ${health.reason}`);
  }

  const anomalies = await detectMlAnomalies(ctx);
  findings.push(...anomalies.findings);
  console.log(
    `  ${ALERT_TYPE_LABELS.ML_ANOMALY.padEnd(32)} ${String(anomalies.findings.length).padStart(4)}   ${anomalies.note}`,
  );

  const delay = await predictDelayRisk(ctx);
  console.log(`  Delay-risk forecasts              ${String(delay.predictions.length).padStart(4)}   ${delay.note}`);

  // ---- persist -------------------------------------------------------------
  const bySeverity = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n${findings.length} findings total`);
  console.log(
    `by severity: ${(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const)
      .filter((s) => bySeverity[s])
      .map((s) => `${s}=${bySeverity[s]}`)
      .join("  ")}`,
  );

  const summary = await persistFindings(findings);
  console.log(
    `alerts: ${summary.created} created, ${summary.updated} updated, ${summary.removed} withdrawn, ${summary.retained} retained (already actioned)`,
  );

  // Forecasts are replaced wholesale. Unlike alerts they carry no review state
  // — nobody acts on a forecast, they act on what it points at — so there is
  // no history to preserve, and a stale prediction is worse than none.
  if (delay.predictions.length > 0 && delay.modelVersion) {
    await prisma.delayRisk.deleteMany();
    await prisma.delayRisk.createMany({
      data: delay.predictions.map((p) => ({
        workId: p.workId,
        probability: p.probability,
        band: p.band,
        drivers: p.drivers,
        modelVersion: delay.modelVersion!,
      })),
    });
    const byBand = delay.predictions.reduce<Record<string, number>>((acc, p) => {
      acc[p.band] = (acc[p.band] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `delay risk: ${delay.predictions.length} forecasts stored — ${(
        ["VERY_HIGH", "HIGH", "MODERATE", "LOW"] as const
      )
        .filter((b) => byBand[b])
        .map((b) => `${b}=${byBand[b]}`)
        .join("  ")}`,
    );
  } else if (env.mlMode === "ml") {
    console.log("delay risk: no forecasts stored");
  }

  console.log(`\ndone in ${Date.now() - started}ms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
