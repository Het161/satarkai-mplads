"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { AlertState } from "@prisma/client";

import { recordReview, type ReviewResult } from "@/app/actions/alerts";
import { Card, CardHeader } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/en";
import { fill } from "@/lib/i18n/locale";
import { ACTIONS, MIN_NOTE_LENGTH, type ReviewAction } from "@/lib/review";

/**
 * The slice of the dictionary this panel needs.
 *
 * Passed down as a prop rather than read here, because this is the one
 * interactive piece in the product and `t()` reads a cookie on the server.
 * Narrowing it to two sections keeps the payload that crosses the boundary to
 * what is actually rendered.
 */
export type ReviewLabels = {
  review: Dictionary["review"];
  action: Dictionary["action"];
  alertState: Dictionary["alertState"];
};

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

function Submit({ label, recording }: { label: string; recording: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-navy px-3 py-1.5 text-2xs font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? recording : label}
    </button>
  );
}

export function ReviewPanel({
  alertId,
  state,
  actions,
  escalationTarget,
  labels,
}: {
  alertId: string;
  state: AlertState;
  actions: ReviewAction[];
  escalationTarget: string;
  labels: ReviewLabels;
}) {
  const { review: r, action: act } = labels;
  const [result, formAction] = useFormState<ReviewResult | null, FormData>(
    recordReview,
    null,
  );
  const [selected, setSelected] = useState<ReviewAction | null>(null);

  const spec = selected ? ACTIONS[selected] : null;

  return (
    <Card>
      <CardHeader title={r.heading} subtitle={r.subtitle} />

      <form action={formAction} className="space-y-3 px-4 py-3">
        <input type="hidden" name="alertId" value={alertId} />

        <fieldset>
          <legend className="text-2xs font-medium uppercase tracking-wide text-slate">
            {r.action}
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
                {act[a].label}
              </label>
            ))}
          </div>
        </fieldset>

        {spec ? (
          <p className="rounded border border-line bg-paper px-3 py-2 text-2xs leading-relaxed text-slate">
            {selected ? act[selected].meaning : null}
            {selected === "ESCALATED"
              ? fill(r.escalationNotice, { target: escalationTarget })
              : null}
          </p>
        ) : null}

        <div>
          <label
            htmlFor="note"
            className="mb-1 block text-2xs font-medium uppercase tracking-wide text-slate"
          >
            {r.note}{" "}
            {spec?.requiresNote ? (
              <span className="text-severity-critical">{r.required}</span>
            ) : (
              <span className="font-normal normal-case text-slate">
                {r.optional}
              </span>
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
                ? r.placeholderExplained
                : selected === "CLARIFICATION_SOUGHT"
                  ? r.placeholderClarification
                  : selected === "ESCALATED"
                    ? r.placeholderEscalated
                    : r.placeholderDefault
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
            {fill(r.currentlyState, { state: labels.alertState[state] })}
          </p>
          <Submit
            label={selected ? act[selected].label : r.record}
            recording={r.recording}
          />
        </div>
      </form>

      <p className="border-t border-line px-4 py-2 text-2xs leading-relaxed text-slate">
        {r.footer}
      </p>
    </Card>
  );
}
