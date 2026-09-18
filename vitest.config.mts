import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Tests run against the real seeded Postgres — RBAC that is only proved against
// a mock proves nothing about the queries that actually ship.
config({ path: ".env" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
