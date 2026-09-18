import {
  CoverageGapNotice,
  HumanDecidesNotice,
} from "@/components/DataNotices";
import Link from "next/link";

import { RankedBars, TrendLines } from "@/components/charts";
import {
  AlertQueuePreview,
  ComparisonTable,
  DashboardHeading,
  DelayWatchlist,
  StagePipeline,
} from "@/components/dashboard/shared";
import { Card, CardHeader, EmptyState, KpiCard } from "@/components/ui";
import {
  districtBreakdown,
  monthlyPipeline,
  overdueWorks,
  schemeKpis,
  topAlerts,
  topDelayRisks,
  worksByStage,
} from "@/lib/dashboard";
import {
  daysBetween,
  formatDate,
  formatINR,
  formatNumber,
  formatPct,
} from "@/lib/format";
import { fill, t as tr } from "@/lib/i18n";
import { COMPLETION_WINDOW_DAYS } from "@/lib/scheme";
import type { Scope } from "@/lib/scope";

/**
 * State Nodal Authority — every district in one state.
 *
 * An SNA's job is comparative: which of my districts is falling behind, and
 * what needs escalating. So districts are ranked against each other on the
 * measures that would prompt a phone call, rather than shown as one aggregate.
 */
export async function StateDashboard({
  scope,
  stateName,
}: {
  scope: Scope;
  stateName: string;
}) {
  const d = tr();
  const [kpis, districts, pipeline, alerts, stages, risks, overdue] =
    await Promise.all([
      schemeKpis(scope),
      districtBreakdown(scope),
      monthlyPipeline(scope),
      topAlerts(scope, 6),
      worksByStage(scope),
      topDelayRisks(scope, 5),
      overdueWorks(scope, 8),
    ]);

  const byCompletion = [...districts]
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 8)
    .map((row) => ({
      label: row.name,
      value: Math.round(row.completionRate * 100),
      hint: fill(d.dash.worksCount, { count: formatNumber(row.works) }),
    }));

  return (
    <div className="space-y-5">
      <DashboardHeading
        title={fill(d.dash.stateTitle, { state: stateName })}
        subtitle={fill(d.dash.stateSubtitle, {
          state: stateName,
          count: formatNumber(kpis.districts),
        })}
        badge={d.role.SNA}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label={d.kpi.works}
          value={formatNumber(kpis.works)}
          hint={fill(d.dash.hintAcrossDistricts, {
            count: formatNumber(kpis.districts),
          })}
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
          label={d.kpi.completionRate}
          value={formatPct(kpis.completionRate, 1)}
          hint={fill(d.dash.hintMarkedComplete, {
            count: formatNumber(kpis.completed),
          })}
        />
        <KpiCard
          label={d.kpi.pastOneYear}
          value={formatNumber(kpis.overdue)}
          hint={d.dash.hintNeedsEscalation}
          emphasis={kpis.overdue > 0}
        />
        <KpiCard
          label={d.kpi.criticalAlerts}
          value={formatNumber(kpis.criticalAlerts)}
          hint={fill(d.dash.hintOfAwaiting, {
            count: formatNumber(kpis.openAlerts),
          })}
          emphasis={kpis.criticalAlerts > 0}
        />
      </div>

      <AlertQueuePreview
        alerts={alerts}
        total={kpis.openAlerts}
        emptyBody={fill(d.dash.noAlertsIn, { place: stateName })}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={d.dash.overdueTitle}
            subtitle={d.dash.overdueSubtitle}
          />
          {overdue.length === 0 ? (
            <EmptyState
              title={d.dash.overdueEmptyTitle}
              body={fill(d.dash.overdueEmptyBody, { place: stateName })}
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {overdue.map((w) => {
                const over =
                  daysBetween(w.sanctionedAt!, new Date()) -
                  COMPLETION_WINDOW_DAYS;
                return (
                  <li key={w.id} className="px-4 py-2">
                    <Link
                      href={`/works/${w.id}`}
                      className="text-sm font-medium text-navy hover:underline"
                    >
                      {w.title}
                    </Link>
                    <div className="text-2xs text-slate">
                      <span className="font-medium text-severity-critical">
                        {fill(d.dash.daysOver, { days: over })}
                      </span>{" "}
                      ·{" "}
                      {fill(d.dash.overdueMeta, {
                        progress: w.progressPct,
                        district: w.district.name,
                        agency: w.ia?.name ?? d.dash.noAgencyDesignatedLower,
                        due: formatDate(w.expectedCompletionAt),
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
            title={d.dash.lowestCompletionTitle}
            subtitle={d.dash.lowestCompletionSubtitle}
          />
          <RankedBars
            labels={{
              showChart: d.common.showChart,
              showFigures: d.common.showFigures,
              month: d.table.month,
            }}
            data={byCompletion}
            valueName={d.dash.completionRateSeries}
            height={240}
            format="percent"
          />
        </Card>
      </div>

      <ComparisonTable
        title={d.dash.districtsComparedTitle}
        subtitle={d.dash.districtsComparedSubtitle}
        unitLabel={d.table.district}
        rows={districts}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <DelayWatchlist works={risks} />
        <StagePipeline stages={stages} total={kpis.works} />
      </div>

      <Card>
        <CardHeader
          title={d.dash.pipelineTitle}
          subtitle={fill(d.dash.pipelineSubtitleIn, { place: stateName })}
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
