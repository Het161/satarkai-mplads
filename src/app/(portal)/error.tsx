"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { LOCALE_COOKIE } from "@/lib/i18n/locale";

/**
 * A page-level failure.
 *
 * Says the one thing an officer needs to know beyond "it broke": nothing was
 * changed. On a platform where every action is recorded, "did my decision go
 * through?" is the first question a failure raises, and leaving it unanswered
 * is worse than the error itself.
 *
 * These six strings are kept here rather than read from the dictionary, which
 * is the one place in the app that duplicates copy. The reason is bundle
 * weight: this is an error boundary, so it is part of *every* route's client
 * bundle, and importing the dictionaries to reach six strings would ship both
 * languages in full to every page for a component that renders only on
 * failure. Six lines of duplication is the cheaper mistake.
 *
 * The locale is read from the cookie after mount rather than during render:
 * the server has no `document`, so resolving it during render would produce a
 * hydration mismatch. The cost is that a Hindi user sees one frame of English
 * on an error page, which is the right thing to trade away.
 */
const TEXT = {
  en: {
    title: "Something went wrong on this page",
    body: "The error has been logged. You can try again, or go back to the dashboard.",
    unchanged: "No data was changed by this failure.",
    reference: "Reference:",
    retry: "Try again",
    back: "Back to dashboard",
  },
  hi: {
    title: "इस पृष्ठ पर कुछ त्रुटि हुई",
    body: "त्रुटि दर्ज कर ली गई है। आप पुनः प्रयास कर सकते हैं या डैशबोर्ड पर लौट सकते हैं।",
    unchanged: "इस विफलता से किसी आँकड़े में परिवर्तन नहीं हुआ है।",
    reference: "संदर्भ:",
    retry: "पुनः प्रयास करें",
    back: "डैशबोर्ड पर लौटें",
  },
} as const;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [t, setT] = useState<(typeof TEXT)[keyof typeof TEXT]>(TEXT.en);

  useEffect(() => {
    console.error("page error", error);
  }, [error]);

  useEffect(() => {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
    );
    if (match?.[1] === "hi") setT(TEXT.hi);
  }, []);

  return (
    <div
      role="alert"
      className="mx-auto max-w-lg rounded border border-line bg-white px-5 py-6 text-center shadow-card"
    >
      <h1 className="text-sm font-semibold text-ink">{t.title}</h1>
      <p className="mt-2 text-2xs leading-relaxed text-slate">
        {t.body} <span className="font-medium text-ink">{t.unchanged}</span>
      </p>
      {error.digest ? (
        <p className="mt-2 text-2xs text-slate">
          {t.reference} <code className="text-ink">{error.digest}</code>
        </p>
      ) : null}
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-navy px-3 py-1.5 text-2xs font-medium text-white hover:bg-ink"
        >
          {t.retry}
        </button>
        <Link
          href="/dashboard"
          className="rounded border border-line px-3 py-1.5 text-2xs font-medium text-navy hover:bg-paper"
        >
          {t.back}
        </Link>
      </div>
    </div>
  );
}
