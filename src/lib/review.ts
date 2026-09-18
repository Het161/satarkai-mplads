import type { AlertState, Role } from "@prisma/client";

/**
 * The review workflow.
 *
 * Four things an officer can do with an alert, and nothing the system does on
 * its own. No alert is ever auto-closed, auto-escalated or auto-reported —
 * every state change on this platform has a person's name against it, and the
 * engine's own re-runs deliberately leave `state` alone.
 *
 * The transitions are deliberately few. A workflow with a dozen states invites
 * cases to be parked in one of them; these four describe what actually happens
 * to an oversight signal, and each requires the officer to say something.
 */

export const ACTIONS = {
  ACKNOWLEDGED: {
    label: "Acknowledge",
    verb: "acknowledged",
    /** Said in the UI, so the officer knows what they are committing to. */
    meaning:
      "You have seen this and are looking into it. The alert stays open in the queue.",
    requiresNote: false,
    /** Whether this decision closes the case for feedback-loop purposes. */
    concludes: false,
  },
  CLARIFICATION_SOUGHT: {
    label: "Seek clarification",
    verb: "sought clarification on",
    meaning:
      "You have asked the implementing agency or district for an explanation. Record what you asked for.",
    requiresNote: true,
    concludes: false,
  },
  EXPLAINED: {
    label: "Mark as explained",
    verb: "marked as explained",
    meaning:
      "There is a legitimate reason and no further action is needed. Record the reason — it is what lets the detector be tuned later, and it is what a future reviewer will read.",
    requiresNote: true,
    concludes: true,
  },
  ESCALATED: {
    label: "Escalate",
    verb: "escalated",
    meaning:
      "This warrants attention above your level. Record why. Escalation does not accuse anyone of anything; it moves the question up.",
    requiresNote: true,
    concludes: true,
  },
} as const satisfies Record<
  Exclude<AlertState, "OPEN">,
  {
    label: string;
    verb: string;
    meaning: string;
    requiresNote: boolean;
    concludes: boolean;
  }
>;

export type ReviewAction = keyof typeof ACTIONS;

export const ALERT_STATE_LABELS: Record<AlertState, string> = {
  OPEN: "Awaiting review",
  ACKNOWLEDGED: "Acknowledged",
  CLARIFICATION_SOUGHT: "Clarification sought",
  EXPLAINED: "Explained",
  ESCALATED: "Escalated",
};

/**
 * Which actions are available from a given state.
 *
 * A concluded alert can be reopened only by escalating it or by seeking
 * clarification again — there is no "undo". Somebody recorded a decision, and
 * the way to disagree with a decision is to record a new one, not to erase it.
 */
export function availableActions(state: AlertState): ReviewAction[] {
  switch (state) {
    case "OPEN":
      return ["ACKNOWLEDGED", "CLARIFICATION_SOUGHT", "EXPLAINED", "ESCALATED"];
    case "ACKNOWLEDGED":
      return ["CLARIFICATION_SOUGHT", "EXPLAINED", "ESCALATED"];
    case "CLARIFICATION_SOUGHT":
      return ["EXPLAINED", "ESCALATED"];
    case "EXPLAINED":
      // Reopening a closed case is legitimate — new information arrives — but
      // it is itself an action that gets recorded.
      return ["CLARIFICATION_SOUGHT", "ESCALATED"];
    case "ESCALATED":
      return ["CLARIFICATION_SOUGHT", "EXPLAINED"];
  }
}

/**
 * Who may act at all.
 *
 * MPs and implementing agencies read their data; they do not close oversight
 * alerts about it. An agency marking its own missing-evidence alert as
 * "explained" would make the whole trail worthless.
 */
export function canAct(role: Role): boolean {
  return role === "MINISTRY" || role === "SNA" || role === "DISTRICT";
}

/**
 * Escalation goes up, so a district officer escalating should reach the state
 * authority, and a state authority the Ministry. The Ministry has nowhere
 * further to send it — it escalates within itself, which is a real thing
 * (to a different desk) and worth saying plainly rather than hiding the button.
 */
export function escalatesTo(role: Role): string {
  switch (role) {
    case "DISTRICT":
      return "the State Nodal Authority";
    case "SNA":
      return "the Ministry";
    case "MINISTRY":
      return "the Ministry's own review";
    default:
      return "a higher authority";
  }
}

/** Minimum length for a note, so "ok" does not pass as a reason. */
export const MIN_NOTE_LENGTH = 15;
