import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * src/env.ts validates at module-load time by design (fail fast, no
 * lazy/partial config). These tests exercise that by resetting the
 * module registry and re-importing under a controlled process.env
 * for each case, since that is the only way to observe both a
 * successful and a failing load in the same test run.
 */

const ORIGINAL_ENV = { ...process.env };

/**
 * Every key src/env.ts's schema reads, explicitly cleared before each
 * test's own overrides are applied. Without this, a value the
 * surrounding process actually has set -- e.g. CI's workflow-level
 * `GUEST_SESSION_TTL_MINUTES: "60"` -- would silently leak into a test
 * that means to exercise the "unset" case, passing locally (where no
 * such variable happens to be exported) while failing in CI. Every
 * test must be able to control its own env.ts-relevant input
 * regardless of what the host process happens to export.
 */
const ENV_SCHEMA_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "EMAIL_MODE",
  "SCHEDULER_MODE",
  "AI_MODE",
  "ALLOW_TEST_FIXTURES",
  "DEPLOYMENT_MODE",
  "GUEST_SESSION_TTL_MINUTES",
  "LIVE_DEPLOYMENT_APPROVED",
] as const;

function setEnv(overrides: Record<string, string | undefined>) {
  const cleared = Object.fromEntries(
    ENV_SCHEMA_KEYS.map((key) => [key, undefined]),
  );
  process.env = { ...ORIGINAL_ENV, ...cleared, ...overrides };
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
    expect(env.DEPLOYMENT_MODE).toBe("LOCAL");
  });

  describe("DEPLOYMENT_MODE / session TTL (Phase 1A repair item 5)", () => {
    it("defaults to DEPLOYMENT_MODE=LOCAL and an illustrative 60-minute session TTL when unset", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      const { env } = await import("@/env");
      expect(env.DEPLOYMENT_MODE).toBe("LOCAL");
      expect(env.GUEST_SESSION_TTL_MINUTES).toBeUndefined();
      expect(env.resolvedGuestSessionTtlMinutes).toBe(60);
    });

    it("rejects a GUEST_SESSION_TTL_MINUTES below the minimum bound", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        GUEST_SESSION_TTL_MINUTES: "1",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(/at least 5 minutes/);
    });

    it("rejects a GUEST_SESSION_TTL_MINUTES above the maximum bound", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        GUEST_SESSION_TTL_MINUTES: "99999",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(/at most 31 days/);
    });

    it("refuses DEPLOYMENT_MODE=LIVE without LIVE_DEPLOYMENT_APPROVED=true", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "LIVE",
        GUEST_SESSION_TTL_MINUTES: "120",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(/LIVE_DEPLOYMENT_APPROVED/);
    });

    it("refuses DEPLOYMENT_MODE=LIVE without an explicit GUEST_SESSION_TTL_MINUTES, even when approved", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "LIVE",
        LIVE_DEPLOYMENT_APPROVED: "true",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(
        /GUEST_SESSION_TTL_MINUTES to be set explicitly/,
      );
    });

    it("accepts DEPLOYMENT_MODE=LIVE only with both LIVE_DEPLOYMENT_APPROVED=true and an explicit TTL", async () => {
      setEnv({
        // A remote host -- see the loopback-rejection tests below for
        // why LIVE cannot use a localhost DATABASE_URL either.
        DATABASE_URL: "postgresql://user:pass@db.example.internal:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "LIVE",
        LIVE_DEPLOYMENT_APPROVED: "true",
        GUEST_SESSION_TTL_MINUTES: "120",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      const { env } = await import("@/env");
      expect(env.DEPLOYMENT_MODE).toBe("LIVE");
      expect(env.resolvedGuestSessionTtlMinutes).toBe(120);
    });

    it("PREVIEW mode uses the illustrative default without requiring approval or an explicit TTL", async () => {
      setEnv({
        // A remote host -- see the loopback-rejection tests below for
        // why PREVIEW cannot use a localhost DATABASE_URL.
        DATABASE_URL: "postgresql://user:pass@db.example.internal:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "PREVIEW",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      const { env } = await import("@/env");
      expect(env.DEPLOYMENT_MODE).toBe("PREVIEW");
      expect(env.resolvedGuestSessionTtlMinutes).toBe(60);
    });
  });

  describe("loopback DATABASE_URL rejection in deployed environments (Phase 3B repair)", () => {
    it("LOCAL + a localhost DATABASE_URL is allowed", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "LOCAL",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      const { env } = await import("@/env");
      expect(env.DEPLOYMENT_MODE).toBe("LOCAL");
    });

    it("LOCAL + a 127.0.0.1 DATABASE_URL is allowed", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "LOCAL",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      const { env } = await import("@/env");
      expect(env.DEPLOYMENT_MODE).toBe("LOCAL");
    });

    it("PREVIEW + a localhost DATABASE_URL is rejected", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "PREVIEW",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(/loopback host/);
    });

    it("PREVIEW + a 127.0.0.1 DATABASE_URL is rejected", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "PREVIEW",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(/loopback host/);
    });

    it("PREVIEW + a ::1 DATABASE_URL is rejected", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@[::1]:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "PREVIEW",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(/loopback host/);
    });

    it("PREVIEW + a remote PostgreSQL DATABASE_URL is accepted", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@db.example.internal:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "PREVIEW",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      const { env } = await import("@/env");
      expect(env.DEPLOYMENT_MODE).toBe("PREVIEW");
    });

    it("LIVE + a localhost DATABASE_URL is rejected (even before the LIVE-approval gate)", async () => {
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "LIVE",
        LIVE_DEPLOYMENT_APPROVED: "true",
        GUEST_SESSION_TTL_MINUTES: "120",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      await expect(import("@/env")).rejects.toThrow(/loopback host/);
    });

    it("does not reject a loopback DATABASE_URL while next build itself is evaluating this module (NEXT_PHASE=phase-production-build)", async () => {
      // A real Vercel Preview build failed with exactly this combination
      // before this exemption existed: `next build` imports every route
      // module (including this one) during its page-data-collection
      // step even though nothing is actually serving a request yet, so
      // a build-time-only placeholder DATABASE_URL must not fail the
      // build itself -- only a genuine runtime request should ever hit
      // this check. See DECISION_LOG.md DEC-G7.
      setEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        BETTER_AUTH_SECRET: "x".repeat(32),
        DEPLOYMENT_MODE: "PREVIEW",
        NEXT_PHASE: "phase-production-build",
      });
      const { vi } = await import("vitest");
      vi.resetModules();
      const { env } = await import("@/env");
      expect(env.DEPLOYMENT_MODE).toBe("PREVIEW");
    });
  });
});
