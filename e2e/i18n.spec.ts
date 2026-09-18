import { expect, test, type Page } from "@playwright/test";

import { cookieFor, localeCookie, prisma } from "./session";

/**
 * Hindi.
 *
 * The check that matters most is `<html lang>`: a screen reader announcing
 * Devanagari with an English voice is unintelligible rather than merely wrong,
 * and that attribute is the only thing that tells it which to use.
 */

test.afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Everything on the page that is still English prose.
 *
 * Asserting "the Hindi is present" cannot catch a half-translated page, which
 * is exactly what went wrong: the chrome was translated from the start and the
 * page bodies were not, so every existing assertion passed while dashboard
 * headings, card titles, KPI labels and table headers stayed in English. This
 * looks for the failure instead of the success.
 *
 * It matches runs of three or more lowercase English words, which is what an
 * untranslated label or sentence looks like. Proper nouns — place names,
 * agency names, "MPLADS", "eSAKSHI" — do not match, so they need no exception.
 *
 * Three things are excluded, each because it is data or code rather than
 * interface copy:
 *
 *  - A node that also contains Devanagari. That is a translated string with a
 *    command or URL embedded in it (`npm run detect:ml`); the Latin run is the
 *    command, which does not translate.
 *  - `[data-detector-text]` — the alert reason sentence and its evidence rows.
 *    Detectors compose these with figures interpolated and store the finished
 *    text on the Alert row, so they stay English until that becomes a message
 *    key plus parameters: a schema change, eleven detectors and a re-run of
 *    detection. The limitation is stated to the user in `locale.partial`, and
 *    naming it here is what keeps this test honest about the gap rather than
 *    quietly loosened to hide it.
 *  - A record's own stored text: links into a record (`/works/…`, `/alerts/…`)
 *    and anything marked `[data-record-text]`. A work's title —
 *    "Construction of solar street lighting at Ward No. 11" — is what the
 *    register says it is. Translating it would misrepresent the record.
 */
async function untranslatedText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return ["no <main> element"];

    const devanagari = /[ऀ-ॿ]/;
    const englishRun = /\b[a-z]{3,}\s+(?:[a-z]{2,}\s+){1,}[a-z]{2,}\b/;
    const found: string[] = [];

    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? "").trim();
      if (!englishRun.test(text)) continue;
      if (devanagari.test(text)) continue;

      const el = n.parentElement;
      if (el?.closest("[data-detector-text]")) continue;
      if (el?.closest("[data-record-text]")) continue;
      if (el?.closest('a[href^="/works/"], a[href^="/alerts/"]')) continue;

      found.push(text.slice(0, 90));
    }
    return found;
  });
}

test("the interface switches to Hindi, and the document says so", async ({
  page,
  context,
}) => {
  await context.addCookies([
    await cookieFor("district.gj-ahd@demo.gov"),
    localeCookie("hi"),
  ]);

  await page.goto("/alerts");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
  await expect(page.getByRole("navigation", { name: "मुख्य" })).toBeVisible();
  await expect(page.getByText("चेतावनी सूची")).toBeVisible();
  await expect(page.getByText("कृत्रिम प्रदर्शन आँकड़े")).toBeVisible();
});

test("page bodies are translated, not only the chrome", async ({
  page,
  context,
}) => {
  await context.addCookies([
    await cookieFor("district.gj-ahd@demo.gov"),
    localeCookie("hi"),
  ]);

  await page.goto("/dashboard");

  // Heading, role badge, a KPI label, a card title and a table header — one of
  // each kind of string that used to be hardcoded.
  await expect(
    page.getByRole("heading", { name: /ज़िला$/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("ज़िला प्राधिकरण (NDA/IDA)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("अभिलेख में साक्ष्य").first()).toBeVisible();
  await expect(page.getByText("सर्वप्रथम ध्यान अपेक्षित")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "एक वर्ष से अधिक" }),
  ).toBeVisible();

  // Every page an officer can reach, not just this one: the original problem
  // was uneven, so a single-page assertion would report success on half a job.
  for (const path of [
    "/dashboard",
    "/alerts",
    "/works",
    "/forecast",
    "/audit",
    "/notifications",
  ]) {
    await page.goto(path);
    expect(
      await untranslatedText(page),
      `untranslated text on ${path}`,
    ).toEqual([]);
  }
});

/**
 * The same sweep across the role dashboards.
 *
 * Each role renders an entirely different component — MinistryDashboard,
 * StateDashboard, DistrictDashboard, MpDashboard, AgencyDashboard — so a sweep
 * signed in as one officer proves nothing about the other four. This is where
 * the uneven translation actually lived.
 */
for (const [role, email] of [
  ["Ministry", "ministry@mospi.demo"],
  ["State Nodal Authority", "sna.gj@demo.gov"],
  ["Member of Parliament", "mp.gj@demo.gov"],
  ["Implementing Agency", "ia.gj-ahd@demo.gov"],
] as const) {
  test(`the ${role} dashboard is translated`, async ({ page, context }) => {
    await context.addCookies([await cookieFor(email), localeCookie("hi")]);
    await page.goto("/dashboard");
    expect(
      await untranslatedText(page),
      `untranslated text on the ${role} dashboard`,
    ).toEqual([]);
  });
}

test("English is the default and the toggle returns to it", async ({
  page,
  context,
}) => {
  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);

  await page.goto("/alerts");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
  await expect(page.getByText("Alert queue")).toBeVisible();

  // The toggle is labelled in the language it switches TO — the only labelling
  // that helps someone who cannot read the current one.
  await page.getByRole("button", { name: "हिन्दी में देखें" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");

  await page.getByRole("button", { name: "View in English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
});
