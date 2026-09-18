import Link from "next/link";

import { CoverageGapNotice, HumanDecidesNotice } from "@/components/DataNotices";
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
  const [kpis, agencies, alerts, stages, pipeline, risks, undocumented, unmarked] =
    await Promise.all([
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
        title={`${districtName} district`}
        subtitle={`${stateName}. The works this office sanctioned, how the designated agencies are performing, and what is waiting on an action here.`}
        badge="District Authority (NDA/IDA)"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Works"
          value={formatNumber(kpis.works)}
          hint={`${agencies.length} agencies engaged`}
        />
        <KpiCard label="Sanctioned" value={formatINR(kpis.sanctioned)} />
        <KpiCard
          label="Released to vendors"
          value={formatINR(kpis.released)}
          hint={`${formatPct(kpis.sanctioned > 0 ? kpis.released / kpis.sanctioned : 0, 0)} of sanctioned`}
        />
        <KpiCard
          label="Evidence on file"
          value={formatPct(evidenceRate, 0)}
          hint={`${formatNumber(documentedStages)} of ${formatNumber(totalStages)} payment stages`}
          emphasis={evidenceRate < 0.9}
        />
        <KpiCard
          label="Past one-year rule"
          value={formatNumber(kpis.overdue)}
          emphasis={kpis.overdue > 0}
        />
        <KpiCard
          label="Awaiting completion marking"
          value={formatNumber(kpis.awaitingMarking)}
          hint="finished, not marked by the agency"
          emphasis={kpis.awaitingMarking > 0}
        />
      </div>

      <AlertQueuePreview
        alerts={alerts}
        total={kpis.openAlerts}
        emptyBody={`No open alert for ${districtName}. Either the detectors have not run since the data last changed, or every signal has been reviewed.`}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Payment stages with no evidence"
            subtitle="Money released with no asset photograph or document on record. The sanction order requires one at each stage."
          />
          {undocumented.length === 0 ? (
            <EmptyState
              title="Every stage is documented"
              body="Each payment released in this district has at least one photograph or document against it."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">
                  Payment stages released without evidence
                </caption>
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                    <th scope="col" className="px-4 py-2 text-left font-medium">Work</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Stage</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Released</th>
                  </tr>
                </thead>
                <tbody>
                  {undocumented.map((p) => (
                    <tr key={p.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2">
                        <Link
                          href={`/works/${p.workId}`}
                          className="font-medium text-navy hover:underline"
                        >
                          {p.work.title}
                        </Link>
                        <div className="text-2xs text-slate">
                          {p.work.ia?.name ?? "No agency designated"}
                        </div>
                      </td>
                      <td className="tnum px-4 py-2 text-right text-ink">{p.stageNo}</td>
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
            title="Finished but not marked complete"
            subtitle="Works recorded at 100% and complete on the ground, which the agency has not marked. Until it does, they do not count as completed anywhere."
          />
          {unmarked.length === 0 ? (
            <EmptyState
              title="Nothing pending"
              body="Every completed work in this district has been marked complete by its implementing agency."
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
                    complete since {formatDate(w.completedAt)} ·{" "}
                    {w.ia?.name ?? "No agency designated"} · {formatINR(w.sanctionedAmount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ComparisonTable
        title="Implementing agencies compared"
        subtitle="Ordered by critical alerts. A dominant agency is not itself a problem — the district may have one capable body — but it is worth knowing."
        unitLabel="Agency"
        rows={agencies}
        extraColumn={{
          header: "Evidence",
          render: (r) =>
            formatPct((r as AgencyRow).evidenceCompleteness, 0),
        }}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <DelayWatchlist works={risks} />
        <StagePipeline stages={stages} total={kpis.works} />
      </div>

      <Card>
        <CardHeader
          title="Works through the pipeline"
          subtitle={`Monthly count of works recommended, sanctioned, and marked complete in ${districtName}.`}
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
