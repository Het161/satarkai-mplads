import { CoverageGapNotice, HumanDecidesNotice } from "@/components/DataNotices";
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
import { ALERT_TYPE_LABELS } from "@/lib/scheme";
import type { Scope } from "@/lib/scope";

/**
 * Ministry / Central Nodal Agency — the national view.
 *
 * The job here is triage across the whole country: which states are carrying
 * the most risk, what the scheme is doing over time, and which cases are
 * waiting. Everything drills down; nothing is a dead end.
 */
export async function MinistryDashboard({ scope }: { scope: Scope }) {
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
      hint: `${s.criticalAlerts} critical · ${formatNumber(s.works)} works`,
    }));

  const alertTypeBars = byType.slice(0, 8).map((a) => ({
    label: ALERT_TYPE_LABELS[a.type],
    value: a._count,
  }));

  return (
    <div className="space-y-5">
      <DashboardHeading
        title="National overview"
        subtitle="Every state and Union Territory. Scheme-wide position, where risk is concentrated, and the cases waiting on someone's decision."
        badge="Ministry / Central Nodal Agency"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Works"
          value={formatNumber(kpis.works)}
          hint={`across ${formatNumber(kpis.districts)} districts`}
        />
        <KpiCard
          label="Recommended"
          value={formatINR(kpis.recommended)}
          hint="earmarked by MPs"
        />
        <KpiCard
          label="Released to vendors"
          value={formatINR(kpis.released)}
          hint={`${formatPct(kpis.sanctioned > 0 ? kpis.released / kpis.sanctioned : 0, 0)} of sanctioned`}
        />
        <KpiCard
          label="Completion rate"
          value={formatPct(kpis.completionRate, 1)}
          hint={`${formatNumber(kpis.completed)} marked complete`}
        />
        <KpiCard
          label="Past one-year rule"
          value={formatNumber(kpis.overdue)}
          hint="sanctioned > 365 days, unmarked"
          emphasis={kpis.overdue > 0}
        />
        <KpiCard
          label="Critical alerts"
          value={formatNumber(kpis.criticalAlerts)}
          hint={`of ${formatNumber(kpis.openAlerts)} awaiting review`}
          emphasis={kpis.criticalAlerts > 0}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Works through the pipeline"
            subtitle="Monthly count of works recommended, sanctioned, and marked complete. All three count works, so they share one scale."
          />
          <TrendLines
            data={pipeline}
            series={[
              { key: "recommended", name: "Recommended" },
              { key: "sanctioned", name: "Sanctioned" },
              { key: "completed", name: "Marked complete" },
            ]}
          />
        </Card>

        <Card>
          <CardHeader
            title="Vendor payments released"
            subtitle="Money moves on a different scale from work counts, so it gets its own chart rather than a second axis."
          />
          <TrendLines
            data={spend}
            series={[{ key: "released", name: "Released" }]}
            format="inr"
          />
        </Card>
      </div>

      <AlertQueuePreview
        alerts={alerts}
        total={kpis.openAlerts}
        emptyBody="No open alert in any state. Either the detectors have not run since the data last changed, or every signal has been reviewed."
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Where alerts are concentrated"
            subtitle="Open and reviewed alerts by state. Bar length is the count; hover for the critical share."
          />
          <RankedBars data={riskiestStates} valueName="Alerts" height={240} />
        </Card>

        <Card>
          <CardHeader
            title="What is being flagged"
            subtitle="Alert volume by type, across the country."
          />
          <RankedBars data={alertTypeBars} valueName="Alerts" height={240} />
        </Card>
      </div>

      <ComparisonTable
        title="States compared"
        subtitle="Ordered by critical alerts. Every figure is a link into that state's works."
        unitLabel="State"
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
