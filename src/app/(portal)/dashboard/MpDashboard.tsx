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
import { scoped, type Scope } from "@/lib/scope";
import { COMPLETION_WINDOW_DAYS, WORK_STATUS_LABELS } from "@/lib/scheme";

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
  const overdueCutoff = new Date(Date.now() - COMPLETION_WINDOW_DAYS * 86_400_000);

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
    [...years].reverse().find((y) => y.sanctioned > 0) ?? years[years.length - 1];
  const totalAuthorised = years.reduce((s, y) => s + y.authorised, 0);

  return (
    <div className="space-y-5">
      <DashboardHeading
        title={`${mp.constituency}`}
        subtitle={`Works recommended by ${mp.name} under MPLADS, and where each one has reached. ${mp.house === "RS" ? "Rajya Sabha" : "Lok Sabha"}.`}
        badge="Hon'ble Member of Parliament"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Works recommended"
          value={formatNumber(kpis.works)}
          hint={`${formatNumber(kpis.completed)} completed`}
        />
        <KpiCard
          label="Entitlement authorised"
          value={formatINR(totalAuthorised)}
          hint={`across ${years.length} financial years`}
        />
        <KpiCard
          label="Recommended against it"
          value={formatINR(kpis.recommended)}
          hint={formatPct(
            totalAuthorised > 0 ? kpis.recommended / totalAuthorised : 0,
            0,
          ) + " of entitlement"}
        />
        <KpiCard
          label="Reached vendors"
          value={formatINR(kpis.released)}
          hint="actually paid out for work done"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title={`Where the money stands${currentYear ? ` — FY ${currentYear.financialYear}` : ""}`}
            subtitle="Each step is a smaller figure than the one before it, and the gaps are where money is waiting rather than working."
          />
          {currentYear ? (
            <FundFlowBars
              data={[
                { label: "Entitlement authorised", value: currentYear.authorised },
                { label: "You recommended", value: currentYear.recommended },
                { label: "District sanctioned", value: currentYear.sanctioned },
                { label: "Paid to vendors", value: currentYear.spent },
              ]}
              format="inr"
            />
          ) : (
            <EmptyState
              title="No entitlement on record"
              body="No annual entitlement has been authorised for this Member in the period covered by the portal."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Year by year"
            subtitle="Entitlement authorised against what was recommended, sanctioned and paid."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">
                Entitlement and utilisation by financial year
              </caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">Year</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Entitlement</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Recommended</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Sanctioned</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Paid</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Works</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => {
                  const over = y.recommended > y.authorised;
                  return (
                    <tr key={y.financialYear} className="border-b border-line/60 last:border-0">
                      <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
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
              A year shown in red has recommendations totalling more than the
              entitlement authorised for it. That needs reconciling with the
              district authority.
            </p>
          ) : null}
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="Works running late"
            subtitle={`Sanctioned more than ${COMPLETION_WINDOW_DAYS} days ago and still not marked complete by the implementing agency.`}
          />
          {delayed.length === 0 ? (
            <EmptyState
              title="Nothing running late"
              body="Every work recommended from this constituency is either inside the one-year window or already marked complete."
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
                      {days} days past the one-year mark · {w.progressPct}% done ·{" "}
                      {w.ia?.name ?? "no agency designated"} · {w.district.name}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="What the works are for"
            subtitle="Recommended amount by category of asset."
          />
          <table className="w-full text-sm">
            <caption className="sr-only">Recommended amount by category</caption>
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                <th scope="col" className="px-4 py-2 text-left font-medium">Category</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Works</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.category} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-ink">{c.category}</td>
                  <td className="tnum px-4 py-2 text-right text-slate">{c.works}</td>
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
            title="Most recent recommendations"
            subtitle="Newest first."
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
                  {formatDate(w.recommendedAt)} · {formatINR(w.recommendedAmount)} ·{" "}
                  {WORK_STATUS_LABELS[w.status]}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Where the works have reached"
            subtitle="Every recommendation passes through these stages. A work only counts as completed once the agency marks it so."
          />
          <table className="w-full text-sm">
            <caption className="sr-only">Works by stage</caption>
            <tbody>
              {stages.map((s) => (
                <tr key={s.status} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-ink">
                    {WORK_STATUS_LABELS[s.status]}
                    {s.status === "COMPLETED_UNMARKED" ? (
                      <span className="ml-2 text-2xs text-slate">
                        finished, waiting on the agency to record it
                      </span>
                    ) : null}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-ink">{s.count}</td>
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
