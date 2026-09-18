import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-4 text-center"
    >
      <div className="max-w-md">
        <h1 className="text-lg font-semibold text-ink">Record not available</h1>
        <p className="mt-2 text-2xs leading-relaxed text-slate">
          This record either does not exist or falls outside the state, district,
          constituency or agency attached to your account. SatarkAI does not
          confirm the existence of records beyond your jurisdiction.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded border border-line px-3 py-1.5 text-2xs font-medium text-navy hover:bg-paper"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
