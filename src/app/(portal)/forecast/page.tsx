import Link from "next/link";
import type { Metadata } from "next";

import { DelayRiskBadge } from "@/components/DelayRisk";
import { Card, CardHeader, EmptyState, KpiCard, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { fill, t as tr } from "@/lib/i18n";
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
  const dict = tr();

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
            {dict.forecast.heading}
          </h1>
          <p className="mt-0.5 max-w-3xl text-2xs leading-relaxed text-slate">
            {fill(dict.forecast.subtitle, {
              scope: dict.scope[scope.label],
              days: COMPLETION_WINDOW_DAYS,
            })}
          </p>
        </div>
        {sample ? <Tag>{sample.modelVersion}</Tag> : null}
      </div>

      <p className="rounded border border-severity-info/30 bg-severity-info/5 px-3 py-2 text-2xs leading-relaxed text-slate">
        <span className="font-medium text-ink">
          {dict.forecast.notFindingsLead}
        </span>{" "}
        {dict.forecast.notFindingsBody}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={dict.forecast.kpiForecast}
          value={formatNumber(totalForecast)}
          hint={dict.forecast.kpiForecastHint}
        />
        <KpiCard
          label={dict.forecast.kpiLikely}
          value={formatNumber(atRisk)}
          hint={dict.forecast.kpiLikelyHint}
          emphasis={atRisk > 0}
        />
        <KpiCard
          label={dict.forecast.kpiSomeRisk}
          value={formatNumber(bands.MODERATE ?? 0)}
        />
        <KpiCard
          label={dict.forecast.kpiOnTrack}
          value={formatNumber(bands.LOW ?? 0)}
        />
      </div>

      <Card>
        <CardHeader
          title={dict.forecast.tableTitle}
          subtitle={dict.forecast.tableSubtitle}
        />

        {works.length === 0 ? (
          <EmptyState
            title={dict.forecast.emptyTitle}
            body={dict.forecast.emptyBody}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">
                {dict.forecast.tableCaption}
              </caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {dict.table.work}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {dict.table.district}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {dict.table.agency}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {dict.table.sanctioned}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {dict.table.due}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {dict.table.progress}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {dict.forecast.colEstimate}
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {dict.forecast.colOutlook}
                  </th>
                </tr>
              </thead>
              <tbody>
                {works.map((w) => (
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
                    <td className="px-4 py-2 text-ink">
                      {w.district.name}
                      <div className="text-2xs text-slate">
                        {w.district.state.name}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-2xs text-slate">
                      {w.ia?.name ?? dict.dash.notDesignated}
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
            {fill(dict.forecast.provenance, {
              date: formatDate(sample.computedAt),
              model: sample.modelVersion,
            })}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
