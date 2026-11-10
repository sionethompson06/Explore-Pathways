import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { buildAuth } from "@/auth/config";
import { parseSetCookieHeader } from "better-auth/cookies";
import { getPrincipal, requirePrincipal } from "@/server/principal";
import { AuthorizationError } from "@/server/access-control";

/**
 * Phase 1A repair item 3, scenario "missing, invalid or unverified
 * request principal: deny at the request-facing authorization
 * boundary." Uses a test-scoped auth instance built from the same
 * buildAuth factory as tests/magic-link.test.ts (never a separate
 * mock), with magic-link unblocked so a real, verified session can be
 * established for the one "valid principal" contrast case.
 */

const TEST_EMAIL = "principal-test@test.example";

describe.skipIf(!hasTestDatabase)("principal boundary (real PostgreSQL)", () => {
  const db = () => testDb!;
  const testAuth = () => buildAuth({ db: db(), blockMagicLink: false });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("a valid, verified session resolves a principal matching the signed-in user", async () => {
    let captured: { email: string; url: string; token: string } | undefined;
    const auth = buildAuth({
      db: db(),
      blockMagicLink: false,
      sendMagicLink: (ctx) => {
        captured = ctx;
      },
    });

    await auth.api.signInMagicLink({
      body: { email: TEST_EMAIL },
      headers: new Headers(),
    });
    expect(captured).toBeDefined();

    const verifyResponse = await auth.api.magicLinkVerify({
      query: { token: captured!.token },
      headers: new Headers(),
      asResponse: true,
    });
    const sessionTokenCookie = parseSetCookieHeader(
      verifyResponse.headers.get("set-cookie") ?? "",
    ).get("better-auth.session_token")?.value;
    expect(sessionTokenCookie).toBeTruthy();

    const requestHeaders = new Headers({
      cookie: `better-auth.session_token=${sessionTokenCookie}`,
    });

    const principal = await getPrincipal(requestHeaders, auth);
    expect(principal).not.toBeNull();
    expect(principal?.email).toBe(TEST_EMAIL);

    await expect(
      requirePrincipal(requestHeaders, auth),
    ).resolves.toMatchObject({ email: TEST_EMAIL });
  });

  it("a request with no session cookie at all resolves no principal, and requirePrincipal denies", async () => {
    const auth = testAuth();
    const noCookieHeaders = new Headers();

    const principal = await getPrincipal(noCookieHeaders, auth);
    expect(principal).toBeNull();

    await expect(requirePrincipal(noCookieHeaders, auth)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("a fabricated/tampered session cookie value never resolves a principal", async () => {
    const auth = testAuth();
    const forgedHeaders = new Headers({
      cookie: "better-auth.session_token=not-a-real-signed-session-value",
    });

    const principal = await getPrincipal(forgedHeaders, auth);
    expect(principal).toBeNull();

    await expect(requirePrincipal(forgedHeaders, auth)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("a real session's cookie value stops resolving a principal after sign-out", async () => {
    let captured: { email: string; url: string; token: string } | undefined;
    const auth = buildAuth({
      db: db(),
      blockMagicLink: false,
      sendMagicLink: (ctx) => {
        captured = ctx;
      },
    });

    await auth.api.signInMagicLink({
      body: { email: TEST_EMAIL },
      headers: new Headers(),
    });
    const verifyResponse = await auth.api.magicLinkVerify({
      query: { token: captured!.token },
      headers: new Headers(),
      asResponse: true,
    });
    const sessionTokenCookie = parseSetCookieHeader(
      verifyResponse.headers.get("set-cookie") ?? "",
    ).get("better-auth.session_token")?.value;
    const requestHeaders = new Headers({
      cookie: `better-auth.session_token=${sessionTokenCookie}`,
    });

    expect(await getPrincipal(requestHeaders, auth)).not.toBeNull();

    await auth.api.signOut({ headers: requestHeaders });

    const principalAfterSignOut = await getPrincipal(requestHeaders, auth);
    expect(principalAfterSignOut).toBeNull();
    await expect(requirePrincipal(requestHeaders, auth)).rejects.toThrow(
      AuthorizationError,
    );
  });
});
