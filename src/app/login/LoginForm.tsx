"use client";

import { useFormState, useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-2xs font-medium uppercase tracking-wide text-slate"
        >
          Official email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate/60"
          placeholder="name@department.gov.in"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-2xs font-medium uppercase tracking-wide text-slate"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded border border-severity-critical/30 bg-severity-critical/10 px-3 py-2 text-2xs text-severity-critical"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
