import { prisma } from "../db";
import type { Finding } from "./types";

/**
 * Write findings to the alert table.
 *
 * Re-running the engine must not destroy review history, so the reconciliation
 * is deliberate rather than a truncate-and-insert:
 *
 *  - **Still firing** → update score, severity, reason and evidence, but keep
 *    `state`. An alert an officer already marked EXPLAINED does not silently
 *    reopen because the nightly run saw it again.
 *  - **No longer firing, never actioned** → delete. Nobody ever saw it, and
 *    keeping stale OPEN alerts around is how a queue becomes untrustworthy.
 *  - **No longer firing, but actioned** → keep. Someone looked at it and
 *    recorded a decision; that record outranks the tidiness of the queue.
 */
export type PersistSummary = {
  created: number;
  updated: number;
  removed: number;
  retained: number;
  byType: Record<string, number>;
};

export async function persistFindings(
  findings: Finding[],
): Promise<PersistSummary> {
  const summary: PersistSummary = {
    created: 0,
    updated: 0,
    removed: 0,
    retained: 0,
    byType: {},
  };

  const existing = await prisma.alert.findMany({
    select: {
      id: true,
      workId: true,
      type: true,
      state: true,
      _count: { select: { actions: true } },
    },
  });

  const key = (workId: string, type: string) => `${workId}|${type}`;
  const existingByKey = new Map(existing.map((a) => [key(a.workId, a.type), a]));
  const firing = new Set(findings.map((f) => key(f.workId, f.type)));

  for (const f of findings) {
    summary.byType[f.type] = (summary.byType[f.type] ?? 0) + 1;

    const prior = existingByKey.get(key(f.workId, f.type));
    if (prior) {
      await prisma.alert.update({
        where: { id: prior.id },
        data: {
          score: f.score,
          severity: f.severity,
          reason: f.reason,
          evidenceJson: f.evidence as object,
          detectedAt: new Date(),
          // `state` is deliberately absent — the officer owns it, not the engine.
        },
      });
      summary.updated++;
    } else {
      await prisma.alert.create({
        data: {
          workId: f.workId,
          type: f.type,
          score: f.score,
          severity: f.severity,
          reason: f.reason,
          evidenceJson: f.evidence as object,
        },
      });
      summary.created++;
    }
  }

  for (const a of existing) {
    if (firing.has(key(a.workId, a.type))) continue;
    if (a._count.actions > 0 || a.state !== "OPEN") {
      summary.retained++;
      continue;
    }
    await prisma.alert.delete({ where: { id: a.id } });
    summary.removed++;
  }

  return summary;
}
