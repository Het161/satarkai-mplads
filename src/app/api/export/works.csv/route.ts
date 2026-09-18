import { requireSession, UnauthenticatedError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/export";
import { WORK_STATUS_LABELS } from "@/lib/scheme";

export const dynamic = "force-dynamic";

/**
 * The works register as a spreadsheet — the whole lifecycle per row, so it can
 * be reconciled against a district's own records offline.
 */
export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return new Response("Not signed in", { status: 401 });
    }
    throw error;
  }

  const { user, scope } = session;

  const works = await prisma.work.findMany({
    where: scope.work,
    orderBy: { recommendedAt: "desc" },
    include: {
      district: { include: { state: true } },
      mp: true,
      ia: true,
      payments: { include: { evidence: true } },
      alerts: true,
      delayRisk: true,
    },
  });

  const csv = toCsv(
    [
      "Work code",
      "Title",
      "Work type",
      "Category",
      "Location",
      "District",
      "State",
      "Recommended by",
      "Constituency",
      "Financial year",
      "Recommended on",
      "Recommended amount",
      "Sanctioned on",
      "Sanctioned amount",
      "Due for completion",
      "Status",
      "Progress %",
      "Complete on the ground",
      "Marked complete",
      "Implementing agency",
      "Payment stages",
      "Stages with evidence",
      "Released to vendors",
      "Open alerts",
      "Highest alert score",
      "Delay risk",
    ],
    works.map((w) => {
      const released = w.payments.reduce((s, p) => s + Number(p.amount), 0);
      const documented = w.payments.filter((p) => p.evidence.length > 0).length;
      const open = w.alerts.filter((a) => a.state === "OPEN").length;
      const top = w.alerts.reduce((m, a) => Math.max(m, a.score), 0);
      return [
        w.workCode,
        w.title,
        w.workType,
        w.category,
        w.locality,
        w.district.name,
        w.district.state.name,
        w.mp.name,
        w.mp.constituency,
        w.financialYear,
        w.recommendedAt.toISOString().slice(0, 10),
        w.recommendedAmount.toString(),
        w.sanctionedAt?.toISOString().slice(0, 10) ?? "",
        w.sanctionedAmount?.toString() ?? "",
        w.expectedCompletionAt?.toISOString().slice(0, 10) ?? "",
        WORK_STATUS_LABELS[w.status],
        w.progressPct,
        w.completedAt?.toISOString().slice(0, 10) ?? "",
        w.markedCompleteAt?.toISOString().slice(0, 10) ?? "",
        w.ia?.name ?? "",
        w.payments.length,
        documented,
        released,
        open,
        top || "",
        w.delayRisk ? `${Math.round(w.delayRisk.probability * 100)}% (${w.delayRisk.band})` : "",
      ];
    }),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`satarkai-works-${user.role.toLowerCase()}-${stamp}.csv`, csv);
}
