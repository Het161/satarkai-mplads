import Link from "next/link";

import { DashboardHeading } from "@/components/dashboard/shared";
import { Card, CardHeader, EmptyState, KpiCard } from "@/components/ui";
import { schemeKpis, worksByStage } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { fill, t as tr } from "@/lib/i18n";
import { scoped, type Scope } from "@/lib/scope";

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
  const d = tr();
  const [
    kpis,
    stages,
    needsEvidence,
    needsMarking,
    running,
    totalStages,
    documented,
  ] = await Promise.all([
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
      where: scoped(scope.work, {
        status: { in: ["SANCTIONED", "IN_PROGRESS"] },
      }),
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
        subtitle={d.dash.agencySubtitle}
        badge={d.role.IA}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={d.dash.kpiWorksAssigned}
          value={formatNumber(kpis.works)}
          hint={fill(d.dash.hintMarkedComplete, {
            count: formatNumber(kpis.completed),
          })}
        />
        <KpiCard
          label={d.dash.kpiSanctionedValue}
          value={formatINR(kpis.sanctioned)}
        />
        <KpiCard
          label={d.kpi.evidenceOnFile}
          value={formatPct(evidenceRate, 0)}
          hint={fill(d.dash.hintPaymentStages, {
            documented: formatNumber(documented),
            total: formatNumber(totalStages),
          })}
          emphasis={evidenceRate < 0.9}
        />
        <KpiCard
          label={d.dash.kpiAwaitingYourMarking}
          value={formatNumber(kpis.awaitingMarking)}
          hint={d.dash.hintFinishedOnGround}
          emphasis={kpis.awaitingMarking > 0}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={d.dash.uploadTitle}
            subtitle={d.dash.uploadSubtitle}
          />
          {needsEvidence.length === 0 ? (
            <EmptyState
              title={d.dash.uploadEmptyTitle}
              body={d.dash.uploadEmptyBody}
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
                    {fill(d.dash.stageMeta, {
                      stage: p.stageNo,
                      amount: formatINR(p.amount),
                      date: formatDate(p.releasedAt),
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={d.dash.markTitle} subtitle={d.dash.markSubtitle} />
          {needsMarking.length === 0 ? (
            <EmptyState
              title={d.dash.markEmptyTitle}
              body={d.dash.markEmptyBody}
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
                    {fill(d.dash.markMeta, {
                      date: formatDate(w.completedAt),
                      amount: formatINR(w.sanctionedAmount),
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={d.dash.inHandTitle}
          subtitle={d.dash.inHandSubtitle}
        />
        {running.length === 0 ? (
          <EmptyState
            title={d.dash.inHandEmptyTitle}
            body={d.dash.inHandEmptyBody}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">{d.dash.inHandCaption}</caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {d.table.work}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {d.table.district}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.sanctioned}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.due}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {d.table.progress}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {d.table.stage}
                  </th>
                </tr>
              </thead>
              <tbody>
                {running.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-line/60 last:border-0 hover:bg-paper"
                  >
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
                    <td className="tnum px-4 py-2 text-right text-ink">
                      {w.progressPct}%
                    </td>
                    <td className="px-4 py-2 text-slate">
                      {d.workStatus[w.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={d.dash.stagesTitle} />
        <table className="w-full text-sm">
          <caption className="sr-only">{d.dash.stagesCaption}</caption>
          <tbody>
            {stages.map((s) => (
              <tr
                key={s.status}
                className="border-b border-line/60 last:border-0"
              >
                <td className="px-4 py-2 text-ink">{d.workStatus[s.status]}</td>
                <td className="tnum px-4 py-2 text-right text-ink">
                  {s.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
