import clsx from "clsx";
import type { ReactNode } from "react";

/* --------------------------------------------------------------------------
 * "Audit" primitives. Dense, quiet, data-first.
 * Severity colour appears only on risk. Never decorative.
 * ----------------------------------------------------------------------- */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded border border-line bg-white shadow-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-2xs text-slate">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded border border-line bg-white px-4 py-3 shadow-card">
      {/* Two lines reserved for the label so the figures across a row of cards
          share a baseline even when one label wraps. */}
      <div className="min-h-[2rem] text-2xs font-medium uppercase leading-4 tracking-wide text-slate">
        {label}
      </div>
      <div
        className={clsx(
          "tnum text-2xl font-semibold leading-none",
          emphasis ? "text-severity-critical" : "text-ink",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-2xs text-slate">{hint}</div> : null}
    </div>
  );
}

/**
 * Badge text is a darker step of its own severity hue, not the hue itself.
 *
 * The severity tokens are chosen to read as *marks* — a bar, a border, a dot —
 * where 3:1 is the bar. As small text on a tinted ground they are a different
 * job with a different threshold, and amber in particular fails it badly:
 * #D97706 on its own 10% tint measures 2.70:1 against the paper ground, well
 * under the 4.5:1 that WCAG AA asks of body text. An axe pass caught it.
 *
 * Every value below was computed against both grounds the badge appears on
 * (white cards and the paper background), taking the worse of the two:
 * critical 5.53, high 5.30, medium 5.30, low 5.38, info 5.59.
 */
const SEVERITY_STYLES = {
  CRITICAL: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
  HIGH: "border-severity-high/30 bg-severity-high/10 text-[#9A4A04]",
  MEDIUM: "border-severity-medium/40 bg-severity-medium/10 text-[#7A6408]",
  LOW: "border-severity-low/30 bg-severity-low/10 text-[#196B42]",
  INFO: "border-severity-info/30 bg-severity-info/10 text-severity-info",
} as const;

export function SeverityBadge({
  severity,
  children,
}: {
  severity: keyof typeof SEVERITY_STYLES;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-medium",
        SEVERITY_STYLES[severity],
      )}
    >
      {children}
    </span>
  );
}

/** Neutral tag for non-risk metadata — status, category, financial year. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-line bg-paper px-1.5 py-0.5 text-2xs font-medium text-slate">
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-2xs text-slate">{body}</p>
    </div>
  );
}

/**
 * Data provenance label. Every figure in this platform carries its source and
 * date; a government dashboard that cannot say where a number came from is not
 * fit for decisions.
 */
export function ProvenanceNote({
  kind,
  name,
  fetchedAt,
  note,
}: {
  kind: "REAL" | "SYNTHETIC";
  name: string;
  fetchedAt: string;
  note?: string;
}) {
  return (
    <p className="text-2xs leading-relaxed text-slate">
      <span className="font-medium text-ink">Source:</span> {name} ·{" "}
      {kind === "SYNTHETIC" ? "synthetic demonstration data" : "official record"} ·
      as of {fetchedAt}
      {note ? <> · {note}</> : null}
    </p>
  );
}
