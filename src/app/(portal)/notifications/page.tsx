import Link from "next/link";
import type { Metadata } from "next";

import { markAllNotificationsRead } from "@/app/actions/alerts";
import { Card, CardHeader, EmptyState, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { t as tr } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/**
 * What the platform has tried to tell this officer, and whether it got through.
 *
 * The delivery column is not decoration. Channels that could not deliver are
 * listed with their reason — an SMS channel that is stubbed in this build says
 * so, and an email channel with no SMTP configured says that. A monitoring
 * platform that silently fails to notify is worse than one that does not
 * notify at all, because nobody knows it is not working.
 */
export default async function NotificationsPage() {
  const { user } = await requireSession();
  const d = tr();

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  // Group by the event, so one escalation does not appear as four rows.
  const grouped = new Map<string, typeof notifications>();
  for (const n of notifications) {
    const key = `${n.entity}|${n.entityId}|${n.createdAt.toISOString()}|${n.subject}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(n);
    grouped.set(key, bucket);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            {d.notifications.heading}
          </h1>
          <p className="mt-0.5 max-w-3xl text-2xs leading-relaxed text-slate">
            {d.notifications.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 ? (
            <Tag>
              {formatNumber(unread)} {d.common.unread}
            </Tag>
          ) : null}
          {unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="rounded border border-line bg-white px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
              >
                {d.common.markAllRead}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader
          title={d.notifications.recentTitle}
          subtitle={d.notifications.recentSubtitle}
        />
        {grouped.size === 0 ? (
          <EmptyState
            title={d.empty.noNotificationsTitle}
            body={d.empty.noNotificationsBody}
          />
        ) : (
          <ul className="divide-y divide-line/60">
            {[...grouped.values()].map((group) => {
              const first = group[0];
              const isUnread = group.some((n) => n.readAt === null);
              return (
                <li
                  key={first.id}
                  className={
                    isUnread ? "bg-severity-info/5 px-4 py-3" : "px-4 py-3"
                  }
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {first.entity === "Alert" ? (
                      <Link
                        href={`/alerts/${first.entityId}`}
                        className="text-sm font-medium text-navy hover:underline"
                      >
                        {first.subject}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-ink">
                        {first.subject}
                      </span>
                    )}
                    <span className="tnum text-2xs text-slate">
                      {first.createdAt
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ")}
                    </span>
                  </div>

                  <p className="mt-1 max-w-4xl whitespace-pre-line text-2xs leading-relaxed text-slate">
                    {first.body}
                  </p>

                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {group.map((n) => (
                      <li key={n.id} className="text-2xs">
                        <span className="font-medium text-ink">
                          {n.channel.replace("_", "-").toLowerCase()}
                        </span>{" "}
                        <span
                          className={
                            n.status === "SENT"
                              ? "text-severity-low"
                              : n.status === "FAILED"
                                ? "text-severity-critical"
                                : "text-slate"
                          }
                        >
                          {n.status.toLowerCase()}
                        </span>
                        {n.error ? (
                          <span className="text-slate"> — {n.error}</span>
                        ) : null}
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
