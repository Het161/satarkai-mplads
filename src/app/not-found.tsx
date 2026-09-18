import Link from "next/link";

import { t as tr } from "@/lib/i18n";

export default function NotFound() {
  const d = tr();
  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-4 text-center"
    >
      <div className="max-w-md">
        <h1 className="text-lg font-semibold text-ink">
          {d.error.notFoundTitle}
        </h1>
        <p className="mt-2 text-2xs leading-relaxed text-slate">
          {d.error.notFoundBody}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded border border-line px-3 py-1.5 text-2xs font-medium text-navy hover:bg-paper"
        >
          {d.error.backToDashboard}
        </Link>
      </div>
    </main>
  );
}
