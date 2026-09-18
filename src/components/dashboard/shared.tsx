import Link from "next/link";

import { Card, CardHeader, EmptyState, SeverityBadge, Tag } from "@/components/ui";
import { DelayRiskBadge } from "@/components/DelayRisk";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { ALERT_TYPE_LABELS, WORK_STATUS_LABELS } from "@/lib/scheme";
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
        <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
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
  return (
    <Card>
      <CardHeader
        title="Needs attention first"
        subtitle="Open alerts, highest Anomaly-Priority Score first. Each carries the rule it broke and the records behind it."
        action={
          <Link href="/alerts" className="whitespace-nowrap text-2xs text-navy hover:underline">
            All {formatNumber(total)} →
          </Link>
        }
      />
      {alerts.length === 0 ? (
        <EmptyState title="Nothing awaiting review" body={emptyBody} />
      ) : (
        <ul className="divide-y divide-line/60">
          {alerts.map((a) => (
            <li key={a.id} className="px-4 py-2.5 hover:bg-paper">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
                <span className="text-sm text-ink">· {a.work.title}</span>
              </div>
              <p className="mt-0.5 max-w-4xl text-2xs leading-relaxed text-slate">
                {a.reason}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-2xs text-slate">
                <span>{a.work.workCode}</span>
                <span>
                  {a.work.district.name}, {a.work.district.state.name}
                </span>
                <span>{a.work.ia?.name ?? "No agency designated"}</span>
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
  const sorted = [...rows].sort(
    (a, b) => b.criticalAlerts - a.criticalAlerts || b.alerts - a.alerts,
  );

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {sorted.length === 0 ? (
        <EmptyState
          title="Nothing to compare"
          body={`No ${unitLabel.toLowerCase()} in your jurisdiction has any works recorded.`}
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
                <th scope="col" className="px-4 py-2 text-right font-medium">Works</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Sanctioned</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Completed</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Past one year</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Alerts</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Critical</th>
                {extraColumn ? (
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {extraColumn.header}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-paper">
                  <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
                    {r.name}
                    {r.subtitle ? (
                      <div className="text-2xs font-normal text-slate">{r.subtitle}</div>
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
  return (
    <Card>
      <CardHeader
        title="Works by stage"
        subtitle="The eSAKSHI lifecycle, from an MP's recommendation to the agency marking the work complete."
      />
      <table className="w-full text-sm">
        <caption className="sr-only">Count of works at each stage</caption>
        <thead>
          <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
            <th scope="col" className="px-4 py-2 text-left font-medium">Stage</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Works</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.status} className="border-b border-line/60 last:border-0">
              <td className="px-4 py-2 text-ink">
                {WORK_STATUS_LABELS[s.status]}
                {s.status === "COMPLETED_UNMARKED" ? (
                  <span className="ml-2 text-2xs text-slate">
                    not shown as completed publicly
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
  return (
    <Card>
      <CardHeader
        title="Watch list"
        subtitle="Running works the model expects to miss the one-year mark. A forecast, not a finding — the useful response is a call to the agency."
        action={
          <Link href="/forecast" className="whitespace-nowrap text-2xs text-navy hover:underline">
            All forecasts →
          </Link>
        }
      />
      {works.length === 0 ? (
        <EmptyState
          title="No works flagged"
          body="Either nothing in your jurisdiction is at elevated risk, or the model service has not been run — forecasts need `npm run detect:ml`, which the rest of the platform does not."
        />
      ) : (
        <ul className="divide-y divide-line/60">
          {works.map((w) => (
            <li key={w.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
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
                {w.district.name} · {w.ia?.name ?? "No agency"} · {w.progressPct}% done ·
                due {formatDate(w.expectedCompletionAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
