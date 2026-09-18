/**
 * Seed integrity check.
 *
 * The seed's whole value rests on one invariant: works WITHOUT a PlantedAnomaly
 * label must not trip any rule detector. If the baseline leaks, then Phase 3's
 * precision figure measures nothing — an "false positive" might just be a work
 * the generator accidentally made anomalous.
 *
 * This script re-implements the rule conditions independently of the detectors
 * (Phase 2) so the two cannot agree by sharing a bug, and reports any leak.
 *
 * Run: npm run check:baseline
 */

import { PrismaClient } from "@prisma/client";
import { COMPLETION_WINDOW_DAYS, THRESHOLDS } from "../src/lib/scheme";

const prisma = new PrismaClient();

const NOW = new Date("2026-09-18T00:00:00.000Z");
const days = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86_400_000);

async function main() {
  const works = await prisma.work.findMany({
    include: { payments: { include: { evidence: true } }, planted: true },
  });

  const leaks: Record<string, string[]> = {};
  const leak = (rule: string, code: string) => {
    (leaks[rule] ??= []).push(code);
  };

  for (const w of works) {
    const labels = new Set(w.planted.map((p) => p.type));
    const sanctioned = Number(w.sanctionedAmount ?? 0);
    const paid = w.payments.reduce((s, p) => s + Number(p.amount), 0);

    // OVERDUE — past the one-year guideline and not marked complete.
    if (
      w.sanctionedAt &&
      !w.markedCompleteAt &&
      w.status !== "CANCELLED" &&
      days(w.sanctionedAt, NOW) > COMPLETION_WINDOW_DAYS &&
      !labels.has("OVERDUE") &&
      !labels.has("STUCK_UNMARKED")
    ) {
      leak("OVERDUE", w.workCode);
    }

    // COST_OVERRUN — payments beyond the sanctioned amount.
    // COST_OUTLIER works are exempt: inflating the cost is the point there.
    if (
      sanctioned > 0 &&
      paid > sanctioned * (1 + THRESHOLDS.costOverrunPct) &&
      !labels.has("COST_OVERRUN") &&
      !labels.has("COST_OUTLIER")
    ) {
      leak("COST_OVERRUN", w.workCode);
    }

    // PAYMENT_AHEAD — money released well beyond recorded progress.
    if (
      sanctioned > 0 &&
      w.status === "IN_PROGRESS" &&
      paid / sanctioned > w.progressPct / 100 + THRESHOLDS.paymentAheadOfProgressPct &&
      !labels.has("PAYMENT_AHEAD") &&
      !labels.has("COST_OVERRUN") &&
      !labels.has("COST_OUTLIER")
    ) {
      leak("PAYMENT_AHEAD", w.workCode);
    }

    // MISSING_EVIDENCE — a released stage with nothing uploaded.
    if (
      w.payments.some((p) => p.evidence.length === 0) &&
      !labels.has("MISSING_EVIDENCE")
    ) {
      leak("MISSING_EVIDENCE", w.workCode);
    }

    // STUCK_UNMARKED — complete on the ground, never marked complete.
    if (w.status === "COMPLETED_UNMARKED" && !labels.has("STUCK_UNMARKED")) {
      leak("STUCK_UNMARKED", w.workCode);
    }

    // FY_END_SPIKE — sanctioned inside the closing window of a financial year.
    if (w.sanctionedAt) {
      const closeYear =
        w.sanctionedAt.getUTCMonth() >= 3
          ? w.sanctionedAt.getUTCFullYear() + 1
          : w.sanctionedAt.getUTCFullYear();
      const close = new Date(Date.UTC(closeYear, 2, 31));
      const toClose = days(w.sanctionedAt, close);
      if (
        toClose >= 0 &&
        toClose <= THRESHOLDS.fyEndWindowDays &&
        !labels.has("FY_END_SPIKE")
      ) {
        leak("FY_END_SPIKE", w.workCode);
      }
    }
  }

  // ---- chronology ----------------------------------------------------------
  // A record can be free of rule violations and still be nonsense: a work
  // completed before it was sanctioned, or a vendor paid a year after handover.
  // Planting moves dates around, so these invariants are checked explicitly
  // rather than assumed — a reviewer opening one such work would rightly stop
  // trusting every other figure on the page.
  const chronology: Record<string, string[]> = {};
  const breach = (rule: string, code: string) => {
    (chronology[rule] ??= []).push(code);
  };

  for (const w of works) {
    if (w.sanctionedAt && w.sanctionedAt < w.recommendedAt) {
      breach("sanctioned before recommended", w.workCode);
    }
    if (w.completedAt && w.sanctionedAt && w.completedAt < w.sanctionedAt) {
      breach("completed before sanctioned", w.workCode);
    }
    if (w.markedCompleteAt && w.completedAt && w.markedCompleteAt < w.completedAt) {
      breach("marked complete before finished", w.workCode);
    }
    for (const p of w.payments) {
      if (w.sanctionedAt && p.releasedAt < w.sanctionedAt) {
        breach("paid before sanction", w.workCode);
      }
      if (p.releasedAt > NOW) breach("paid in the future", w.workCode);
      if (
        w.completedAt &&
        days(w.completedAt, p.releasedAt) > 60
      ) {
        breach("paid over 60 days after completion", w.workCode);
      }
      for (const e of p.evidence) {
        if (e.uploadedAt > NOW) breach("evidence uploaded in the future", w.workCode);
      }
    }
  }

  // ENTITLEMENT_BREACH — recommendations per MP per FY above the entitlement.
  // Cancelled recommendations release their earmarked funds, so they are
  // excluded here exactly as the detector excludes them.
  const overEntitlement = await prisma.$queryRaw<
    { mpId: string; financialYear: string; total: number }[]
  >`SELECT w."mpId", w."financialYear", SUM(w."recommendedAmount")::float AS total
      FROM "Work" w
      JOIN "Entitlement" e
        ON e."mpId" = w."mpId" AND e."financialYear" = w."financialYear"
     WHERE w."status" <> 'CANCELLED'
     GROUP BY w."mpId", w."financialYear", e."amountAuthorised"
    HAVING SUM(w."recommendedAmount") > e."amountAuthorised"`;

  const plantedBreach = await prisma.plantedAnomaly.count({
    where: { type: "ENTITLEMENT_BREACH" },
  });

  // ---- report --------------------------------------------------------------
  const statuses = await prisma.work.groupBy({ by: ["status"], _count: true });
  const coverage = await prisma.work.aggregate({
    _min: { recommendedAt: true },
    _max: { recommendedAt: true },
  });
  const labelCounts = await prisma.plantedAnomaly.groupBy({
    by: ["type"],
    _count: true,
  });

  console.log(`works: ${works.length}`);
  console.log(
    `coverage: ${coverage._min.recommendedAt?.toISOString().slice(0, 10)} -> ${coverage._max.recommendedAt?.toISOString().slice(0, 10)}`,
  );
  console.log(`status: ${statuses.map((s) => `${s.status}=${s._count}`).join("  ")}`);
  console.log(
    `ground truth: ${labelCounts.map((l) => `${l.type}=${l._count}`).join("  ")}`,
  );
  console.log(
    `MP-FY over entitlement: ${overEntitlement.length} (${plantedBreach} planted)`,
  );

  const leakedRules = Object.keys(leaks);
  const chronoBreaches = Object.keys(chronology);

  if (leakedRules.length > 0) {
    console.log("\nBASELINE LEAKS (unlabelled works that would fire a detector):");
    for (const rule of leakedRules) {
      console.log(`  ${rule.padEnd(36)} ${leaks[rule].length}`);
      console.log(`    e.g. ${leaks[rule].slice(0, 3).join(", ")}`);
    }
  }

  if (chronoBreaches.length > 0) {
    console.log("\nCHRONOLOGY BREACHES (records that do not make sense in time):");
    for (const rule of chronoBreaches) {
      const codes = [...new Set(chronology[rule])];
      console.log(`  ${rule.padEnd(36)} ${codes.length} work(s)`);
      console.log(`    e.g. ${codes.slice(0, 3).join(", ")}`);
    }
  }

  if (leakedRules.length === 0 && chronoBreaches.length === 0) {
    console.log(
      "\nbaseline clean — no unlabelled work trips a rule detector, and every record is chronologically coherent.",
    );
    return;
  }

  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
