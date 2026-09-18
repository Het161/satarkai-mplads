import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { cookieFor, localeCookie, prisma } from "./session";

/**
 * WCAG 2.1 AA, checked rather than asserted.
 *
 * This caught a real failure: the "high" severity badge rendered amber text on
 * its own pale amber tint at 2.70:1, well under the 4.5:1 AA asks of body text.
 * The severity tokens were chosen to work as marks — a bar, a border — where
 * 3:1 is the bar, and nobody had re-checked them as small text. A human
 * eyeballing the page would not have caught it; axe did on the first run.
 */

// Read from node_modules directly rather than through import.meta.resolve:
// Playwright transpiles these specs to CommonJS, where import.meta does not exist.
const AXE = readFileSync(
  path.join(process.cwd(), "node_modules/axe-core/axe.min.js"),
  "utf8",
);

const PAGES = [
  { name: "sign-in", path: "/login", auth: false },
  { name: "dashboard", path: "/dashboard", auth: true },
  { name: "alert queue", path: "/alerts", auth: true },
  { name: "works", path: "/works", auth: true },
  { name: "audit trail", path: "/audit", auth: true },
  { name: "notifications", path: "/notifications", auth: true },
  { name: "early warning", path: "/forecast", auth: true },
];

test.afterAll(async () => {
  await prisma.$disconnect();
});

for (const pageSpec of PAGES) {
  test(`${pageSpec.name} has no WCAG AA violations`, async ({ page, context }) => {
    if (pageSpec.auth) {
      await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);
    }
    await page.goto(pageSpec.path, { waitUntil: "networkidle" });
    await page.addScriptTag({ content: AXE });

    const violations = await page.evaluate(async () => {
      // @ts-expect-error injected at runtime
      const result = await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      });
      return result.violations.map(
        (v: { id: string; impact: string; help: string; nodes: { html: string }[] }) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          example: v.nodes[0]?.html.slice(0, 160),
        }),
      );
    });

    expect(
      violations,
      `${pageSpec.name}:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });
}

test("a single work's drill-down is accessible", async ({ page, context }) => {
  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);
  const district = await prisma.district.findUniqueOrThrow({
    where: { code: "GJ-AHD" },
  });
  const work = await prisma.work.findFirstOrThrow({
    where: { districtId: district.id, payments: { some: {} } },
  });

  await page.goto(`/works/${work.id}`, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error injected at runtime
    const r = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return r.violations.map((v: { id: string }) => v.id);
  });
  expect(violations).toEqual([]);
});

test("the page is usable by keyboard alone", async ({ page, context }) => {
  await context.addCookies([await cookieFor("district.gj-ahd@demo.gov")]);
  await page.goto("/alerts");

  // The skip link must be the first thing a keyboard user reaches.
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(first).toContain("Skip to main content");

  // And every interactive element must show a visible focus ring.
  await page.keyboard.press("Tab");
  const hasVisibleFocus = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(hasVisibleFocus).toBe(true);
});
