/**
 * Scheme constants and thresholds, all traceable to the published MPLADS /
 * eSAKSHI workflow. Detectors must read from here rather than inlining magic
 * numbers, so a reviewer can see exactly what rule fired and why.
 *
 * Source: MPLADS eSAKSHI portal — https://mplads.mospi.gov.in/digigov/dashboard.html
 */

/**
 * Sanctioned works are generally required to be completed within one year of
 * sanction. This is the scheme's own guideline and the basis of every delay
 * signal in the platform.
 */
export const COMPLETION_WINDOW_DAYS = 365;

/** Tunable detector thresholds. Phase 2 reads these; officers can revise them. */
export const THRESHOLDS = {
  /** Expenditure above sanctioned amount by more than this share is flagged. */
  costOverrunPct: 0.1,
  /** Payments released as a share of sanction, versus recorded progress. */
  paymentAheadOfProgressPct: 0.25,
  /** MP recommendations above entitlement by more than this share. */
  entitlementBreachPct: 0.0,
  /** Days before FY end that count as "financial-year-end clustering". */
  fyEndWindowDays: 21,
  /** Fuzzy title similarity above which two works are near-duplicates. */
  duplicateSimilarity: 0.82,
  /** Share of a district's sanctioned value held by one IA before flagging. */
  iaConcentrationShare: 0.45,
} as const;

/**
 * Honest coverage limit. The eSAKSHI portal holds MPLADS data from
 * 1 April 2023 onward. For the 17th Lok Sabha, 2019-20 to 2022-23 is not on
 * the portal, and Rajya Sabha details are unavailable before 2023-24.
 * Surface this wherever the UI shows history — never imply full coverage.
 */
export const DATA_COVERAGE_FROM = new Date("2023-04-01T00:00:00.000Z");

/**
 * The coverage gap, for reference.
 *
 * The copy shown to officers lives in the dictionaries as `notice.coverage`,
 * because it has to be readable in Hindi too. This constant stays as the
 * canonical statement of the limit for anything outside the UI — scripts,
 * exports, and anyone reading the scheme rules in one place.
 */
export const DATA_COVERAGE_NOTE =
  "eSAKSHI holds MPLADS data from 1 April 2023 onward. For the 17th Lok Sabha, FY 2019-20 to 2022-23 is not available on the portal, and Rajya Sabha details are unavailable before FY 2023-24.";

/** Financial years the seed covers. Indian FY runs 1 April – 31 March. */
export const FINANCIAL_YEARS = ["2023-24", "2024-25", "2025-26"] as const;
export type FinancialYear = (typeof FINANCIAL_YEARS)[number];

export function financialYearOf(date: Date): string {
  const y = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** 31 March of a financial year, the date FY-end clustering gathers around. */
export function financialYearEnd(fy: string): Date {
  const startYear = Number(fy.slice(0, 4));
  return new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59));
}

export function financialYearStart(fy: string): Date {
  const startYear = Number(fy.slice(0, 4));
  return new Date(Date.UTC(startYear, 3, 1));
}

/** The five real MPLADS stakeholder roles, in oversight order. */
export const ROLE_LABELS = {
  MINISTRY: "Ministry / Central Nodal Agency (MoSPI)",
  SNA: "State Nodal Authority",
  DISTRICT: "District Authority (NDA/IDA)",
  MP: "Hon'ble Member of Parliament",
  IA: "Implementing Agency",
} as const;

export const ALERT_TYPE_LABELS = {
  OVERDUE: "Overdue completion",
  PAYMENT_AHEAD: "Payment ahead of progress",
  COST_OVERRUN: "Cost overrun",
  ENTITLEMENT_BREACH: "Entitlement breach",
  MISSING_EVIDENCE: "Missing asset evidence",
  STUCK_UNMARKED: "Complete but not marked",
  DUPLICATE: "Possible duplicate work",
  FY_END_SPIKE: "Financial-year-end clustering",
  COST_OUTLIER: "Cost outlier vs peers",
  IA_CONCENTRATION: "Implementing agency concentration",
  ML_ANOMALY: "Multivariate anomaly",
} as const;

/**
 * The step of the eSAKSHI lifecycle each signal concerns, so a work's timeline
 * can pin every alert to the point in the process where it arose rather than
 * listing them all at the bottom.
 */
export const ALERT_TYPE_STEP = {
  ENTITLEMENT_BREACH: "Recommendation & earmarking",
  DUPLICATE: "Recommendation & earmarking",
  COST_OUTLIER: "Sanction",
  FY_END_SPIKE: "Sanction",
  OVERDUE: "Completion window",
  IA_CONCENTRATION: "Designation of the implementing agency",
  PAYMENT_AHEAD: "Vendor payments",
  COST_OVERRUN: "Vendor payments",
  MISSING_EVIDENCE: "Asset evidence",
  STUCK_UNMARKED: "Completion marking",
  ML_ANOMALY: "Across the whole record",
} as const;

/** The lifecycle steps in order, for grouping a work's alerts. */
export const LIFECYCLE_STEPS = [
  "Recommendation & earmarking",
  "Sanction",
  "Designation of the implementing agency",
  "Vendor payments",
  "Asset evidence",
  "Completion window",
  "Completion marking",
  "Across the whole record",
] as const;

export const WORK_STATUS_LABELS = {
  RECOMMENDED: "Recommended by MP",
  SANCTIONED: "Sanctioned",
  IN_PROGRESS: "In progress",
  COMPLETED_UNMARKED: "Complete, not marked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;
