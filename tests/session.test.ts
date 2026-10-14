import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import {
  createGuestSession,
  getGuestSessionByToken,
  guestSessionCookieOptions,
} from "@/server/session";
import { guestSessionTtlSeconds } from "@/server/session-config";
import { discoverySession } from "@/db/schema";

describe.skipIf(!hasTestDatabase)("guest session issuance and lookup (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("creates a session whose raw token is never the persisted value", async () => {
    const db = testDb!;
    const issued = await createGuestSession(db);

    const [row] = await db
      .select()
      .from(discoverySession)
      .where(eq(discoverySession.id, issued.id));

    expect(row).toBeDefined();
    expect(row!.tokenHash).not.toBe(issued.token);
    expect(row!.tokenHash).toHaveLength(64); // sha256 hex
  });

  it("resolves a session by its raw token", async () => {
    const db = testDb!;
    const issued = await createGuestSession(db);

    const found = await getGuestSessionByToken(db, issued.token);
    expect(found?.id).toBe(issued.id);
  });

  it("returns null for a well-formed but wrong token", async () => {
    const db = testDb!;
    await createGuestSession(db);

    const found = await getGuestSessionByToken(db, "not-the-real-token-at-all");
    expect(found).toBeNull();
  });

  it("returns null for an expired session, never exposing it as valid", async () => {
    const db = testDb!;
    const issued = await createGuestSession(db);

    await db
      .update(discoverySession)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(discoverySession.id, issued.id));

    const found = await getGuestSessionByToken(db, issued.token);
    expect(found).toBeNull();
  });

  it("respects the configured TTL: the database expiry matches guestSessionTtlSeconds, not a hardcoded value", async () => {
    const db = testDb!;
    const before = Date.now();
    const issued = await createGuestSession(db);
    const after = Date.now();

    const actualTtlMs = issued.expiresAt.getTime() - before;
    const maxPossibleTtlMs = issued.expiresAt.getTime() - after;

    // Allow slack only for the test's own execution time, not for any
    // ambiguity about which TTL was applied.
    expect(actualTtlMs).toBeGreaterThanOrEqual(guestSessionTtlSeconds * 1000 - 5000);
    expect(maxPossibleTtlMs).toBeLessThanOrEqual(guestSessionTtlSeconds * 1000);
  });

  it("keeps the cookie maxAge and the database expiry derived from the same configured TTL (Phase 1A repair item 5)", () => {
    expect(guestSessionCookieOptions().maxAge).toBe(guestSessionTtlSeconds);
  });
});
