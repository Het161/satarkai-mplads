/**
 * The ML layer's guarantees, tested without the Python service running.
 *
 * Two claims matter here and neither needs scikit-learn to check:
 *
 *  1. The application never depends on the model service. With ML_MODE=rules,
 *     or with the service down, detection still produces a full queue.
 *  2. The delay model cannot see its own answer. This is the failure that
 *     actually happened during development — the first version reported an AUC
 *     of 0.98 because `delayRatio` (days past the deadline) was in its input.
 *     A test is the only thing that stops that creeping back in.
 *
 * Requires a seeded database: npm run db:reset
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { buildContext, type DetectorContext } from "../src/lib/detectors/context";
import {
  buildDelayFeatures,
  buildFeatures,
  DELAY_FEATURE_NAMES,
  FEATURE_NAMES,
} from "../src/lib/detectors/features";
import { detectMlAnomalies, predictDelayRisk } from "../src/lib/detectors/ml";
import { RULE_DETECTORS } from "../src/lib/detectors/rules";
import {
  binomialTailProbability,
  STATISTICAL_DETECTORS,
} from "../src/lib/detectors/statistics";

const prisma = new PrismaClient();
const NOW = new Date("2026-09-18T00:00:00.000Z");

let ctx: DetectorContext;

beforeAll(async () => {
  ctx = await buildContext(NOW);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the app never depends on the model service", () => {
  it("produces a full alert queue from rules and statistics alone", () => {
    const findings = [...RULE_DETECTORS, ...STATISTICAL_DETECTORS].flatMap((d) =>
      d.run(ctx),
    );
    expect(findings.length).toBeGreaterThan(80);

    // Every rule detector contributes something, so a queue built without the
    // model is not quietly missing a whole class of signal.
    for (const d of RULE_DETECTORS) {
      expect(d.run(ctx).length, `${d.type} produced nothing`).toBeGreaterThan(0);
    }
  });

  it("returns no findings and a stated reason when ML_MODE is rules", async () => {
    // vitest.config loads .env, where ML_MODE is 'rules'.
    const result = await detectMlAnomalies(ctx);
    expect(result.findings).toEqual([]);
    expect(result.note).toMatch(/rules/i);
  });

  it("returns no forecasts and a stated reason, rather than throwing", async () => {
    const result = await predictDelayRisk(ctx);
    expect(result.predictions).toEqual([]);
    expect(result.note.length).toBeGreaterThan(10);
    expect(result.evaluation).toBeNull();
  });
});

describe("delay prediction cannot see its own answer", () => {
  it("excludes every feature that encodes the outcome", () => {
    // These describe where a work ended up. Any of them in the delay model's
    // input is leakage, not a feature.
    const outcomeBearing = [
      "delayRatio",
      "progressRate",
      "paymentProgressGap",
      "evidenceCompleteness",
      "paymentIrregularity",
      "iaDistrictShare",
      "costPerUnitRatio",
    ];

    for (const name of outcomeBearing) {
      expect(
        DELAY_FEATURE_NAMES,
        `${name} moves after sanction and must not be a delay feature`,
      ).not.toContain(name);
    }
  });

  it("uses only attributes fixed at the moment of sanction", () => {
    const allowed = new Set([
      "amountScale",
      "unitCount",
      "sanctionLagRatio",
      "fyEndProximity",
      "sanctionMonth",
      "sanctionToRecommendRatio",
      "agencyPriorLateRate",
      "agencyPriorCount",
      "districtPriorLateRate",
      "workTypePriorLateRate",
    ]);
    for (const name of DELAY_FEATURE_NAMES) {
      expect(allowed.has(name), `unexpected delay feature: ${name}`).toBe(true);
    }
  });

  it("keeps the training and prediction sets disjoint", () => {
    const { train, predict } = buildDelayFeatures(ctx);
    const trainIds = new Set(train.map((r) => r.workId));
    const overlap = predict.filter((r) => trainIds.has(r.workId));
    expect(overlap, "a work cannot both train and be predicted").toEqual([]);
    expect(train.length).toBeGreaterThan(100);
    expect(predict.length).toBeGreaterThan(0);
  });

  it("gives every training example a settled outcome, and none a predicted one", () => {
    const { train, predict } = buildDelayFeatures(ctx);
    expect(train.every((r) => typeof r.late === "boolean")).toBe(true);
    expect(predict.every((r) => r.late === null)).toBe(true);
  });

  it("has both outcomes well represented, so the model has something to learn", () => {
    const { train } = buildDelayFeatures(ctx);
    const lateRate = train.filter((r) => r.late).length / train.length;
    // Neither degenerate nor suspiciously balanced.
    expect(lateRate).toBeGreaterThan(0.05);
    expect(lateRate).toBeLessThan(0.6);
  });
});

describe("feature vectors", () => {
  it("has one value per named feature, for both sets", () => {
    const anomaly = buildFeatures(ctx);
    expect(anomaly.length).toBeGreaterThan(100);
    for (const row of anomaly.slice(0, 50)) {
      expect(row.values).toHaveLength(FEATURE_NAMES.length);
    }

    const { train, predict } = buildDelayFeatures(ctx);
    for (const row of [...train.slice(0, 50), ...predict.slice(0, 50)]) {
      expect(row.values).toHaveLength(DELAY_FEATURE_NAMES.length);
    }
  });

  it("produces finite numbers only — a NaN would poison the whole fit", () => {
    for (const row of buildFeatures(ctx)) {
      for (const [i, v] of row.values.entries()) {
        expect(
          Number.isFinite(v),
          `${FEATURE_NAMES[i]} is ${v} for work ${row.workId}`,
        ).toBe(true);
      }
    }
    const { train, predict } = buildDelayFeatures(ctx);
    for (const row of [...train, ...predict]) {
      for (const [i, v] of row.values.entries()) {
        expect(
          Number.isFinite(v),
          `${DELAY_FEATURE_NAMES[i]} is ${v} for work ${row.workId}`,
        ).toBe(true);
      }
    }
  });
});

describe("binomial tail probability", () => {
  it("matches known values", () => {
    // All 10 of 10 coin flips heads.
    expect(binomialTailProbability(10, 10, 0.5)).toBeCloseTo(1 / 1024, 6);
    // At least 1 of 10 — almost certain.
    expect(binomialTailProbability(1, 10, 0.5)).toBeCloseTo(1023 / 1024, 6);
    // At least 0 is certain; more than n is impossible.
    expect(binomialTailProbability(0, 10, 0.5)).toBe(1);
    expect(binomialTailProbability(11, 10, 0.5)).toBe(0);
  });

  it("makes an ordinary split unremarkable and a lopsided one surprising", () => {
    // 10 of 21 works with one of three agencies: ordinary.
    expect(binomialTailProbability(10, 21, 1 / 3)).toBeGreaterThan(0.05);
    // 18 of 21: not ordinary.
    expect(binomialTailProbability(18, 21, 1 / 3)).toBeLessThan(0.0001);
  });
});
