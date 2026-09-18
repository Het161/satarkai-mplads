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
import { fill, t as tr } from "@/lib/i18n";
import { COMPLETION_WINDOW_DAYS } from "@/lib/scheme";

export const metadata: Metadata = { title: "Work detail" };
export const dynamic = "force-dynamic";

export default async function WorkDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { scope } = await requireSession();
  const d = tr();

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
          {d.workDetail.back}
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {work.title}
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-slate">
          <span>{work.workCode}</span>
          <Tag>{d.workStatus[work.status]}</Tag>
          <Tag>{work.category}</Tag>
          <Tag>{fill(d.workDetail.fyTag, { fy: work.financialYear })}</Tag>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title={d.workDetail.particulars} />
          <dl className="divide-y divide-line/60 text-sm">
            {[
              [d.workDetail.workType, work.workType],
              [
                d.table.district,
                `${work.district.name}, ${work.district.state.name}`,
              ],
              [
                d.table.recommendedBy,
                `${work.mp.name} · ${work.mp.constituency}`,
              ],
              [
                d.workDetail.implementingAgency,
                work.ia?.name ?? d.workDetail.notYetDesignated,
              ],
              [d.workDetail.recommendedOn, formatDate(work.recommendedAt)],
              [
                d.workDetail.recommendedAmount,
                formatINR(work.recommendedAmount),
              ],
              [d.workDetail.sanctionedOn, formatDate(work.sanctionedAt)],
              [
                d.workDetail.sanctionedAmount,
                work.sanctionedAmount ? formatINR(work.sanctionedAmount) : "—",
              ],
              [
                d.workDetail.dueForCompletion,
                work.expectedCompletionAt
                  ? fill(d.workDetail.dueValue, {
                      date: formatDate(work.expectedCompletionAt),
                    })
                  : "—",
              ],
              [d.workDetail.recordedProgress, `${work.progressPct}%`],
              [d.workDetail.completeOnGround, formatDate(work.completedAt)],
              [d.workDetail.markedByAgency, formatDate(work.markedCompleteAt)],
              [d.workDetail.releasedToVendors, formatINR(paid)],
              [
                d.workDetail.releasedShare,
                sanctioned > 0
                  ? `${Math.round((paid / sanctioned) * 100)}%`
                  : "—",
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
              {fill(d.workDetail.overdueNote, { days: overdueDays })}
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
