import { randomBytes, createHash } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import type { Database } from "@/db/client";
import { discoverySession } from "@/db/schema";
import { generateId } from "./ids";

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
 */

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
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
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

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

/** Cookie attributes for the guest session token. Secure is conditional on the deployment actually being HTTPS. */
export function guestSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
