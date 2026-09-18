/**
 * The review workflow.
 *
 * The state machine and the permission rules are pure functions, so they are
 * tested directly. The server action that uses them is exercised over HTTP in
 * scripts/smoke-review.ts, because a server action needs a running Next.js to
 * mean anything.
 *
 * What matters here: the workflow cannot lose a decision, cannot close a case
 * without a reason, and never lets a role act that should not.
 */

import { describe, expect, it } from "vitest";
import type { AlertState, Role } from "@prisma/client";

import {
  ACTIONS,
  ALERT_STATE_LABELS,
  MIN_NOTE_LENGTH,
  availableActions,
  canAct,
  escalatesTo,
  type ReviewAction,
} from "../src/lib/review";

const ALL_STATES: AlertState[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "CLARIFICATION_SOUGHT",
  "EXPLAINED",
  "ESCALATED",
];

describe("who may act", () => {
  it("lets the oversight roles act", () => {
    for (const role of ["MINISTRY", "SNA", "DISTRICT"] as Role[]) {
      expect(canAct(role), `${role} should be able to act`).toBe(true);
    }
  });

  it("does not let an MP or an implementing agency close an alert", () => {
    // An agency marking its own missing-evidence alert as "explained" would
    // make the entire trail worthless.
    expect(canAct("MP" as Role)).toBe(false);
    expect(canAct("IA" as Role)).toBe(false);
  });

  it("names where an escalation goes, for every role", () => {
    expect(escalatesTo("DISTRICT" as Role)).toContain("State");
    expect(escalatesTo("SNA" as Role)).toContain("Ministry");
    // The Ministry has nowhere above it, and the UI says so rather than
    // offering a button that quietly does nothing.
    expect(escalatesTo("MINISTRY" as Role).length).toBeGreaterThan(0);
  });
});

describe("the state machine", () => {
  it("offers every action from an untouched alert", () => {
    expect(availableActions("OPEN").sort()).toEqual(
      ["ACKNOWLEDGED", "CLARIFICATION_SOUGHT", "EXPLAINED", "ESCALATED"].sort(),
    );
  });

  it("never offers an action that lands on the state already held", () => {
    for (const state of ALL_STATES) {
      expect(
        availableActions(state),
        `${state} should not offer a transition to itself`,
      ).not.toContain(state as ReviewAction);
    }
  });

  it("always leaves a way forward — no state is a dead end", () => {
    for (const state of ALL_STATES) {
      expect(
        availableActions(state).length,
        `${state} has no available action`,
      ).toBeGreaterThan(0);
    }
  });

  it("lets a closed case be reopened, since new information arrives", () => {
    expect(availableActions("EXPLAINED")).toContain("ESCALATED");
    expect(availableActions("EXPLAINED")).toContain("CLARIFICATION_SOUGHT");
    expect(availableActions("ESCALATED")).toContain("EXPLAINED");
  });

  it("offers no way to erase a decision — only to record another", () => {
    // "OPEN" is where the engine starts an alert; an officer cannot put it
    // back, because that would silently discard their own earlier decision.
    for (const state of ALL_STATES) {
      expect(availableActions(state) as string[]).not.toContain("OPEN");
    }
  });

  it("does not let acknowledging happen twice", () => {
    expect(availableActions("ACKNOWLEDGED")).not.toContain("ACKNOWLEDGED");
  });
});

describe("what each action demands", () => {
  it("requires a reason for anything that concludes or escalates a case", () => {
    expect(ACTIONS.EXPLAINED.requiresNote).toBe(true);
    expect(ACTIONS.ESCALATED.requiresNote).toBe(true);
    expect(ACTIONS.CLARIFICATION_SOUGHT.requiresNote).toBe(true);
  });

  it("does not demand one merely to say you have seen it", () => {
    expect(ACTIONS.ACKNOWLEDGED.requiresNote).toBe(false);
  });

  it("sets a note length that rules out 'ok'", () => {
    expect(MIN_NOTE_LENGTH).toBeGreaterThan(5);
    expect("ok".length).toBeLessThan(MIN_NOTE_LENGTH);
  });

  it("treats exactly the two closing actions as conclusions", () => {
    const concluding = (Object.keys(ACTIONS) as ReviewAction[]).filter(
      (a) => ACTIONS[a].concludes,
    );
    // These are the two that write a DetectorOutcome, which is what the
    // threshold-tuning pass reads. Acknowledging is not a conclusion.
    expect(concluding.sort()).toEqual(["ESCALATED", "EXPLAINED"]);
  });

  it("explains in words what each action commits the officer to", () => {
    for (const [name, spec] of Object.entries(ACTIONS)) {
      expect(spec.meaning.length, `${name} has no explanation`).toBeGreaterThan(40);
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.verb.length).toBeGreaterThan(0);
    }
  });

  it("gives every state a readable label", () => {
    for (const state of ALL_STATES) {
      expect(ALERT_STATE_LABELS[state]).toBeTruthy();
      expect(ALERT_STATE_LABELS[state]).not.toContain("_");
    }
  });
});
