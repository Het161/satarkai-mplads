import Link from "next/link";

import { DashboardHeading } from "@/components/dashboard/shared";
import { Card, CardHeader, EmptyState, KpiCard } from "@/components/ui";
import { schemeKpis, worksByStage } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { scoped, type Scope } from "@/lib/scope";
import { WORK_STATUS_LABELS } from "@/lib/scheme";

/**
 * Implementing Agency — the works assigned to them.
 *
 * An IA is the subject of much of this platform's monitoring, not a user of it,
 * so this page is a work list rather than an oversight console: what is
 * assigned, which payment stages still need a photograph uploading, and what is
 * finished but not yet marked complete. Those last two are the agency's own
 * outstanding actions, and they are the two things that most often turn into
 * someone else's alert.
 */
export async function AgencyDashboard({
  scope,
  agencyName,
}: {
  scope: Scope;
  agencyName: string;
}) {
  const [kpis, stages, needsEvidence, needsMarking, running, totalStages, documented] =
    await Promise.all([
      schemeKpis(scope),
      worksByStage(scope),
      prisma.payment.findMany({
        where: scoped(scope.payment, { evidence: { none: {} } }),
        orderBy: { releasedAt: "desc" },
        take: 12,
        include: { work: true },
      }),
      prisma.work.findMany({
        where: scoped(scope.work, { status: "COMPLETED_UNMARKED" }),
        orderBy: { completedAt: "asc" },
        take: 10,
      }),
      prisma.work.findMany({
        where: scoped(scope.work, { status: { in: ["SANCTIONED", "IN_PROGRESS"] } }),
        orderBy: { expectedCompletionAt: "asc" },
        take: 12,
        include: { district: true, delayRisk: true },
      }),
      prisma.payment.count({ where: scope.payment }),
      prisma.payment.count({
        where: scoped(scope.payment, { evidence: { some: {} } }),
      }),
    ]);

  const evidenceRate = totalStages > 0 ? documented / totalStages : 1;

  return (
    <div className="space-y-5">
      <DashboardHeading
        title={agencyName}
        subtitle="Works designated to this agency, and the records still outstanding against them."
        badge="Implementing Agency"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Works assigned"
          value={formatNumber(kpis.works)}
          hint={`${formatNumber(kpis.completed)} marked complete`}
        />
        <KpiCard label="Sanctioned value" value={formatINR(kpis.sanctioned)} />
        <KpiCard
          label="Evidence on file"
          value={formatPct(evidenceRate, 0)}
          hint={`${formatNumber(documented)} of ${formatNumber(totalStages)} payment stages`}
          emphasis={evidenceRate < 0.9}
        />
        <KpiCard
          label="Awaiting your completion marking"
          value={formatNumber(kpis.awaitingMarking)}
          hint="finished on the ground"
          emphasis={kpis.awaitingMarking > 0}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Photographs and documents to upload"
            subtitle="Payment stages released with nothing on record against them. The sanction order requires an asset photograph at each stage."
          />
          {needsEvidence.length === 0 ? (
            <EmptyState
              title="Nothing outstanding"
              body="Every payment stage released to this agency has at least one photograph or document uploaded."
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {needsEvidence.map((p) => (
                <li key={p.id} className="px-4 py-2">
                  <Link
                    href={`/works/${p.workId}`}
                    className="text-sm font-medium text-navy hover:underline"
                  >
                    {p.work.title}
                  </Link>
                  <div className="text-2xs text-slate">
                    stage {p.stageNo} · {formatINR(p.amount)} · released{" "}
                    {formatDate(p.releasedAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Works to mark complete"
            subtitle="Recorded at 100% and finished on the ground. Until this agency marks them complete they do not appear as completed anywhere."
          />
          {needsMarking.length === 0 ? (
            <EmptyState
              title="Nothing pending"
              body="Every finished work assigned to this agency has been marked complete."
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {needsMarking.map((w) => (
                <li key={w.id} className="px-4 py-2">
                  <Link
                    href={`/works/${w.id}`}
                    className="text-sm font-medium text-navy hover:underline"
                  >
                    {w.title}
                  </Link>
                  <div className="text-2xs text-slate">
                    complete since {formatDate(w.completedAt)} ·{" "}
                    {formatINR(w.sanctionedAmount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Works in hand"
          subtitle="Sanctioned or under execution, soonest due first."
        />
        {running.length === 0 ? (
          <EmptyState
            title="No works in hand"
            body="This agency has no sanctioned or in-progress works at present."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Works currently assigned</caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">Work</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">District</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Sanctioned</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Due</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Progress</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {running.map((w) => (
                  <tr key={w.id} className="border-b border-line/60 last:border-0 hover:bg-paper">
                    <td className="px-4 py-2">
                      <Link
                        href={`/works/${w.id}`}
                        className="font-medium text-navy hover:underline"
                      >
                        {w.title}
                      </Link>
                      <div className="text-2xs text-slate">{w.workCode}</div>
                    </td>
                    <td className="px-4 py-2 text-slate">{w.district.name}</td>
                    <td className="tnum px-4 py-2 text-right text-ink">
                      {formatINR(w.sanctionedAmount)}
                    </td>
                    <td className="tnum px-4 py-2 text-right text-slate">
                      {formatDate(w.expectedCompletionAt)}
                    </td>
                    <td className="tnum px-4 py-2 text-right text-ink">{w.progressPct}%</td>
                    <td className="px-4 py-2 text-slate">
                      {WORK_STATUS_LABELS[w.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Works by stage" />
        <table className="w-full text-sm">
          <caption className="sr-only">Works by stage</caption>
          <tbody>
            {stages.map((s) => (
              <tr key={s.status} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2 text-ink">{WORK_STATUS_LABELS[s.status]}</td>
                <td className="tnum px-4 py-2 text-right text-ink">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
