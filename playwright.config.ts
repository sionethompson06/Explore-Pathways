import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 2 browser smoke tests + responsive screenshot capture. Runs
 * against the pre-installed Chromium in this sandbox
 * (PLAYWRIGHT_BROWSERS_PATH), launched by explicit executablePath
 * since the installed @playwright/test version may not match the
 * revision that path was fetched for -- see the environment notes on
 * this point. Never runs `playwright install`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
          // This sandbox runs Chromium as root, where its own sandbox
          // refuses to start at all ("Running as root without
          // --no-sandbox is not supported"). Disabling it is safe
          // here because the browser only ever loads pages this test
          // suite itself serves from localhost, never arbitrary
          // third-party content.
          args: ["--no-sandbox"],
        },
      },
    },
  ],
});
