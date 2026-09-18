/**
 * RBAC isolation, proved against the real database.
 *
 * The claim under test is not "the UI hides other districts" — it is that
 * scopeFor() produces a WHERE fragment that makes cross-jurisdiction data
 * unreachable at the query layer, and that a user with no jurisdiction sees
 * nothing rather than everything.
 *
 * Requires a seeded database: npm run db:reset
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Role } from "@prisma/client";

import { scopeFor, scoped, type ScopedUser } from "../src/lib/scope";

const prisma = new PrismaClient();

type Fixture = {
  ministry: ScopedUser;
  snaGujarat: ScopedUser;
  snaMaharashtra: ScopedUser;
  districtAhmedabad: ScopedUser;
  mpGujarat: ScopedUser;
  iaAhmedabad: ScopedUser;
  gujaratId: string;
  maharashtraId: string;
  ahmedabadId: string;
  puneId: string;
};

let f: Fixture;

async function userByEmail(email: string): Promise<ScopedUser & { role: Role }> {
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
  const [gujarat, maharashtra] = await Promise.all([
    prisma.state.findUniqueOrThrow({ where: { name: "Gujarat" } }),
    prisma.state.findUniqueOrThrow({ where: { name: "Maharashtra" } }),
  ]);
  const [ahmedabad, pune] = await Promise.all([
    prisma.district.findUniqueOrThrow({ where: { code: "GJ-AHD" } }),
    prisma.district.findUniqueOrThrow({ where: { code: "MH-PUN" } }),
  ]);

  f = {
    ministry: await userByEmail("ministry@mospi.demo"),
    snaGujarat: await userByEmail("sna.gj@demo.gov"),
    snaMaharashtra: await userByEmail("sna.mh@demo.gov"),
    districtAhmedabad: await userByEmail("district.gj-ahd@demo.gov"),
    mpGujarat: await userByEmail("mp.gj@demo.gov"),
    iaAhmedabad: await userByEmail("ia.gj-ahd@demo.gov"),
    gujaratId: gujarat.id,
    maharashtraId: maharashtra.id,
    ahmedabadId: ahmedabad.id,
    puneId: pune.id,
  };
});

afterAll(async () => {
  await prisma.$disconnect();
});

// `scoped()` ANDs the filters onto the jurisdiction fragment. A plain spread
// would let a colliding key (districtId, mpId, iaId) overwrite the scope — the
// exact mistake these tests exist to catch.
const countWorks = (user: ScopedUser, extra: object = {}) =>
  prisma.work.count({ where: scoped(scopeFor(user).work, extra) });

describe("scopeFor — jurisdiction isolation", () => {
  it("Ministry sees works in every state", async () => {
    const total = await prisma.work.count();
    expect(await countWorks(f.ministry)).toBe(total);
    expect(total).toBeGreaterThan(100);
  });

  it("a State Nodal Authority sees its own state and no other", async () => {
    const gjWorks = await countWorks(f.snaGujarat);
    expect(gjWorks).toBeGreaterThan(0);

    // Not a single Maharashtra work leaks into the Gujarat SNA's scope.
    const leaked = await countWorks(f.snaGujarat, {
      district: { stateId: f.maharashtraId },
    });
    expect(leaked).toBe(0);

    // And the two states do not overlap.
    const mhWorks = await countWorks(f.snaMaharashtra);
    expect(mhWorks).toBeGreaterThan(0);
    const total = await prisma.work.count();
    expect(gjWorks + mhWorks).toBeLessThan(total);
  });

  it("a District Authority sees only its own district", async () => {
    const mine = await countWorks(f.districtAhmedabad);
    expect(mine).toBeGreaterThan(0);

    const outside = await countWorks(f.districtAhmedabad, {
      districtId: { not: f.ahmedabadId },
    });
    expect(outside).toBe(0);

    // Explicitly asking for another district returns nothing.
    const pune = await countWorks(f.districtAhmedabad, { districtId: f.puneId });
    expect(pune).toBe(0);
  });

  it("an MP sees only the works they recommended", async () => {
    const mine = await countWorks(f.mpGujarat);
    expect(mine).toBeGreaterThan(0);

    const others = await countWorks(f.mpGujarat, {
      mpId: { not: f.mpGujarat.mpId! },
    });
    expect(others).toBe(0);

    // Not even other works in their own district.
    const sameDistrictOtherMp = await prisma.work.count({
      where: scoped(scopeFor(f.mpGujarat).work, {
        mpId: { not: f.mpGujarat.mpId! },
        districtId: f.ahmedabadId,
      }),
    });
    expect(sameDistrictOtherMp).toBe(0);
  });

  it("an Implementing Agency sees only works assigned to it", async () => {
    const mine = await countWorks(f.iaAhmedabad);
    const outside = await countWorks(f.iaAhmedabad, {
      iaId: { not: f.iaAhmedabad.iaId! },
    });
    expect(outside).toBe(0);
    expect(mine).toBeGreaterThan(0);
  });
});

describe("scopeFor — drill-down cannot cross a jurisdiction", () => {
  it("a district user fetching another district's work gets nothing, not a refusal", async () => {
    const foreign = await prisma.work.findFirstOrThrow({
      where: { districtId: f.puneId },
    });

    // The same query the work-detail page runs.
    const found = await prisma.work.findFirst({
      where: scoped(scopeFor(f.districtAhmedabad).work, { id: foreign.id }),
    });

    expect(found).toBeNull();

    // Sanity: the record does exist, and the Ministry can reach it — so the
    // null above is the scope filter working, not a bad id.
    const asMinistry = await prisma.work.findFirst({
      where: scoped(scopeFor(f.ministry).work, { id: foreign.id }),
    });
    expect(asMinistry?.id).toBe(foreign.id);
  });

  it("an MP cannot reach a work recommended by another MP", async () => {
    const foreign = await prisma.work.findFirstOrThrow({
      where: { mpId: { not: f.mpGujarat.mpId! } },
    });
    const found = await prisma.work.findFirst({
      where: scoped(scopeFor(f.mpGujarat).work, { id: foreign.id }),
    });
    expect(found).toBeNull();
  });
});

describe("scopeFor — failure mode is deny, not allow", () => {
  const anchorless: Record<string, ScopedUser> = {
    "SNA without a state": { role: "SNA", stateId: null, districtId: null, mpId: null, iaId: null },
    "District without a district": { role: "DISTRICT", stateId: "x", districtId: null, mpId: null, iaId: null },
    "MP without a constituency": { role: "MP", stateId: "x", districtId: null, mpId: null, iaId: null },
    "IA without an agency": { role: "IA", stateId: "x", districtId: "y", mpId: null, iaId: null },
  };

  for (const [label, user] of Object.entries(anchorless)) {
    it(`${label} sees nothing`, async () => {
      expect(await countWorks(user)).toBe(0);
      expect(await prisma.alert.count({ where: scopeFor(user).alert })).toBe(0);
      expect(await prisma.district.count({ where: scopeFor(user).district })).toBe(0);
      expect(await prisma.payment.count({ where: scopeFor(user).payment })).toBe(0);
    });
  }

  it("an unknown role sees nothing", async () => {
    const rogue = {
      role: "SUPERUSER" as Role,
      stateId: null,
      districtId: null,
      mpId: null,
      iaId: null,
    };
    expect(await countWorks(rogue)).toBe(0);
  });
});

describe("scopeFor — every scheme entity is covered", () => {
  it("returns a fragment for each entity a dashboard queries", () => {
    const scope = scopeFor(f.districtAhmedabad);
    for (const key of ["work", "alert", "district", "state", "mp", "agency", "payment"] as const) {
      expect(scope[key], `missing scope fragment: ${key}`).toBeDefined();
    }
  });
});
