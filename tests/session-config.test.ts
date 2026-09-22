import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Phase 1A repair item 5. session-config.ts reads env at module load
 * (like env.ts itself), so exercising different DEPLOYMENT_MODE /
 * GUEST_SESSION_TTL_MINUTES combinations requires the same
 * module-reset pattern used in tests/env.test.ts.
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

async function freshSessionConfig(overrides: Record<string, string | undefined>) {
  setEnv({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    BETTER_AUTH_SECRET: "x".repeat(32),
    ...overrides,
  });
  const { vi } = await import("vitest");
  vi.resetModules();
  return import("@/server/session-config");
}

describe("session-config", () => {
  it("resolves the TTL from env.resolvedGuestSessionTtlMinutes, in consistent minutes/seconds/ms", async () => {
    const config = await freshSessionConfig({ GUEST_SESSION_TTL_MINUTES: "90" });
    expect(config.guestSessionTtlMinutes).toBe(90);
    expect(config.guestSessionTtlSeconds).toBe(90 * 60);
    expect(config.guestSessionTtlMs).toBe(90 * 60 * 1000);
  });

  it("falls back to the illustrative 60-minute default when unset (LOCAL mode)", async () => {
    const config = await freshSessionConfig({});
    expect(config.guestSessionTtlMinutes).toBe(60);
  });

  it("marks the cookie non-secure under DEPLOYMENT_MODE=LOCAL", async () => {
    const config = await freshSessionConfig({ DEPLOYMENT_MODE: "LOCAL" });
    expect(config.isSecureCookieDeploymentMode()).toBe(false);
  });

  it("marks the cookie secure under DEPLOYMENT_MODE=PREVIEW", async () => {
    const config = await freshSessionConfig({ DEPLOYMENT_MODE: "PREVIEW" });
    expect(config.isSecureCookieDeploymentMode()).toBe(true);
  });

  it("marks the cookie secure under DEPLOYMENT_MODE=LIVE", async () => {
    const config = await freshSessionConfig({
      DEPLOYMENT_MODE: "LIVE",
      LIVE_DEPLOYMENT_APPROVED: "true",
      GUEST_SESSION_TTL_MINUTES: "120",
    });
    expect(config.isSecureCookieDeploymentMode()).toBe(true);
  });
});
