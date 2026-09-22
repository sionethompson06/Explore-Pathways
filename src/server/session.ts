import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import type { Database } from "@/db/client";
import { discoverySession } from "@/db/schema";
import { generateId } from "./ids";
import {
  guestSessionTtlMs,
  guestSessionTtlSeconds,
  isSecureCookieDeploymentMode,
} from "./session-config";

/**
 * Guest session issuance and lookup. Implements Specification 07
 * "Ownership and privacy": "Guest receives a cryptographically
 * random, HttpOnly, Secure ... session cookie. Server stores only the
 * needed draft behind that session." The raw token is the bearer
 * secret that belongs in the cookie; only its hash is ever persisted,
 * so a database read alone (e.g. a leaked row, a log line, a stray
 * SELECT *) can never be replayed as a valid session -- this is what
 * OWASP API1:2023 (Broken Object Level Authorization) means by
 * "identifiers alone do not provide authorization" applied to
 * sessions specifically.
 *
 * Session expiry is not data deletion: an expired session simply
 * stops being a valid credential. The underlying row (and anything it
 * links to) is subject to the separate, not-yet-implemented
 * retention/deletion policy tracked in
 * docs/pathways/DECISION_LOG.md section D -- this module invents no
 * retention period of its own.
 */

const TOKEN_BYTES = 32; // 256 bits of entropy

export interface IssuedGuestSession {
  /** Persisted row id -- NOT a credential, safe to log/reference. */
  id: string;
  /** The raw bearer secret. Set as the HttpOnly cookie value; never persisted, never logged. */
  token: string;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createGuestSession(
  db: Database,
): Promise<IssuedGuestSession> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const id = generateId("dsess");
  const expiresAt = new Date(Date.now() + guestSessionTtlMs);

  await db.insert(discoverySession).values({
    id,
    tokenHash,
    expiresAt,
  });

  return { id, token, expiresAt };
}

/**
 * The only supported way to look up a guest session: by presenting
 * the raw bearer token (as read from the HttpOnly cookie), never by
 * the row id alone. Returns null for a missing, expired, or unknown
 * token -- callers must not distinguish "wrong token" from "expired"
 * in any user-facing response, to avoid turning this into an
 * enumeration oracle.
 */
export async function getGuestSessionByToken(db: Database, token: string) {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(discoverySession)
    .where(
      and(
        eq(discoverySession.tokenHash, tokenHash),
        gt(discoverySession.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const GUEST_SESSION_COOKIE_NAME = "pathways_guest_session";

/**
 * Cookie attributes for the guest session token. `secure` reflects
 * DEPLOYMENT_MODE (see session-config.ts's
 * isSecureCookieDeploymentMode), not NODE_ENV -- a production build
 * is not necessarily a live HTTPS deployment, and this function does
 * not itself inspect any inbound request's protocol (no route sets
 * this cookie yet; see session-config.ts's doc comment for what a
 * future route should additionally check). `maxAge` and the database
 * expiry above are both derived from the same guestSessionTtl*
 * constants, so they cannot drift apart.
 */
export function guestSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureCookieDeploymentMode(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: guestSessionTtlSeconds,
  };
}
