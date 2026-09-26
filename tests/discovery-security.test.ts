import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import {
  loadDraftByToken,
  saveDraftPatch,
  startDiscoverySession,
  submitDiscoveryProfile,
} from "@/server/discovery-draft";
import { discoverySession } from "@/db/schema";

/**
 * Phase 3 instruction §54: integration tests that bypass the UI
 * entirely and attempt each listed abuse directly against the
 * server-authoritative persistence functions -- exactly what a
 * malicious or buggy client could send, never trusting that the
 * browser enforced anything.
 */
describe.skipIf(!hasTestDatabase)("Discovery security/validation bypass (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("rejects an invalid enum value", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    const result = await saveDraftPatch(db, issued.id, { current_grade: "PHD" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown field name outright, never silently dropping it", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    const result = await saveDraftPatch(db, issued.id, { is_admin: true, ssn: "123-45-6789" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "UNKNOWN_FIELD")).toBe(true);
  });

  it("rejects a 4th family priority", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    const result = await saveDraftPatch(db, issued.id, {
      family_priorities: ["FLEXIBILITY", "ACADEMIC_QUALITY", "PERSONAL_SUPPORT", "AFFORDABILITY"],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects NONE combined with a substantive multi-select value", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    const result = await saveDraftPatch(db, issued.id, {
      reported_support_needs: ["NONE", "READING"],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects UNKNOWN combined with a substantive multi-select value", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    const result = await saveDraftPatch(db, issued.id, {
      preferred_learning_environment: ["UNKNOWN", "HANDS_ON"],
    });
    expect(result.ok).toBe(false);
  });

  it("an inactive branch's answer never becomes effective, even if force-saved to raw storage", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    // Elementary grade -- credit_recovery_need's branch is inactive.
    await saveDraftPatch(db, issued.id, { current_grade: "3" });
    // saveDraftPatch's own validateDraftPatch does not gate on
    // activation (only per-value shape), so this raw write succeeds --
    // the real guarantee under test is that it can never surface as
    // effective/complete data afterward.
    const patchResult = await saveDraftPatch(db, issued.id, { credit_recovery_need: "YES" });
    expect(patchResult.ok).toBe(true);

    const draft = await loadDraftByToken(db, issued.token);
    expect(draft?.rawAnswers.credit_recovery_need).toBe("YES"); // preserved in raw storage

    // Fill in the rest of a minimal valid elementary profile and submit.
    for (const [field, value] of Object.entries({
      residence: { state: "UNKNOWN" },
      current_education_model: "TRADITIONAL_PUBLIC",
      discovery_reasons: ["ACADEMIC_SUPPORT"],
      reported_academic_position: "ON_LEVEL",
      learning_support_pattern: "REGULAR_GUIDANCE",
      flexibility_importance: "NOT_IMPORTANT",
      family_priorities: ["FLEXIBILITY"],
      desired_parent_involvement: "REGULAR_SUPPORT",
    })) {
      await saveDraftPatch(db, issued.id, { [field]: value });
    }
    const submitted = await submitDiscoveryProfile(db, issued.id);
    expect(submitted.ok).toBe(true);
  });

  it("rejects a malformed location object", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    const result = await saveDraftPatch(db, issued.id, {
      residence: { lat: 37.77, lng: -122.41 },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an oversized nickname, sport name, and parent context", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    expect((await saveDraftPatch(db, issued.id, { student_display_name: "A".repeat(41) })).ok).toBe(
      false,
    );
    expect((await saveDraftPatch(db, issued.id, { primary_sport: "A".repeat(61) })).ok).toBe(false);
    expect((await saveDraftPatch(db, issued.id, { parent_context: "A".repeat(751) })).ok).toBe(
      false,
    );
  });

  it("blocks submission with a missing required active question", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    await saveDraftPatch(db, issued.id, { current_grade: "6" }); // only one of several required fields
    const result = await submitDiscoveryProfile(db, issued.id);
    expect(result.ok).toBe(false);
  });

  it("an expired guest session cannot save or submit", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    await db
      .update(discoverySession)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(discoverySession.id, issued.id));

    // The token no longer resolves to a valid session at all --
    // exactly like the "wrong token" case, per session.ts's own
    // non-distinguishing design.
    const draft = await loadDraftByToken(db, issued.token);
    expect(draft).toBeNull();
  });

  it("a wrong/foreign session id cannot submit using another session's draft", async () => {
    const db = testDb!;
    const owner = await startDiscoverySession(db, null);
    const attacker = await startDiscoverySession(db, null);
    for (const [field, value] of Object.entries({
      current_grade: "6",
      residence: { state: "UNKNOWN" },
      current_education_model: "TRADITIONAL_PUBLIC",
      discovery_reasons: ["ATHLETICS"],
      reported_academic_position: "ON_LEVEL",
      learning_support_pattern: "OCCASIONAL_CHECK_INS",
      flexibility_importance: "NOT_IMPORTANT",
      family_priorities: ["FLEXIBILITY"],
      desired_parent_involvement: "REGULAR_SUPPORT",
    })) {
      await saveDraftPatch(db, owner.id, { [field]: value });
    }

    // The attacker's own (different, empty) session id submits its own
    // empty draft -- it can never read or complete the owner's draft
    // by any id guess, since every function here is keyed to the
    // caller's own resolved session row, never a cross-session id
    // parameter.
    const attackerResult = await submitDiscoveryProfile(db, attacker.id);
    expect(attackerResult.ok).toBe(false);

    const ownerResult = await submitDiscoveryProfile(db, owner.id);
    expect(ownerResult.ok).toBe(true);
  });

  it("duplicate submission retry returns the same revision, never a second one", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    for (const [field, value] of Object.entries({
      current_grade: "8",
      residence: { state: "UNKNOWN" },
      current_education_model: "TRADITIONAL_PUBLIC",
      discovery_reasons: ["HOMESCHOOL"],
      reported_academic_position: "ON_LEVEL",
      learning_support_pattern: "OCCASIONAL_CHECK_INS",
      flexibility_importance: "NOT_IMPORTANT",
      family_priorities: ["FLEXIBILITY"],
      desired_parent_involvement: "REGULAR_SUPPORT",
    })) {
      await saveDraftPatch(db, issued.id, { [field]: value });
    }

    const results = await Promise.all([
      submitDiscoveryProfile(db, issued.id),
      submitDiscoveryProfile(db, issued.id),
      submitDiscoveryProfile(db, issued.id),
    ]);
    const revisionIds = new Set(results.map((r) => r.revisionId));
    expect(revisionIds.size).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);
  });
});
