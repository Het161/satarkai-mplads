import { defineConfig } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env" });

/**
 * End-to-end tests against a real build.
 *
 * These exist for the things unit tests genuinely cannot reach: a Next.js
 * server action needs a running server to be invoked at all, and an
 * accessibility audit needs a rendered page. Everything else is covered by
 * `npm test`, which is faster and does not need a build.
 *
 * Uses the system Chrome rather than Playwright's bundled browser, so the
 * suite runs on a machine that has not downloaded one.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3311",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --port 3311",
    url: "http://127.0.0.1:3311/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
