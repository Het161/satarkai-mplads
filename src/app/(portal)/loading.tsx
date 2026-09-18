import { t } from "@/lib/i18n";

/**
 * Shown while a page's server queries run.
 *
 * A national dashboard aggregates across every work in the scheme, so there is
 * a real wait to fill. Skeleton blocks rather than a spinner, because they
 * show the shape of what is coming and do not move — and `animate-pulse`
 * stops entirely under `prefers-reduced-motion`, which the global stylesheet
 * enforces.
 */
export default function Loading() {
  const dict = t();
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">{dict.common.loading}</span>

      <div className="h-6 w-64 animate-pulse rounded bg-line/60" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded border border-line bg-white"
          />
        ))}
      </div>

      <div className="h-64 animate-pulse rounded border border-line bg-white" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded border border-line bg-white" />
        <div className="h-56 animate-pulse rounded border border-line bg-white" />
      </div>
    </div>
  );
}
