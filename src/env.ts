import "server-only";
import { z } from "zod";

/**
 * Server-only environment validation. Fails fast and loudly on an
 * invalid or missing configuration rather than silently falling back
 * to an insecure default. This module must be the only place that
 * reads `process.env` for these keys; everything else imports the
 * parsed, typed `env` object below.
 *
 * Per the Phase 1 contract (docs/pathways/IMPLEMENTATION_CONTRACT.md
 * and the master prompt's nonnegotiable behavior 9): a missing
 * integration must produce an honest UNCONFIGURED/DISABLED state, not
 * a faked success. This file is where that state is decided, once,
 * server-side.
 */

const integrationModeSchema = {
  email: z.enum(["UNCONFIGURED"]).default("UNCONFIGURED"),
  scheduler: z
    .enum(["UNCONFIGURED", "REQUEST_ONLY", "LIVE_VERIFIED"])
    .default("UNCONFIGURED"),
  ai: z.enum(["DISABLED"]).default("DISABLED"),
} as const;

const rawEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database (local/test instance only in Phase 1 -- see
  // docs/pathways/INTEGRATION_REGISTER.md; never a production
  // connection string in this phase).
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required to run the app or its tests")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// connection string",
    ),

  // Better Auth groundwork. A real secret is required even in
  // development so that session handling is exercised honestly; it is
  // never a hardcoded default in this file.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),

  // Explicit, honest integration modes. Only the values listed above
  // are accepted in this phase -- adding a new mode (a real email
  // provider, LIVE scheduler, or an AI provider) is a later-phase
  // change to this schema, not a runtime flag.
  EMAIL_MODE: integrationModeSchema.email,
  SCHEDULER_MODE: integrationModeSchema.scheduler,
  AI_MODE: integrationModeSchema.ai,

  // Explicit, narrowly-scoped escape hatch for local/test fixtures
  // (e.g. seeding a guest session without a real browser flow). Must
  // never be usable in production; enforced below, not just by
  // convention.
  ALLOW_TEST_FIXTURES: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Deployment/operating mode, deliberately separate from NODE_ENV.
  // A production *build* (NODE_ENV=production) can still be a
  // non-live preview deployment; NODE_ENV alone must not be read as
  // "this is collecting real family data." LOCAL: a developer's own
  // machine. PREVIEW: a deployed-but-not-publicly-promoted build
  // (e.g. a PR preview). LIVE: the only mode that may ever collect
  // real guest/family data -- gated further below.
  DEPLOYMENT_MODE: z.enum(["LOCAL", "PREVIEW", "LIVE"]).default("LOCAL"),

  // Bounded guest-session lifetime, shared by the database expiry and
  // the cookie maxAge (see src/server/session-config.ts). Optional
  // here: LOCAL/PREVIEW get a documented illustrative default below;
  // LIVE must set this explicitly (checked below) since a session
  // lifetime is an operating decision, not a code default, once real
  // guest data is involved.
  GUEST_SESSION_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5, "GUEST_SESSION_TTL_MINUTES must be at least 5 minutes")
    .max(44640, "GUEST_SESSION_TTL_MINUTES must be at most 31 days (44640 minutes)")
    .optional(),

  // A single, explicit, human-made acknowledgment that the required
  // operating and privacy approvals for live guest data collection
  // have actually been obtained (see docs/pathways/DECISION_LOG.md
  // section D -- retention periods, privacy notice, terms, etc. are
  // still owner decisions, not implemented by this flag). This flag
  // does not grant those approvals; it only refuses to run in LIVE
  // mode without someone affirmatively setting it, so LIVE mode can
  // never be reached by a missing/default value. No retention or
  // deletion subsystem is implemented by this flag.
  LIVE_DEPLOYMENT_APPROVED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

// Local/test/preview illustrative default only -- see
// GUEST_SESSION_TTL_MINUTES above and docs/pathways/INTEGRATION_REGISTER.md.
// This is a development convenience, never an approved production
// retention or session policy; LIVE mode must set the variable
// explicitly and is refused below if it does not.
const ILLUSTRATIVE_DEV_SESSION_TTL_MINUTES = 60;

const LOOPBACK_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Best-effort loopback-host check; an unparseable string is not this
 * function's concern -- the DATABASE_URL shape refine above already
 * rejects anything that isn't a postgres connection string. The
 * WHATWG URL parser returns a bracketed IPv6 hostname (`[::1]`), so
 * that's normalized to bare `::1` before the Set lookup.
 */
function isLoopbackDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname.replace(/^\[|\]$/g, "");
    return LOOPBACK_DATABASE_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export type Env = z.infer<typeof rawEnvSchema> & {
  isProduction: boolean;
  /** Resolved, always-present TTL in minutes: the configured value, or the illustrative LOCAL/PREVIEW default. Never used to silently supply a default in LIVE mode -- that is refused below instead. */
  resolvedGuestSessionTtlMinutes: number;
};

function loadEnv(): Env {
  const parsed = rawEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Refusing to start.\n${issues}\n` +
        "See .env.example for the required shape. No default value is substituted for a missing or invalid variable.",
    );
  }

  const env = parsed.data;

  // Production readiness check: reject prohibited fixture/bypass
  // flags outright, per master-prompt nonnegotiable behavior 9 and
  // the Phase 1 acceptance criterion "Production must refuse
  // demo-auth/bypass flags."
  if (env.NODE_ENV === "production" && env.ALLOW_TEST_FIXTURES) {
    throw new Error(
      "ALLOW_TEST_FIXTURES=true is set in a production environment. " +
        "Refusing to start. This flag exists only for local/test use.",
    );
  }

  if (env.NODE_ENV === "production" && env.SCHEDULER_MODE === "LIVE_VERIFIED") {
    // Phase 1 does not implement the scheduler adapter's verified
    // webhook/signature handling yet (that is Phase 6). A production
    // process must never claim LIVE_VERIFIED before that exists.
    throw new Error(
      "SCHEDULER_MODE=LIVE_VERIFIED is not implemented until Phase 6. " +
        "Refusing to start in production with an unimplemented live mode claimed.",
    );
  }

  // LIVE deployment mode is the only mode that may ever collect real
  // guest/family data. Both of the following must be explicitly and
  // affirmatively configured -- there is no default that reaches
  // LIVE. This is a narrow activation gate, not a substitute for the
  // actual retention/privacy/terms decisions still tracked as launch
  // decisions in docs/pathways/DECISION_LOG.md section D.
  if (env.DEPLOYMENT_MODE === "LIVE") {
    if (!env.LIVE_DEPLOYMENT_APPROVED) {
      throw new Error(
        "DEPLOYMENT_MODE=LIVE requires LIVE_DEPLOYMENT_APPROVED=true. Refusing to " +
          "start: live guest data collection must not activate without an explicit, " +
          "affirmative acknowledgment that the required operating and privacy " +
          "approvals have actually been obtained.",
      );
    }
    if (env.GUEST_SESSION_TTL_MINUTES === undefined) {
      throw new Error(
        "DEPLOYMENT_MODE=LIVE requires GUEST_SESSION_TTL_MINUTES to be set " +
          "explicitly. Refusing to start: a live session lifetime is an operating " +
          "decision, not a code default.",
      );
    }
  }

  // A deployed, non-LOCAL environment (PREVIEW or LIVE) must never
  // silently fall back to a loopback database host: that host simply
  // does not exist inside a deployed serverless function, and the
  // failure would otherwise surface only at request time as an opaque
  // "ECONNREFUSED 127.0.0.1:5432" rather than at startup with an
  // actionable message (Phase 3B: this is exactly the failure mode the
  // owner hit testing the Vercel preview). LOCAL is exempt -- a
  // developer's own machine legitimately runs Postgres on localhost.
  if (env.DEPLOYMENT_MODE !== "LOCAL" && isLoopbackDatabaseUrl(env.DATABASE_URL)) {
    throw new Error(
      `DATABASE_URL points at a loopback host, which is not reachable from a ` +
        `deployed ${env.DEPLOYMENT_MODE} environment. Configure a remotely ` +
        "accessible PostgreSQL connection string for this environment.",
    );
  }

  const resolvedGuestSessionTtlMinutes =
    env.GUEST_SESSION_TTL_MINUTES ?? ILLUSTRATIVE_DEV_SESSION_TTL_MINUTES;

  return {
    ...env,
    isProduction: env.NODE_ENV === "production",
    resolvedGuestSessionTtlMinutes,
  };
}

export const env = loadEnv();
