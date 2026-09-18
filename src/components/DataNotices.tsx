import { t } from "@/lib/i18n";
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
  const dict = t();
  return (
    <div
      role="note"
      className="border-b border-severity-high/30 bg-severity-high/10 px-4 py-1.5 text-2xs text-[#7A4A06]"
    >
      <span className="font-semibold uppercase tracking-wide">
        {dict.notice.syntheticTitle}
      </span>{" "}
      — {dict.notice.synthetic}
    </div>
  );
}

export function CoverageGapNotice() {
  const dict = t();
  return (
    <p className="rounded border border-line bg-paper px-3 py-2 text-2xs leading-relaxed text-slate">
      <span className="font-medium text-ink">{dict.notice.coverageTitle}</span>{" "}
      {DATA_COVERAGE_NOTE}
    </p>
  );
}

export function HumanDecidesNotice() {
  const dict = t();
  return (
    <p className="rounded border border-severity-info/30 bg-severity-info/5 px-3 py-2 text-2xs leading-relaxed text-slate">
      <span className="font-medium text-ink">
        {dict.notice.humanDecidesTitle}
      </span>{" "}
      {dict.notice.humanDecides}
    </p>
  );
}
