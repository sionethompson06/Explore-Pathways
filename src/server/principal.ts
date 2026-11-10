import "server-only";
import { auth } from "@/auth/config";
import { AuthorizationError } from "./access-control";

/**
 * The reusable, server-only request principal boundary (Phase 1A
 * repair item 3). This is the ONLY supported way to answer "who is
 * making this request" for any future request-facing operation
 * (a route handler, a server action). A client-supplied user ID,
 * email, or role -- a request body field, a query parameter, a
 * custom header like `x-user-id` -- is never a principal; only a
 * verified Better Auth session is. Everything in access-control.ts
 * takes a raw `...UserId: string` because it is the internal layer
 * *behind* this boundary: a route handler calls getPrincipal/
 * requirePrincipal first, and only ever passes principal.userId (not
 * a value taken from the request body) into an access-control.ts
 * function.
 */

export interface Principal {
  userId: string;
  email: string;
}

type SessionApi = Pick<typeof auth, "api">;

/**
 * Returns the verified principal for this request, or null if there
 * is no valid session. Accepts an injectable auth instance so tests
 * can supply one built against a disposable test database (see
 * tests/principal.test.ts); the real app never passes this parameter
 * and always gets the shared `auth` instance.
 */
export async function getPrincipal(
  headers: Headers,
  authInstance: SessionApi = auth,
): Promise<Principal | null> {
  const session = await authInstance.api.getSession({ headers });
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email };
}

/** Throws AuthorizationError instead of returning null -- for handlers that require a verified principal to proceed at all. */
export async function requirePrincipal(
  headers: Headers,
  authInstance: SessionApi = auth,
): Promise<Principal> {
  const principal = await getPrincipal(headers, authInstance);
  if (!principal) {
    throw new AuthorizationError(
      "No verified session; a request principal is required for this operation.",
    );
  }
  return principal;
}
