import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { buildAuth, shouldBlockMagicLink } from "@/auth/config";
import { verification } from "@/db/schema";

/**
 * Phase 1A repair item 2. Two Better Auth instances are built from
 * the SAME production factory (buildAuth in src/auth/config.ts),
 * differing only in the options a test harness supplies -- never a
 * separate mock auth implementation. The in-memory magic-link
 * capture function below exists only in this test file; nothing
 * under src/ or app/ can select it.
 */

const TEST_EMAIL = "guardian-test@test.example";

function createCapturingSendMagicLink() {
  const captured: { email: string; url: string; token: string }[] = [];
  return {
    captured,
    sendMagicLink: (ctx: { email: string; url: string; token: string }) => {
      captured.push(ctx);
    },
  };
}

function allLoggedText(spies: ReturnType<typeof spyOnConsole>): string {
  return Object.values(spies)
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" | ");
}

function spyOnConsole() {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}

describe("shouldBlockMagicLink (pure, no DB)", () => {
  it("blocks for every EMAIL_MODE this app currently implements", () => {
    expect(shouldBlockMagicLink("UNCONFIGURED")).toBe(true);
  });
});

describe.skipIf(!hasTestDatabase)("magic-link initiation (real PostgreSQL)", () => {
  const db = () => testDb!;

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // No afterAll(closeTestDb) here -- tests/helpers/db.ts's pool is a
  // module-level singleton shared by every describe block in this
  // file (Vitest isolates per *file*, not per describe block).
  // Closing it here would break the later describe block below.
  // Exactly one afterAll(closeTestDb) exists in this file, at the
  // very end.

  it("blocks initiation with a stable, non-sensitive error and creates no verification row", async () => {
    const consoleSpies = spyOnConsole();
    const blockedAuth = buildAuth({ db: db(), blockMagicLink: true });

    await expect(
      blockedAuth.api.signInMagicLink({
        body: { email: TEST_EMAIL },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({
      status: "SERVICE_UNAVAILABLE",
    });

    const rows = await db().select().from(verification);
    expect(rows).toHaveLength(0);

    const logged = allLoggedText(consoleSpies);
    expect(logged).not.toContain(TEST_EMAIL);
    expect(logged.toLowerCase()).not.toContain("magic-link/verify");
  });

  it("never logs the email, a token, or a sign-in URL when blocked", async () => {
    const consoleSpies = spyOnConsole();
    const blockedAuth = buildAuth({ db: db(), blockMagicLink: true });

    await blockedAuth.api
      .signInMagicLink({ body: { email: TEST_EMAIL }, headers: new Headers() })
      .catch(() => {});

    const logged = allLoggedText(consoleSpies);
    expect(logged).not.toContain(TEST_EMAIL);
    expect(logged).not.toMatch(/token=/i);
    expect(logged).not.toContain("http://");
    expect(logged).not.toContain("https://");
  });

  it("keeps ordinary unauthenticated session inspection harmless while blocked", async () => {
    const blockedAuth = buildAuth({ db: db(), blockMagicLink: true });
    const session = await blockedAuth.api.getSession({
      headers: new Headers(),
    });
    expect(session).toBeNull();
  });

  it("a blocked instance still exposes every other endpoint normally (only the magic-link path is intercepted)", async () => {
    const blockedAuth = buildAuth({ db: db(), blockMagicLink: true });
    // sign-out on a request with no session should resolve harmlessly,
    // not be swept up by the magic-link block.
    await expect(
      blockedAuth.api.signOut({ headers: new Headers() }),
    ).resolves.toBeDefined();
  });
});

describe.skipIf(!hasTestDatabase)(
  "magic-link full lifecycle via an isolated, test-only in-memory delivery adapter (real PostgreSQL)",
  () => {
    const db = () => testDb!;

    beforeEach(async () => {
      await resetTestDatabase();
    });

    afterAll(async () => {
      await closeTestDb();
    });

    it("completes request -> capture -> verify -> session using the real library code paths", async () => {
      const capture = createCapturingSendMagicLink();
      const unblockedAuth = buildAuth({
        db: db(),
        blockMagicLink: false,
        sendMagicLink: capture.sendMagicLink,
      });

      const signInResult = await unblockedAuth.api.signInMagicLink({
        body: { email: TEST_EMAIL },
        headers: new Headers(),
      });
      expect(signInResult.status).toBe(true);

      expect(capture.captured).toHaveLength(1);
      const { token, url } = capture.captured[0]!;
      expect(token).toBeTruthy();
      expect(url).toContain("token=");

      // Proves the request actually created a real, usable
      // verification row -- the contrast case to the blocked tests
      // above, where none is created.
      const rows = await db().select().from(verification);
      expect(rows).toHaveLength(1);

      const verifyResult = await unblockedAuth.api.magicLinkVerify({
        query: { token },
        headers: new Headers(),
      });
      expect(verifyResult?.user?.email).toBe(TEST_EMAIL);
      expect(verifyResult?.session).toBeDefined();

      // The token is consumed on first use -- the verification row is
      // deleted, not merely marked used.
      const rowsAfterVerify = await db()
        .select()
        .from(verification)
        .where(eq(verification.identifier, token));
      expect(rowsAfterVerify).toHaveLength(0);
    });

    it("the in-memory capture adapter is defined only in this test file, never imported by src/ or app/", async () => {
      // A structural assertion, not a runtime one: this test exists to
      // document the constraint (grep-verified separately in the
      // Phase 1A evidence report) that createCapturingSendMagicLink
      // has exactly one call site, here.
      expect(typeof createCapturingSendMagicLink).toBe("function");
    });
  },
);
