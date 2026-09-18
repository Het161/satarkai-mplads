import { CoverageGapNotice, HumanDecidesNotice } from "@/components/DataNotices";
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
import { daysBetween, formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
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
    .map((d) => ({
      label: d.name,
      value: Math.round(d.completionRate * 100),
      hint: `${formatNumber(d.works)} works`,
    }));

  return (
    <div className="space-y-5">
      <DashboardHeading
        title={`${stateName} — district oversight`}
        subtitle={`All ${formatNumber(kpis.districts)} districts in ${stateName}. Districts are compared against each other, because the decision an SNA makes is which one to chase.`}
        badge="State Nodal Authority"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Works"
          value={formatNumber(kpis.works)}
          hint={`across ${formatNumber(kpis.districts)} districts`}
        />
        <KpiCard label="Sanctioned" value={formatINR(kpis.sanctioned)} />
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
          hint="needs escalation"
          emphasis={kpis.overdue > 0}
        />
        <KpiCard
          label="Critical alerts"
          value={formatNumber(kpis.criticalAlerts)}
          hint={`of ${formatNumber(kpis.openAlerts)} awaiting review`}
          emphasis={kpis.criticalAlerts > 0}
        />
      </div>

      <AlertQueuePreview
        alerts={alerts}
        total={kpis.openAlerts}
        emptyBody={`No open alert in ${stateName}. Either the detectors have not run since the data last changed, or every signal has been reviewed.`}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Works past the one-year rule"
            subtitle="Sanctioned over a year ago and still not marked complete. These are the escalations — named, because a count by district is already a column in the table below."
          />
          {overdue.length === 0 ? (
            <EmptyState
              title="Nothing past the guideline"
              body={`Every sanctioned work in ${stateName} is either inside the one-year window or already marked complete.`}
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {overdue.map((w) => {
                const over =
                  daysBetween(w.sanctionedAt!, new Date()) - COMPLETION_WINDOW_DAYS;
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
                        {over} days over
                      </span>{" "}
                      · {w.progressPct}% done · {w.district.name} ·{" "}
                      {w.ia?.name ?? "no agency designated"} · due{" "}
                      {formatDate(w.expectedCompletionAt)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Lowest completion rates"
            subtitle="Share of each district's works marked complete. Weakest first — a low rate can mean slow execution or slow marking, and the district table separates the two."
          />
          <RankedBars
            data={byCompletion}
            valueName="Completion rate"
            height={240}
            format="percent"
          />
        </Card>
      </div>

      <ComparisonTable
        title="Districts compared"
        subtitle="Ordered by critical alerts."
        unitLabel="District"
        rows={districts}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <DelayWatchlist works={risks} />
        <StagePipeline stages={stages} total={kpis.works} />
      </div>

      <Card>
        <CardHeader
          title="Works through the pipeline"
          subtitle={`Monthly count of works recommended, sanctioned, and marked complete across ${stateName}.`}
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

      <div className="grid gap-3 lg:grid-cols-2">
        <HumanDecidesNotice />
        <CoverageGapNotice />
      </div>
    </div>
  );
}
