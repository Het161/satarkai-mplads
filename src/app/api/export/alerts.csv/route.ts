import { requireSession, UnauthenticatedError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/export";
import { scoped } from "@/lib/scope";
import { ALERT_TYPE_LABELS } from "@/lib/scheme";
import { ALERT_STATE_LABELS } from "@/lib/review";

export const dynamic = "force-dynamic";

/**
 * The alert queue as a spreadsheet.
 *
 * Scope-filtered exactly like the page it mirrors — an export route is the
 * classic place a jurisdiction filter gets forgotten, because it does not look
 * like a page and nobody screenshots it. A district officer downloading this
 * gets their district.
 *
 * Every row carries the reason and the officer's note, because the point of an
 * export is to be read away from the platform, where the "why" cannot be
 * clicked through to.
 */
export async function GET(request: Request) {
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
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const type = url.searchParams.get("type");

  const filters: Record<string, unknown> = {};
  if (state && state in ALERT_STATE_LABELS) filters.state = state;
  if (type && type in ALERT_TYPE_LABELS) filters.type = type;

  const alerts = await prisma.alert.findMany({
    where: scoped(scope.alert, filters),
    orderBy: [{ score: "desc" }, { detectedAt: "desc" }],
    include: {
      work: {
        include: { district: { include: { state: true } }, mp: true, ia: true },
      },
      actions: { orderBy: { at: "desc" }, take: 1, include: { byUser: true } },
    },
  });

  const csv = toCsv(
    [
      "Alert type",
      "Severity",
      "Score",
      "Review state",
      "Detected on",
      "Reason",
      "Work code",
      "Work",
      "Location",
      "District",
      "State",
      "Recommended by",
      "Implementing agency",
      "Sanctioned amount",
      "Work status",
      "Last action",
      "Last action by",
      "Last action on",
      "Last note",
    ],
    alerts.map((a) => {
      const last = a.actions[0];
      return [
        ALERT_TYPE_LABELS[a.type],
        a.severity,
        a.score,
        ALERT_STATE_LABELS[a.state],
        a.detectedAt.toISOString().slice(0, 10),
        a.reason,
        a.work.workCode,
        a.work.title,
        a.work.locality,
        a.work.district.name,
        a.work.district.state.name,
        a.work.mp.name,
        a.work.ia?.name ?? "",
        a.work.sanctionedAmount?.toString() ?? "",
        a.work.status,
        last ? ALERT_STATE_LABELS[last.toState] : "",
        last?.byUser.name ?? "",
        last ? last.at.toISOString().slice(0, 10) : "",
        last?.note ?? "",
      ];
    }),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const who = user.role.toLowerCase();
  return csvResponse(`satarkai-alerts-${who}-${stamp}.csv`, csv);
}
