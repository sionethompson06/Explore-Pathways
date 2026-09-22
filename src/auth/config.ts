import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "@/db/client";
import { env } from "@/env";
import * as schema from "@/db/schema";

/**
 * Better Auth groundwork only (Phase 1). Verified single-use
 * email-link ("magic link") sign-in, with live sending disabled
 * until separately approved -- see sendMagicLink below and
 * docs/pathways/INTEGRATION_REGISTER.md (EMAIL_MODE=UNCONFIGURED).
 *
 * No custom authentication system, no impersonation route, no public
 * role selector, no dev-login shortcut: this file only configures the
 * standard library, and the only place ALLOW_TEST_FIXTURES is even
 * read is in test setup code, never here.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (env.EMAIL_MODE !== "UNCONFIGURED") {
          // Unreachable until a later phase adds a real mode; this
          // branch exists so adding one forces a deliberate decision
          // here rather than silently falling through.
          throw new Error(
            `EMAIL_MODE "${env.EMAIL_MODE}" has no send implementation yet.`,
          );
        }
        // No live email is sent in Phase 1. In non-production
        // environments this is logged so local/manual testing of the
        // magic-link flow remains possible without a real mail
        // provider; nothing is sent over the network.
        if (!env.isProduction) {
          console.info(
            `[auth:magic-link:not-sent] Would send a sign-in link to ${email}: ${url}`,
          );
        }
      },
    }),
  ],
});
