import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 6A.2 native-booking-calendar end-to-end coverage (docs/pathways
 * instruction sections 61-63). A separate config from playwright.config.ts
 * because those existing Phase 6A specs deliberately assert the honest
 * SCHEDULER_MODE=UNCONFIGURED behavior of this repo's real local env --
 * this suite instead needs its own dev server explicitly started with
 * SCHEDULER_MODE=INTERNAL (never mutating the shared .env.local), on a
 * separate port so both suites can run independently without fighting
 * over a single already-running server.
 */
export default defineConfig({
  testDir: "./tests/e2e-internal",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3102",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec next dev -p 3102",
    url: "http://localhost:3102",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      SCHEDULER_MODE: "INTERNAL",
    } as Record<string, string>,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
          args: ["--no-sandbox"],
        },
      },
    },
  ],
});
