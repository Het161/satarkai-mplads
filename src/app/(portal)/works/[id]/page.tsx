import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Card, CardHeader, SeverityBadge, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { scoped } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { daysBetween, formatDate, formatINR, money } from "@/lib/format";
import {
  ALERT_TYPE_LABELS,
  ALERT_TYPE_STEP,
  COMPLETION_WINDOW_DAYS,
  LIFECYCLE_STEPS,
  WORK_STATUS_LABELS,
} from "@/lib/scheme";

export const metadata: Metadata = { title: "Work detail" };
export const dynamic = "force-dynamic";

export default async function WorkDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { scope } = await requireSession();

  // The jurisdiction filter sits in the WHERE clause alongside the id. A work
  // outside the user's jurisdiction is not "found and refused" — it is simply
  // not found, so the page cannot confirm the record even exists.
  const work = await prisma.work.findFirst({
    where: scoped(scope.work, { id: params.id }),
    include: {
      district: { include: { state: true } },
      mp: true,
      ia: true,
      payments: { orderBy: { stageNo: "asc" }, include: { evidence: true } },
      evidence: true,
      alerts: { orderBy: { score: "desc" } },
    },
  });

  if (!work) notFound();

  const paid = work.payments.reduce((s, p) => s + money(p.amount), 0);
  const sanctioned = money(work.sanctionedAmount);
  const overdueDays =
    work.sanctionedAt && !work.markedCompleteAt
      ? daysBetween(work.sanctionedAt, new Date()) - COMPLETION_WINDOW_DAYS
      : null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/works" className="text-2xs text-navy hover:underline">
          ← All works
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {work.title}
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-slate">
          <span>{work.workCode}</span>
          <Tag>{WORK_STATUS_LABELS[work.status]}</Tag>
          <Tag>{work.category}</Tag>
          <Tag>FY {work.financialYear}</Tag>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Particulars" />
          <dl className="divide-y divide-line/60 text-sm">
            {[
              ["Work type", work.workType],
              ["District", `${work.district.name}, ${work.district.state.name}`],
              ["Recommended by", `${work.mp.name} · ${work.mp.constituency}`],
              ["Implementing agency", work.ia?.name ?? "Not yet designated"],
              ["Recommended on", formatDate(work.recommendedAt)],
              ["Recommended amount", formatINR(work.recommendedAmount)],
              ["Sanctioned on", formatDate(work.sanctionedAt)],
              ["Sanctioned amount", work.sanctionedAmount ? formatINR(work.sanctionedAmount) : "—"],
              [
                "Due for completion",
                work.expectedCompletionAt
                  ? `${formatDate(work.expectedCompletionAt)} (one year from sanction)`
                  : "—",
              ],
              ["Recorded progress", `${work.progressPct}%`],
              ["Complete on the ground", formatDate(work.completedAt)],
              ["Marked complete by agency", formatDate(work.markedCompleteAt)],
              ["Released to vendors", formatINR(paid)],
              [
                "Released as share of sanction",
                sanctioned > 0 ? `${Math.round((paid / sanctioned) * 100)}%` : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2">
                <dt className="text-slate">{label}</dt>
                <dd className="tnum text-right text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {overdueDays !== null && overdueDays > 0 ? (
            <p className="border-t border-line bg-severity-critical/5 px-4 py-2 text-2xs text-severity-critical">
              {overdueDays} days past the scheme&apos;s one-year completion
              guideline, and not yet marked complete by the implementing agency.
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Payment stages and asset evidence"
            subtitle="Implementing agencies raise vendor payment requests at stages set in the sanction order, and upload photographs of the asset at each stage."
          />
          {work.payments.length === 0 ? (
            <p className="px-4 py-6 text-center text-2xs text-slate">
              No vendor payment has been released against this work yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">
                  Vendor payment stages and the evidence uploaded against each
                </caption>
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                    <th scope="col" className="px-4 py-2 text-left font-medium">Stage</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Released</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Vendor</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {work.payments.map((p) => (
                    <tr key={p.id} className="border-b border-line/60 last:border-0">
                      <td className="tnum px-4 py-2 text-ink">{p.stageNo}</td>
                      <td className="tnum px-4 py-2 text-right text-ink">
                        {formatINR(p.amount)}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-slate">
                        {formatDate(p.releasedAt)}
                      </td>
                      <td className="px-4 py-2 text-slate">{p.vendorName ?? "—"}</td>
                      <td className="px-4 py-2">
                        {p.evidence.length === 0 ? (
                          <span className="text-severity-critical">
                            None on record
                          </span>
                        ) : (
                          <span className="text-slate">
                            {p.evidence.map((e) => e.kind.toLowerCase()).join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            work.alerts.length === 0
              ? "Risk signals"
              : `${work.alerts.length} risk signal${work.alerts.length === 1 ? "" : "s"}`
          }
          subtitle="Grouped by the point in the scheme's process each one concerns. Signals are prompts for review, not findings."
        />
        {work.alerts.length === 0 ? (
          <p className="px-4 py-6 text-center text-2xs text-slate">
            No rule detector has flagged this work.
          </p>
        ) : (
          <ul className="divide-y divide-line/60">
            {LIFECYCLE_STEPS.flatMap((step) => {
              const atStep = work.alerts.filter(
                (a) => ALERT_TYPE_STEP[a.type] === step,
              );
              if (atStep.length === 0) return [];
              return (
                <li key={step} className="px-4 py-3">
                  <div className="text-2xs font-medium uppercase tracking-wide text-slate">
                    {step}
                  </div>
                  <ul className="mt-1.5 space-y-2">
                    {atStep.map((a) => (
                      <li key={a.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={a.severity}>
                            {a.severity.toLowerCase()}
                          </SeverityBadge>
                          <span className="tnum rounded border border-line bg-paper px-1.5 py-0.5 text-2xs font-semibold text-ink">
                            {a.score}
                          </span>
                          <Link
                            href={`/alerts/${a.id}`}
                            className="text-sm font-medium text-navy hover:underline"
                          >
                            {ALERT_TYPE_LABELS[a.type]}
                          </Link>
                        </div>
                        <p className="mt-0.5 max-w-3xl text-2xs leading-relaxed text-slate">
                          {a.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
