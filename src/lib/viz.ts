/**
 * Chart colour, decided by the job each colour does — not by taste.
 *
 * Every value here was run through the palette validator (OKLCH lightness band,
 * chroma floor, CVD separation under protanopia and deuteranopia, normal-vision
 * separation, contrast against the white card surface) rather than eyeballed.
 * The results are recorded beside each set so a later change can be re-checked
 * against the same bar.
 *
 * The rule that shapes everything below: **severity colour is reserved for
 * risk.** The critical/high/medium/low tokens in tailwind.config.ts mean
 * something — an officer reads red as "this needs attention". Spending them on
 * "the third line in a trend chart" would make them stop meaning it. So charts
 * draw from a separate categorical set, and a chart never uses a severity
 * colour unless it is genuinely encoding severity.
 */

/**
 * Identity — which series is which. Three slots only.
 *
 * Validated all-pairs on a white surface: worst CVD ΔE 9.2 (deuteranopia),
 * worst normal-vision ΔE 24.0. Both clear their floors.
 *
 * Three is a real cap, not a stylistic preference: a fourth slot puts yellow
 * beside orange and fails the separation floors. A fourth series folds into
 * "Other" or the chart becomes small multiples. Colours are assigned in fixed
 * order and follow the entity — filtering a series out never repaints the rest.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"] as const;

/**
 * The aqua slot sits at 2.82:1 against white, below the 3:1 mark. The validator
 * allows this only with relief: the values must be readable without relying on
 * the colour. Every chart using slot 3 therefore carries direct labels or shows
 * the same figures as a table.
 */
export const SERIES_NEEDS_LABEL_RELIEF = true;

/** Magnitude of one measure across nominal categories: one hue, every bar. */
export const SINGLE_SERIES = SERIES[0];

/**
 * Position in a sequence — entitlement → recommended → sanctioned → released.
 * Swapping the order would change the meaning, so this is ordinal and takes a
 * one-hue ramp: the reader sees the progression in the colour itself.
 *
 * Validated: lightness monotone, adjacent ΔL ≥ 0.06, light end 2.11:1 on white,
 * hue spread 3°.
 */
export const ORDINAL = ["#86b6ef", "#5598e7", "#2a78d6", "#184f95"] as const;

/** Recessive furniture. Grid and axes must not compete with the data. */
export const AXIS = {
  grid: "#DCE3EC",
  tick: "#45536B",
  line: "#DCE3EC",
} as const;

/** Severity, for the one job severity colour is for. */
export const SEVERITY_COLOURS = {
  CRITICAL: "#B3261E",
  HIGH: "#D97706",
  MEDIUM: "#C2A11A",
  LOW: "#1E7F4F",
  INFO: "#2E5F9E",
} as const;
