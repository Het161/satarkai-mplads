import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EvidencePanels } from "@/components/AlertEvidence";
import { ReviewPanel } from "@/components/ReviewPanel";
import { HumanDecidesNotice } from "@/components/DataNotices";
import { Card, CardHeader, SeverityBadge, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AlertEvidence } from "@/lib/detectors/types";
import { formatDate, formatINR } from "@/lib/format";
import { scoped } from "@/lib/scope";
import { fill, t as tr } from "@/lib/i18n";
import { availableActions, canAct } from "@/lib/review";

export const metadata: Metadata = { title: "Alert" };
export const dynamic = "force-dynamic";

export default async function AlertDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, scope } = await requireSession();
  const d = tr();

  // Jurisdiction sits in the same WHERE as the id: an alert outside the user's
  // scope is not found, rather than found and refused.
  const alert = await prisma.alert.findFirst({
    where: scoped(scope.alert, { id: params.id }),
    include: {
      work: {
        include: { district: { include: { state: true } }, mp: true, ia: true },
      },
      actions: { orderBy: { at: "desc" }, include: { byUser: true } },
    },
  });

  if (!alert) notFound();

  const evidence = alert.evidenceJson as unknown as AlertEvidence;
  const w = alert.work;

  // Other works this alert refers to — the earlier duplicate, the year's other
  // recommendations, the rest of a year-end cluster. Scope-filtered, so a
  // related work outside the user's jurisdiction simply is not listed.
  const relatedIds = (evidence.relatedWorkIds ?? []).filter(
    (id) => id !== w.id,
  );
  const related = relatedIds.length
    ? await prisma.work.findMany({
        where: scoped(scope.work, { id: { in: relatedIds } }),
        include: { district: true },
        take: 25,
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/alerts" className="text-2xs text-navy hover:underline">
          {d.alertDetail.back}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity}>
            {d.severity[alert.severity]}
          </SeverityBadge>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            {d.alertType[alert.type]}
          </h1>
          <span className="tnum rounded border border-line bg-white px-2 py-0.5 text-sm font-semibold text-ink">
            {alert.score}
            <span className="ml-1 text-2xs font-normal text-slate">
              {d.alertDetail.outOf}
            </span>
          </span>
          <Tag>{d.alertState[alert.state]}</Tag>
          <a
            href={`/api/export/alert/${alert.id}`}
            className="ml-auto rounded border border-line bg-white px-2.5 py-1 text-2xs font-medium text-navy hover:bg-paper"
          >
            {d.common.downloadPdf}
          </a>
        </div>
        <p
          data-detector-text
          className="mt-2 max-w-4xl text-sm leading-relaxed text-ink"
        >
          {alert.reason}
        </p>
        <p className="mt-1 text-2xs text-slate">
          {fill(d.alertDetail.detectedBy, {
            date: formatDate(alert.detectedAt),
            source:
              alert.type === "ML_ANOMALY"
                ? d.alertDetail.sourceModel
                : alert.type === "COST_OUTLIER" ||
                    alert.type === "IA_CONCENTRATION"
                  ? d.alertDetail.sourceStatistical
                  : d.alertDetail.sourceRules,
          })}
        </p>
      </div>

      <HumanDecidesNotice />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={d.alertDetail.workTitle}
              action={
                <Link
                  href={`/works/${w.id}`}
                  className="whitespace-nowrap text-2xs text-navy hover:underline"
                >
                  {d.common.fullTimeline} →
                </Link>
              }
            />
            <dl className="divide-y divide-line/60 text-sm">
              {[
                [d.table.work, w.title],
                [d.table.workCode, w.workCode],
                [d.table.location, `${w.locality}, ${w.district.name}`],
                [d.table.state, w.district.state.name],
                [d.table.recommendedBy, `${w.mp.name} · ${w.mp.constituency}`],
                [
                  d.alertDetail.implementingAgency,
                  w.ia?.name ?? d.dash.notDesignated,
                ],
                [d.table.stage, d.workStatus[w.status]],
                [
                  d.alertDetail.sanctionedAmount,
                  w.sanctionedAmount ? formatINR(w.sanctionedAmount) : "—",
                ],
                [d.alertDetail.financialYear, w.financialYear],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 px-4 py-2"
                >
                  <dt className="shrink-0 text-slate">{label}</dt>
                  <dd className="text-right text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {related.length > 0 ? (
            <Card>
              <CardHeader
                title={d.alertDetail.relatedTitle}
                subtitle={d.alertDetail.relatedSubtitle}
              />
              <ul className="divide-y divide-line/60">
                {related.map((r) => (
                  <li key={r.id} className="px-4 py-2 text-sm">
                    <Link
                      href={`/works/${r.id}`}
                      className="font-medium text-navy hover:underline"
                    >
                      {r.title}
                    </Link>
                    <div className="text-2xs text-slate">
                      {r.workCode} · {r.district.name} ·{" "}
                      {formatINR(r.recommendedAmount)}
                    </div>
                  </li>
                ))}
              </ul>
              {related.length < relatedIds.length ? (
                <p className="border-t border-line px-4 py-2 text-2xs text-slate">
                  {fill(
                    relatedIds.length - related.length === 1
                      ? d.alertDetail.relatedHiddenOne
                      : d.alertDetail.relatedHiddenMany,
                    { count: relatedIds.length - related.length },
                  )}
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader title={d.review.history} />
            {alert.actions.length === 0 ? (
              <p className="px-4 py-4 text-2xs text-slate">
                {d.review.noAction}
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {alert.actions.map((a) => (
                  <li key={a.id} className="px-4 py-2 text-sm">
                    <div className="text-ink">
                      {a.fromState ? `${d.alertState[a.fromState]} → ` : ""}
                      {d.alertState[a.toState]}
                    </div>
                    <div className="text-2xs text-slate">
                      {a.byUser.name} · {formatDate(a.at)}
                    </div>
                    {a.note ? (
                      <p className="mt-1 text-2xs text-slate">{a.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {!canAct(user.role) ? (
              <p className="border-t border-line px-4 py-2 text-2xs text-slate">
                {d.review.readOnly}
              </p>
            ) : null}
          </Card>

          {canAct(user.role) ? (
            <ReviewPanel
              alertId={alert.id}
              state={alert.state}
              actions={availableActions(alert.state)}
              escalationTarget={d.escalate[user.role]}
              labels={{
                review: d.review,
                action: d.action,
                alertState: d.alertState,
              }}
            />
          ) : null}
        </div>

        <EvidencePanels evidence={evidence} />
      </div>
    </div>
  );
}
