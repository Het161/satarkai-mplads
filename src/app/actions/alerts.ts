"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notify, recipientsForAlert } from "@/lib/notify";
import {
  ACTIONS,
  MIN_NOTE_LENGTH,
  availableActions,
  canAct,
  type ReviewAction,
} from "@/lib/review";
import { scoped } from "@/lib/scope";
import { ALERT_TYPE_LABELS } from "@/lib/scheme";

/**
 * Recording a review decision.
 *
 * Everything that makes this trustworthy happens here, server-side, and none of
 * it relies on the UI having hidden a button:
 *
 *  - the officer's role is allowed to act at all;
 *  - the alert is inside their jurisdiction (same scope filter as every read);
 *  - the transition is legal from the alert's current state;
 *  - a note is present where the action demands one.
 *
 * The state change, the action record and the audit entry are written in one
 * transaction. An audit trail with gaps in it is not an audit trail, so it is
 * not possible for a state to change without the entry that explains it.
 */

const schema = z.object({
  alertId: z.string().min(1),
  action: z.enum([
    "ACKNOWLEDGED",
    "CLARIFICATION_SOUGHT",
    "EXPLAINED",
    "ESCALATED",
  ]),
  note: z.string().max(2000).optional(),
});

export type ReviewResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function recordReview(
  _prev: ReviewResult | null,
  formData: FormData,
): Promise<ReviewResult> {
  const { user, scope } = await requireSession();

  if (!canAct(user.role)) {
    return {
      ok: false,
      error:
        "Your role has read access to alerts. Action on oversight alerts rests with the district, state and ministry authorities.",
    };
  }

  const parsed = schema.safeParse({
    alertId: formData.get("alertId"),
    action: formData.get("action"),
    note: formData.get("note")?.toString().trim() || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "That action is not recognised." };
  }

  const { alertId, action, note } = parsed.data;
  const spec = ACTIONS[action as ReviewAction];

  if (spec.requiresNote) {
    if (!note || note.length < MIN_NOTE_LENGTH) {
      return {
        ok: false,
        error: `${spec.label} needs a note of at least ${MIN_NOTE_LENGTH} characters. It is what the next person to read this case will rely on.`,
      };
    }
  }

  // Scope sits in the same WHERE as the id: an alert outside this officer's
  // jurisdiction is not found, so it cannot be acted on and its existence is
  // not confirmed either.
  const alert = await prisma.alert.findFirst({
    where: scoped(scope.alert, { id: alertId }),
    include: { work: { select: { id: true, workCode: true, title: true, districtId: true } } },
  });

  if (!alert) {
    return { ok: false, error: "That alert is not available to this account." };
  }

  if (!availableActions(alert.state).includes(action as ReviewAction)) {
    return {
      ok: false,
      error: `This alert is already ${alert.state.replace(/_/g, " ").toLowerCase()}, and ${spec.label.toLowerCase()} is not available from there. Reload the page to see the current options.`,
    };
  }

  const fromState = alert.state;
  const hoursToDecide =
    (Date.now() - alert.detectedAt.getTime()) / 3_600_000;

  await prisma.$transaction(async (tx) => {
    await tx.alert.update({
      where: { id: alert.id },
      data: { state: action },
    });

    await tx.alertAction.create({
      data: {
        alertId: alert.id,
        fromState,
        toState: action,
        note,
        byUserId: user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: `ALERT_${action}`,
        entity: "Alert",
        entityId: alert.id,
        meta: {
          from: fromState,
          to: action,
          alertType: alert.type,
          score: alert.score,
          workCode: alert.work.workCode,
          note: note ?? null,
        },
      },
    });

    // The feedback loop. Written only when a human reaches a conclusion, and
    // read by `npm run tune` — never by the engine, which would make the
    // detectors quietly self-adjusting and nobody accountable for it.
    if (spec.concludes) {
      await tx.detectorOutcome.upsert({
        where: { alertId: alert.id },
        create: {
          alertId: alert.id,
          type: alert.type,
          severity: alert.severity,
          score: alert.score,
          resolution: action,
          note,
          byUserId: user.id,
          hoursToDecide,
          districtId: alert.work.districtId,
        },
        update: {
          resolution: action,
          note,
          byUserId: user.id,
          hoursToDecide,
          at: new Date(),
        },
      });
    }
  });

  // Delivery happens after the decision is safely recorded, and its failure is
  // recorded rather than raised — an officer must never see an error because a
  // mail server is down.
  try {
    const recipients = await recipientsForAlert(alert.work.id, {
      escalating: action === "ESCALATED",
      excludeUserId: user.id,
    });

    await notify({
      userIds: recipients,
      channels: ["IN_APP", "EMAIL"],
      subject: `${ALERT_TYPE_LABELS[alert.type]} ${spec.verb} — ${alert.work.workCode}`,
      body:
        `${user.name} ${spec.verb} an alert on "${alert.work.title}" (${alert.work.workCode}).\n\n` +
        `Alert: ${ALERT_TYPE_LABELS[alert.type]}, score ${alert.score} of 100.\n` +
        (note ? `Note: ${note}\n` : "") +
        `\nThis is a risk signal under review, not a finding of any kind.`,
      entity: "Alert",
      entityId: alert.id,
    });
  } catch (error) {
    // Deliberately swallowed: the decision stands whether or not anyone was
    // told about it, and the notification rows carry what happened.
    console.error("notification dispatch failed", error);
  }

  revalidatePath(`/alerts/${alert.id}`);
  revalidatePath("/alerts");
  revalidatePath("/audit");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Recorded: you ${spec.verb} this alert. Your name and the time are on the trail.`,
  };
}

/** Mark one in-app notification read. */
export async function markNotificationRead(id: string): Promise<void> {
  const { user } = await requireSession();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const { user } = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}
