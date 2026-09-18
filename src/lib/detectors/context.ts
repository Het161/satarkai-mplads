import { prisma } from "../db";

/**
 * The detectors are pure functions over a snapshot, not over the database.
 *
 * Loading once and passing the snapshot around keeps each rule readable, makes
 * them trivially unit-testable, and lets the cross-record rules (duplicates,
 * year-end clustering, entitlement totals) look across works without issuing a
 * query per row.
 */

export type WorkRecord = Awaited<ReturnType<typeof loadWorks>>[number];
export type EntitlementRecord = Awaited<ReturnType<typeof loadEntitlements>>[number];

function loadWorks() {
  return prisma.work.findMany({
    include: {
      district: { include: { state: true } },
      mp: true,
      ia: true,
      payments: {
        orderBy: { stageNo: "asc" },
        include: { evidence: true },
      },
    },
  });
}

function loadEntitlements() {
  return prisma.entitlement.findMany({ include: { mp: true } });
}

export type DetectorContext = {
  /** Evaluation time. Injectable so runs are reproducible and testable. */
  now: Date;
  works: WorkRecord[];
  entitlements: EntitlementRecord[];
};

export async function buildContext(now = new Date()): Promise<DetectorContext> {
  const [works, entitlements] = await Promise.all([
    loadWorks(),
    loadEntitlements(),
  ]);
  return { now, works, entitlements };
}

// --- shared derivations -----------------------------------------------------

export const num = (v: { toString(): string } | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v.toString());

export const daysBetween = (a: Date, b: Date): number =>
  Math.floor((b.getTime() - a.getTime()) / 86_400_000);

/** Total vendor payments released against a work — the scheme's "expenditure". */
export const totalPaid = (w: WorkRecord): number =>
  w.payments.reduce((s, p) => s + num(p.amount), 0);

/**
 * A work is physically finished but the implementing agency has not marked it
 * complete on the portal — so it never appears as completed publicly. The
 * portal itself flags this as an ongoing problem, which is why it is treated
 * as its own signal rather than folded into "overdue".
 */
export const isFinishedButUnmarked = (w: WorkRecord): boolean =>
  w.markedCompleteAt === null &&
  w.progressPct >= 100 &&
  w.completedAt !== null &&
  w.status !== "CANCELLED";

/** Works that have been sanctioned and are not cancelled — the live pipeline. */
export const isLive = (w: WorkRecord): boolean =>
  w.sanctionedAt !== null && w.status !== "CANCELLED";
