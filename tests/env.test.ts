import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * src/env.ts validates at module-load time by design (fail fast, no
 * lazy/partial config). These tests exercise that by resetting the
 * module registry and re-importing under a controlled process.env
 * for each case, since that is the only way to observe both a
 * successful and a failing load in the same test run.
 */

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, ...overrides };
}

beforeEach(() => {
  setEnv({});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("environment validation", () => {
  it("throws with no default substituted when DATABASE_URL and BETTER_AUTH_SECRET are missing", async () => {
    setEnv({
      DATABASE_URL: undefined,
      BETTER_AUTH_SECRET: undefined,
    });
    const { vi } = await import("vitest");
    vi.resetModules();
    await expect(import("@/env")).rejects.toThrow(
      /Invalid environment configuration/,
    );
  });

  it("throws when DATABASE_URL does not look like a postgres connection string", async () => {
    setEnv({
      DATABASE_URL: "mysql://example",
      BETTER_AUTH_SECRET: "x".repeat(32),
    });
    const { vi } = await import("vitest");
    vi.resetModules();
    await expect(import("@/env")).rejects.toThrow(
      /postgres/,
    );
  });

  it("refuses ALLOW_TEST_FIXTURES=true under NODE_ENV=production", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
      ALLOW_TEST_FIXTURES: "true",
    });
    const { vi } = await import("vitest");
    vi.resetModules();
    await expect(import("@/env")).rejects.toThrow(/ALLOW_TEST_FIXTURES/);
  });

  it("refuses SCHEDULER_MODE=LIVE_VERIFIED under NODE_ENV=production (not implemented until Phase 6)", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
      SCHEDULER_MODE: "LIVE_VERIFIED",
    });
    const { vi } = await import("vitest");
    vi.resetModules();
    await expect(import("@/env")).rejects.toThrow(/LIVE_VERIFIED/);
  });

  it("loads successfully with a minimal valid configuration and defaults every integration to its honest off-state", async () => {
    setEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
    });
    const { vi } = await import("vitest");
    vi.resetModules();
    const { env } = await import("@/env");
    expect(env.EMAIL_MODE).toBe("UNCONFIGURED");
    expect(env.SCHEDULER_MODE).toBe("UNCONFIGURED");
    expect(env.AI_MODE).toBe("DISABLED");
    expect(env.isProduction).toBe(false);
  });
});
