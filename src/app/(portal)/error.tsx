"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * A page-level failure.
 *
 * Says the one thing an officer needs to know beyond "it broke": nothing was
 * changed. On a platform where every action is recorded, "did my decision go
 * through?" is the first question a failure raises, and leaving it unanswered
 * is worse than the error itself.
 *
 * The message is not translated here because this component must render even
 * when the failure is in the server layer that resolves the locale.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("page error", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto max-w-lg rounded border border-line bg-white px-5 py-6 text-center shadow-card"
    >
      <h1 className="text-sm font-semibold text-ink">
        Something went wrong on this page
      </h1>
      <p className="mt-2 text-2xs leading-relaxed text-slate">
        The error has been logged. You can try again, or go back to the
        dashboard.{" "}
        <span className="font-medium text-ink">
          No data was changed by this failure.
        </span>
      </p>
      {error.digest ? (
        <p className="mt-2 text-2xs text-slate">
          Reference: <code className="text-ink">{error.digest}</code>
        </p>
      ) : null}
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-navy px-3 py-1.5 text-2xs font-medium text-white hover:bg-ink"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded border border-line px-3 py-1.5 text-2xs font-medium text-navy hover:bg-paper"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
