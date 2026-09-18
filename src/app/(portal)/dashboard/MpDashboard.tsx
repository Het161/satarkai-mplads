import Link from "next/link";

import { CoverageGapNotice } from "@/components/DataNotices";
import { FundFlowBars } from "@/components/charts";
import { DashboardHeading } from "@/components/dashboard/shared";
import { Card, CardHeader, EmptyState, KpiCard } from "@/components/ui";
import {
  entitlementByYear,
  schemeKpis,
  worksByCategory,
  worksByStage,
} from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { fill, t as tr } from "@/lib/i18n";
import { scoped, type Scope } from "@/lib/scope";
import { COMPLETION_WINDOW_DAYS } from "@/lib/scheme";

/**
 * Member of Parliament — their own recommended works.
 *
 * Deliberately the plainest of the four. An MP is not an auditor and has no
 * alerts to action, so nothing here uses the word "anomaly", shows a priority
 * score, or asks them to review a case. The questions this page answers are the
 * ones a constituency office actually asks: how much of my entitlement is used,
 * what did it buy, and what is stuck.
 *
 * Where a work is delayed the page says so in words rather than in severity
 * colour — an MP reading that a school block is late needs the fact, not a
 * risk score.
 */
export async function MpDashboard({
  scope,
  mp,
}: {
  scope: Scope;
  mp: { id: string; name: string; constituency: string; house: string };
}) {
  const d = tr();
  const overdueCutoff = new Date(
    Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000,
  );

  const [kpis, years, categories, stages, delayed, recent] = await Promise.all([
    schemeKpis(scope),
    entitlementByYear(scope, mp.id),
    worksByCategory(scope),
    worksByStage(scope),
    prisma.work.findMany({
      where: scoped(scope.work, {
        sanctionedAt: { lt: overdueCutoff },
        markedCompleteAt: null,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      }),
      orderBy: { sanctionedAt: "asc" },
      take: 10,
      include: { district: true, ia: true },
    }),
    prisma.work.findMany({
      where: scoped(scope.work, { status: { not: "CANCELLED" } }),
      orderBy: { recommendedAt: "desc" },
      take: 8,
      include: { district: true },
    }),
  ]);

  // The newest financial year may have barely started — an entitlement with
  // nothing sanctioned against it yet makes an empty chart that says nothing.
  // Show the most recent year that has actually moved.
  const currentYear =
    [...years].reverse().find((y) => y.sanctioned > 0) ??
    years[years.length - 1];
  const totalAuthorised = years.reduce((s, y) => s + y.authorised, 0);

  return (
    <div className="space-y-5">
      <DashboardHeading
        title={mp.constituency}
        subtitle={fill(d.dash.mpSubtitle, {
          mp: mp.name,
          house: mp.house === "RS" ? d.dash.houseRS : d.dash.houseLS,
        })}
        badge={d.role.MP}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={d.dash.kpiWorksRecommended}
          value={formatNumber(kpis.works)}
          hint={fill(d.dash.hintCompleted, {
            count: formatNumber(kpis.completed),
          })}
        />
        <KpiCard
          label={d.dash.kpiEntitlementAuthorised}
          value={formatINR(totalAuthorised)}
          hint={fill(d.dash.hintAcrossYears, { count: years.length })}
        />
        <KpiCard
          label={d.dash.kpiRecommendedAgainst}
          value={formatINR(kpis.recommended)}
          hint={fill(d.dash.hintOfEntitlement, {
            pct: formatPct(
              totalAuthorised > 0 ? kpis.recommended / totalAuthorised : 0,
              0,
            ),
          })}
        />
        <KpiCard
          label={d.dash.kpiReachedVendors}
          value={formatINR(kpis.released)}
          hint={d.dash.hintActuallyPaidOut}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title={
              currentYear
                ? fill(d.dash.moneyStandsTitleFy, {
                    fy: currentYear.financialYear,
                  })
                : d.dash.moneyStandsTitle
            }
            subtitle={d.dash.moneyStandsSubtitle}
          />
          {currentYear ? (
            <FundFlowBars
              labels={{
                showChart: d.common.showChart,
                showFigures: d.common.showFigures,
                month: d.table.month,
              }}
              columnLabels={{ stage: d.table.stage, amount: d.table.amount }}
              data={[
                {
                  label: d.dash.flowEntitlement,
                  value: currentYear.authorised,
                },
                {
                  label: d.dash.flowRecommended,
                  value: currentYear.recommended,
                },
                { label: d.dash.flowSanctioned, value: currentYear.sanctioned },
                { label: d.dash.flowPaid, value: currentYear.spent },
              ]}
              format="inr"
            />
          ) : (
            <EmptyState
              title={d.dash.noEntitlementTitle}
              body={d.dash.noEntitlementBody}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title={d.dash.yearByYearTitle}
            subtitle={d.dash.yearByYearSubtitle}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">{d.dash.yearByYearCaption}</caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {d.table.year}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.entitlement}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.recommended}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.sanctioned}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.paid}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.works}
                  </th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => {
                  const over = y.recommended > y.authorised;
                  return (
                    <tr
                      key={y.financialYear}
                      className="border-b border-line/60 last:border-0"
                    >
                      <th
                        scope="row"
                        className="px-4 py-2 text-left font-medium text-ink"
                      >
                        {y.financialYear}
                      </th>
                      <td className="tnum px-4 py-2 text-right text-slate">
                        {formatINR(y.authorised)}
                      </td>
                      <td
                        className={
                          over
                            ? "tnum px-4 py-2 text-right font-medium text-severity-critical"
                            : "tnum px-4 py-2 text-right text-ink"
                        }
                      >
                        {formatINR(y.recommended)}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-ink">
                        {formatINR(y.sanctioned)}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-ink">
                        {formatINR(y.spent)}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-slate">
                        {y.completed}/{y.works}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {years.some((y) => y.recommended > y.authorised) ? (
            <p className="border-t border-line bg-severity-critical/5 px-4 py-2 text-2xs text-severity-critical">
              {d.dash.overRecommendedNote}
            </p>
          ) : null}
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={d.dash.lateTitle}
            subtitle={fill(d.dash.lateSubtitle, {
              days: COMPLETION_WINDOW_DAYS,
            })}
          />
          {delayed.length === 0 ? (
            <EmptyState
              title={d.dash.lateEmptyTitle}
              body={d.dash.lateEmptyBody}
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {delayed.map((w) => {
                const days =
                  Math.floor(
                    (Date.now() - w.sanctionedAt!.getTime()) / 86_400_000,
                  ) - COMPLETION_WINDOW_DAYS;
                return (
                  <li key={w.id} className="px-4 py-2">
                    <Link
                      href={`/works/${w.id}`}
                      className="text-sm font-medium text-navy hover:underline"
                    >
                      {w.title}
                    </Link>
                    <div className="text-2xs text-slate">
                      {fill(d.dash.lateMeta, {
                        days,
                        progress: w.progressPct,
                        agency: w.ia?.name ?? d.dash.noAgencyDesignatedLower,
                        district: w.district.name,
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={d.dash.categoriesTitle}
            subtitle={d.dash.categoriesSubtitle}
          />
          <table className="w-full text-sm">
            <caption className="sr-only">{d.dash.categoriesCaption}</caption>
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  {d.table.category}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.table.works}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.table.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr
                  key={c.category}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="px-4 py-2 text-ink">{c.category}</td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {c.works}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-ink">
                    {formatINR(c.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={d.dash.recentTitle}
            subtitle={d.dash.recentSubtitle}
          />
          <ul className="divide-y divide-line/60">
            {recent.map((w) => (
              <li key={w.id} className="px-4 py-2">
                <Link
                  href={`/works/${w.id}`}
                  className="text-sm font-medium text-navy hover:underline"
                >
                  {w.title}
                </Link>
                <div className="text-2xs text-slate">
                  {formatDate(w.recommendedAt)} ·{" "}
                  {formatINR(w.recommendedAmount)} · {d.workStatus[w.status]}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title={d.dash.reachedTitle}
            subtitle={d.dash.reachedSubtitle}
          />
          <table className="w-full text-sm">
            <caption className="sr-only">{d.dash.stagesCaption}</caption>
            <tbody>
              {stages.map((s) => (
                <tr
                  key={s.status}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="px-4 py-2 text-ink">
                    {d.workStatus[s.status]}
                    {s.status === "COMPLETED_UNMARKED" ? (
                      <span className="ml-2 text-2xs text-slate">
                        {d.dash.awaitingAgencyRecord}
                      </span>
                    ) : null}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-ink">
                    {s.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <CoverageGapNotice />
    </div>
  );
}
