import Link from "next/link";

import {
  Card,
  CardHeader,
  EmptyState,
  SeverityBadge,
  Tag,
} from "@/components/ui";
import { DelayRiskBadge } from "@/components/DelayRisk";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { fill, t as tr } from "@/lib/i18n";
import type { ALERT_TYPE_LABELS, WORK_STATUS_LABELS } from "@/lib/scheme";
import type { RankedRow } from "@/lib/dashboard";

/* Pieces every role dashboard shares, so the four differ in what they show
   rather than in how they look. */

export function DashboardHeading({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-0.5 max-w-4xl text-2xs leading-relaxed text-slate">
          {subtitle}
        </p>
      </div>
      {badge ? <Tag>{badge}</Tag> : null}
    </div>
  );
}

type AlertPreview = {
  id: string;
  type: keyof typeof ALERT_TYPE_LABELS;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  score: number;
  reason: string;
  work: {
    id: string;
    title: string;
    workCode: string;
    district: { name: string; state: { name: string } };
    ia: { name: string } | null;
  };
};

export function AlertQueuePreview({
  alerts,
  total,
  emptyBody,
}: {
  alerts: AlertPreview[];
  total: number;
  emptyBody: string;
}) {
  const d = tr();
  return (
    <Card>
      <CardHeader
        title={d.dash.needsAttentionTitle}
        subtitle={d.dash.needsAttentionSubtitle}
        action={
          <Link
            href="/alerts"
            className="whitespace-nowrap text-2xs text-navy hover:underline"
          >
            {fill(d.dash.allOf, { count: formatNumber(total) })}
          </Link>
        }
      />
      {alerts.length === 0 ? (
        <EmptyState title={d.dash.nothingAwaitingTitle} body={emptyBody} />
      ) : (
        <ul className="divide-y divide-line/60">
          {alerts.map((a) => (
            <li key={a.id} className="px-4 py-2.5 hover:bg-paper">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <SeverityBadge severity={a.severity}>
                  {d.severity[a.severity]}
                </SeverityBadge>
                <span className="tnum rounded border border-line bg-paper px-1.5 py-0.5 text-2xs font-semibold text-ink">
                  {a.score}
                </span>
                <Link
                  href={`/alerts/${a.id}`}
                  className="text-sm font-medium text-navy hover:underline"
                >
                  {d.alertType[a.type]}
                </Link>
                {/* The work's own recorded title — data, not interface copy,
                    so it is never translated. Marked for the i18n sweep. */}
                <span className="text-sm text-ink" data-record-text>
                  · {a.work.title}
                </span>
              </div>
              <p
                data-detector-text
                className="mt-0.5 max-w-4xl text-2xs leading-relaxed text-slate"
              >
                {a.reason}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-2xs text-slate">
                <span>{a.work.workCode}</span>
                <span>
                  {a.work.district.name}, {a.work.district.state.name}
                </span>
                <span>{a.work.ia?.name ?? d.dash.noAgencyDesignated}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Comparative table for states, districts or agencies.
 *
 * A table rather than a chart on purpose: five measures per row, all of which
 * an officer needs to read exactly, is what tables are for. The ranked bar
 * chart beside it answers one question at a glance; this answers the rest.
 */
export function ComparisonTable({
  title,
  subtitle,
  unitLabel,
  rows,
  extraColumn,
}: {
  title: string;
  subtitle: string;
  unitLabel: string;
  rows: RankedRow[];
  extraColumn?: {
    header: string;
    render: (row: RankedRow) => React.ReactNode;
  };
}) {
  const d = tr();
  const sorted = [...rows].sort(
    (a, b) => b.criticalAlerts - a.criticalAlerts || b.alerts - a.alerts,
  );

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {sorted.length === 0 ? (
        <EmptyState
          title={d.dash.nothingToCompareTitle}
          body={fill(d.dash.nothingToCompareBody, {
            unit: unitLabel.toLowerCase(),
          })}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">
              {title} — {subtitle}
            </caption>
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  {unitLabel}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.table.works}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.table.sanctioned}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.table.completed}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.dash.pastOneYearCol}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.table.alerts}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.table.critical}
                </th>
                {extraColumn ? (
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {extraColumn.header}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-line/60 last:border-0 hover:bg-paper"
                >
                  <th
                    scope="row"
                    className="px-4 py-2 text-left font-medium text-ink"
                  >
                    {r.name}
                    {r.subtitle ? (
                      <div className="text-2xs font-normal text-slate">
                        {r.subtitle}
                      </div>
                    ) : null}
                  </th>
                  <td className="tnum px-4 py-2 text-right text-ink">
                    {formatNumber(r.works)}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-ink">
                    {formatINR(r.value)}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {formatPct(r.completionRate, 0)}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {r.overdue > 0 ? r.overdue : "—"}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {r.alerts > 0 ? r.alerts : "—"}
                  </td>
                  <td className="tnum px-4 py-2 text-right">
                    {r.criticalAlerts > 0 ? (
                      <span className="font-medium text-severity-critical">
                        {r.criticalAlerts}
                      </span>
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </td>
                  {extraColumn ? (
                    <td className="tnum px-4 py-2 text-right text-slate">
                      {extraColumn.render(r)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function StagePipeline({
  stages,
  total,
}: {
  stages: { status: keyof typeof WORK_STATUS_LABELS; count: number }[];
  total: number;
}) {
  const d = tr();
  return (
    <Card>
      <CardHeader title={d.dash.stagesTitle} subtitle={d.dash.stagesSubtitle} />
      <table className="w-full text-sm">
        <caption className="sr-only">{d.dash.stagesCaption}</caption>
        <thead>
          <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
            <th scope="col" className="px-4 py-2 text-left font-medium">
              {d.table.stage}
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              {d.table.works}
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              {d.table.share}
            </th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr
              key={s.status}
              className="border-b border-line/60 last:border-0"
            >
              <td className="px-4 py-2 text-ink">
                {d.workStatus[s.status]}
                {s.status === "COMPLETED_UNMARKED" ? (
                  <span className="ml-2 text-2xs text-slate">
                    {d.workStatus.notShownPublicly}
                  </span>
                ) : null}
              </td>
              <td className="tnum px-4 py-2 text-right text-ink">
                {formatNumber(s.count)}
              </td>
              <td className="tnum px-4 py-2 text-right text-slate">
                {total > 0 ? formatPct(s.count / total, 1) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function DelayWatchlist({
  works,
}: {
  works: {
    id: string;
    title: string;
    workCode: string;
    expectedCompletionAt: Date | null;
    progressPct: number;
    district: { name: string };
    ia: { name: string } | null;
    delayRisk: { probability: number; band: string } | null;
  }[];
}) {
  const d = tr();
  return (
    <Card>
      <CardHeader
        title={d.dash.watchlistTitle}
        subtitle={d.dash.watchlistSubtitle}
        action={
          <Link
            href="/forecast"
            className="whitespace-nowrap text-2xs text-navy hover:underline"
          >
            {d.common.allForecasts} →
          </Link>
        }
      />
      {works.length === 0 ? (
        <EmptyState
          title={d.dash.watchlistEmptyTitle}
          body={d.dash.watchlistEmptyBody}
        />
      ) : (
        <ul className="divide-y divide-line/60">
          {works.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2"
            >
              <Link
                href={`/works/${w.id}`}
                className="text-sm font-medium text-navy hover:underline"
              >
                {w.title}
              </Link>
              <span className="tnum text-sm font-semibold text-ink">
                {Math.round((w.delayRisk?.probability ?? 0) * 100)}%
              </span>
              <DelayRiskBadge band={w.delayRisk?.band ?? "LOW"} />
              <span className="w-full text-2xs text-slate">
                {fill(d.dash.watchlistMeta, {
                  district: w.district.name,
                  agency: w.ia?.name ?? d.dash.noAgency,
                  progress: w.progressPct,
                  due: formatDate(w.expectedCompletionAt),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
