import type { NotificationChannel } from "@prisma/client";

import { prisma } from "./db";
import { env } from "./env";

/**
 * Channel-agnostic notification.
 *
 * Three rules shape this:
 *
 * 1. **Notifying never blocks the work.** An officer escalating an alert must
 *    not see an error because an SMTP server is down. Delivery is attempted
 *    after the decision is already recorded, and a failure is written to the
 *    notification row rather than thrown.
 *
 * 2. **A channel that cannot deliver says so.** Every intent is persisted,
 *    including the ones that go nowhere, with the reason. A monitoring platform
 *    that silently fails to notify is worse than one that does not notify at
 *    all, because nobody knows it is not working.
 *
 * 3. **In-app always works.** It needs no configuration and no network, so
 *    there is always one channel that has actually delivered. The others are
 *    additions to it, not replacements for it.
 *
 * `NOTIFY_MODE=console` (the default, and what the demo runs) prints instead of
 * sending. SMS and IVR are deliberate stubs: the adapter records the intent so
 * the shape of the integration is visible, and does not pretend to send.
 */

export type NotifyRequest = {
  userIds: string[];
  channels: NotificationChannel[];
  subject: string;
  body: string;
  entity: string;
  entityId: string;
};

export type NotifyResult = {
  created: number;
  sent: number;
  skipped: number;
  failed: number;
};

export async function notify(request: NotifyRequest): Promise<NotifyResult> {
  const result: NotifyResult = { created: 0, sent: 0, skipped: 0, failed: 0 };
  const recipients = [...new Set(request.userIds)];
  if (recipients.length === 0) return result;

  const users = await prisma.user.findMany({
    where: { id: { in: recipients }, active: true },
    select: { id: true, email: true, name: true },
  });

  for (const user of users) {
    for (const channel of request.channels) {
      const outcome = await deliver(channel, user, request);
      result.created++;
      result[outcome.status === "SENT" ? "sent" : outcome.status === "FAILED" ? "failed" : "skipped"]++;

      await prisma.notification.create({
        data: {
          userId: user.id,
          channel,
          status: outcome.status,
          subject: request.subject,
          body: request.body,
          entity: request.entity,
          entityId: request.entityId,
          sentAt: outcome.status === "SENT" ? new Date() : null,
          error: outcome.error,
        },
      });
    }
  }

  return result;
}

type Delivery = { status: "SENT" | "SKIPPED" | "FAILED"; error?: string };

async function deliver(
  channel: NotificationChannel,
  user: { id: string; email: string; name: string },
  request: NotifyRequest,
): Promise<Delivery> {
  switch (channel) {
    // Written to the database and read from the bell in the header. No
    // configuration, no network, so this one always lands.
    case "IN_APP":
      return { status: "SENT" };

    case "EMAIL": {
      if (env.notifyMode === "console") {
        console.log(
          `[notify:email→console] to=${user.email} subject=${request.subject}\n${request.body}\n`,
        );
        return {
          status: "SKIPPED",
          error: "NOTIFY_MODE=console — printed instead of sent.",
        };
      }
      if (!process.env.SMTP_HOST) {
        return {
          status: "SKIPPED",
          error: "No SMTP_HOST configured. Set it, or run with NOTIFY_MODE=console.",
        };
      }
      // A real deployment wires its department's SMTP relay here. Left
      // unimplemented rather than faked: a function that logs and returns SENT
      // would make the notification table lie about what was delivered.
      return {
        status: "SKIPPED",
        error:
          "SMTP transport not implemented in this build. The intent is recorded; wire a transport to deliver it.",
      };
    }

    // Stubs, and honest about it. Both are real channels for this audience —
    // a district officer in the field is far likelier to read an SMS than an
    // email — so the shape is here and the intent is recorded.
    case "SMS":
    case "IVR":
      return {
        status: "SKIPPED",
        error: `${channel} channel is stubbed in this build. The intent is recorded; no message was sent.`,
      };
  }
}

/**
 * Who should hear about an alert action.
 *
 * Escalation is the only case that reaches upward: the point of escalating is
 * that somebody above you sees it. Other actions notify the officers whose
 * jurisdiction contains the work, so a state authority can see that a district
 * is working its queue without being pinged for every acknowledgement.
 */
export async function recipientsForAlert(
  workId: string,
  opts: { escalating: boolean; excludeUserId?: string },
): Promise<string[]> {
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { districtId: true, district: { select: { stateId: true } } },
  });
  if (!work) return [];

  const roles = opts.escalating
    ? ([
        { role: "SNA" as const, stateId: work.district.stateId },
        { role: "MINISTRY" as const },
      ] as const)
    : ([{ role: "DISTRICT" as const, districtId: work.districtId }] as const);

  const users = await prisma.user.findMany({
    where: {
      active: true,
      OR: roles.map((r) =>
        "stateId" in r
          ? { role: r.role, stateId: r.stateId }
          : "districtId" in r
            ? { role: r.role, districtId: r.districtId }
            : { role: r.role },
      ),
    },
    select: { id: true },
  });

  return users.map((u) => u.id).filter((id) => id !== opts.excludeUserId);
}
