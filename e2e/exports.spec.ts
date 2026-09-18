import { expect, test } from "@playwright/test";

import { cookieFor, prisma } from "./session";

/** Export routes carry the same jurisdiction filter as the pages they mirror. */

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("the alert export is scoped to the officer's jurisdiction", async ({ request }) => {
  const district = await cookieFor("district.gj-ahd@demo.gov");
  const ministry = await cookieFor("ministry@mospi.demo");

  const asDistrict = await request.get("/api/export/alerts.csv", {
    headers: { cookie: `${district.name}=${district.value}` },
  });
  const asMinistry = await request.get("/api/export/alerts.csv", {
    headers: { cookie: `${ministry.name}=${ministry.value}` },
  });

  expect(asDistrict.ok()).toBe(true);
  expect(asMinistry.ok()).toBe(true);

  const districtRows = (await asDistrict.text()).trim().split("\r\n").length;
  const ministryRows = (await asMinistry.text()).trim().split("\r\n").length;
  expect(ministryRows).toBeGreaterThan(districtRows);
});

test("an unauthenticated export is refused", async ({ request }) => {
  const res = await request.get("/api/export/alerts.csv");
  expect(res.status()).toBe(401);
});

test("the CSV opens as UTF-8 and quotes correctly", async ({ request }) => {
  const c = await cookieFor("ministry@mospi.demo");
  const res = await request.get("/api/export/alerts.csv", {
    headers: { cookie: `${c.name}=${c.value}` },
  });
  const body = await res.text();

  // A BOM, or Excel mangles every rupee sign and place name with a diacritic.
  expect(body.charCodeAt(0)).toBe(0xfeff);
  // Reasons contain commas, so they must be quoted.
  expect(body).toMatch(/"[^"]*,[^"]*"/);
});

test("a PDF case note is produced, and only within the jurisdiction", async ({
  request,
}) => {
  const c = await cookieFor("district.gj-ahd@demo.gov");
  const district = await prisma.district.findUniqueOrThrow({
    where: { code: "GJ-AHD" },
  });
  const foreign = await prisma.district.findUniqueOrThrow({
    where: { code: "MH-PUN" },
  });

  const mine = await prisma.alert.findFirstOrThrow({
    where: { work: { districtId: district.id } },
  });
  const theirs = await prisma.alert.findFirstOrThrow({
    where: { work: { districtId: foreign.id } },
  });

  const ok = await request.get(`/api/export/alert/${mine.id}`, {
    headers: { cookie: `${c.name}=${c.value}` },
  });
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("application/pdf");
  expect((await ok.body()).subarray(0, 4).toString()).toBe("%PDF");

  const refused = await request.get(`/api/export/alert/${theirs.id}`, {
    headers: { cookie: `${c.name}=${c.value}` },
  });
  expect(refused.status()).toBe(404);
});
