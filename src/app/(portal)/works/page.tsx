import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardHeader, EmptyState, Tag } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { WORK_STATUS_LABELS } from "@/lib/scheme";

export const metadata: Metadata = { title: "Works" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

export default async function WorksPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { scope } = await requireSession();

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const [works, total] = await Promise.all([
    prisma.work.findMany({
      where: scope.work, // jurisdiction filter — not optional
      orderBy: { recommendedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        district: { include: { state: true } },
        mp: true,
        ia: true,
      },
    }),
    prisma.work.count({ where: scope.work }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Works</h1>
          <p className="mt-0.5 text-2xs text-slate">
            {formatNumber(total)} work{total === 1 ? "" : "s"} in {scope.label.toLowerCase()}.
          </p>
        </div>
        <Tag>Page {page} of {pages}</Tag>
      </div>

      <Card>
        <CardHeader
          title="Recommended works"
          subtitle="Newest recommendation first. Select a work to open its full timeline."
        />

        {works.length === 0 ? (
          <EmptyState
            title="No works in your jurisdiction"
            body="Nothing has been recommended under MPLADS for the state, district, constituency or agency attached to this account."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">
                MPLADS works within your jurisdiction
              </caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">Work</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">District</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Recommended by</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Sanctioned</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Stage</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Progress</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Sanctioned on</th>
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
                      <div className="mt-0.5 text-2xs text-slate">{w.workCode}</div>
                    </td>
                    <td className="px-4 py-2 text-ink">
                      {w.district.name}
                      <div className="text-2xs text-slate">{w.district.state.name}</div>
                    </td>
                    <td className="px-4 py-2 text-ink">
                      {w.mp.name}
                      <div className="text-2xs text-slate">{w.mp.constituency}</div>
                    </td>
                    <td className="tnum px-4 py-2 text-right text-ink">
                      {w.sanctionedAmount ? formatINR(w.sanctionedAmount) : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate">
                      {WORK_STATUS_LABELS[w.status]}
                    </td>
                    <td className="tnum px-4 py-2 text-right text-ink">
                      {w.progressPct}%
                    </td>
                    <td className="tnum px-4 py-2 text-right text-slate">
                      {formatDate(w.sanctionedAt)}
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
              <Link href={`/works?page=${page - 1}`} className="text-navy hover:underline">
                ← Previous
              </Link>
            ) : (
              <span className="text-slate/50">← Previous</span>
            )}
            <span className="text-slate">
              {formatNumber((page - 1) * PAGE_SIZE + 1)}–
              {formatNumber(Math.min(page * PAGE_SIZE, total))} of {formatNumber(total)}
            </span>
            {page < pages ? (
              <Link href={`/works?page=${page + 1}`} className="text-navy hover:underline">
                Next →
              </Link>
            ) : (
              <span className="text-slate/50">Next →</span>
            )}
          </nav>
        ) : null}
      </Card>
    </div>
  );
}
