/**
 * The dashboard query layer, tested for the one property that matters: every
 * function respects the scope it is given.
 *
 * Phase 4 added around twenty new aggregate queries, several of them raw SQL
 * that resolves the scope to a list of ids. Raw SQL is exactly where a
 * jurisdiction filter goes missing quietly — Prisma will not catch it, the page
 * will render, and a district officer will simply see national figures. So each
 * one is checked against the same question: does narrowing the scope narrow the
 * answer, and does an empty scope return nothing?
 *
 * Requires a seeded database with detectors run:
 *   npm run db:reset && npm run detect
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Role } from "@prisma/client";

import {
  agencyBreakdown,
  alertsByType,
  districtBreakdown,
  entitlementByYear,
  monthlyPipeline,
  monthlySpend,
  overdueWorks,
  schemeKpis,
  stateBreakdown,
  topAlerts,
  worksByCategory,
  worksByStage,
} from "../src/lib/dashboard";
import { scopeFor, type ScopedUser } from "../src/lib/scope";

const prisma = new PrismaClient();

let ministry: ScopedUser;
let sna: ScopedUser;
let district: ScopedUser;
let mp: ScopedUser;
/** A user whose jurisdiction anchor is missing — scopeFor denies everything. */
const anchorless: ScopedUser = {
  role: "SNA" as Role,
  stateId: null,
  districtId: null,
  mpId: null,
  iaId: null,
};

async function userByEmail(email: string): Promise<ScopedUser> {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`Seed user ${email} missing — run: npm run db:reset`);
  return {
    role: u.role,
    stateId: u.stateId,
    districtId: u.districtId,
    mpId: u.mpId,
    iaId: u.iaId,
  };
}

beforeAll(async () => {
  [ministry, sna, district, mp] = await Promise.all([
    userByEmail("ministry@mospi.demo"),
    userByEmail("sna.gj@demo.gov"),
    userByEmail("district.gj-ahd@demo.gov"),
    userByEmail("mp.gj@demo.gov"),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("headline figures narrow with the scope", () => {
  it("counts fewer works at each level down", async () => {
    const [n, s, d] = await Promise.all([
      schemeKpis(scopeFor(ministry)),
      schemeKpis(scopeFor(sna)),
      schemeKpis(scopeFor(district)),
    ]);

    expect(n.works).toBeGreaterThan(s.works);
    expect(s.works).toBeGreaterThan(d.works);
    expect(n.districts).toBeGreaterThan(s.districts);
    expect(d.districts).toBe(1);
  });

  it("sums less money at each level down", async () => {
    const [n, s, d] = await Promise.all([
      schemeKpis(scopeFor(ministry)),
      schemeKpis(scopeFor(sna)),
      schemeKpis(scopeFor(district)),
    ]);
    expect(n.sanctioned).toBeGreaterThan(s.sanctioned);
    expect(s.sanctioned).toBeGreaterThan(d.sanctioned);
    expect(n.released).toBeGreaterThan(s.released);
  });

  it("returns zero throughout for a user with no jurisdiction", async () => {
    const k = await schemeKpis(scopeFor(anchorless));
    expect(k.works).toBe(0);
    expect(k.districts).toBe(0);
    expect(k.sanctioned).toBe(0);
    expect(k.released).toBe(0);
    expect(k.openAlerts).toBe(0);
    expect(k.criticalAlerts).toBe(0);
    expect(k.overdue).toBe(0);
  });
});

describe("the raw-SQL aggregates carry the scope too", () => {
  it("counts fewer works per month for a district than nationally", async () => {
    const [n, d] = await Promise.all([
      monthlyPipeline(scopeFor(ministry)),
      monthlyPipeline(scopeFor(district)),
    ]);
    const total = (rows: { recommended: number }[]) =>
      rows.reduce((s, r) => s + r.recommended, 0);
    expect(total(n)).toBeGreaterThan(total(d));
    expect(d.length).toBeGreaterThan(0);
  });

  it("sums less spend for a state than nationally", async () => {
    const [n, s] = await Promise.all([
      monthlySpend(scopeFor(ministry)),
      monthlySpend(scopeFor(sna)),
    ]);
    const total = (rows: { released: number }[]) =>
      rows.reduce((a, r) => a + r.released, 0);
    expect(total(n)).toBeGreaterThan(total(s));
    expect(total(s)).toBeGreaterThan(0);
  });

  it("returns nothing at all for a denied scope", async () => {
    expect(await monthlyPipeline(scopeFor(anchorless))).toEqual([]);
    expect(await monthlySpend(scopeFor(anchorless))).toEqual([]);
  });
});

describe("breakdowns only contain rows inside the scope", () => {
  it("gives an SNA their own state's districts and no others", async () => {
    const gujarat = await prisma.state.findUniqueOrThrow({
      where: { name: "Gujarat" },
    });
    const rows = await districtBreakdown(scopeFor(sna));
    expect(rows.length).toBeGreaterThan(0);

    const ids = rows.map((r) => r.id);
    const outside = await prisma.district.count({
      where: { id: { in: ids }, stateId: { not: gujarat.id } },
    });
    expect(outside).toBe(0);
  });

  it("gives a district officer only their own district", async () => {
    const rows = await districtBreakdown(scopeFor(district));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(district.districtId);
  });

  it("gives the Ministry every state, an SNA exactly one", async () => {
    const stateCount = await prisma.state.count();
    expect(await stateBreakdown(scopeFor(ministry))).toHaveLength(stateCount);
    expect(await stateBreakdown(scopeFor(sna))).toHaveLength(1);
  });

  it("gives a district officer only agencies in their district", async () => {
    const rows = await agencyBreakdown(scopeFor(district));
    expect(rows.length).toBeGreaterThan(0);
    const outside = await prisma.implementingAgency.count({
      where: {
        id: { in: rows.map((r) => r.id) },
        districtId: { not: district.districtId! },
      },
    });
    expect(outside).toBe(0);
  });

  it("returns empty breakdowns for a denied scope", async () => {
    expect(await districtBreakdown(scopeFor(anchorless))).toEqual([]);
    expect(await stateBreakdown(scopeFor(anchorless))).toEqual([]);
    expect(await agencyBreakdown(scopeFor(anchorless))).toEqual([]);
  });
});

describe("lists never reach outside the scope", () => {
  it("shows a district officer only their own district's alerts", async () => {
    const alerts = await topAlerts(scopeFor(district), 50);
    for (const a of alerts) {
      expect(a.work.districtId).toBe(district.districtId);
    }
  });

  it("shows an MP only works they recommended", async () => {
    const overdue = await overdueWorks(scopeFor(mp), 50);
    for (const w of overdue) expect(w.mpId).toBe(mp.mpId);
  });

  it("returns nothing for a denied scope", async () => {
    expect(await topAlerts(scopeFor(anchorless), 10)).toEqual([]);
    expect(await overdueWorks(scopeFor(anchorless), 10)).toEqual([]);
    expect(await alertsByType(scopeFor(anchorless))).toEqual([]);
    expect(await worksByCategory(scopeFor(anchorless))).toEqual([]);
  });
});

describe("an MP's entitlement position", () => {
  it("reports one row per financial year, with recommendations inside it", async () => {
    const years = await entitlementByYear(scopeFor(mp), mp.mpId!);
    expect(years.length).toBeGreaterThan(0);

    for (const y of years) {
      expect(y.authorised).toBeGreaterThan(0);
      // Sanctioned cannot exceed what was recommended, and paid cannot exceed
      // what was sanctioned — if it does, the figures are being summed across
      // the wrong set of works.
      expect(y.sanctioned).toBeLessThanOrEqual(y.recommended * 1.01);
      expect(y.completed).toBeLessThanOrEqual(y.works);
    }
  });

  it("cannot be read for another Member through an MP's scope", async () => {
    const other = await prisma.mP.findFirstOrThrow({
      where: { id: { not: mp.mpId! } },
    });
    const years = await entitlementByYear(scopeFor(mp), other.id);
    // The entitlement rows exist, but every figure drawn through the scope is
    // zero: the works belong to someone else.
    for (const y of years) {
      expect(y.recommended).toBe(0);
      expect(y.sanctioned).toBe(0);
      expect(y.spent).toBe(0);
      expect(y.works).toBe(0);
    }
  });
});

describe("stage breakdown", () => {
  it("lists stages in lifecycle order and totals to the work count", async () => {
    const stages = await worksByStage(scopeFor(sna));
    expect(stages.map((s) => s.status)).toEqual([
      "RECOMMENDED",
      "SANCTIONED",
      "IN_PROGRESS",
      "COMPLETED_UNMARKED",
      "COMPLETED",
      "CANCELLED",
    ]);

    const kpis = await schemeKpis(scopeFor(sna));
    expect(stages.reduce((s, r) => s + r.count, 0)).toBe(kpis.works);
  });

  it("is all zeroes for a denied scope, not an error", async () => {
    const stages = await worksByStage(scopeFor(anchorless));
    expect(stages.every((s) => s.count === 0)).toBe(true);
  });
});
