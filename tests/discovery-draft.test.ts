import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import {
  loadDraftByToken,
  mapMarketingInterestToHint,
  reopenForEditing,
  saveDraftPatch,
  startDiscoverySession,
  submitDiscoveryProfile,
  hasCompletedRevision,
} from "@/server/discovery-draft";
import { getGuestSessionByToken } from "@/server/session";
import { discoverySession, profileRevision, studentPathwayRecord } from "@/db/schema";

describe.skipIf(!hasTestDatabase)("Discovery draft persistence (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("mapMarketingInterestToHint maps only the allowlisted marketing interests, to canonical DISC_006 values", () => {
    expect(mapMarketingInterestToHint("athletics")).toBe("ATHLETICS");
    expect(mapMarketingInterestToHint("homeschool_support")).toBe("HOMESCHOOL");
    expect(mapMarketingInterestToHint("unsure")).toBe("EXPLORING");
    expect(mapMarketingInterestToHint("<script>alert(1)</script>")).toBeNull();
    expect(mapMarketingInterestToHint(undefined)).toBeNull();
  });

  it("starts a session carrying the question-bank version and an editable interest hint, not a committed answer", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, "ATHLETICS");

    const draft = await loadDraftByToken(db, issued.token);
    expect(draft?.interestHint).toBe("ATHLETICS");
    expect(draft?.rawAnswers.discovery_reasons).toBeUndefined(); // never silently written as an answer
  });

  it("saves a valid draft patch and rejects an invalid one, without touching storage on rejection", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);

    const bad = await saveDraftPatch(db, issued.id, { current_grade: "13" });
    expect(bad.ok).toBe(false);

    const draftBefore = await loadDraftByToken(db, issued.token);
    expect(draftBefore?.rawAnswers.current_grade).toBeUndefined();

    const good = await saveDraftPatch(db, issued.id, { current_grade: "7" });
    expect(good.ok).toBe(true);

    const draftAfter = await loadDraftByToken(db, issued.token);
    expect(draftAfter?.rawAnswers.current_grade).toBe("7");
  });

  it("rejects an unknown field name", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    const result = await saveDraftPatch(db, issued.id, { not_a_real_field: "x" });
    expect(result.ok).toBe(false);
  });

  it("clears the interest hint once a real discovery_reasons answer is saved", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, "HOMESCHOOL");
    await saveDraftPatch(db, issued.id, { discovery_reasons: ["HOMESCHOOL"] });

    const draft = await loadDraftByToken(db, issued.token);
    expect(draft?.interestHint).toBeNull();
    expect(draft?.rawAnswers.discovery_reasons).toEqual(["HOMESCHOOL"]);
  });

  it("sanitizes free text before persisting it", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    await saveDraftPatch(db, issued.id, {
      student_display_name: "<b>Jordan</b>",
    });
    const draft = await loadDraftByToken(db, issued.token);
    expect(draft?.rawAnswers.student_display_name).toBe("Jordan");
  });

  it("survives a resumed lookup within the valid session (refresh/resume)", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    await saveDraftPatch(db, issued.id, { current_grade: "9" });

    // Simulate "refresh": a brand-new lookup call using only the token.
    const resumed = await loadDraftByToken(db, issued.token);
    expect(resumed?.rawAnswers.current_grade).toBe("9");
  });

  function minimalValidRaw() {
    return {
      current_grade: "6",
      residence: { state: "UNKNOWN" },
      current_education_model: "TRADITIONAL_PUBLIC",
      discovery_reasons: ["ATHLETICS"],
      reported_academic_position: "ON_LEVEL",
      learning_support_pattern: "OCCASIONAL_CHECK_INS",
      flexibility_importance: "NOT_IMPORTANT",
      family_priorities: ["FLEXIBILITY"],
      desired_parent_involvement: "REGULAR_SUPPORT",
    };
  }

  it("blocks submission when a required active question is missing", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    await saveDraftPatch(db, issued.id, { current_grade: "6" });

    const result = await submitDiscoveryProfile(db, issued.id);
    expect(result.ok).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("submits a valid profile transactionally: creates a StudentPathwayRecord and ProfileRevision 1, links the session", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    for (const [field, value] of Object.entries(minimalValidRaw())) {
      const saved = await saveDraftPatch(db, issued.id, { [field]: value });
      expect(saved.ok).toBe(true);
    }

    const result = await submitDiscoveryProfile(db, issued.id);
    expect(result.ok).toBe(true);
    expect(result.revisionNumber).toBe(1);
    expect(result.replay).toBe(false);

    const [record] = await db
      .select()
      .from(studentPathwayRecord)
      .where(eq(studentPathwayRecord.id, result.studentPathwayRecordId!));
    expect(record).toBeDefined();

    const [sessionRow] = await db
      .select()
      .from(discoverySession)
      .where(eq(discoverySession.id, issued.id));
    expect(sessionRow!.studentPathwayRecordId).toBe(result.studentPathwayRecordId);

    const [revision] = await db
      .select()
      .from(profileRevision)
      .where(eq(profileRevision.id, result.revisionId!));
    expect(revision!.gradeBand).toBe("MIDDLE");
    expect((revision!.effectiveAnswers as { derived: { athletics_interest: boolean } }).derived.athletics_interest).toBe(
      true,
    );
  });

  it("is idempotent: a duplicate submission of the same draft returns the same revision, not a second one", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    for (const [field, value] of Object.entries(minimalValidRaw())) {
      await saveDraftPatch(db, issued.id, { [field]: value });
    }

    const first = await submitDiscoveryProfile(db, issued.id);
    const second = await submitDiscoveryProfile(db, issued.id);

    expect(first.revisionId).toBe(second.revisionId);
    expect(second.replay).toBe(true);

    const revisions = await db
      .select()
      .from(profileRevision)
      .where(eq(profileRevision.studentPathwayRecordId, first.studentPathwayRecordId!));
    expect(revisions).toHaveLength(1);
  });

  it("an intentional edit and resubmit creates a genuinely new revision", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    for (const [field, value] of Object.entries(minimalValidRaw())) {
      await saveDraftPatch(db, issued.id, { [field]: value });
    }
    const first = await submitDiscoveryProfile(db, issued.id);
    expect(first.revisionNumber).toBe(1);

    await saveDraftPatch(db, issued.id, { current_grade: "9" });
    const second = await submitDiscoveryProfile(db, issued.id);
    expect(second.ok).toBe(true);
    expect(second.revisionNumber).toBe(2);
    expect(second.replay).toBe(false);
    expect(second.revisionId).not.toBe(first.revisionId);
  });

  it("reopenForEditing loads the latest revision's raw answers back into the draft without mutating it", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    for (const [field, value] of Object.entries(minimalValidRaw())) {
      await saveDraftPatch(db, issued.id, { [field]: value });
    }
    const submitted = await submitDiscoveryProfile(db, issued.id);
    expect(submitted.ok).toBe(true);

    // Simulate a fresh page load's draft (as if the browser only kept the cookie).
    await saveDraftPatch(db, issued.id, { current_grade: "9" }); // drifted from the submitted "6"

    const reopened = await reopenForEditing(db, issued.id);
    expect(reopened).toBe(true);

    const draft = await loadDraftByToken(db, issued.token);
    expect(draft?.rawAnswers.current_grade).toBe("6"); // restored from the revision, not the drifted value

    const [revision] = await db
      .select()
      .from(profileRevision)
      .where(eq(profileRevision.id, submitted.revisionId!));
    expect((revision!.rawAnswers as { current_grade: string }).current_grade).toBe("6"); // untouched
  });

  it("hasCompletedRevision is false before submission and true after", async () => {
    const db = testDb!;
    const issued = await startDiscoverySession(db, null);
    expect(await hasCompletedRevision(db, issued.id)).toBe(false);

    for (const [field, value] of Object.entries(minimalValidRaw())) {
      await saveDraftPatch(db, issued.id, { [field]: value });
    }
    await submitDiscoveryProfile(db, issued.id);
    expect(await hasCompletedRevision(db, issued.id)).toBe(true);
  });

  it("a wrong session id cannot read or affect another session's draft", async () => {
    const db = testDb!;
    const sessionA = await startDiscoverySession(db, null);
    const sessionB = await startDiscoverySession(db, null);
    await saveDraftPatch(db, sessionA.id, { current_grade: "5" });

    const draftB = await loadDraftByToken(db, sessionB.token);
    expect(draftB?.rawAnswers.current_grade).toBeUndefined();

    // getGuestSessionByToken (the only supported lookup) never accepts a bare row id as a credential.
    const byRowId = await getGuestSessionByToken(db, sessionA.id);
    expect(byRowId).toBeNull();
  });
});
