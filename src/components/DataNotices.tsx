import { DATA_COVERAGE_NOTE } from "@/lib/scheme";

/**
 * Two notices that must never be quietly dropped:
 *
 *  1. This dataset is synthetic. Presenting generated figures as official
 *     MoSPI data would be dishonest, so the banner is part of the shell and
 *     appears on every authenticated page.
 *  2. eSAKSHI's coverage starts 1 April 2023. Showing a "trend since 2019"
 *     that silently begins in 2023 would mislead, so history carries the gap.
 */

export function SyntheticDataBanner() {
  return (
    <div
      role="note"
      className="border-b border-severity-high/30 bg-severity-high/10 px-4 py-1.5 text-2xs text-[#7A4A06]"
    >
      <span className="font-semibold uppercase tracking-wide">
        Synthetic demonstration data
      </span>{" "}
      — every figure, work, Member of Parliament, agency and vendor shown here
      is generated for demonstration. No official MPLADS record is reproduced.
      Real state and district names are used for geographic realism only.
    </div>
  );
}

export function CoverageGapNotice() {
  return (
    <p className="rounded border border-line bg-paper px-3 py-2 text-2xs leading-relaxed text-slate">
      <span className="font-medium text-ink">Coverage:</span>{" "}
      {DATA_COVERAGE_NOTE}
    </p>
  );
}

export function HumanDecidesNotice() {
  return (
    <p className="rounded border border-severity-info/30 bg-severity-info/5 px-3 py-2 text-2xs leading-relaxed text-slate">
      <span className="font-medium text-ink">AI flags, a human decides.</span>{" "}
      Every signal on this platform is a risk-prioritised prompt for review, not
      a finding of fraud. Alerts carry the reason and the records behind them,
      and every action an officer takes is recorded in the audit trail.
    </p>
  );
}
