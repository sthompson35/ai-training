import { defineConfig, devices } from "@playwright/test";

// Runs against the already-running docker-compose stack, through the gateway
// (the same origin the app itself is meant to be used at) — not a dev server
// Playwright spawns itself. `docker compose up -d` must have already happened.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // These tests mutate shared server-side state (a real, persistent dev DB,
  // not a per-test fixture) — running strictly sequentially avoids races
  // between specs, at the cost of a slower run. Safe to revisit once proven.
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8082",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
