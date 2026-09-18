import { prisma } from "./db";
import { scoped, type Scope } from "./scope";
import { COMPLETION_WINDOW_DAYS } from "./scheme";

/**
 * Dashboard queries, every one of them scope-filtered.
 *
 * These are shared across the four role dashboards. A district officer and the
 * Ministry desk read the same functions; what differs is the `Scope` passed in,
 * which is built server-side from the signed-in user. There is no "national
 * mode" flag anywhere — a Ministry user simply has a scope that matches
 * everything, and a district user one that matches their district.
 *
 * Aggregates are computed in SQL rather than pulled into Node and summed,
 * because a national query touches every work in the scheme. Each raw query
 * takes the scope as a list of work ids resolved once, which keeps the
 * jurisdiction filter in exactly one place and impossible to forget.
 */

/** Resolve the scope to the ids it covers, once, for the raw aggregates. */
async function scopedWorkIds(scope: Scope): Promise<string[]> {
  const rows = await prisma.work.findMany({
    where: scope.work,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type SchemeKpis = {
  works: number;
  districts: number;
  recommended: number;
  sanctioned: number;
  released: number;
  completed: number;
  completionRate: number;
  overdue: number;
  awaitingMarking: number;
  openAlerts: number;
  criticalAlerts: number;
};

export async function schemeKpis(scope: Scope): Promise<SchemeKpis> {
  const overdueCutoff = new Date(Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000);

  const [
    works,
    districts,
    recommendedAgg,
    sanctionedAgg,
    releasedAgg,
    completed,
    overdue,
    awaitingMarking,
    openAlerts,
    criticalAlerts,
  ] = await Promise.all([
    prisma.work.count({ where: scope.work }),
    prisma.district.count({ where: scope.district }),
    prisma.work.aggregate({ where: scope.work, _sum: { recommendedAmount: true } }),
    prisma.work.aggregate({ where: scope.work, _sum: { sanctionedAmount: true } }),
    prisma.payment.aggregate({ where: scope.payment, _sum: { amount: true } }),
    prisma.work.count({ where: scoped(scope.work, { status: "COMPLETED" }) }),
    prisma.work.count({
      where: scoped(scope.work, {
        sanctionedAt: { lt: overdueCutoff },
        markedCompleteAt: null,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      }),
    }),
    prisma.work.count({
      where: scoped(scope.work, { status: "COMPLETED_UNMARKED" }),
    }),
    prisma.alert.count({ where: scoped(scope.alert, { state: "OPEN" }) }),
    prisma.alert.count({ where: scoped(scope.alert, { severity: "CRITICAL" }) }),
  ]);

  const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

  return {
    works,
    districts,
    recommended: num(recommendedAgg._sum.recommendedAmount),
    sanctioned: num(sanctionedAgg._sum.sanctionedAmount),
    released: num(releasedAgg._sum.amount),
    completed,
    completionRate: works > 0 ? completed / works : 0,
    overdue,
    awaitingMarking,
    openAlerts,
    criticalAlerts,
  };
}

/* ------------------------------------------------------------------------ */

export type MonthPoint = {
  label: string;
  recommended: number;
  sanctioned: number;
  completed: number;
};

/**
 * Works entering each stage, by month.
 *
 * All three series count works, so they share one axis honestly. Money moves on
 * a different scale entirely and gets its own chart rather than a second y-axis
 * — two scales on one plot invent a correlation that is not in the data.
 */
export async function monthlyPipeline(
  scope: Scope,
  months = 24,
): Promise<MonthPoint[]> {
  const ids = await scopedWorkIds(scope);
  if (ids.length === 0) return [];

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months, 1);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<
    { month: Date; recommended: bigint; sanctioned: bigint; completed: bigint }[]
  >`
    WITH m AS (
      SELECT generate_series(
        date_trunc('month', ${since}::timestamp),
        date_trunc('month', now()),
        '1 month'
      ) AS month
    )
    SELECT
      m.month,
      (SELECT count(*) FROM "Work" w
        WHERE w.id = ANY(${ids})
          AND date_trunc('month', w."recommendedAt") = m.month) AS recommended,
      (SELECT count(*) FROM "Work" w
        WHERE w.id = ANY(${ids})
          AND date_trunc('month', w."sanctionedAt") = m.month) AS sanctioned,
      (SELECT count(*) FROM "Work" w
        WHERE w.id = ANY(${ids})
          AND date_trunc('month', w."markedCompleteAt") = m.month) AS completed
    FROM m
    ORDER BY m.month
  `;

  return rows.map((r) => ({
    label: r.month.toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
    recommended: Number(r.recommended),
    sanctioned: Number(r.sanctioned),
    completed: Number(r.completed),
  }));
}

/** Vendor payments released per month. Its own chart — money is its own scale. */
export async function monthlySpend(
  scope: Scope,
  months = 24,
): Promise<{ label: string; released: number }[]> {
  const ids = await scopedWorkIds(scope);
  if (ids.length === 0) return [];

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months, 1);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<{ month: Date; released: number }[]>`
    WITH m AS (
      SELECT generate_series(
        date_trunc('month', ${since}::timestamp),
        date_trunc('month', now()),
        '1 month'
      ) AS month
    )
    SELECT m.month,
      COALESCE((SELECT sum(p.amount) FROM "Payment" p
         WHERE p."workId" = ANY(${ids})
           AND date_trunc('month', p."releasedAt") = m.month), 0)::float AS released
    FROM m
    ORDER BY m.month
  `;

  return rows.map((r) => ({
    label: r.month.toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
    released: Number(r.released),
  }));
}

/* ------------------------------------------------------------------------ */

export type RankedRow = {
  id: string;
  name: string;
  subtitle?: string;
  works: number;
  value: number;
  alerts: number;
  criticalAlerts: number;
  overdue: number;
  completionRate: number;
};

/** Districts within scope, with the figures a comparison needs. */
export async function districtBreakdown(scope: Scope): Promise<RankedRow[]> {
  const districts = await prisma.district.findMany({
    where: scope.district,
    include: { state: true },
  });
  if (districts.length === 0) return [];

  const overdueCutoff = new Date(Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000);

  const rows = await Promise.all(
    districts.map(async (d) => {
      const where = scoped(scope.work, { districtId: d.id });
      const [works, agg, alerts, critical, overdue, completed] = await Promise.all([
        prisma.work.count({ where }),
        prisma.work.aggregate({ where, _sum: { sanctionedAmount: true } }),
        prisma.alert.count({ where: scoped(scope.alert, { work: { districtId: d.id } }) }),
        prisma.alert.count({
          where: scoped(scope.alert, {
            work: { districtId: d.id },
            severity: "CRITICAL",
          }),
        }),
        prisma.work.count({
          where: scoped(scope.work, {
            districtId: d.id,
            sanctionedAt: { lt: overdueCutoff },
            markedCompleteAt: null,
            status: { notIn: ["CANCELLED", "COMPLETED"] },
          }),
        }),
        prisma.work.count({
          where: scoped(scope.work, { districtId: d.id, status: "COMPLETED" }),
        }),
      ]);

      return {
        id: d.id,
        name: d.name,
        subtitle: d.state.name,
        works,
        value: Number(agg._sum.sanctionedAmount ?? 0),
        alerts,
        criticalAlerts: critical,
        overdue,
        completionRate: works > 0 ? completed / works : 0,
      };
    }),
  );

  return rows.filter((r) => r.works > 0);
}

/** States within scope. Ministry only, in practice. */
export async function stateBreakdown(scope: Scope): Promise<RankedRow[]> {
  const states = await prisma.state.findMany({ where: scope.state });
  if (states.length === 0) return [];

  const overdueCutoff = new Date(Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000);

  return Promise.all(
    states.map(async (s) => {
      const where = scoped(scope.work, { district: { stateId: s.id } });
      const [works, agg, alerts, critical, overdue, completed] = await Promise.all([
        prisma.work.count({ where }),
        prisma.work.aggregate({ where, _sum: { sanctionedAmount: true } }),
        prisma.alert.count({
          where: scoped(scope.alert, { work: { district: { stateId: s.id } } }),
        }),
        prisma.alert.count({
          where: scoped(scope.alert, {
            work: { district: { stateId: s.id } },
            severity: "CRITICAL",
          }),
        }),
        prisma.work.count({
          where: scoped(scope.work, {
            district: { stateId: s.id },
            sanctionedAt: { lt: overdueCutoff },
            markedCompleteAt: null,
            status: { notIn: ["CANCELLED", "COMPLETED"] },
          }),
        }),
        prisma.work.count({
          where: scoped(scope.work, {
            district: { stateId: s.id },
            status: "COMPLETED",
          }),
        }),
      ]);

      return {
        id: s.id,
        name: s.name,
        works,
        value: Number(agg._sum.sanctionedAmount ?? 0),
        alerts,
        criticalAlerts: critical,
        overdue,
        completionRate: works > 0 ? completed / works : 0,
      };
    }),
  );
}

/** Implementing agencies within scope, for a district officer. */
export async function agencyBreakdown(scope: Scope): Promise<RankedRow[]> {
  const agencies = await prisma.implementingAgency.findMany({
    where: scope.agency,
    include: { district: true },
  });
  if (agencies.length === 0) return [];

  const overdueCutoff = new Date(Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000);

  const rows = await Promise.all(
    agencies.map(async (a) => {
      const where = scoped(scope.work, { iaId: a.id });
      const [works, agg, alerts, critical, overdue, completed, stages, documented] =
        await Promise.all([
          prisma.work.count({ where }),
          prisma.work.aggregate({ where, _sum: { sanctionedAmount: true } }),
          prisma.alert.count({ where: scoped(scope.alert, { work: { iaId: a.id } }) }),
          prisma.alert.count({
            where: scoped(scope.alert, { work: { iaId: a.id }, severity: "CRITICAL" }),
          }),
          prisma.work.count({
            where: scoped(scope.work, {
              iaId: a.id,
              sanctionedAt: { lt: overdueCutoff },
              markedCompleteAt: null,
              status: { notIn: ["CANCELLED", "COMPLETED"] },
            }),
          }),
          prisma.work.count({
            where: scoped(scope.work, { iaId: a.id, status: "COMPLETED" }),
          }),
          prisma.payment.count({ where: scoped(scope.payment, { work: { iaId: a.id } }) }),
          prisma.payment.count({
            where: scoped(scope.payment, {
              work: { iaId: a.id },
              evidence: { some: {} },
            }),
          }),
        ]);

      return {
        id: a.id,
        name: a.name,
        subtitle: `${a.type} · ${a.district.name}`,
        works,
        value: Number(agg._sum.sanctionedAmount ?? 0),
        alerts,
        criticalAlerts: critical,
        overdue,
        completionRate: works > 0 ? completed / works : 0,
        evidenceCompleteness: stages > 0 ? documented / stages : 1,
        stages,
      };
    }),
  );

  return rows.filter((r) => r.works > 0) as RankedRow[];
}

export type AgencyRow = RankedRow & {
  evidenceCompleteness: number;
  stages: number;
};

/* ------------------------------------------------------------------------ */

export async function alertsByType(scope: Scope) {
  const rows = await prisma.alert.groupBy({
    by: ["type"],
    where: scope.alert,
    _count: true,
  });
  return rows.sort((a, b) => b._count - a._count);
}

export async function alertsBySeverity(scope: Scope) {
  const rows = await prisma.alert.groupBy({
    by: ["severity"],
    where: scope.alert,
    _count: true,
  });
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
  return rows.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

/** The queue, trimmed to what fits on a dashboard. */
export async function topAlerts(scope: Scope, take = 6) {
  return prisma.alert.findMany({
    where: scoped(scope.alert, { state: "OPEN" }),
    orderBy: [{ score: "desc" }, { detectedAt: "desc" }],
    take,
    include: {
      work: { include: { district: { include: { state: true } }, mp: true, ia: true } },
    },
  });
}

/** Works past the one-year guideline and still unmarked — the escalations. */
export async function overdueWorks(scope: Scope, take = 8) {
  const cutoff = new Date(Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000);
  return prisma.work.findMany({
    where: scoped(scope.work, {
      sanctionedAt: { lt: cutoff },
      markedCompleteAt: null,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    }),
    orderBy: { sanctionedAt: "asc" },
    take,
    include: { district: true, ia: true },
  });
}

/** Works forecast most likely to miss the one-year window. */
export async function topDelayRisks(scope: Scope, take = 5) {
  return prisma.work.findMany({
    where: scoped(scope.work, {
      delayRisk: { band: { in: ["VERY_HIGH", "HIGH"] } },
    }),
    orderBy: { delayRisk: { probability: "desc" } },
    take,
    include: { delayRisk: true, district: true, ia: true },
  });
}

/* ------------------------------------------------------------------------ */

export type EntitlementYear = {
  financialYear: string;
  authorised: number;
  released: number;
  recommended: number;
  sanctioned: number;
  spent: number;
  works: number;
  completed: number;
};

/**
 * An MP's year-by-year position: what was authorised, what they recommended
 * against it, what districts sanctioned, and what actually reached vendors.
 */
export async function entitlementByYear(
  scope: Scope,
  mpId: string,
): Promise<EntitlementYear[]> {
  const entitlements = await prisma.entitlement.findMany({
    where: { mpId },
    orderBy: { financialYear: "asc" },
  });

  return Promise.all(
    entitlements.map(async (e) => {
      const where = scoped(scope.work, {
        mpId,
        financialYear: e.financialYear,
        status: { not: "CANCELLED" },
      });

      const [recommendedAgg, sanctionedAgg, spentAgg, works, completed] =
        await Promise.all([
          prisma.work.aggregate({ where, _sum: { recommendedAmount: true } }),
          prisma.work.aggregate({ where, _sum: { sanctionedAmount: true } }),
          prisma.payment.aggregate({
            where: scoped(scope.payment, {
              work: { mpId, financialYear: e.financialYear },
            }),
            _sum: { amount: true },
          }),
          prisma.work.count({ where }),
          prisma.work.count({ where: scoped(where, { status: "COMPLETED" }) }),
        ]);

      return {
        financialYear: e.financialYear,
        authorised: Number(e.amountAuthorised),
        released: Number(e.releasedAmount),
        recommended: Number(recommendedAgg._sum.recommendedAmount ?? 0),
        sanctioned: Number(sanctionedAgg._sum.sanctionedAmount ?? 0),
        spent: Number(spentAgg._sum.amount ?? 0),
        works,
        completed,
      };
    }),
  );
}

/** Works by category — what an MP has put their entitlement into. */
export async function worksByCategory(scope: Scope) {
  const rows = await prisma.work.groupBy({
    by: ["category"],
    where: scoped(scope.work, { status: { not: "CANCELLED" } }),
    _count: true,
    _sum: { recommendedAmount: true },
  });
  return rows
    .map((r) => ({
      category: r.category,
      works: r._count,
      value: Number(r._sum.recommendedAmount ?? 0),
    }))
    .sort((a, b) => b.value - a.value);
}

/** Works by stage, in lifecycle order rather than alphabetically. */
export async function worksByStage(scope: Scope) {
  const rows = await prisma.work.groupBy({
    by: ["status"],
    where: scope.work,
    _count: true,
  });
  const counts = new Map(rows.map((r) => [r.status, r._count]));
  return (
    [
      "RECOMMENDED",
      "SANCTIONED",
      "IN_PROGRESS",
      "COMPLETED_UNMARKED",
      "COMPLETED",
      "CANCELLED",
    ] as const
  ).map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

/** The most recent provenance record, for the source line every page carries. */
export async function latestSource() {
  return prisma.dataSource.findFirst({ orderBy: { fetchedAt: "desc" } });
}
