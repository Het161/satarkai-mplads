import Link from "next/link";

import {
  CoverageGapNotice,
  HumanDecidesNotice,
} from "@/components/DataNotices";
import { TrendLines } from "@/components/charts";
import {
  AlertQueuePreview,
  ComparisonTable,
  DashboardHeading,
  DelayWatchlist,
  StagePipeline,
} from "@/components/dashboard/shared";
import { Card, CardHeader, EmptyState, KpiCard } from "@/components/ui";
import {
  agencyBreakdown,
  monthlyPipeline,
  schemeKpis,
  topAlerts,
  topDelayRisks,
  worksByStage,
  type AgencyRow,
} from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { fill, t as tr } from "@/lib/i18n";
import { scoped, type Scope } from "@/lib/scope";

/**
 * District Authority — one district's pipeline.
 *
 * The closest role to the work itself, and the one that can actually fix
 * things. So this dashboard is about doing rather than surveying: which
 * agencies are performing, which payment stages are missing their evidence, and
 * what is sitting unmarked.
 */
export async function DistrictDashboard({
  scope,
  districtName,
  stateName,
}: {
  scope: Scope;
  districtName: string;
  stateName: string;
}) {
  const d = tr();
  const [
    kpis,
    agencies,
    alerts,
    stages,
    pipeline,
    risks,
    undocumented,
    unmarked,
  ] = await Promise.all([
    schemeKpis(scope),
    agencyBreakdown(scope) as Promise<AgencyRow[]>,
    topAlerts(scope, 6),
    worksByStage(scope),
    monthlyPipeline(scope, 18),
    topDelayRisks(scope, 5),
    // Payment stages released with nothing uploaded against them. The most
    // directly fixable thing on this page — it is a phone call to the agency.
    prisma.payment.findMany({
      where: scoped(scope.payment, { evidence: { none: {} } }),
      orderBy: { releasedAt: "desc" },
      take: 10,
      include: { work: { include: { ia: true } } },
    }),
    prisma.work.findMany({
      where: scoped(scope.work, { status: "COMPLETED_UNMARKED" }),
      orderBy: { completedAt: "asc" },
      take: 8,
      include: { ia: true },
    }),
  ]);

  const totalStages = agencies.reduce((s, a) => s + a.stages, 0);
  const documentedStages = agencies.reduce(
    (s, a) => s + Math.round(a.evidenceCompleteness * a.stages),
    0,
  );
  const evidenceRate = totalStages > 0 ? documentedStages / totalStages : 1;

  return (
    <div className="space-y-5">
      <DashboardHeading
        title={fill(d.dash.districtTitle, { district: districtName })}
        subtitle={fill(d.dash.districtSubtitle, { state: stateName })}
        badge={d.role.DISTRICT}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label={d.kpi.works}
          value={formatNumber(kpis.works)}
          hint={fill(d.dash.hintAgenciesEngaged, { count: agencies.length })}
        />
        <KpiCard label={d.kpi.sanctioned} value={formatINR(kpis.sanctioned)} />
        <KpiCard
          label={d.kpi.released}
          value={formatINR(kpis.released)}
          hint={fill(d.dash.hintOfSanctioned, {
            pct: formatPct(
              kpis.sanctioned > 0 ? kpis.released / kpis.sanctioned : 0,
              0,
            ),
          })}
        />
        <KpiCard
          label={d.kpi.evidenceOnFile}
          value={formatPct(evidenceRate, 0)}
          hint={fill(d.dash.hintPaymentStages, {
            documented: formatNumber(documentedStages),
            total: formatNumber(totalStages),
          })}
          emphasis={evidenceRate < 0.9}
        />
        <KpiCard
          label={d.kpi.pastOneYear}
          value={formatNumber(kpis.overdue)}
          emphasis={kpis.overdue > 0}
        />
        <KpiCard
          label={d.kpi.awaitingMarking}
          value={formatNumber(kpis.awaitingMarking)}
          hint={d.dash.hintFinishedNotMarked}
          emphasis={kpis.awaitingMarking > 0}
        />
      </div>

      <AlertQueuePreview
        alerts={alerts}
        total={kpis.openAlerts}
        emptyBody={fill(d.dash.noAlertsIn, { place: districtName })}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={d.dash.noEvidenceTitle}
            subtitle={d.dash.noEvidenceSubtitle}
          />
          {undocumented.length === 0 ? (
            <EmptyState
              title={d.dash.noEvidenceEmptyTitle}
              body={d.dash.noEvidenceEmptyBody}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">
                  {d.dash.noEvidenceCaption}
                </caption>
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                    <th scope="col" className="px-4 py-2 text-left font-medium">
                      {d.table.work}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium"
                    >
                      {d.table.stage}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium"
                    >
                      {d.table.amount}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium"
                    >
                      {d.table.released}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {undocumented.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-line/60 last:border-0"
                    >
                      <td className="px-4 py-2">
                        <Link
                          href={`/works/${p.workId}`}
                          className="font-medium text-navy hover:underline"
                        >
                          {p.work.title}
                        </Link>
                        <div className="text-2xs text-slate">
                          {p.work.ia?.name ?? d.dash.noAgencyDesignated}
                        </div>
                      </td>
                      <td className="tnum px-4 py-2 text-right text-ink">
                        {p.stageNo}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-ink">
                        {formatINR(p.amount)}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-slate">
                        {formatDate(p.releasedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title={d.dash.unmarkedTitle}
            subtitle={d.dash.unmarkedSubtitle}
          />
          {unmarked.length === 0 ? (
            <EmptyState
              title={d.dash.unmarkedEmptyTitle}
              body={d.dash.unmarkedEmptyBody}
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {unmarked.map((w) => (
                <li key={w.id} className="px-4 py-2">
                  <Link
                    href={`/works/${w.id}`}
                    className="text-sm font-medium text-navy hover:underline"
                  >
                    {w.title}
                  </Link>
                  <div className="text-2xs text-slate">
                    {fill(d.dash.completeSinceMeta, {
                      date: formatDate(w.completedAt),
                      agency: w.ia?.name ?? d.dash.noAgencyDesignated,
                      amount: formatINR(w.sanctionedAmount),
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ComparisonTable
        title={d.dash.agenciesComparedTitle}
        subtitle={d.dash.agenciesComparedSubtitle}
        unitLabel={d.table.agency}
        rows={agencies}
        extraColumn={{
          header: d.table.evidence,
          render: (r) => formatPct((r as AgencyRow).evidenceCompleteness, 0),
        }}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <DelayWatchlist works={risks} />
        <StagePipeline stages={stages} total={kpis.works} />
      </div>

      <Card>
        <CardHeader
          title={d.dash.pipelineTitle}
          subtitle={fill(d.dash.pipelineSubtitleIn, { place: districtName })}
        />
        <TrendLines
          labels={{
            showChart: d.common.showChart,
            showFigures: d.common.showFigures,
            month: d.table.month,
          }}
          data={pipeline}
          series={[
            { key: "recommended", name: d.dash.seriesRecommended },
            { key: "sanctioned", name: d.dash.seriesSanctioned },
            { key: "completed", name: d.dash.seriesMarkedComplete },
          ]}
        />
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <HumanDecidesNotice />
        <CoverageGapNotice />
      </div>
    </div>
  );
}
