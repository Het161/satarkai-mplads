import type { AlertType, Severity } from "@prisma/client";

/**
 * What a detector produces.
 *
 * Every field here exists so an officer can answer "why am I looking at this?"
 * without reading code: `reason` says it in a sentence, `evidence.facts` shows
 * the figures the rule read, `evidence.rows` shows the underlying records, and
 * `evidence.scoring` shows how the priority score was arrived at.
 *
 * A detector never decides anything. It produces a prompt for review.
 */
export type Finding = {
  workId: string;
  type: AlertType;
  /** Anomaly-Priority Score, 0–100. See `score()` below. */
  score: number;
  severity: Severity;
  /** One plain-language sentence. No jargon, no verdict. */
  reason: string;
  evidence: AlertEvidence;
};

export type AlertEvidence = {
  /** The rule as a sentence, including its threshold. */
  rule: string;
  /** The figures the rule actually read. */
  facts: Fact[];
  /** Underlying records — payment stages, peer works, other recommendations. */
  rows?: EvidenceRow[];
  /** How the priority score was composed. */
  scoring: ScoreComponent[];
  /** Other works this finding refers to, for cross-linking in the UI. */
  relatedWorkIds?: string[];
};

export type Fact = { label: string; value: string };

export type EvidenceRow = {
  label: string;
  /** Free-form columns, rendered as a small table. */
  values: Fact[];
  /** Marks the row as the one that breaches the rule. */
  flagged?: boolean;
};

export type ScoreComponent = {
  label: string;
  /** Weight in the final score, 0–1. Weights sum to 1 across components. */
  weight: number;
  /** This component's own 0–100 value. */
  value: number;
  /** Why this component scored what it did. */
  basis: string;
};

/**
 * Compose a 0–100 priority score from weighted components.
 *
 * The weighting is deliberately simple and visible. Two things decide where a
 * case sits in an officer's queue: how badly the rule is broken, and how much
 * public money is exposed. A small work badly over deadline and a large work
 * slightly over should not look alike, and neither should dominate purely on
 * size — which is why value is log-scaled rather than linear.
 */
export function score(components: ScoreComponent[]): number {
  const total = components.reduce((s, c) => s + c.weight * c.value, 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

/**
 * Value at stake as a 0–100 component, log-scaled between ₹1 lakh and ₹5 crore
 * (the MPLADS annual entitlement). A ₹50 lakh work should outrank a ₹5 lakh one
 * without burying it fifty times deeper.
 */
export function valueComponent(rupees: number): number {
  const floor = 100_000;
  const ceiling = 50_000_000;
  if (rupees <= floor) return 0;
  const t =
    Math.log(Math.min(rupees, ceiling) / floor) / Math.log(ceiling / floor);
  return Math.round(t * 100);
}

/** Clamp a ratio to a 0–100 component, saturating at `full`. */
export function ratioComponent(value: number, full: number): number {
  if (full <= 0) return 0;
  return Math.round(Math.max(0, Math.min(1, value / full)) * 100);
}

/**
 * Severity bands. These set the colour an officer sees, so the boundaries are
 * stated once here rather than being chosen per detector.
 */
export function severityFor(score: number): Severity {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "INFO";
}

export function makeFinding(
  workId: string,
  type: AlertType,
  reason: string,
  evidence: Omit<AlertEvidence, "scoring">,
  scoring: ScoreComponent[],
): Finding {
  const s = score(scoring);
  return {
    workId,
    type,
    score: s,
    severity: severityFor(s),
    reason,
    evidence: { ...evidence, scoring },
  };
}
