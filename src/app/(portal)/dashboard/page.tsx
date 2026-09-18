import type { Metadata } from "next";

import {
  CoverageGapNotice,
  HumanDecidesNotice,
} from "@/components/DataNotices";
import { Card, CardHeader, KpiCard, ProvenanceNote, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { scoped } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber, money } from "@/lib/format";
import { COMPLETION_WINDOW_DAYS, WORK_STATUS_LABELS } from "@/lib/scheme";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Phase 1 dashboard. Deliberately plain: its job right now is to prove that
 * every figure on the page comes out of a scope-filtered query. The role-
 * specific dashboards, trend charts and alert queues arrive in Phase 4.
 */
export default async function DashboardPage() {
  const { user, scope } = await requireSession();

  const overdueCutoff = new Date(
    Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000,
  );

  // Every query below carries the jurisdiction filter — directly where there
  // are no other conditions, through scoped() where there are. Drop it and the
  // figure is wrong; give the user no jurisdiction and scopeFor returns
  // DENY_ALL, so the figure reads zero rather than national.
  const [
    totalWorks,
    byStatus,
    recommendedAgg,
    sanctionedAgg,
    paidAgg,
    overdueCount,
    unmarkedCount,
    districtCount,
    source,
  ] = await Promise.all([
    prisma.work.count({ where: scope.work }),
    prisma.work.groupBy({
      by: ["status"],
      where: scope.work,
      _count: true,
    }),
    prisma.work.aggregate({
      where: scope.work,
      _sum: { recommendedAmount: true },
    }),
    prisma.work.aggregate({
      where: scope.work,
      _sum: { sanctionedAmount: true },
    }),
    prisma.payment.aggregate({
      where: scope.payment,
      _sum: { amount: true },
    }),
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
    prisma.district.count({ where: scope.district }),
    prisma.dataSource.findFirst({ orderBy: { fetchedAt: "desc" } }),
  ]);

  const statusCounts = new Map(byStatus.map((r) => [r.status, r._count]));
  const completed = statusCounts.get("COMPLETED") ?? 0;
  const recommended = money(recommendedAgg._sum.recommendedAmount);
  const sanctioned = money(sanctionedAgg._sum.sanctionedAmount);
  const paid = money(paidAgg._sum.amount);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Scheme overview
          </h1>
          <p className="mt-0.5 text-2xs text-slate">
            {scope.label} · every figure below is filtered to your jurisdiction
            on the server.
          </p>
        </div>
        <Tag>{user.role}</Tag>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Works"
          value={formatNumber(totalWorks)}
          hint={`across ${formatNumber(districtCount)} district${districtCount === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Recommended"
          value={formatINR(recommended)}
          hint="earmarked by MPs"
        />
        <KpiCard
          label="Sanctioned"
          value={formatINR(sanctioned)}
          hint="approved by district authorities"
        />
        <KpiCard
          label="Vendor payments"
          value={formatINR(paid)}
          hint="released against works"
        />
        <KpiCard
          label="Past one-year rule"
          value={formatNumber(overdueCount)}
          hint="sanctioned > 365 days, not marked complete"
          emphasis={overdueCount > 0}
        />
        <KpiCard
          label="Awaiting completion marking"
          value={formatNumber(unmarkedCount)}
          hint="finished but not marked by the agency"
          emphasis={unmarkedCount > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title="Works by stage"
            subtitle="The eSAKSHI lifecycle, from an MP's recommendation to the agency marking the work complete."
          />
          <table className="w-full text-sm">
            <caption className="sr-only">
              Count of works at each stage of the MPLADS lifecycle within your
              jurisdiction
            </caption>
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Stage
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Works
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  "RECOMMENDED",
                  "SANCTIONED",
                  "IN_PROGRESS",
                  "COMPLETED_UNMARKED",
                  "COMPLETED",
                  "CANCELLED",
                ] as const
              ).map((status) => {
                const count = statusCounts.get(status) ?? 0;
                const share = totalWorks ? (count / totalWorks) * 100 : 0;
                return (
                  <tr key={status} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2 text-ink">
                      {WORK_STATUS_LABELS[status]}
                      {status === "COMPLETED_UNMARKED" ? (
                        <span className="ml-2 text-2xs text-slate">
                          not shown as completed publicly
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right text-ink">
                      {formatNumber(count)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate">
                      {share.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-medium">
                <td className="px-4 py-2 text-ink">Total</td>
                <td className="px-4 py-2 text-right text-ink">
                  {formatNumber(totalWorks)}
                </td>
                <td className="px-4 py-2 text-right text-slate">100%</td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Fund flow" />
            <dl className="divide-y divide-line/60 text-sm">
              <div className="flex justify-between px-4 py-2">
                <dt className="text-slate">Recommended by MPs</dt>
                <dd className="tnum text-ink">{formatINR(recommended)}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-slate">Sanctioned</dt>
                <dd className="tnum text-ink">{formatINR(sanctioned)}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-slate">Released to vendors</dt>
                <dd className="tnum text-ink">{formatINR(paid)}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-slate">Completion rate</dt>
                <dd className="tnum text-ink">
                  {totalWorks ? ((completed / totalWorks) * 100).toFixed(1) : "0.0"}%
                </dd>
              </div>
            </dl>
          </Card>

          <HumanDecidesNotice />
          <CoverageGapNotice />
        </div>
      </div>

      {source ? (
        <ProvenanceNote
          kind={source.kind}
          name={source.name}
          fetchedAt={formatDate(source.fetchedAt)}
          note={source.sourceUrl ? `modelled on ${source.sourceUrl}` : undefined}
        />
      ) : null}
    </div>
  );
}
