import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

/**
 * Phase 3C's actual reason for existing: the Vercel Preview
 * environment has DEPLOYMENT_MODE=PREVIEW and a DATABASE_URL that is
 * still a loopback placeholder (no hosted Preview database exists
 * yet -- see the Phase 3B blocker in docs/pathways/PHASE_STATUS.md).
 * src/env.ts's own loadEnv() throws for exactly that combination
 * (DEC-G7), and Next.js evaluates a page's whole import graph merely
 * to render it -- so /discover/demo must render 200 in this exact
 * broken-database configuration, never merely "in theory." This test
 * reproduces that real Vercel Preview configuration locally (a real
 * `next dev` process, not a mock) and proves both pages survive it.
 */

const PORT = 3111;
const BASE_URL = `http://localhost:${PORT}`;

let server: ChildProcessWithoutNullStreams | undefined;

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.status > 0) return;
    } catch {
      // Not up yet -- keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server on ${BASE_URL} never became reachable within ${timeoutMs}ms`);
}

describe("Reproduces the actual Vercel Preview database-unavailable configuration", () => {
  beforeAll(async () => {
    server = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEPLOYMENT_MODE: "PREVIEW",
        // The real, unresolved Phase 3B blocker: Preview's DATABASE_URL
        // is still a loopback placeholder, unreachable from a deployed
        // environment.
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/unreachable_from_preview",
        BETTER_AUTH_SECRET: "0".repeat(32),
        BETTER_AUTH_URL: "https://preview.example.vercel.app",
        EMAIL_MODE: "UNCONFIGURED",
        SCHEDULER_MODE: "UNCONFIGURED",
        AI_MODE: "DISABLED",
      },
      stdio: "pipe",
    });
    await waitForServer(60_000);
  }, 70_000);

  afterAll(() => {
    server?.kill("SIGTERM");
  });

  it("/discover/demo renders 200 -- Preview Demo Mode never depends on DATABASE_URL connectivity", async () => {
    const response = await fetch(`${BASE_URL}/discover/demo`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("DEMO PREVIEW");
  });

  it("/discover itself still renders 200 in this exact configuration (the Phase 3C regression this whole feature exists to fix)", async () => {
    const response = await fetch(`${BASE_URL}/discover`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Preview the Discovery Experience");
  });
});
