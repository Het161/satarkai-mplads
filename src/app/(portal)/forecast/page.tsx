import Link from "next/link";
import type { Metadata } from "next";

import { DelayRiskBadge } from "@/components/DelayRisk";
import { Card, CardHeader, EmptyState, KpiCard, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { scoped } from "@/lib/scope";
import { COMPLETION_WINDOW_DAYS } from "@/lib/scheme";

export const metadata: Metadata = { title: "Early warning" };
export const dynamic = "force-dynamic";

/**
 * Forecasts live apart from the alert queue on purpose.
 *
 * An alert is about something that has happened and can be checked against the
 * record. A forecast is about something that has not happened, and the only
 * honest action it supports is a phone call to the agency. Putting the two in
 * one queue would invite officers to treat a prediction as a finding, so they
 * get separate pages, different language and no severity colour.
 */
export default async function ForecastPage() {
  const { scope } = await requireSession();

  const where = scoped(scope.work, { delayRisk: { isNot: null } });

  const [works, counts, sample] = await Promise.all([
    prisma.work.findMany({
      where,
      include: {
        delayRisk: true,
        district: { include: { state: true } },
        ia: true,
      },
      orderBy: { delayRisk: { probability: "desc" } },
      take: 60,
    }),
    prisma.work.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
    prisma.delayRisk.findFirst({ orderBy: { computedAt: "desc" } }),
  ]);

  const bands = works.reduce<Record<string, number>>((acc, w) => {
    const b = w.delayRisk!.band;
    acc[b] = (acc[b] ?? 0) + 1;
    return acc;
  }, {});

  const atRisk = (bands.VERY_HIGH ?? 0) + (bands.HIGH ?? 0);
  const totalForecast = counts.reduce((s, c) => s + c._count, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Early warning
          </h1>
          <p className="mt-0.5 max-w-3xl text-2xs leading-relaxed text-slate">
            {scope.label} · works still running, ranked by the estimated chance
            of passing {COMPLETION_WINDOW_DAYS} days from sanction without being
            marked complete.
          </p>
        </div>
        {sample ? <Tag>{sample.modelVersion}</Tag> : null}
      </div>

      <p className="rounded border border-severity-info/30 bg-severity-info/5 px-3 py-2 text-2xs leading-relaxed text-slate">
        <span className="font-medium text-ink">
          These are predictions, not findings.
        </span>{" "}
        Nothing on this page is an alert, and no case is opened by it. A work
        shown as likely to overrun has done nothing wrong — the estimate is
        drawn from how works with similar characteristics have fared before, and
        the useful response is to ask the implementing agency how it is going,
        not to open a file.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Works forecast"
          value={formatNumber(totalForecast)}
          hint="still running"
        />
        <KpiCard
          label="Likely to overrun"
          value={formatNumber(atRisk)}
          hint="high or very high"
          emphasis={atRisk > 0}
        />
        <KpiCard
          label="Some risk"
          value={formatNumber(bands.MODERATE ?? 0)}
        />
        <KpiCard label="On track" value={formatNumber(bands.LOW ?? 0)} />
      </div>

      <Card>
        <CardHeader
          title="Works by estimated risk"
          subtitle="Highest first. Open a work to see what the estimate rests on."
        />

        {works.length === 0 ? (
          <EmptyState
            title="No forecasts available"
            body="Either no works in your jurisdiction are still running, or the model service has not been run. Forecasts are produced by `npm run detect:ml` and need the Python service; the rest of the platform does not."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">
                Works still running, ranked by estimated delay risk
              </caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">Work</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">District</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Agency</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Sanctioned</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Due</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Progress</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Estimate</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Outlook</th>
                </tr>
              </thead>
              <tbody>
                {works.map((w) => (
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
                    <td className="px-4 py-2 text-ink">
                      {w.district.name}
                      <div className="text-2xs text-slate">{w.district.state.name}</div>
                    </td>
                    <td className="px-4 py-2 text-2xs text-slate">
                      {w.ia?.name ?? "Not designated"}
                    </td>
                    <td className="tnum px-4 py-2 text-right text-ink">
                      {w.sanctionedAmount ? formatINR(w.sanctionedAmount) : "—"}
                    </td>
                    <td className="tnum px-4 py-2 text-right text-slate">
                      {formatDate(w.expectedCompletionAt)}
                    </td>
                    <td className="tnum px-4 py-2 text-right text-ink">
                      {w.progressPct}%
                    </td>
                    <td className="tnum px-4 py-2 text-right font-medium text-ink">
                      {Math.round(w.delayRisk!.probability * 100)}%
                    </td>
                    <td className="px-4 py-2">
                      <DelayRiskBadge band={w.delayRisk!.band} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sample ? (
          <p className="border-t border-line px-4 py-2 text-2xs text-slate">
            Forecasts computed {formatDate(sample.computedAt)} by{" "}
            {sample.modelVersion}, from attributes known when each work was
            sanctioned — size, work type, how long the district took to sanction,
            the season, and the past record of the agency, district and work
            type. Nothing recorded after sanction is used, so the model cannot
            read the outcome it is predicting.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
