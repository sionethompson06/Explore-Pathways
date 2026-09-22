import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db, type Database } from "@/db/client";
import { env, type Env } from "@/env";
import * as schema from "@/db/schema";
import { guestSessionTtlSeconds } from "@/server/session-config";

/**
 * Better Auth groundwork only (Phase 1). Verified single-use
 * email-link ("magic link") sign-in. Live sending is not implemented
 * for any EMAIL_MODE this app currently supports (only
 * "UNCONFIGURED" exists -- see src/env.ts), so magic-link initiation
 * is blocked before Better Auth's own handler runs, per Phase 1A
 * repair item 2. Nothing in this file logs an email address,
 * sign-in URL, or token -- see PHASE_1A_REPAIR notes below and
 * tests/magic-link.test.ts.
 */

export interface MagicLinkSendContext {
  email: string;
  url: string;
  token: string;
}
export type SendMagicLinkFn = (
  ctx: MagicLinkSendContext,
) => Promise<void> | void;

/**
 * Pure, DB-free, so it is unit-testable without touching Postgres.
 * The only EMAIL_MODE this app currently implements is
 * "UNCONFIGURED" (src/env.ts's Zod schema enforces that), so this is
 * always true in the real, deployed app; a later phase that adds a
 * real send implementation changes this function, not a bypass flag.
 */
export function shouldBlockMagicLink(emailMode: Env["EMAIL_MODE"]): boolean {
  return emailMode === "UNCONFIGURED";
}

/**
 * Never invoked in the real app: when blockMagicLink is true (every
 * EMAIL_MODE this app currently implements), the before-hook below
 * throws before Better Auth's /sign-in/magic-link handler -- and
 * therefore this function -- ever runs. It exists only because the
 * magicLink plugin's types require a sendMagicLink callback.
 */
const unreachableSend: SendMagicLinkFn = async () => {
  throw new Error(
    "sendMagicLink was invoked despite magic-link being blocked. The " +
      "before-hook that should have intercepted this request did not run " +
      "-- this indicates a bug in the block wiring, not a live email path.",
  );
};

export interface BuildAuthOptions {
  /** Test-harness override only; the real app always uses the shared db client. */
  db?: Database;
  /** Defaults to true (blocked). Test-harness override only -- never set to false by src/auth/config.ts's own exported `auth`. */
  blockMagicLink?: boolean;
  /** Test-harness override only, and only meaningful when blockMagicLink is false. Must never be selectable from the running app; see BuildAuthOptions doc above. */
  sendMagicLink?: SendMagicLinkFn;
}

/**
 * A stable, non-sensitive response for a blocked magic-link request.
 * Never includes the requested email, a generated token, or a
 * sign-in URL -- there is nothing to include, since the before-hook
 * intercepts the request before Better Auth's handler creates any of
 * those.
 */
function magicLinkUnavailableError(): APIError {
  return new APIError("SERVICE_UNAVAILABLE", {
    message: "Sign-in by email link is not available yet.",
    code: "MAGIC_LINK_UNAVAILABLE",
  });
}

export function buildAuth(options: BuildAuthOptions = {}) {
  const database = options.db ?? db;
  const blockMagicLink = options.blockMagicLink ?? true;
  const sendMagicLink = options.sendMagicLink ?? unreachableSend;

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: false,
    },
    session: {
      expiresIn: guestSessionTtlSeconds,
      updateAge: 0,
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url, token }) => {
          await sendMagicLink({ email, url, token });
        },
      }),
    ],
    // Blocks initiation at the request level, before
    // createVerificationValue or sendMagicLink ever run -- so a
    // blocked request creates no verification row and reaches no
    // send path at all, not merely a send path that declines to
    // deliver. The path check targets exactly one endpoint; every
    // other endpoint (get-session included) passes through
    // untouched, since this middleware returns normally for any
    // other path.
    hooks: blockMagicLink
      ? {
          before: createAuthMiddleware(async (ctx) => {
            if (ctx.path === "/sign-in/magic-link") {
              throw magicLinkUnavailableError();
            }
          }),
        }
      : undefined,
  });
}

export const auth = buildAuth({
  blockMagicLink: shouldBlockMagicLink(env.EMAIL_MODE),
});
