import Link from "next/link";
import type { Metadata } from "next";
import type { AlertState, AlertType, Severity } from "@prisma/client";

import { HumanDecidesNotice } from "@/components/DataNotices";
import {
  Card,
  CardHeader,
  EmptyState,
  KpiCard,
  SeverityBadge,
  Tag,
} from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { scoped } from "@/lib/scope";
import { ALERT_TYPE_LABELS } from "@/lib/scheme";
import { fill, t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Alert queue" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const STATES: AlertState[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "CLARIFICATION_SOUGHT",
  "EXPLAINED",
  "ESCALATED",
];

type Search = {
  type?: string;
  severity?: string;
  state?: string;
  page?: string;
};

/** A filter chip that toggles one query parameter, preserving the others. */
function Filter({
  label,
  param,
  value,
  current,
  search,
}: {
  label: string;
  param: keyof Search;
  value: string | null;
  current: string | undefined;
  search: Search;
}) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (k !== param && k !== "page" && v) next.set(k, v);
  }
  if (value) next.set(param, value);

  const active = (current ?? null) === value;
  const qs = next.toString();

  return (
    <Link
      href={qs ? `/alerts?${qs}` : "/alerts"}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded border border-navy bg-navy px-2 py-1 text-2xs font-medium text-white"
          : "rounded border border-line bg-white px-2 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { scope } = await requireSession();
  const dict = t();

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const filters: Record<string, unknown> = {};
  if (searchParams.type && searchParams.type in ALERT_TYPE_LABELS) {
    filters.type = searchParams.type as AlertType;
  }
  if (
    searchParams.severity &&
    SEVERITIES.includes(searchParams.severity as Severity)
  ) {
    filters.severity = searchParams.severity as Severity;
  }
  if (searchParams.state && STATES.includes(searchParams.state as AlertState)) {
    filters.state = searchParams.state as AlertState;
  }

  const where = scoped(scope.alert, filters);

  const [alerts, total, byType, bySeverity, openCount, valueAtRisk] =
    await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: [{ score: "desc" }, { detectedAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          work: {
            include: {
              district: { include: { state: true } },
              mp: true,
              ia: true,
            },
          },
        },
      }),
      prisma.alert.count({ where }),
      prisma.alert.groupBy({ by: ["type"], where: scope.alert, _count: true }),
      prisma.alert.groupBy({
        by: ["severity"],
        where: scope.alert,
        _count: true,
      }),
      prisma.alert.count({ where: scoped(scope.alert, { state: "OPEN" }) }),
      prisma.work.aggregate({
        where: scoped(scope.work, { alerts: { some: {} } }),
        _sum: { sanctionedAmount: true },
      }),
    ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const typeCounts = new Map(byType.map((r) => [r.type, r._count]));
  const sevCounts = new Map(bySeverity.map((r) => [r.severity, r._count]));
  const totalInScope = byType.reduce((s, r) => s + r._count, 0);
  const critical = sevCounts.get("CRITICAL") ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            {dict.common.alertQueue}
          </h1>
          <p className="mt-0.5 text-2xs text-slate">
            {fill(dict.common.alertQueueSubtitle, {
              scope: dict.scope[scope.label],
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/export/alerts.csv${searchParams.state || searchParams.type ? `?${new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => v && k !== "page") as [string, string][]).toString()}` : ""}`}
            className="rounded border border-line bg-white px-2.5 py-1 text-2xs font-medium text-navy hover:bg-paper"
          >
            {dict.common.exportCsv}
          </a>
          <Tag>
            {dict.common.page} {page} {dict.common.of} {pages}
          </Tag>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={dict.kpi.alertsInScope}
          value={formatNumber(totalInScope)}
        />
        <KpiCard
          label={dict.table.critical}
          value={formatNumber(critical)}
          emphasis={critical > 0}
          hint={dict.hint.scoreAtLeast80}
        />
        <KpiCard
          label={dict.kpi.awaitingReview}
          value={formatNumber(openCount)}
          hint={dict.hint.noActionYet}
        />
        <KpiCard
          label={dict.kpi.valueFlagged}
          value={formatINR(valueAtRisk._sum.sanctionedAmount)}
          hint={dict.hint.acrossFlagged}
        />
      </div>

      <HumanDecidesNotice />

      <Card>
        <CardHeader
          title={dict.common.filters}
          subtitle={dict.common.filtersNote}
        />
        <div className="space-y-2 px-4 py-3">
          <FilterRow label={dict.table.type}>
            <Filter
              label={dict.common.all}
              param="type"
              value={null}
              current={searchParams.type}
              search={searchParams}
            />
            {(Object.keys(ALERT_TYPE_LABELS) as AlertType[])
              .filter((t) => typeCounts.has(t))
              .map((t) => (
                <Filter
                  key={t}
                  label={`${dict.alertType[t]} (${typeCounts.get(t)})`}
                  param="type"
                  value={t}
                  current={searchParams.type}
                  search={searchParams}
                />
              ))}
          </FilterRow>

          <FilterRow label={dict.table.severity}>
            <Filter
              label={dict.common.all}
              param="severity"
              value={null}
              current={searchParams.severity}
              search={searchParams}
            />
            {SEVERITIES.filter((s) => sevCounts.has(s)).map((s) => (
              <Filter
                key={s}
                label={`${dict.severity[s]} (${sevCounts.get(s)})`}
                param="severity"
                value={s}
                current={searchParams.severity}
                search={searchParams}
              />
            ))}
          </FilterRow>

          <FilterRow label={dict.table.status}>
            <Filter
              label={dict.common.all}
              param="state"
              value={null}
              current={searchParams.state}
              search={searchParams}
            />
            {STATES.map((s) => (
              <Filter
                key={s}
                label={dict.alertState[s]}
                param="state"
                value={s}
                current={searchParams.state}
                search={searchParams}
              />
            ))}
          </FilterRow>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`${formatNumber(total)} ${dict.nav.alerts.toLowerCase()}`}
          subtitle={dict.common.orderedByScore}
        />

        {alerts.length === 0 ? (
          <EmptyState
            title={dict.empty.noAlertsTitle}
            body={dict.empty.noAlertsBody}
          />
        ) : (
          <ul className="divide-y divide-line/60">
            {alerts.map((a) => (
              <li key={a.id} className="px-4 py-3 hover:bg-paper">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <SeverityBadge severity={a.severity}>
                    {dict.severity[a.severity]}
                  </SeverityBadge>
                  <span className="tnum rounded border border-line bg-paper px-1.5 py-0.5 text-2xs font-semibold text-ink">
                    {a.score}
                  </span>
                  <Link
                    href={`/alerts/${a.id}`}
                    className="text-sm font-medium text-navy hover:underline"
                  >
                    {dict.alertType[a.type]}
                  </Link>
                  <span className="text-sm text-ink">· {a.work.title}</span>
                  {a.state !== "OPEN" ? (
                    <Tag>{dict.alertState[a.state]}</Tag>
                  ) : null}
                </div>

                <p
                  data-detector-text
                  className="mt-1 max-w-4xl text-2xs leading-relaxed text-slate"
                >
                  {a.reason}
                </p>

                <div className="mt-1 flex flex-wrap gap-x-3 text-2xs text-slate">
                  <span>{a.work.workCode}</span>
                  <span>
                    {a.work.district.name}, {a.work.district.state.name}
                  </span>
                  <span>{a.work.mp.name}</span>
                  <span>{a.work.ia?.name ?? "No agency designated"}</span>
                  <span>detected {formatDate(a.detectedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <Pagination
            page={page}
            pages={pages}
            total={total}
            search={searchParams}
          />
        ) : null}
      </Card>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="w-24 shrink-0 text-2xs font-medium uppercase tracking-wide text-slate">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pagination({
  page,
  pages,
  total,
  search,
}: {
  page: number;
  pages: number;
  total: number;
  search: Search;
}) {
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) {
      if (k !== "page" && v) qs.set(k, v);
    }
    qs.set("page", String(p));
    return `/alerts?${qs.toString()}`;
  };

  const dict = t();

  return (
    <nav
      aria-label={dict.common.pagination}
      className="flex items-center justify-between border-t border-line px-4 py-2 text-2xs"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-navy hover:underline">
          ← {dict.common.previous}
        </Link>
      ) : (
        <span className="text-slate/50">← {dict.common.previous}</span>
      )}
      <span className="text-slate">
        {formatNumber((page - 1) * PAGE_SIZE + 1)}–
        {formatNumber(Math.min(page * PAGE_SIZE, total))} {dict.common.of}{" "}
        {formatNumber(total)}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="text-navy hover:underline">
          {dict.common.next} →
        </Link>
      ) : (
        <span className="text-slate/50">{dict.common.next} →</span>
      )}
    </nav>
  );
}
