import { expect, test } from "@playwright/test";

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
