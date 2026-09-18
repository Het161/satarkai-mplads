import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardHeader, EmptyState, KpiCard, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { ALERT_STATE_LABELS } from "@/lib/review";
import { scoped } from "@/lib/scope";
import { ALERT_TYPE_LABELS, ROLE_LABELS } from "@/lib/scheme";

export const metadata: Metadata = { title: "Audit trail" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Every decision anyone has recorded, in order.
 *
 * Visible upward by construction: the trail is filtered by the same
 * jurisdiction scope as everything else, so a state authority sees its
 * districts' decisions and the Ministry sees all of them, while a district
 * officer sees only their own. Nobody's actions are hidden from the people
 * responsible for them, and nobody can see across into a jurisdiction that is
 * not theirs.
 *
 * Nothing here can be edited or deleted through the application. A decision an
 * officer disagrees with is answered by recording a new one, not by removing
 * the old.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { user, scope } = await requireSession();
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const where = scoped(scope.alert, {});

  const [actions, total, byAction, officers] = await Promise.all([
    prisma.alertAction.findMany({
      where: { alert: where },
      orderBy: { at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        byUser: true,
        alert: {
          include: {
            work: { include: { district: { include: { state: true } } } },
          },
        },
      },
    }),
    prisma.alertAction.count({ where: { alert: where } }),
    prisma.alertAction.groupBy({
      by: ["toState"],
      where: { alert: where },
      _count: true,
    }),
    prisma.alertAction
      .findMany({
        where: { alert: where },
        select: { byUserId: true },
        distinct: ["byUserId"],
      })
      .then((r) => r.length),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = new Map(byAction.map((r) => [r.toState, r._count]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Audit trail
          </h1>
          <p className="mt-0.5 max-w-4xl text-2xs leading-relaxed text-slate">
            {scope.label} · every decision recorded against an alert, newest
            first. Records are append-only: a decision is answered by recording
            another, never by removing it.
          </p>
        </div>
        <Tag>Page {page} of {pages}</Tag>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Decisions recorded" value={formatNumber(total)} />
        <KpiCard
          label="Explained"
          value={formatNumber(counts.get("EXPLAINED") ?? 0)}
          hint="closed with a reason"
        />
        <KpiCard
          label="Escalated"
          value={formatNumber(counts.get("ESCALATED") ?? 0)}
          hint="sent upward"
        />
        <KpiCard label="Officers involved" value={formatNumber(officers)} />
      </div>

      <p className="rounded border border-severity-info/30 bg-severity-info/5 px-3 py-2 text-2xs leading-relaxed text-slate">
        <span className="font-medium text-ink">
          Nothing on this platform closes itself.
        </span>{" "}
        Every row below was written by a named person. The detection engine
        refreshes an alert&apos;s score and evidence when it re-runs, but never
        its review state — so an alert somebody marked as explained does not
        quietly reopen, and one nobody has looked at never quietly closes.
      </p>

      <Card>
        <CardHeader
          title={`${formatNumber(total)} decision${total === 1 ? "" : "s"}`}
          subtitle={
            user.role === "MINISTRY"
              ? "All jurisdictions."
              : "Your jurisdiction, and those below it."
          }
        />

        {actions.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            body="No officer has acted on an alert in your jurisdiction. Open an alert from the queue and record a decision to start the trail."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">
                Decisions recorded against alerts in your jurisdiction
              </caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">When</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Officer</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Decision</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Alert</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Work</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Reason given</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id} className="border-b border-line/60 last:border-0 align-top">
                    <td className="tnum whitespace-nowrap px-4 py-2 text-2xs text-slate">
                      {a.at.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-ink">{a.byUser.name}</div>
                      <div className="text-2xs text-slate">
                        {ROLE_LABELS[a.byUser.role]}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-ink">
                      {a.fromState ? (
                        <span className="text-2xs text-slate">
                          {ALERT_STATE_LABELS[a.fromState]} →{" "}
                        </span>
                      ) : null}
                      {ALERT_STATE_LABELS[a.toState]}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/alerts/${a.alertId}`}
                        className="text-navy hover:underline"
                      >
                        {ALERT_TYPE_LABELS[a.alert.type]}
                      </Link>
                      <div className="tnum text-2xs text-slate">
                        score {a.alert.score}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-2xs text-ink">{a.alert.work.title}</div>
                      <div className="text-2xs text-slate">
                        {a.alert.work.workCode} · {a.alert.work.district.name},{" "}
                        {a.alert.work.district.state.name}
                      </div>
                    </td>
                    <td className="max-w-md px-4 py-2 text-2xs leading-relaxed text-slate">
                      {a.note ?? <span className="text-slate/60">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 ? (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between border-t border-line px-4 py-2 text-2xs"
          >
            {page > 1 ? (
              <Link href={`/audit?page=${page - 1}`} className="text-navy hover:underline">
                ← Newer
              </Link>
            ) : (
              <span className="text-slate/50">← Newer</span>
            )}
            <span className="text-slate">
              {formatNumber((page - 1) * PAGE_SIZE + 1)}–
              {formatNumber(Math.min(page * PAGE_SIZE, total))} of {formatNumber(total)}
            </span>
            {page < pages ? (
              <Link href={`/audit?page=${page + 1}`} className="text-navy hover:underline">
                Older →
              </Link>
            ) : (
              <span className="text-slate/50">Older →</span>
            )}
          </nav>
        ) : null}
      </Card>
    </div>
  );
}
