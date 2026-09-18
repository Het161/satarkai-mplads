import {
  CoverageGapNotice,
  HumanDecidesNotice,
} from "@/components/DataNotices";
import { RankedBars, TrendLines } from "@/components/charts";
import {
  AlertQueuePreview,
  ComparisonTable,
  DashboardHeading,
  DelayWatchlist,
  StagePipeline,
} from "@/components/dashboard/shared";
import { Card, CardHeader, KpiCard } from "@/components/ui";
import {
  alertsByType,
  monthlyPipeline,
  monthlySpend,
  schemeKpis,
  stateBreakdown,
  topAlerts,
  topDelayRisks,
  worksByStage,
} from "@/lib/dashboard";
import { formatINR, formatNumber, formatPct } from "@/lib/format";
import { fill, t as tr } from "@/lib/i18n";
import type { Scope } from "@/lib/scope";

/**
 * Ministry / Central Nodal Agency — the national view.
 *
 * The job here is triage across the whole country: which states are carrying
 * the most risk, what the scheme is doing over time, and which cases are
 * waiting. Everything drills down; nothing is a dead end.
 */
export async function MinistryDashboard({ scope }: { scope: Scope }) {
  const d = tr();
  const [kpis, pipeline, spend, states, byType, alerts, stages, risks] =
    await Promise.all([
      schemeKpis(scope),
      monthlyPipeline(scope),
      monthlySpend(scope),
      stateBreakdown(scope),
      alertsByType(scope),
      topAlerts(scope, 6),
      worksByStage(scope),
      topDelayRisks(scope, 5),
    ]);

  const riskiestStates = [...states]
    .filter((s) => s.alerts > 0)
    .sort((a, b) => b.alerts - a.alerts)
    .slice(0, 8)
    .map((s) => ({
      label: s.name,
      value: s.alerts,
      hint: fill(d.dash.criticalWorks, {
        critical: s.criticalAlerts,
        works: formatNumber(s.works),
      }),
    }));

  const alertTypeBars = byType.slice(0, 8).map((a) => ({
    label: d.alertType[a.type],
    value: a._count,
  }));

  return (
    <div className="space-y-5">
      <DashboardHeading
        title={d.dash.ministryTitle}
        subtitle={d.dash.ministrySubtitle}
        badge={d.role.MINISTRY}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label={d.kpi.works}
          value={formatNumber(kpis.works)}
          hint={fill(d.dash.hintAcrossDistricts, {
            count: formatNumber(kpis.districts),
          })}
        />
        <KpiCard
          label={d.kpi.recommended}
          value={formatINR(kpis.recommended)}
          hint={d.dash.hintEarmarkedByMps}
        />
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
          hint={d.dash.hintSanctionedOver365}
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

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={d.dash.pipelineTitle}
            subtitle={d.dash.pipelineSubtitle}
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

        <Card>
          <CardHeader
            title={d.dash.spendTitle}
            subtitle={d.dash.spendSubtitle}
          />
          <TrendLines
            labels={{
              showChart: d.common.showChart,
              showFigures: d.common.showFigures,
              month: d.table.month,
            }}
            data={spend}
            series={[{ key: "released", name: d.dash.seriesReleased }]}
            format="inr"
          />
        </Card>
      </div>

      <AlertQueuePreview
        alerts={alerts}
        total={kpis.openAlerts}
        emptyBody={d.dash.noAlertsNational}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={d.dash.concentrationTitle}
            subtitle={d.dash.concentrationSubtitle}
          />
          <RankedBars
            labels={{
              showChart: d.common.showChart,
              showFigures: d.common.showFigures,
              month: d.table.month,
            }}
            data={riskiestStates}
            valueName={d.dash.alertsSeries}
            height={240}
          />
        </Card>

        <Card>
          <CardHeader
            title={d.dash.flaggedTitle}
            subtitle={d.dash.flaggedSubtitle}
          />
          <RankedBars
            labels={{
              showChart: d.common.showChart,
              showFigures: d.common.showFigures,
              month: d.table.month,
            }}
            data={alertTypeBars}
            valueName={d.dash.alertsSeries}
            height={240}
          />
        </Card>
      </div>

      <ComparisonTable
        title={d.dash.statesComparedTitle}
        subtitle={d.dash.statesComparedSubtitle}
        unitLabel={d.table.state}
        rows={states}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <DelayWatchlist works={risks} />
        <StagePipeline stages={stages} total={kpis.works} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <HumanDecidesNotice />
        <CoverageGapNotice />
      </div>
    </div>
  );
}
