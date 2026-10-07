import "server-only";
import { env } from "@/env";

/**
 * The single source of truth for guest-session lifetime, shared by
 * the database expiry (src/server/session.ts) and the Better Auth
 * session config (src/auth/config.ts) and cookie maxAge, so the three
 * can never silently drift apart. Backed by env.resolvedGuestSessionTtlMinutes
 * (src/env.ts), which is itself bounded and, in DEPLOYMENT_MODE=LIVE,
 * required to be set explicitly rather than defaulted -- see that
 * file for the full gate. This module does not implement retention
 * or deletion; a session expiring is not the same as data being
 * deleted (see docs/pathways/DECISION_LOG.md section D).
 */
export const guestSessionTtlMinutes = env.resolvedGuestSessionTtlMinutes;
export const guestSessionTtlSeconds = guestSessionTtlMinutes * 60;
export const guestSessionTtlMs = guestSessionTtlSeconds * 1000;

/**
 * Whether the guest-session cookie should be marked Secure.
 *
 * This is deliberately keyed on DEPLOYMENT_MODE, not NODE_ENV: a
 * production *build* is not necessarily a live HTTPS deployment (a
 * preview build can still run over plain HTTP in some hosts), and a
 * non-production build is not necessarily insecure. LOCAL is assumed
 * non-HTTPS (typically http://localhost) and never marked Secure, or
 * browsers will silently refuse to store the cookie at all and break
 * local development outright. PREVIEW and LIVE are assumed to be
 * served over HTTPS by infrastructure convention (both are real
 * deployments, not a developer's own machine).
 *
 * This is a deployment-mode-based approximation, not a per-request
 * protocol check -- no route sets this cookie yet in Phase 1 (that is
 * Phase 3). When a route does, prefer checking the actual inbound
 * request (e.g. `x-forwarded-proto` behind a proxy, or the request
 * URL's scheme) and fall back to this function's result only when
 * that signal is unavailable, so a misconfigured proxy cannot report
 * HTTPS when the deployment mode says otherwise.
 */
export function isSecureCookieDeploymentMode(): boolean {
  return env.DEPLOYMENT_MODE !== "LOCAL";
}
