/**
 * Detector behaviour, against the seeded database.
 *
 * Two kinds of test here:
 *
 *  - Unit tests of the pieces that are easy to get subtly wrong — the
 *    similarity measure and the scoring maths.
 *  - Whole-engine tests of the invariants the seed exists to support: every
 *    planted anomaly is caught, and nothing unlabelled is flagged. These are
 *    the claims the README reports, so they belong in the test suite rather
 *    than only in a script somebody remembers to run.
 *
 * Requires a seeded database: npm run db:reset
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type AlertType } from "@prisma/client";

import { buildContext, type DetectorContext } from "../src/lib/detectors/context";
import { RULE_DETECTORS, runRuleDetectors, similarity } from "../src/lib/detectors/rules";
import {
  ratioComponent,
  severityFor,
  valueComponent,
  score,
} from "../src/lib/detectors/types";
import type { Finding } from "../src/lib/detectors/types";

const prisma = new PrismaClient();

/** Matches the seed's fixed "today", so ages are stable between runs. */
const NOW = new Date("2026-09-18T00:00:00.000Z");

let ctx: DetectorContext;
let findings: Finding[];
let plantedByType: Map<AlertType, Set<string>>;

beforeAll(async () => {
  ctx = await buildContext(NOW);
  findings = runRuleDetectors(ctx);

  const planted = await prisma.plantedAnomaly.findMany();
  plantedByType = new Map();
  for (const p of planted) {
    const set = plantedByType.get(p.type) ?? new Set<string>();
    set.add(p.workId);
    plantedByType.set(p.type, set);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const RULE_TYPES = RULE_DETECTORS.map((d) => d.type);

describe("similarity", () => {
  it("is 1 for identical strings and 0 for unrelated ones", () => {
    expect(similarity("Nehru Nagar", "Nehru Nagar")).toBe(1);
    expect(similarity("Nehru Nagar", "Tagore Para")).toBeLessThan(0.2);
  });

  it("is insensitive to case and punctuation", () => {
    expect(similarity("Ward No. 17", "ward no 17")).toBeGreaterThan(0.95);
  });

  it("separates different wards, which a title-based match would not", () => {
    // The bug this replaced: comparing whole titles scored these at 91%,
    // because the work type and district dominate the trigram set.
    expect(similarity("Ward No. 17", "Ward No. 4")).toBeLessThan(0.82);
    expect(
      similarity(
        "Covered Drainage Line at Ward No. 17, Surat",
        "Covered Drainage Line at Ward No. 4, Surat",
      ),
    ).toBeGreaterThan(0.82);
  });

  it("is symmetric", () => {
    expect(similarity("Shastri Nagar", "Shastri Nagar Extension")).toBeCloseTo(
      similarity("Shastri Nagar Extension", "Shastri Nagar"),
      10,
    );
  });
});

describe("scoring", () => {
  it("weights components and clamps to 0-100", () => {
    expect(
      score([
        { label: "a", weight: 0.5, value: 100, basis: "" },
        { label: "b", weight: 0.5, value: 0, basis: "" },
      ]),
    ).toBe(50);
  });

  it("scales value logarithmically, so a big work does not swamp the queue", () => {
    const small = valueComponent(500_000); // ₹5 lakh
    const medium = valueComponent(5_000_000); // ₹50 lakh
    const large = valueComponent(50_000_000); // ₹5 crore
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
    // A 100x larger work scores higher, but nothing like 100x higher.
    expect(large / Math.max(small, 1)).toBeLessThan(4);
  });

  it("saturates ratios rather than running past 100", () => {
    expect(ratioComponent(400, 365)).toBe(100);
    expect(ratioComponent(-5, 365)).toBe(0);
  });

  it("bands severity at the documented boundaries", () => {
    expect(severityFor(80)).toBe("CRITICAL");
    expect(severityFor(79)).toBe("HIGH");
    expect(severityFor(60)).toBe("HIGH");
    expect(severityFor(40)).toBe("MEDIUM");
    expect(severityFor(20)).toBe("LOW");
    expect(severityFor(0)).toBe("INFO");
  });
});

describe("every finding is reviewable", () => {
  it("carries a reason, a rule, figures, and a complete score breakdown", () => {
    expect(findings.length).toBeGreaterThan(0);

    for (const f of findings) {
      expect(f.reason.length, `${f.type} reason too short`).toBeGreaterThan(40);
      expect(f.evidence.rule.length).toBeGreaterThan(20);
      expect(f.evidence.facts.length).toBeGreaterThan(0);
      expect(f.evidence.scoring.length).toBeGreaterThan(0);

      // Weights must sum to 1, or the score is not on the scale it claims.
      const weight = f.evidence.scoring.reduce((s, c) => s + c.weight, 0);
      expect(weight, `${f.type} weights sum to ${weight}`).toBeCloseTo(1, 5);

      // Every component must explain itself.
      for (const c of f.evidence.scoring) {
        expect(c.basis.length, `${f.type}/${c.label} has no basis`).toBeGreaterThan(0);
      }

      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
      expect(f.severity).toBe(severityFor(f.score));
    }
  });

  it("never reports the same rule twice for one work", () => {
    const seen = new Set<string>();
    for (const f of findings) {
      const key = `${f.workId}|${f.type}`;
      expect(seen.has(key), `duplicate finding: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("uses no verdict language — these are prompts for review", () => {
    const forbidden = /\bfraud\b|\bfraudulent\b|\bcorrupt\b|\bguilty\b|\bembezzl/i;
    for (const f of findings) {
      expect(forbidden.test(f.reason), `verdict language in ${f.type}`).toBe(false);
    }
  });
});

describe("recall — every planted anomaly is caught", () => {
  for (const type of RULE_TYPES) {
    it(`catches every planted ${type}`, () => {
      const planted = plantedByType.get(type) ?? new Set<string>();
      if (planted.size === 0) return;

      const caught = new Set(
        findings.filter((f) => f.type === type).map((f) => f.workId),
      );

      // ENTITLEMENT_BREACH concerns an MP's financial year, not one work; the
      // engine tags the recommendation that crossed the limit while the seed
      // tags the one it inflated. Matching by work id would score a labelling
      // difference as a miss, so this rule is checked by count.
      if (type === "ENTITLEMENT_BREACH") {
        expect(caught.size).toBe(planted.size);
        return;
      }

      const missed = [...planted].filter((id) => !caught.has(id));
      expect(missed, `${type}: ${missed.length} planted anomalies missed`).toEqual([]);
    });
  }
});

describe("precision — nothing unlabelled is flagged", () => {
  it("fires only on works planted for that rule", async () => {
    const works = new Map(ctx.works.map((w) => [w.id, w]));
    const unexpected: string[] = [];

    for (const f of findings) {
      if (f.type === "ENTITLEMENT_BREACH") continue; // see above
      const planted = plantedByType.get(f.type) ?? new Set<string>();
      if (!planted.has(f.workId)) {
        unexpected.push(`${f.type} on ${works.get(f.workId)?.workCode ?? f.workId}`);
      }
    }

    expect(unexpected, `unexpected findings:\n${unexpected.join("\n")}`).toEqual([]);
  });
});

describe("the engine is deterministic", () => {
  it("produces identical findings on a second pass over the same snapshot", () => {
    const again = runRuleDetectors(ctx);
    const fingerprint = (fs: Finding[]) =>
      fs
        .map((f) => `${f.workId}|${f.type}|${f.score}`)
        .sort()
        .join("\n");
    expect(fingerprint(again)).toBe(fingerprint(findings));
  });
});
