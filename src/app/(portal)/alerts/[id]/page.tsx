import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EvidencePanels } from "@/components/AlertEvidence";
import { HumanDecidesNotice } from "@/components/DataNotices";
import { Card, CardHeader, SeverityBadge, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AlertEvidence } from "@/lib/detectors/types";
import { formatDate, formatINR } from "@/lib/format";
import { canActOnAlerts, scoped } from "@/lib/scope";
import { ALERT_TYPE_LABELS, WORK_STATUS_LABELS } from "@/lib/scheme";

export const metadata: Metadata = { title: "Alert" };
export const dynamic = "force-dynamic";

export default async function AlertDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, scope } = await requireSession();

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
  const relatedIds = (evidence.relatedWorkIds ?? []).filter((id) => id !== w.id);
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
          ← Alert queue
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity}>
            {alert.severity.toLowerCase()}
          </SeverityBadge>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            {ALERT_TYPE_LABELS[alert.type]}
          </h1>
          <span className="tnum rounded border border-line bg-white px-2 py-0.5 text-sm font-semibold text-ink">
            {alert.score}
            <span className="ml-1 text-2xs font-normal text-slate">/ 100</span>
          </span>
          <Tag>{alert.state.replace(/_/g, " ").toLowerCase()}</Tag>
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-ink">
          {alert.reason}
        </p>
        <p className="mt-1 text-2xs text-slate">
          Detected {formatDate(alert.detectedAt)} by{" "}
          {alert.type === "ML_ANOMALY"
            ? "the model service"
            : alert.type === "COST_OUTLIER" || alert.type === "IA_CONCENTRATION"
              ? "a statistical test"
              : "the rule engine"}
          .
        </p>
      </div>

      <HumanDecidesNotice />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="The work"
              action={
                <Link
                  href={`/works/${w.id}`}
                  className="whitespace-nowrap text-2xs text-navy hover:underline"
                >
                  Full timeline →
                </Link>
              }
            />
            <dl className="divide-y divide-line/60 text-sm">
              {[
                ["Title", w.title],
                ["Work code", w.workCode],
                ["Location", `${w.locality}, ${w.district.name}`],
                ["State", w.district.state.name],
                ["Recommended by", `${w.mp.name} · ${w.mp.constituency}`],
                ["Implementing agency", w.ia?.name ?? "Not designated"],
                ["Stage", WORK_STATUS_LABELS[w.status]],
                ["Sanctioned amount", w.sanctionedAmount ? formatINR(w.sanctionedAmount) : "—"],
                ["Financial year", w.financialYear],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2">
                  <dt className="shrink-0 text-slate">{label}</dt>
                  <dd className="text-right text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {related.length > 0 ? (
            <Card>
              <CardHeader
                title="Related works"
                subtitle="Other works this finding compared against."
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
                  {relatedIds.length - related.length} further related work
                  {relatedIds.length - related.length === 1 ? " is" : "s are"}{" "}
                  outside your jurisdiction and not shown.
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Review history" />
            {alert.actions.length === 0 ? (
              <p className="px-4 py-4 text-2xs text-slate">
                No action recorded yet. This alert is awaiting review.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {alert.actions.map((a) => (
                  <li key={a.id} className="px-4 py-2 text-sm">
                    <div className="text-ink">
                      {a.fromState ? `${a.fromState} → ` : ""}
                      {a.toState.replace(/_/g, " ").toLowerCase()}
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
            <p className="border-t border-line px-4 py-2 text-2xs text-slate">
              {canActOnAlerts(user.role)
                ? "Acknowledge, seek clarification, mark as explained and escalate arrive in Phase 5, each recorded against your name."
                : "Your role has read access to this alert. Action on oversight alerts rests with the district, state and ministry authorities."}
            </p>
          </Card>
        </div>

        <EvidencePanels evidence={evidence} />
      </div>
    </div>
  );
}
