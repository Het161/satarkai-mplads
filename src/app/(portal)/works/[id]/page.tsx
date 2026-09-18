import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DelayRiskPanel, type DriverRow } from "@/components/DelayRisk";
import { WorkTimeline } from "@/components/WorkTimeline";
import { Card, CardHeader, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { scoped } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { daysBetween, formatDate, formatINR, money } from "@/lib/format";
import { COMPLETION_WINDOW_DAYS, WORK_STATUS_LABELS } from "@/lib/scheme";

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
      delayRisk: true,
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

        <WorkTimeline work={work} alerts={work.alerts} />
      </div>

      {work.delayRisk ? (
        <DelayRiskPanel
          probability={work.delayRisk.probability}
          band={work.delayRisk.band}
          drivers={work.delayRisk.drivers as unknown as DriverRow[]}
          modelVersion={work.delayRisk.modelVersion}
          computedAt={formatDate(work.delayRisk.computedAt)}
        />
      ) : null}
    </div>
  );
}
