import { expect, test } from "@playwright/test";

import { cookieFor, prisma } from "./session";

/**
 * The review workflow, end to end.
 *
 * A Next.js server action cannot be invoked without a running server, so the
 * guards inside `recordReview` — the role, the jurisdiction, the legality of
 * the transition, the required note — are only truly exercised here. The most
 * important test in the file forges the hidden `alertId` to point at another
 * district's alert, because a permission check that lives in a hidden button is
 * not a permission check.
 */

test.afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Put an alert back to untouched.
 *
 * These tests change review state, so without this the second run of the suite
 * finds an alert already explained and the action it needs no longer offered —
 * which is the workflow behaving correctly and the test being badly written.
 * Resetting here rather than relying on a fresh seed keeps the suite runnable
 * as many times as you like.
 */
async function resetAlert(alertId: string) {
  await prisma.detectorOutcome.deleteMany({ where: { alertId } });
  await prisma.alertAction.deleteMany({ where: { alertId } });
  await prisma.auditLog.deleteMany({
    where: { entity: "Alert", entityId: alertId },
  });
  await prisma.alert.update({
    where: { id: alertId },
    data: { state: "OPEN" },
  });
}

async function openAlerts() {
  const district = await prisma.district.findUniqueOrThrow({
    where: { code: "GJ-AHD" },
  });
  const foreignDistrict = await prisma.district.findUniqueOrThrow({
    where: { code: "MH-PUN" },
  });

  const mine = await prisma.alert.findFirst({
    where: { work: { districtId: district.id } },
    orderBy: { score: "desc" },
  });
  const theirs = await prisma.alert.findFirst({
    where: { work: { districtId: foreignDistrict.id } },
    orderBy: { score: "desc" },
  });

  if (!mine || !theirs) {
    throw new Error("Seed has no alerts — run: npm run db:reset && npm run detect");
  }
  return { mine, theirs };
}

test("an officer records a decision, and it reaches the audit trail", async ({
  page,
  context,
}) => {
  const { mine } = await openAlerts();
  await resetAlert(mine.id);
  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);

  await page.goto(`/alerts/${mine.id}`);
  await page.getByText("Mark as explained", { exact: true }).click();

  const note =
    "Checked with the implementing agency: the higher rate reflects rock excavation, documented in the revised estimate.";
  await page.fill("#note", note);
  await page.getByRole("button", { name: "Mark as explained" }).click();

  await expect(page.getByText(/Recorded:/)).toBeVisible();

  // The decision is on the record, with the officer's name against it.
  const after = await prisma.alert.findUniqueOrThrow({
    where: { id: mine.id },
    include: { actions: { include: { byUser: true } } },
  });
  expect(after.state).toBe("EXPLAINED");
  expect(after.actions.at(-1)?.note).toBe(note);
  expect(after.actions.at(-1)?.byUser.email).toBe("district.gj-ahd@demo.gov");

  // And it is visible on the trail.
  await page.goto("/audit");
  await expect(page.getByText(note)).toBeVisible();
});

test("concluding an alert records an outcome for the feedback loop", async ({
  page,
  context,
}) => {
  const { mine } = await openAlerts();
  await resetAlert(mine.id);
  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);

  await page.goto(`/alerts/${mine.id}`);
  await page.getByText("Mark as explained", { exact: true }).click();
  await page.fill(
    "#note",
    "Verified against the revised estimate; the cost is accounted for and no further action is needed.",
  );
  await page.getByRole("button", { name: "Mark as explained" }).click();
  await expect(page.getByText(/Recorded:/)).toBeVisible();

  const outcome = await prisma.detectorOutcome.findUnique({
    where: { alertId: mine.id },
  });
  expect(outcome, "a concluded alert should write a DetectorOutcome").not.toBeNull();
  expect(outcome!.score).toBe(mine.score);
  expect(outcome!.resolution).toBe("EXPLAINED");
  // Acknowledging is not a conclusion, so only the closing actions land here.
  expect(outcome!.hoursToDecide).toBeGreaterThanOrEqual(0);
});

test("a note that is too short is refused", async ({ page, context }) => {
  const { mine } = await openAlerts();
  await resetAlert(mine.id);
  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);

  await page.goto(`/alerts/${mine.id}`);
  await page.getByText("Escalate", { exact: true }).click();
  // Bypass the browser's own minlength so the server guard is the one tested.
  await page.fill("#note", "no");
  await page.evaluate(() => {
    document.querySelector("#note")?.removeAttribute("minlength");
  });
  await page.getByRole("button", { name: "Escalate" }).click();

  await expect(page.getByText(/needs a note of at least/)).toBeVisible();
});

test("a forged alertId cannot reach another district's alert", async ({
  page,
  context,
}) => {
  const { mine, theirs } = await openAlerts();
  await resetAlert(mine.id);
  const before = await prisma.alert.findUniqueOrThrow({ where: { id: theirs.id } });

  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);
  await page.goto(`/alerts/${mine.id}`);
  await page.getByText("Escalate", { exact: true }).click();
  await page.fill(
    "#note",
    "Submitting against a work outside this district, to confirm the server refuses it.",
  );

  // The UI never offers this. The point is that the server does not rely on
  // the UI: it re-derives the session and applies the same jurisdiction filter
  // as every read.
  await page.evaluate((id) => {
    const input = document.querySelector<HTMLInputElement>("input[name=alertId]");
    if (input) input.value = id;
  }, theirs.id);

  await page.getByRole("button", { name: "Escalate" }).click();
  await expect(page.getByText(/not available to this account/)).toBeVisible();

  const after = await prisma.alert.findUniqueOrThrow({
    where: { id: theirs.id },
    include: { actions: true },
  });
  expect(after.state).toBe(before.state);
  expect(after.actions).toHaveLength(0);
});

test("a Member of Parliament is not offered the review panel", async ({
  page,
  context,
}) => {
  const mp = await prisma.user.findUniqueOrThrow({
    where: { email: "mp.gj@demo.gov" },
  });
  const alert = await prisma.alert.findFirst({
    where: { work: { mpId: mp.mpId! } },
  });
  test.skip(!alert, "this MP has no alerts in the current seed");

  await context.addCookies([await cookieFor("mp.gj@demo.gov")]);
  await page.goto(`/alerts/${alert!.id}`);

  await expect(page.getByText("Record your decision")).toHaveCount(0);
  await expect(page.getByText(/read access to this alert/)).toBeVisible();
});

test("a work outside the jurisdiction is not found, not refused", async ({
  page,
  context,
}) => {
  const { theirs } = await openAlerts();
  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);

  await page.goto(`/alerts/${theirs.id}`);
  await expect(page.getByText("Record not available")).toBeVisible();
});
