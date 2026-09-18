/**
 * SatarkAI seed — a SYNTHETIC MPLADS dataset faithful to the real eSAKSHI
 * workflow, with anomalies deliberately planted and recorded as ground truth.
 *
 *   entitlement -> MP recommends & earmarks -> District Authority sanctions
 *   -> IA executes -> staged vendor payments + asset photos -> IA marks complete
 *
 * Two-pass construction:
 *   1. A CLEAN baseline. Every work is generated so that no detector should
 *      fire on it — completed within the 1-year window, payments within the
 *      sanctioned amount and behind progress, evidence complete at every
 *      stage, recommendations inside the entitlement, sanctions away from the
 *      financial-year boundary.
 *   2. Planted anomalies. Selected works are mutated to violate exactly one
 *      rule, and the violation is written to PlantedAnomaly as ground truth so
 *      Phase 3's eval script can measure precision and recall honestly.
 *
 * A dirty baseline would make those numbers meaningless, so pass 1 is
 * deliberately conservative.
 *
 * Run: npm run db:seed
 */

import { PrismaClient, type AlertType, type WorkStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  AGENCY_TEMPLATES,
  ANNUAL_ENTITLEMENT,
  CONSTITUENCIES,
  FICTIONAL_FIRST_NAMES,
  FICTIONAL_SURNAMES,
  FICTIONAL_VENDORS,
  GEOGRAPHY,
  LOCALITIES,
  WORK_TYPES,
} from "./seed-reference";

const prisma = new PrismaClient();

// --- deterministic randomness -------------------------------------------------
// A fixed seed means every run produces the same dataset, so a demo, a test and
// a screenshot all describe the same works.

let rngState = 0x9e3779b9;

function rnd(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
const round = (n: number, to = 1000) => Math.round(n / to) * to;

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DAY);

/** "Today" for the dataset. Fixed so seeded ages never drift between runs. */
const NOW = new Date("2026-09-18T00:00:00.000Z");

const FYS = ["2023-24", "2024-25", "2025-26", "2026-27"] as const;
const fyStart = (fy: string) => new Date(Date.UTC(Number(fy.slice(0, 4)), 3, 1));
const fyEnd = (fy: string) => new Date(Date.UTC(Number(fy.slice(0, 4)) + 1, 2, 31));

// --- in-memory work shape before it reaches the database ----------------------

type SeedPayment = {
  stageNo: number;
  amount: number;
  releasedAt: Date;
  vendorName: string;
  voucherRef: string;
  /** Evidence attached to this payment stage. Empty = missing evidence. */
  evidence: { kind: "PHOTO" | "DOC"; uploadedAt: Date }[];
};

type SeedWork = {
  workCode: string;
  mpIndex: number;
  districtCode: string;
  agencyIndex: number | null;
  title: string;
  description: string;
  workType: string;
  category: string;
  locality: string;
  recommendedAt: Date;
  recommendedAmount: number;
  financialYear: string;
  sanctionedAt: Date | null;
  sanctionedAmount: number | null;
  status: WorkStatus;
  progressPct: number;
  completedAt: Date | null;
  markedCompleteAt: Date | null;
  unitCount: number;
  lat: number;
  lng: number;
  payments: SeedPayment[];
  planted: { type: AlertType; note: string }[];
};

async function main() {
  console.log("SatarkAI seed — generating synthetic MPLADS dataset\n");

  // Wipe in dependency order. This seed owns the database; it is not additive.
  await prisma.$transaction([
    prisma.alertAction.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.plantedAnomaly.deleteMany(),
    prisma.evidence.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.work.deleteMany(),
    prisma.entitlement.deleteMany(),
    prisma.implementingAgency.deleteMany(),
    prisma.mP.deleteMany(),
    prisma.district.deleteMany(),
    prisma.state.deleteMany(),
    prisma.dataSource.deleteMany(),
  ]);

  // -- provenance ------------------------------------------------------------
  await prisma.dataSource.create({
    data: {
      name: "SatarkAI synthetic MPLADS dataset",
      sourceUrl: "https://mplads.mospi.gov.in/digigov/dashboard.html",
      kind: "SYNTHETIC",
      fetchedAt: NOW,
      note: "Generated locally. Structure mirrors the eSAKSHI MPLADS workflow; every figure, person, agency and vendor is invented. No real MPLADS record is reproduced here. Real state, district and constituency names are used for geographic realism only.",
      coverageFrom: new Date("2023-04-01T00:00:00.000Z"),
      coverageNote:
        "eSAKSHI holds MPLADS data from 1 April 2023 onward. FY 2019-20 to 2022-23 of the 17th Lok Sabha is not on the portal, and Rajya Sabha details are unavailable before FY 2023-24. This dataset mirrors that coverage window and does not fabricate earlier history.",
    },
  });

  // -- geography -------------------------------------------------------------
  const stateIds = new Map<string, string>();
  const districtIds = new Map<string, string>();
  const districtsByState = new Map<string, { code: string; name: string }[]>();

  for (const g of GEOGRAPHY) {
    const state = await prisma.state.create({
      data: { name: g.state, code: g.code },
    });
    stateIds.set(g.code, state.id);
    districtsByState.set(g.code, g.districts);

    for (const d of g.districts) {
      const district = await prisma.district.create({
        data: { stateId: state.id, name: d.name, code: d.code },
      });
      districtIds.set(d.code, district.id);
    }
  }
  console.log(`  states: ${stateIds.size}   districts: ${districtIds.size}`);

  // -- implementing agencies (3 per district) --------------------------------
  const agencies: { id: string; name: string; districtCode: string }[] = [];
  for (const g of GEOGRAPHY) {
    for (const d of g.districts) {
      for (let i = 0; i < 3; i++) {
        const t = AGENCY_TEMPLATES[(i * 2 + d.name.length) % AGENCY_TEMPLATES.length];
        const created = await prisma.implementingAgency.create({
          data: {
            name: `${d.name} ${t.suffix}`,
            districtId: districtIds.get(d.code)!,
            type: t.type,
          },
        });
        agencies.push({ id: created.id, name: created.name, districtCode: d.code });
      }
    }
  }
  console.log(`  implementing agencies: ${agencies.length}`);

  // -- Members of Parliament (fictional names, real constituencies) -----------
  const mps: {
    id: string;
    name: string;
    stateCode: string;
    house: "LS" | "RS";
    constituency: string;
    /** For a Lok Sabha member, the district their constituency sits in. */
    homeDistrictCode: string | null;
  }[] = [];

  let nameCursor = 0;
  for (const g of GEOGRAPHY) {
    const seats = CONSTITUENCIES[g.code];
    for (let i = 0; i < seats.length; i++) {
      // Last seat per state is a Rajya Sabha member, whose "constituency" is the state.
      const house = i === seats.length - 1 ? "RS" : "LS";
      const first = FICTIONAL_FIRST_NAMES[nameCursor % FICTIONAL_FIRST_NAMES.length];
      const last = FICTIONAL_SURNAMES[(nameCursor * 7 + 3) % FICTIONAL_SURNAMES.length];
      nameCursor++;

      const created = await prisma.mP.create({
        data: {
          name: `${first} ${last}`,
          house,
          constituency: house === "RS" ? `${g.state} (Rajya Sabha)` : seats[i],
          stateId: stateIds.get(g.code)!,
          termStart: new Date("2024-06-24T00:00:00.000Z"),
        },
      });
      mps.push({
        id: created.id,
        name: created.name,
        stateCode: g.code,
        house,
        constituency: created.constituency,
        homeDistrictCode: house === "LS" ? g.districts[i].code : null,
      });
    }
  }
  console.log(`  members of parliament: ${mps.length} (fictional names)`);

  // -- entitlements ----------------------------------------------------------
  for (const mp of mps) {
    for (const fy of FYS) {
      // Rajya Sabha figures are unavailable before FY 2023-24; we simply do not
      // create rows we could not honestly claim to have.
      const released =
        fy === "2026-27" ? ANNUAL_ENTITLEMENT / 2 : ANNUAL_ENTITLEMENT;
      await prisma.entitlement.create({
        data: {
          mpId: mp.id,
          financialYear: fy,
          amountAuthorised: ANNUAL_ENTITLEMENT,
          releasedAmount: released,
        },
      });
    }
  }
  console.log(`  entitlements: ${mps.length * FYS.length}`);

  // ==========================================================================
  // PASS 1 — clean baseline
  // ==========================================================================

  const works: SeedWork[] = [];
  let codeSeq = 1;

  for (let mpIndex = 0; mpIndex < mps.length; mpIndex++) {
    const mp = mps[mpIndex];
    const stateDistricts = districtsByState.get(mp.stateCode)!;

    for (const fy of FYS) {
      // Keep the FY total comfortably inside the ₹5 Cr entitlement so that a
      // breach only ever appears where we plant one.
      // Headroom below the ₹5 Cr entitlement, so that duplicate clones planted
      // in pass 2 do not accidentally push a year over the limit.
      const budget = ANNUAL_ENTITLEMENT * 0.7;
      let spent = 0;
      const target = fy === "2026-27" ? int(3, 6) : int(8, 13);

      for (let n = 0; n < target; n++) {
        const wt = pick(WORK_TYPES);
        const units = wt.multiUnit ? int(1, 4) : 1;
        const perUnit = round(int(wt.min, wt.max), 5000);
        const amount = perUnit * units;
        if (spent + amount > budget) break;
        spent += amount;

        // Where a Member may recommend a work:
        //   Lok Sabha  — within their own constituency. MPLADS additionally
        //                permits a limited value of works elsewhere in the
        //                state, modelled here as a small minority.
        //   Rajya Sabha — anywhere in the state from which they were elected.
        const district =
          mp.homeDistrictCode && !chance(0.15)
            ? stateDistricts.find((d) => d.code === mp.homeDistrictCode)!
            : pick(stateDistricts);
        // One work type per locality per district, at most. Without this the
        // generator produces genuinely identical titles by chance — two
        // "Borewell with Handpump at Ward No. 4, Surat" works that a duplicate
        // detector is right to flag. Those would be indistinguishable from the
        // duplicates planted on purpose, and would wreck the ground truth.
        const locality = uniqueLocality(district.code, wt.type);
        if (!locality) continue;

        // Recommendation date: inside the FY, and clear of the last 40 days so
        // the baseline never trips FY-end clustering.
        const start = fyStart(fy);
        const end = fyEnd(fy);
        const span = Math.max(1, daysBetween(start, end) - 40);
        const recommendedAt = addDays(start, int(5, span));
        if (recommendedAt > NOW) continue;

        const work: SeedWork = {
          workCode: `MPLADS/${mp.stateCode}/${fy.replace("-", "")}/${String(codeSeq++).padStart(5, "0")}`,
          mpIndex,
          districtCode: district.code,
          agencyIndex: null,
          title: `${wt.type}${units > 1 ? ` (${units} ${wt.unit}s)` : ""} at ${locality}, ${district.name}`,
          description: `Construction/provision of ${wt.type.toLowerCase()} at ${locality} in ${district.name} district, recommended under MPLADS for creation of a durable community asset.`,
          workType: wt.type,
          category: wt.category,
          locality,
          recommendedAt,
          recommendedAmount: amount,
          financialYear: fy,
          sanctionedAt: null,
          sanctionedAmount: null,
          status: "RECOMMENDED",
          progressPct: 0,
          completedAt: null,
          markedCompleteAt: null,
          unitCount: units,
          lat: 0,
          lng: 0,
          payments: [],
          planted: [],
        };

        advanceLifecycle(work, agencies, district.code);
        works.push(work);
      }
    }
  }

  console.log(`\n  baseline works generated: ${works.length}`);

  // ==========================================================================
  // PASS 2 — plant anomalies, one rule per work, recorded as ground truth
  // ==========================================================================

  const planted = plantAnomalies(works, mps, agencies);
  normalisePaymentDates(works);
  const trimmed = reconcileEntitlements(works);
  if (trimmed > 0) {
    console.log(`  entitlement reconciliation: trimmed ${trimmed} unlabelled work(s)`);
  }
  console.log("  planted anomalies:");
  for (const [type, count] of Object.entries(planted).sort()) {
    console.log(`    ${type.padEnd(20)} ${count}`);
  }

  // ==========================================================================
  // Persist
  // ==========================================================================

  let workCount = 0;
  let paymentCount = 0;
  let evidenceCount = 0;
  let plantedRows = 0;

  for (const w of works) {
    const created = await prisma.work.create({
      data: {
        workCode: w.workCode,
        mpId: mps[w.mpIndex].id,
        districtId: districtIds.get(w.districtCode)!,
        iaId: w.agencyIndex === null ? null : agencies[w.agencyIndex].id,
        title: w.title,
        description: w.description,
        workType: w.workType,
        category: w.category,
        locality: w.locality,
        recommendedAt: w.recommendedAt,
        recommendedAmount: w.recommendedAmount,
        financialYear: w.financialYear,
        sanctionedAt: w.sanctionedAt,
        sanctionedAmount: w.sanctionedAmount,
        expectedCompletionAt: w.sanctionedAt ? addDays(w.sanctionedAt, 365) : null,
        status: w.status,
        progressPct: w.progressPct,
        completedAt: w.completedAt,
        markedCompleteAt: w.markedCompleteAt,
        unitCount: w.unitCount,
        lat: w.lat || null,
        lng: w.lng || null,
      },
    });
    workCount++;

    for (const p of w.payments) {
      const payment = await prisma.payment.create({
        data: {
          workId: created.id,
          stageNo: p.stageNo,
          amount: p.amount,
          releasedAt: p.releasedAt,
          vendorName: p.vendorName,
          voucherRef: p.voucherRef,
        },
      });
      paymentCount++;

      for (const e of p.evidence) {
        await prisma.evidence.create({
          data: {
            workId: created.id,
            paymentId: payment.id,
            kind: e.kind,
            url: `/evidence/${created.id}/stage-${p.stageNo}-${e.kind.toLowerCase()}.jpg`,
            uploadedAt: e.uploadedAt,
            stageNo: p.stageNo,
          },
        });
        evidenceCount++;
      }
    }

    for (const pa of w.planted) {
      await prisma.plantedAnomaly.create({
        data: { workId: created.id, type: pa.type, note: pa.note },
      });
      plantedRows++;
    }
  }

  console.log(
    `\n  persisted: ${workCount} works, ${paymentCount} payments, ${evidenceCount} evidence files, ${plantedRows} ground-truth labels`,
  );

  // -- users -----------------------------------------------------------------
  const password = process.env.SEED_PASSWORD ?? "satark@2026";
  const passwordHash = await bcrypt.hash(password, 10);

  const accounts: { name: string; email: string; role: any; data: any }[] = [
    {
      name: "Ministry Oversight Desk",
      email: "ministry@mospi.demo",
      role: "MINISTRY",
      data: {},
    },
  ];

  for (const g of GEOGRAPHY) {
    accounts.push({
      name: `${g.state} State Nodal Authority`,
      email: `sna.${g.code.toLowerCase()}@demo.gov`,
      role: "SNA",
      data: { stateId: stateIds.get(g.code)! },
    });
    // One district account per state, on the first district.
    const d = g.districts[0];
    accounts.push({
      name: `${d.name} District Authority`,
      email: `district.${d.code.toLowerCase()}@demo.gov`,
      role: "DISTRICT",
      data: { districtId: districtIds.get(d.code)! },
    });
  }

  // One MP login per state (the first Lok Sabha seat) and two IA logins.
  for (const g of GEOGRAPHY) {
    const mp = mps.find((m) => m.stateCode === g.code && m.house === "LS")!;
    accounts.push({
      name: mp.name,
      email: `mp.${g.code.toLowerCase()}@demo.gov`,
      role: "MP",
      data: { mpId: mp.id, stateId: stateIds.get(g.code)! },
    });
  }
  // Two IA logins, in different districts so the emails stay distinct.
  const iaSeats = [
    agencies.find((a) => a.districtCode === "GJ-AHD")!,
    agencies.find((a) => a.districtCode === "UP-GKP")!,
  ];
  for (const a of iaSeats) {
    accounts.push({
      name: a.name,
      email: `ia.${a.districtCode.toLowerCase()}@demo.gov`,
      role: "IA",
      data: { iaId: a.id, districtId: districtIds.get(a.districtCode)! },
    });
  }

  for (const acc of accounts) {
    await prisma.user.create({
      data: {
        name: acc.name,
        email: acc.email,
        passwordHash,
        role: acc.role,
        ...acc.data,
      },
    });
  }
  console.log(`  users: ${accounts.length} (password from SEED_PASSWORD)`);

  console.log("\nSeed complete.\n");
}

// ---------------------------------------------------------------------------
// Lifecycle: recommendation -> sanction -> payments+evidence -> completion
// ---------------------------------------------------------------------------

function advanceLifecycle(
  w: SeedWork,
  agencies: { id: string; name: string; districtCode: string }[],
  districtCode: string,
) {
  // ~12% of recommendations never reach sanction (feasibility, funds, withdrawal).
  if (chance(0.12)) {
    if (chance(0.25)) w.status = "CANCELLED";
    return;
  }

  // District Authority sanctions after feasibility checks.
  const sanctionLag = int(25, 110);
  const sanctionedAt = addDays(w.recommendedAt, sanctionLag);
  if (sanctionedAt > NOW) return; // still awaiting sanction

  // Keep the baseline clear of the last 40 days of the FY so FY-end clustering
  // only appears where planted.
  const fyClose = fyEnd(w.financialYear);
  if (daysBetween(sanctionedAt, fyClose) < 40 && daysBetween(sanctionedAt, fyClose) >= 0) {
    sanctionedAt.setTime(addDays(sanctionedAt, -55).getTime());
    if (sanctionedAt <= w.recommendedAt) return;
  }

  w.sanctionedAt = sanctionedAt;
  // Sanctioned amount lands at or just under what was recommended.
  w.sanctionedAmount = round(w.recommendedAmount * (0.92 + rnd() * 0.08), 1000);
  w.status = "SANCTIONED";

  const districtAgencies = agencies
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a.districtCode === districtCode);
  w.agencyIndex = pick(districtAgencies).i;

  const age = daysBetween(sanctionedAt, NOW);
  if (age < 20) return; // sanctioned, work not yet started

  // Progress: baseline works finish inside the 365-day window.
  const durationPlanned = int(120, 330);
  const progress = Math.min(100, Math.round((age / durationPlanned) * 100));
  w.progressPct = progress;
  w.status = progress >= 100 ? "COMPLETED" : "IN_PROGRESS";

  if (w.status === "COMPLETED") {
    w.completedAt = addDays(sanctionedAt, durationPlanned);
    // Baseline: the IA marks completion promptly (days, not months).
    w.markedCompleteAt = addDays(w.completedAt, int(3, 25));
  }

  buildPayments(w, districtAgencies.length ? agencies[w.agencyIndex].name : "IA");
}

function buildPayments(w: SeedWork, _iaName: string) {
  if (!w.sanctionedAt || !w.sanctionedAmount) return;

  const stages = w.sanctionedAmount > 3_000_000 ? int(3, 4) : int(2, 3);
  const vendor = pick(FICTIONAL_VENDORS);

  // Payments run alongside the work, so they end when the work does — not at
  // today's date. Spreading a finished work's stages out to "now" produces a
  // final bill released a year after the asset was handed over, which no
  // reviewer would believe. A short settlement tail after completion is normal.
  const executionEnd = w.completedAt
    ? addDays(w.completedAt, int(5, 45))
    : NOW;
  const durationSoFar = Math.max(
    1,
    daysBetween(w.sanctionedAt, executionEnd < NOW ? executionEnd : NOW),
  );

  // Payments trail progress — the baseline never pays ahead of the work.
  const paidShare = Math.max(0, (w.progressPct / 100) * (0.80 + rnd() * 0.12));
  const totalPaid = round(w.sanctionedAmount * Math.min(paidShare, 0.98), 1000);
  if (totalPaid <= 0) return;

  const releasedStages = Math.max(1, Math.round((w.progressPct / 100) * stages));
  let remaining = totalPaid;

  for (let s = 1; s <= releasedStages; s++) {
    const isLast = s === releasedStages;
    const amount = isLast ? remaining : round(totalPaid / releasedStages, 1000);
    remaining -= amount;
    if (amount <= 0) continue;

    const releasedAt = addDays(
      w.sanctionedAt,
      Math.round((durationSoFar * s) / (releasedStages + 1)) + int(0, 10),
    );

    // Baseline: every payment stage carries its asset photograph and document.
    w.payments.push({
      stageNo: s,
      amount,
      releasedAt,
      vendorName: vendor,
      voucherRef: `VCH/${w.workCode.split("/").pop()}/${s}`,
      evidence: [
        { kind: "PHOTO", uploadedAt: addDays(releasedAt, int(0, 4)) },
        { kind: "DOC", uploadedAt: addDays(releasedAt, int(0, 2)) },
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Planting
// ---------------------------------------------------------------------------

function plantAnomalies(
  works: SeedWork[],
  mps: { id: string; name: string; stateCode: string }[],
  agencies: { id: string; name: string; districtCode: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  const used = new Set<string>();

  const note = (t: AlertType, n: string) => ({ type: t, note: n });
  // Works are generated state by state, so selecting in generation order would
  // pile every planted anomaly into Gujarat and leave the rest of the country
  // suspiciously clean. Shuffle once, deterministically, and draw from that.
  const shuffled = [...works];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const take = (
    predicate: (w: SeedWork) => boolean,
    n: number,
  ): SeedWork[] => {
    const out: SeedWork[] = [];
    for (const w of shuffled) {
      if (out.length >= n) break;
      if (used.has(w.workCode)) continue;
      if (!predicate(w)) continue;
      used.add(w.workCode);
      out.push(w);
    }
    return out;
  };
  const tally = (t: AlertType, n: number) => {
    counts[t] = (counts[t] ?? 0) + n;
  };

  // 1. OVERDUE — sanctioned over a year ago, still not marked complete.
  //    Violates the scheme's one-year completion guideline.
  {
    const chosen = take(
      (w) => !!w.sanctionedAt && daysBetween(w.sanctionedAt, NOW) > 420 && w.status !== "CANCELLED",
      18,
    );
    for (const w of chosen) {
      w.status = "IN_PROGRESS";
      w.progressPct = int(35, 80);
      w.completedAt = null;
      w.markedCompleteAt = null;
      // Pull payments back in line with the reduced progress, so this work
      // tests the delay rule alone and not payment-ahead-of-progress too.
      if (w.sanctionedAmount) {
        redistribute(w, round(w.sanctionedAmount * (w.progressPct / 100) * 0.85, 1000));
      }
      const overdueBy = daysBetween(w.sanctionedAt!, NOW) - 365;
      w.planted.push(
        note("OVERDUE", `Sanctioned ${daysBetween(w.sanctionedAt!, NOW)} days ago; ${overdueBy} days past the one-year completion guideline, still at ${w.progressPct}% progress.`),
      );
    }
    tally("OVERDUE", chosen.length);
  }

  // 2. PAYMENT_AHEAD — money released far beyond recorded physical progress.
  {
    const chosen = take(
      (w) => w.status === "IN_PROGRESS" && w.payments.length >= 2 && !!w.sanctionedAmount,
      16,
    );
    for (const w of chosen) {
      w.progressPct = int(15, 35);
      const target = round(w.sanctionedAmount! * (0.82 + rnd() * 0.12), 1000);
      redistribute(w, target);
      w.planted.push(
        note("PAYMENT_AHEAD", `${Math.round((target / w.sanctionedAmount!) * 100)}% of the sanctioned amount released against ${w.progressPct}% recorded progress.`),
      );
    }
    tally("PAYMENT_AHEAD", chosen.length);
  }

  // 3. COST_OVERRUN — total vendor payments exceed the sanctioned amount.
  {
    const chosen = take((w) => w.payments.length >= 2 && !!w.sanctionedAmount, 15);
    for (const w of chosen) {
      const overrun = 1.12 + rnd() * 0.45;
      const target = round(w.sanctionedAmount! * overrun, 1000);
      redistribute(w, target);
      w.planted.push(
        note("COST_OVERRUN", `Expenditure of ₹${target.toLocaleString("en-IN")} against a sanctioned ₹${w.sanctionedAmount!.toLocaleString("en-IN")} — an overrun of ${Math.round((overrun - 1) * 100)}%.`),
      );
    }
    tally("COST_OVERRUN", chosen.length);
  }

  // 4. ENTITLEMENT_BREACH — one MP's recommendations for a year pushed past
  //    the ₹5 crore annual entitlement. Planted by inflating a few large works.
  {
    const breachMps = [2, 9, 17, 24];
    let n = 0;
    for (const mpIndex of breachMps) {
      const fy = "2025-26";
      // Cancelled recommendations release their earmarked funds, so they do
      // not count towards the year's commitment — and the detector is right to
      // exclude them. Inflating a cancelled work would plant a breach that
      // correctly never fires, and the ground truth would then be wrong.
      const theirs = works.filter(
        (w) =>
          w.mpIndex === mpIndex &&
          w.financialYear === fy &&
          w.status !== "CANCELLED" &&
          !used.has(w.workCode),
      );
      if (theirs.length < 2) continue;
      const total = theirs.reduce((s, w) => s + w.recommendedAmount, 0);
      const excess = ANNUAL_ENTITLEMENT * 1.14 - total;
      if (excess <= 0) continue;

      const w = theirs[theirs.length - 1];
      used.add(w.workCode);
      w.recommendedAmount = round(w.recommendedAmount + excess, 1000);
      if (w.sanctionedAmount) w.sanctionedAmount = round(w.recommendedAmount * 0.96, 1000);
      w.planted.push(
        note("ENTITLEMENT_BREACH", `Recommendations by ${mps[mpIndex].name} for FY ${fy} total about ₹${Math.round((total + excess) / 1e7)} crore against an annual entitlement of ₹5 crore.`),
      );
      n++;
    }
    tally("ENTITLEMENT_BREACH", n);
  }

  // 5. MISSING_EVIDENCE — payment stages released with no asset photograph or
  //    document uploaded, though the sanction order requires it at each stage.
  {
    const chosen = take((w) => w.payments.length >= 2, 17);
    for (const w of chosen) {
      const strip = w.payments.slice(-int(1, 2));
      for (const p of strip) p.evidence = [];
      w.planted.push(
        note("MISSING_EVIDENCE", `${strip.length} payment stage(s) totalling ₹${strip.reduce((s, p) => s + p.amount, 0).toLocaleString("en-IN")} released with no asset photograph or supporting document on record.`),
      );
    }
    tally("MISSING_EVIDENCE", chosen.length);
  }

  // 6. STUCK_UNMARKED — physically complete, fully paid, but the IA never
  //    marked completion, so the work never shows as completed publicly.
  {
    const chosen = take(
      (w) => !!w.sanctionedAt && daysBetween(w.sanctionedAt, NOW) > 240 && w.payments.length >= 2,
      16,
    );
    for (const w of chosen) {
      w.status = "COMPLETED_UNMARKED";
      w.progressPct = 100;
      // The completion date must be safely in the past: an agency cannot be
      // late marking a work that has not finished yet, and a detector is right
      // to ignore one that is. These works were sanctioned over 240 days ago,
      // so pulling the date back stays clear of the sanction date.
      const naturalFinish = addDays(w.sanctionedAt!, int(150, 300));
      w.completedAt =
        naturalFinish > addDays(NOW, -15) ? addDays(NOW, -int(20, 200)) : naturalFinish;
      w.markedCompleteAt = null;
      // Payments were laid out against the work's earlier timeline; pull any
      // that now post-date completion back behind it, so the record does not
      // show a vendor being paid long after the asset was finished.
      const settleBy = addDays(w.completedAt, 30);
      for (const pay of w.payments) {
        if (pay.releasedAt > settleBy) pay.releasedAt = addDays(settleBy, -int(0, 60));
      }
      const stale = daysBetween(w.completedAt, NOW);
      w.planted.push(
        note("STUCK_UNMARKED", `Work recorded at 100% progress and complete since ${w.completedAt.toISOString().slice(0, 10)}, but the implementing agency has not marked it complete — ${stale} days pending.`),
      );
    }
    tally("STUCK_UNMARKED", chosen.length);
  }

  // 7. DUPLICATE — a near-identical work in the same district in an
  //    overlapping period, under a barely-changed title.
  {
    const bases = take((w) => !!w.sanctionedAt && w.status !== "CANCELLED", 12);
    let n = 0;
    for (const base of bases) {
      const clone: SeedWork = structuredClone(base);
      clone.workCode = `${base.workCode}-D`;
      // A duplicate recommendation describes the SAME asset in the same place;
      // what differs is the wording. Locality is carried over unchanged, which
      // is exactly the signal the detector looks for.
      clone.title = `Construction of ${base.workType.toLowerCase()} at ${base.locality}, ${base.title.split(", ").pop()}`;
      clone.description = `${base.description} (Re-recommended for the same location.)`;
      // Shift forward, but never past "today" — a recommendation dated in the
      // future would be a data error, not an anomaly.
      const shift = int(20, 75);
      clone.recommendedAt = clampToNow(addDays(base.recommendedAt, shift));
      clone.planted = [
        note("DUPLICATE", `Near-identical to ${base.workCode}: same work type and locality in ${base.districtCode}, recommended ${daysBetween(base.recommendedAt, clone.recommendedAt)} days apart.`),
      ];
      // Shift the WHOLE timeline by the same amount. Moving only the sanction
      // date leaves the copied payments sitting before their own sanction and
      // the completion date before the work started — a record no reviewer
      // would trust, and nothing the duplicate rule needs.
      if (clone.sanctionedAt) {
        clone.sanctionedAt = nudgeClearOfFyEnd(
          clampToNow(addDays(clone.sanctionedAt, shift)),
        );
        // Nudging away from the year-end window moves the sanction backwards,
        // which can push it behind the recommendation it followed.
        if (clone.sanctionedAt <= clone.recommendedAt) {
          clone.recommendedAt = addDays(clone.sanctionedAt, -int(25, 70));
        }
      }
      if (clone.completedAt) clone.completedAt = clampToNow(addDays(clone.completedAt, shift));
      if (clone.markedCompleteAt) {
        clone.markedCompleteAt = clampToNow(addDays(clone.markedCompleteAt, shift));
      }
      for (const pay of clone.payments) {
        pay.releasedAt = clampToNow(addDays(pay.releasedAt, shift));
        for (const e of pay.evidence) {
          e.uploadedAt = clampToNow(addDays(e.uploadedAt, shift));
        }
      }
      works.push(clone);
      used.add(clone.workCode);
      n++;
    }
    tally("DUPLICATE", n);
  }

  // 8. FY_END_SPIKE — sanctions crowded into the closing weeks of a financial
  //    year, the classic year-end fund-exhaustion pattern.
  //
  //    Planted as a CLUSTER inside a handful of districts, because that is what
  //    the behaviour actually looks like: a district racing to commit an
  //    unspent balance before 31 March. A detector worth having compares each
  //    district's year-end share against its own normal spread, so scattering
  //    one late sanction per district would be nothing to detect.
  {
    const spikeDistricts = ["TN-CBE", "AS-DIB", "MH-NSK", "UP-MRT"];
    const close = fyEnd("2024-25");
    let n = 0;

    for (const dc of spikeDistricts) {
      const chosen = take(
        (w) =>
          w.districtCode === dc && !!w.sanctionedAt && w.financialYear === "2024-25",
        6,
      );
      // Two late sanctions are not a spike, and the detector is right to say
      // so. Only plant where a genuine cluster can form.
      if (chosen.length < 4) continue;

      for (const w of chosen) {
        const shifted = addDays(close, -int(1, 14));
        // Move the whole timeline by the same delta. Pushing the sanction date
        // forward on its own can leave a work completed months before it was
        // sanctioned, which is a worse data error than the one being planted.
        const delta = daysBetween(w.sanctionedAt!, shifted);
        w.sanctionedAt = shifted;
        if (w.recommendedAt >= shifted) w.recommendedAt = addDays(shifted, -int(20, 60));
        if (w.completedAt) w.completedAt = clampToNow(addDays(w.completedAt, delta));
        if (w.markedCompleteAt) {
          w.markedCompleteAt = clampToNow(addDays(w.markedCompleteAt, delta));
        }
        for (const p of w.payments) {
          p.releasedAt = clampToNow(addDays(p.releasedAt, delta));
          for (const e of p.evidence) e.uploadedAt = clampToNow(addDays(e.uploadedAt, delta));
        }
        w.planted.push(
          note("FY_END_SPIKE", `Sanctioned on ${shifted.toISOString().slice(0, 10)}, inside the final fortnight of FY 2024-25 — one of ${chosen.length} sanctions crowded into the year-end window in ${dc}.`),
        );
        n++;
      }
    }
    tally("FY_END_SPIKE", n);
  }

  // 9. COST_OUTLIER — cost per unit far above the peer distribution for the
  //    same work type. Detected by the ML layer against district/state peers.
  //
  //    Every amount scales by the SAME factor, payments included, so the
  //    paid-to-sanctioned ratio is untouched. Inflating the sanction while
  //    leaving payments at a fixed share would make these works read as
  //    payment-ahead-of-progress as well, and the ground truth would then be
  //    wrong about which rule the work actually breaks.
  {
    const chosen = take((w) => !!w.sanctionedAmount && w.unitCount >= 1, 14);
    for (const w of chosen) {
      const factor = 2.4 + rnd() * 1.8;
      w.recommendedAmount = round(w.recommendedAmount * factor, 1000);
      w.sanctionedAmount = round(w.sanctionedAmount! * factor, 1000);
      for (const p of w.payments) p.amount = round(p.amount * factor, 1000);
      const perUnit = Math.round(w.sanctionedAmount / w.unitCount);
      w.planted.push(
        note("COST_OUTLIER", `Sanctioned at ₹${perUnit.toLocaleString("en-IN")} per unit for "${w.workType}" — roughly ${factor.toFixed(1)}x the typical cost of comparable works.`),
      );
    }
    tally("COST_OUTLIER", chosen.length);
  }

  // 10. IA_CONCENTRATION — one implementing agency taking a dominant share of
  //     a district's sanctioned value. A signal for review, not an accusation.
  {
    const targetDistricts = ["UP-GKP", "WB-MSD", "MH-SOL"];
    let n = 0;
    for (const dc of targetDistricts) {
      const inDistrict = works.filter((w) => w.districtCode === dc && w.agencyIndex !== null);
      if (inDistrict.length < 6) continue;
      const dominant = agencies.findIndex((a) => a.districtCode === dc);
      if (dominant < 0) continue;

      const moved = inDistrict.slice(0, Math.ceil(inDistrict.length * 0.8));
      for (const w of moved) w.agencyIndex = dominant;
      // Label one representative work so the ground truth has an anchor row.
      const anchor = moved[0];
      if (!anchor.planted.some((p) => p.type === "IA_CONCENTRATION")) {
        anchor.planted.push(
          note("IA_CONCENTRATION", `${agencies[dominant].name} is designated on ${moved.length} of ${inDistrict.length} sanctioned works in ${dc} — a disproportionate share warranting review.`),
        );
        n++;
      }
    }
    tally("IA_CONCENTRATION", n);
  }

  return counts;
}

const clampToNow = (d: Date) => (d > NOW ? NOW : d);

/**
 * Planting moves sanction dates and completion dates around, which can leave a
 * payment stranded long after the asset was finished. Nothing about any rule
 * depends on that, and it reads as a data error to anyone opening the work, so
 * a final pass pulls stray payment dates back inside the work's own timeline.
 */
function normalisePaymentDates(works: SeedWork[]) {
  const SETTLEMENT_TAIL_DAYS = 45;

  for (const w of works) {
    if (w.payments.length === 0) continue;
    const latest = w.completedAt
      ? addDays(w.completedAt, SETTLEMENT_TAIL_DAYS)
      : NOW;

    // A payment belongs inside [sanction, completion + tail], and never in the
    // future. Clamp rather than resample, so a work whose two bounds are only
    // days apart still lands on a valid date instead of oscillating between
    // two conflicting rules.
    const earliest = w.sanctionedAt ?? w.recommendedAt;
    const upper = new Date(Math.min(latest.getTime(), NOW.getTime()));

    for (const p of w.payments) {
      if (p.releasedAt > upper) {
        p.releasedAt = new Date(
          Math.max(earliest.getTime(), addDays(upper, -int(0, 30)).getTime()),
        );
      }
      if (p.releasedAt < earliest) {
        p.releasedAt = new Date(
          Math.min(upper.getTime(), addDays(earliest, int(5, 30)).getTime()),
        );
      }

      for (const e of p.evidence) {
        e.uploadedAt = clampToNow(addDays(p.releasedAt, int(0, 4)));
      }
    }

    w.payments.sort((a, b) => a.stageNo - b.stageNo);
  }
}

/**
 * Claim a locality for a (district, work type) pair, so no two generated works
 * describe the same asset in the same place. Returns null once a district has
 * exhausted the locality pool for that work type.
 */
const claimedLocalities = new Set<string>();

function uniqueLocality(districtCode: string, workType: string): string | null {
  const start = int(0, LOCALITIES.length - 1);
  for (let i = 0; i < LOCALITIES.length; i++) {
    const locality = LOCALITIES[(start + i) % LOCALITIES.length];
    const key = `${districtCode}|${workType}|${locality}`;
    if (claimedLocalities.has(key)) continue;
    claimedLocalities.add(key);
    return locality;
  }
  return null;
}

/**
 * Keep a date out of the closing weeks of its financial year, so a work that
 * was not planted as FY-end clustering does not drift into that window and
 * pollute the ground truth.
 */
function nudgeClearOfFyEnd(d: Date): Date {
  const closeYear = d.getUTCMonth() >= 3 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  const close = new Date(Date.UTC(closeYear, 2, 31));
  const toClose = daysBetween(d, close);
  return toClose >= 0 && toClose < 40 ? addDays(d, -55) : d;
}

/**
 * After planting, no MP-financial-year total may exceed the entitlement unless
 * an ENTITLEMENT_BREACH was deliberately planted there. Duplicate clones add
 * value the pass-1 budget never accounted for, so trim the largest unlabelled
 * work in any year that drifted over.
 */
function reconcileEntitlements(works: SeedWork[]) {
  const buckets = new Map<string, SeedWork[]>();
  for (const w of works) {
    // Cancelled recommendations release their funds, so they are outside the
    // year's commitment — the same accounting the detector uses.
    if (w.status === "CANCELLED") continue;
    const key = `${w.mpIndex}|${w.financialYear}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(w);
  }

  // Scaling a work down proportionally — recommendation, sanction and every
  // payment by the same factor — leaves every ratio-based rule intact, so a
  // trim can never quietly erase or create another planted anomaly. Works whose
  // anomaly *is* an absolute amount are excluded outright.
  const AMOUNT_SENSITIVE = new Set<string>(["ENTITLEMENT_BREACH", "COST_OUTLIER"]);

  let trimmed = 0;
  for (const bucket of buckets.values()) {
    if (bucket.some((w) => w.planted.some((p) => p.type === "ENTITLEMENT_BREACH"))) {
      continue; // this overshoot is the point
    }
    let total = bucket.reduce((s, w) => s + w.recommendedAmount, 0);
    if (total <= ANNUAL_ENTITLEMENT) continue;

    const trimmable = bucket
      .filter((w) => !w.planted.some((p) => AMOUNT_SENSITIVE.has(p.type)))
      .sort((a, b) => b.recommendedAmount - a.recommendedAmount);

    for (const w of trimmable) {
      if (total <= ANNUAL_ENTITLEMENT * 0.98) break;
      const excess = total - ANNUAL_ENTITLEMENT * 0.98;
      const cut = Math.min(excess, w.recommendedAmount * 0.6);
      const factor = (w.recommendedAmount - cut) / w.recommendedAmount;

      w.recommendedAmount = round(w.recommendedAmount * factor, 1000);
      if (w.sanctionedAmount) w.sanctionedAmount = round(w.sanctionedAmount * factor, 1000);
      for (const p of w.payments) p.amount = round(p.amount * factor, 1000);

      total -= cut;
      trimmed++;
    }

    // Some years cannot be trimmed back under the limit — typically one
    // heavily inflated cost-outlier work carries the whole year past ₹5 Cr.
    // That year really does breach the entitlement, so record it as ground
    // truth rather than distorting the data to hide it.
    if (total > ANNUAL_ENTITLEMENT) {
      const anchor = bucket.sort((a, b) => b.recommendedAmount - a.recommendedAmount)[0];
      anchor.planted.push({
        type: "ENTITLEMENT_BREACH",
        note: `Recommendations for FY ${anchor.financialYear} total ₹${Math.round(total).toLocaleString("en-IN")} against an annual entitlement of ₹${ANNUAL_ENTITLEMENT.toLocaleString("en-IN")} — driven by an unusually large single recommendation.`,
      });
    }
  }
  return trimmed;
}

/** Rewrite a work's payment amounts so they sum to `target`, stages intact. */
function redistribute(w: SeedWork, target: number) {
  if (w.payments.length === 0) return;
  const per = round(target / w.payments.length, 1000);
  let remaining = target;
  w.payments.forEach((p, i) => {
    const isLast = i === w.payments.length - 1;
    p.amount = isLast ? Math.max(0, remaining) : per;
    remaining -= p.amount;
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
