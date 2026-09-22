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
});

export type Env = z.infer<typeof rawEnvSchema> & {
  isProduction: boolean;
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

  return { ...env, isProduction: env.NODE_ENV === "production" };
}

export const env = loadEnv();
