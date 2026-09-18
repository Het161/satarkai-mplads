"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { AlertState } from "@prisma/client";

import { recordReview, type ReviewResult } from "@/app/actions/alerts";
import { Card, CardHeader } from "@/components/ui";
import {
  ACTIONS,
  MIN_NOTE_LENGTH,
  type ReviewAction,
} from "@/lib/review";

/**
 * Where an officer records what they decided.
 *
 * Two things are deliberate here. Choosing an action reveals what it *means*
 * before the officer commits to it — "mark as explained" is a decision someone
 * will read in a year, and the panel says so. And the note is not an optional
 * afterthought: for the three actions that conclude or escalate a case, the
 * form will not submit without one, because a trail of state changes with no
 * reasons attached is not an audit trail.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-navy px-3 py-1.5 text-2xs font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Recording…" : label}
    </button>
  );
}

export function ReviewPanel({
  alertId,
  state,
  actions,
  escalationTarget,
}: {
  alertId: string;
  state: AlertState;
  actions: ReviewAction[];
  escalationTarget: string;
}) {
  const [result, formAction] = useFormState<ReviewResult | null, FormData>(
    recordReview,
    null,
  );
  const [selected, setSelected] = useState<ReviewAction | null>(null);

  const spec = selected ? ACTIONS[selected] : null;

  return (
    <Card>
      <CardHeader
        title="Record your decision"
        subtitle="Nothing on this platform closes an alert by itself. Every state change carries the name of the person who made it."
      />

      <form action={formAction} className="space-y-3 px-4 py-3">
        <input type="hidden" name="alertId" value={alertId} />

        <fieldset>
          <legend className="text-2xs font-medium uppercase tracking-wide text-slate">
            Action
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <label
                key={a}
                className={
                  selected === a
                    ? "cursor-pointer rounded border border-navy bg-navy px-2.5 py-1 text-2xs font-medium text-white"
                    : "cursor-pointer rounded border border-line bg-white px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
                }
              >
                <input
                  type="radio"
                  name="action"
                  value={a}
                  checked={selected === a}
                  onChange={() => setSelected(a)}
                  className="sr-only"
                  required
                />
                {ACTIONS[a].label}
              </label>
            ))}
          </div>
        </fieldset>

        {spec ? (
          <p className="rounded border border-line bg-paper px-3 py-2 text-2xs leading-relaxed text-slate">
            {spec.meaning}
            {selected === "ESCALATED" ? (
              <> This will notify {escalationTarget}.</>
            ) : null}
          </p>
        ) : null}

        <div>
          <label
            htmlFor="note"
            className="mb-1 block text-2xs font-medium uppercase tracking-wide text-slate"
          >
            Note{" "}
            {spec?.requiresNote ? (
              <span className="text-severity-critical">required</span>
            ) : (
              <span className="font-normal normal-case text-slate">optional</span>
            )}
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            required={spec?.requiresNote ?? false}
            minLength={spec?.requiresNote ? MIN_NOTE_LENGTH : undefined}
            placeholder={
              selected === "EXPLAINED"
                ? "What is the legitimate reason? Be specific enough that someone reading this in a year understands it."
                : selected === "CLARIFICATION_SOUGHT"
                  ? "What have you asked for, and from whom?"
                  : selected === "ESCALATED"
                    ? "Why does this need attention above your level?"
                    : "Anything worth recording."
            }
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate/60"
          />
        </div>

        {result && !result.ok ? (
          <p
            role="alert"
            className="rounded border border-severity-critical/30 bg-severity-critical/10 px-3 py-2 text-2xs text-severity-critical"
          >
            {result.error}
          </p>
        ) : null}

        {result?.ok ? (
          <p
            role="status"
            className="rounded border border-severity-low/30 bg-severity-low/10 px-3 py-2 text-2xs text-severity-low"
          >
            {result.message}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs text-slate">
            Currently {state.replace(/_/g, " ").toLowerCase()}.
          </p>
          <Submit label={spec ? spec.label : "Record"} />
        </div>
      </form>

      <p className="border-t border-line px-4 py-2 text-2xs leading-relaxed text-slate">
        Recording a decision does not accuse anyone of anything, and no penalty
        or report follows from it automatically. It records what an officer
        concluded, so that the next person to open this case can see it.
      </p>
    </Card>
  );
}
