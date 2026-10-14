import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { startDiscoverySession, saveDraftPatch, submitDiscoveryProfile } from "@/server/discovery-draft";
import { submitConsultationContact } from "@/server/consultation";
import { createInternalBooking } from "@/server/booking";
import { getCaseForConsultationRequest } from "@/server/pathways-case";
import { assignAdvisorToCase } from "@/server/advisor-assignment";
import { completePlanningCall, getPrimaryPlanningCallRecord } from "@/server/planning-call";
import {
  createOrOpenBlueprint,
  saveBlueprintDraft,
  moveBlueprintToInternalReview,
  markBlueprintReadyForClient,
  createNewBlueprintRevision,
  getCurrentBlueprintRevision,
  listBlueprintRevisions,
} from "@/server/blueprint";
import { parseBlueprintContent, completenessIssues, type BlueprintContent } from "@/lib/blueprint/content-schema";
import {
  user,
  staffRole,
  advisorAssignment,
  studentSuccessBlueprint,
  auditEvent,
  pathwaysCase,
} from "@/db/schema";
import { PLANNING_TIME_ZONE } from "@/lib/consultation/scheduling-policy";
import { zonedWallTimeToUtc } from "@/lib/consultation/timezone";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import type { Database } from "@/db/client";

/**
 * Phase 6E integration coverage (docs/pathways
 * PHASE6E_BLUEPRINT_AUTHORING.md "Required tests", 36 scenarios) --
 * all against real PostgreSQL, the same convention as
 * tests/planning-call.test.ts.
 */

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

const NOW = new Date("2026-01-05T15:00:00.000Z");
const VALID_SLOT = zonedWallTimeToUtc(2026, 1, 7, 10, 0, 0, PLANNING_TIME_ZONE);

async function completeDiscoveryWithContact(db: Database, email = "pat@example.com") {
  const issued = await startDiscoverySession(db, null);
  for (const [field, value] of Object.entries(minimalValidRaw())) {
    await saveDraftPatch(db, issued.id, { [field]: value });
  }
  const submission = await submitDiscoveryProfile(db, issued.id);
  const contact: ConsultationContactInput = {
    guardianName: "Pat Guardian",
    email,
    mobilePhone: "555-123-4567",
    preferredCallFormat: "VIDEO",
    consentAcknowledged: true,
  };
  const result = await submitConsultationContact(db, issued.id, contact);
  if (!result.ok) throw new Error("Setup failed: contact submission did not succeed");
  const theCase = await getCaseForConsultationRequest(db, result.consultationRequestId);
  if (!theCase) throw new Error("Setup failed: no case created");
  if (!submission.ok) throw new Error("Setup failed: submission not ok");
  return {
    sessionId: issued.id,
    pathwaysCaseId: theCase.id,
    profileRevisionId: theCase.profileRevisionId,
    reportSnapshotId: theCase.reportSnapshotId,
  };
}

let staffCounter = 0;
async function createStaffUser(db: Database, role: "ADVISOR" | "ADMIN" | null) {
  staffCounter += 1;
  const userId = `test_user_${staffCounter}`;
  await db.insert(user).values({ id: userId, email: `${userId}@pathways.test`, name: `Test ${userId}` });
  if (role) {
    await db.insert(staffRole).values({ id: `test_role_${staffCounter}`, userId, role });
  }
  return userId;
}

async function setupAssignedCase(db: Database, email = "pat@example.com") {
  const a = await completeDiscoveryWithContact(db, email);
  const adminId = await createStaffUser(db, "ADMIN");
  const advisorId = await createStaffUser(db, "ADVISOR");
  const assigned = await assignAdvisorToCase(db, {
    pathwaysCaseId: a.pathwaysCaseId,
    advisorUserId: advisorId,
    assignedByUserId: adminId,
  });
  if (!assigned.ok) throw new Error("Setup failed: assignment did not succeed");
  return { ...a, adminId, advisorId };
}

/** An eligible case: assigned advisor, booked, Planning Call completed with ATTENDED/CONTINUE_TO_BLUEPRINT. */
async function setupEligibleCase(db: Database, email = "pat@example.com") {
  const s = await setupAssignedCase(db, email);
  await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
  const completed = await completePlanningCall(db, {
    pathwaysCaseId: s.pathwaysCaseId,
    advisorUserId: s.advisorId,
    expectedVersion: 0,
    attendance: "ATTENDED",
    outcome: "CONTINUE_TO_BLUEPRINT",
    content: {},
  });
  if (!completed.ok) throw new Error("Setup failed: planning call completion did not succeed: " + completed.reason);
  const planningCallRecord = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
  if (!planningCallRecord) throw new Error("Setup failed: no planning call record");
  return { ...s, planningCallRecord };
}

/** A minimal content object that satisfies the READY_FOR_CLIENT completeness gate. */
function completeContent(base: BlueprintContent): BlueprintContent {
  return parseBlueprintContent({
    ...base,
    b01: { ...base.b01, statedGoals: "Wants more flexibility for travel." },
    b02: { ...base.b02, confirmedPrimaryGoal: "Flexible schedule that supports travel." },
    b04: { ...base.b04, recommendedModelIds: ["B01"], alignmentRationale: "Keeps current school with added flexibility." },
    b10: { ...base.b10, items: [{ id: "a1", text: "Enroll in recommended model", owner: "FAMILY", status: "NOT_STARTED" }] },
    b12: { ...base.b12, summary: "Recommend B01 with flexible-schedule support." },
  });
}

describe.skipIf(!hasTestDatabase)("Phase 6E Student Success Blueprint (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // ---------------------------------------------------------------------
  // A. Eligibility & creation
  // ---------------------------------------------------------------------

  it("1. an eligible completed Planning Call allows Blueprint creation (revision 1, DRAFT, isCurrent)", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.created).toBe(true);

    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current?.status).toBe("DRAFT");
    expect(current?.isCurrent).toBe(true);
    expect(current?.revisionNumber).toBe(1);
  });

  it("2. no Planning Call record at all is NOT_ELIGIBLE", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db, "noplanningcall@example.com");
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_ELIGIBLE");
  });

  it("3. a DRAFT (not completed) Planning Call is NOT_ELIGIBLE", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db, "draftonly@example.com");
    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    const { savePlanningCallDraft } = await import("@/server/planning-call");
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: { familyMainGoal: "x" },
    });
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_ELIGIBLE");
  });

  it("4. a completed Planning Call with a non-CONTINUE_TO_BLUEPRINT outcome is NOT_ELIGIBLE", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db, "followup@example.com");
    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    const completed = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      attendance: "ATTENDED",
      outcome: "FOLLOW_UP",
      content: {},
    });
    expect(completed.ok).toBe(true);
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_ELIGIBLE");
  });

  it("5. creation is idempotent -- a second call reselects the same parent and revision", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const first = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    const second = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error();
    expect(second.created).toBe(false);
    expect(second.blueprintId).toBe(first.blueprintId);
    expect(second.revisionId).toBe(first.revisionId);
  });

  it("6. at most one StudentSuccessBlueprint row exists per PathwaysCase (DB-enforced)", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    const rows = await db.select().from(studentSuccessBlueprint).where(eq(studentSuccessBlueprint.pathwaysCaseId, s.pathwaysCaseId));
    expect(rows.length).toBe(1);
  });

  // ---------------------------------------------------------------------
  // B. Authorization
  // ---------------------------------------------------------------------

  it("7. a user with no staff role at all is NOT_AUTHORIZED", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const nonStaffId = await createStaffUser(db, null);
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: nonStaffId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_AUTHORIZED");
  });

  it("8. an ADVISOR with no assignment to this case is NOT_AUTHORIZED", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const otherAdvisorId = await createStaffUser(db, "ADVISOR");
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: otherAdvisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_AUTHORIZED");
  });

  it("9. an ADMIN-only user with no assignment to this case is NOT_AUTHORIZED (no admin bypass)", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.adminId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_AUTHORIZED");
  });

  it("10. a former advisor (since unassigned) is denied Blueprint creation", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    await db.update(advisorAssignment).set({ unassignedAt: new Date() }).where(eq(advisorAssignment.advisorUserId, s.advisorId));
    const result = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_AUTHORIZED");
  });

  it("11. a former advisor is denied saveBlueprintDraft on an already-created revision", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await db.update(advisorAssignment).set({ unassignedAt: new Date() }).where(eq(advisorAssignment.advisorUserId, s.advisorId));

    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: current!.content,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_AUTHORIZED");
  });

  it("12. a former advisor is denied moveToInternalReview, markReadyForClient, and createNewRevision", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await db.update(advisorAssignment).set({ unassignedAt: new Date() }).where(eq(advisorAssignment.advisorUserId, s.advisorId));

    const review = await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(review.ok).toBe(false);
    if (review.ok) throw new Error();
    expect(review.reason).toBe("NOT_AUTHORIZED");

    const ready = await markBlueprintReadyForClient(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(ready.ok).toBe(false);
    if (ready.ok) throw new Error();
    expect(ready.reason).toBe("NOT_AUTHORIZED");

    const newRev = await createNewBlueprintRevision(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId, revisionReason: "FAMILY_UPDATE" });
    expect(newRev.ok).toBe(false);
    if (newRev.ok) throw new Error();
    expect(newRev.reason).toBe("NOT_AUTHORIZED");
  });

  // ---------------------------------------------------------------------
  // C. Source manifest exactness
  // ---------------------------------------------------------------------

  it("13. the revision's source manifest exactly matches the case's own ProfileRevision/ReportSnapshot", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current?.sourceProfileRevisionId).toBe(s.profileRevisionId);
    expect(current?.sourceReportSnapshotId).toBe(s.reportSnapshotId);
  });

  it("14. the revision's source manifest exactly matches the Planning Call record and its version", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current?.sourcePlanningCallRecordId).toBe(s.planningCallRecord.id);
    expect(current?.sourcePlanningCallRecordVersion).toBe(s.planningCallRecord.version);
  });

  // ---------------------------------------------------------------------
  // D. Content validation
  // ---------------------------------------------------------------------

  it("15. saveBlueprintDraft rejects an invalid provenance value as INVALID_CONTENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const badContent = { ...current!.content, b01: { ...current!.content.b01, provenance: "NOT_A_REAL_VALUE" } };
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: badContent,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("INVALID_CONTENT");
  });

  it("16. saveBlueprintDraft rejects an unknown taxonomy id in recommendedModelIds as INVALID_CONTENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const badContent = { ...current!.content, b04: { ...current!.content.b04, recommendedModelIds: ["NOT_A_REAL_MODEL"] } };
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: badContent,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("INVALID_CONTENT");
  });

  it("17. saveBlueprintDraft rejects an unknown top-level key (strict schema) as INVALID_CONTENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const badContent = { ...current!.content, unexpectedField: "should be rejected" };
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: badContent,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("INVALID_CONTENT");
  });

  it("18. saveBlueprintDraft rejects a B09 item with status VERIFIED but no verifiedAt as INVALID_CONTENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const badContent = {
      ...current!.content,
      b09: {
        ...current!.content.b09,
        items: [{ id: "v1", category: "OTHER", question: "Is this accredited?", status: "VERIFIED" }],
      },
    };
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: badContent,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("INVALID_CONTENT");
  });

  it("19. saveBlueprintDraft accepts a fully valid content object", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    expect(result.ok).toBe(true);
  });

  it("20. a second valid save succeeds and increments the version again", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const save1 = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    expect(save1.ok).toBe(true);
    if (!save1.ok) throw new Error();
    const reloaded = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const save2 = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: save1.version,
      content: { ...reloaded!.content, b12: { ...reloaded!.content.b12, summary: "Updated summary." } },
    });
    expect(save2.ok).toBe(true);
    if (!save2.ok) throw new Error();
    expect(save2.version).toBe(save1.version + 1);
  });

  // ---------------------------------------------------------------------
  // E. Optimistic concurrency
  // ---------------------------------------------------------------------

  it("21. a stale expectedVersion is rejected as VERSION_CONFLICT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    const stale = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error();
    expect(stale.reason).toBe("VERSION_CONFLICT");
  });

  it("22. the correct expectedVersion succeeds and the version increments by exactly one", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.version).toBe(current!.version + 1);
  });

  it("23. a losing concurrent save (same stale version as a winner) never overwrites the winner's content", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const winnerContent = { ...current!.content, b12: { ...current!.content.b12, summary: "Winner." } };
    const loserContent = { ...current!.content, b12: { ...current!.content.b12, summary: "Loser." } };

    const winner = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: winnerContent,
    });
    const loser = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: loserContent,
    });
    expect(winner.ok).toBe(true);
    expect(loser.ok).toBe(false);

    const reloaded = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(reloaded?.content.b12.summary).toBe("Winner.");
  });

  // ---------------------------------------------------------------------
  // F. Status-transition legality
  // ---------------------------------------------------------------------

  it("24. DRAFT -> INTERNAL_REVIEW succeeds", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const result = await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(true);
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current?.status).toBe("INTERNAL_REVIEW");
  });

  it("25. a same-status 'transition' (INTERNAL_REVIEW -> INTERNAL_REVIEW) is rejected", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    const again = await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(again.ok).toBe(false);
    if (again.ok) throw new Error();
    expect(again.reason).toBe("INVALID_TRANSITION");
  });

  it("26. DRAFT cannot skip straight to READY_FOR_CLIENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const result = await markBlueprintReadyForClient(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("INVALID_TRANSITION");
  });

  it("27. an incomplete revision in INTERNAL_REVIEW cannot become READY_FOR_CLIENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    const result = await markBlueprintReadyForClient(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("INCOMPLETE");
    expect(result.issues!.length).toBeGreaterThan(0);
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current?.status).toBe("INTERNAL_REVIEW");
  });

  it("28. a complete revision in INTERNAL_REVIEW becomes READY_FOR_CLIENT with a timestamp", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const saved = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    expect(saved.ok).toBe(true);
    await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    const result = await markBlueprintReadyForClient(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.readyForClientAt).toBeTruthy();
    const current2 = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current2?.status).toBe("READY_FOR_CLIENT");
    expect(current2?.readyForClientAt).toBeTruthy();
  });

  it("29. a READY_FOR_CLIENT revision is immutable -- saveBlueprintDraft rejects it as NOT_EDITABLE", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const saved = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    if (!saved.ok) throw new Error();
    await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    await markBlueprintReadyForClient(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });

    const reloaded = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    const result = await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: reloaded!.version,
      content: reloaded!.content,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_EDITABLE");
  });

  it("30. moveToInternalReview on a READY_FOR_CLIENT revision is rejected", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    await saveBlueprintDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      revisionId: created.revisionId,
      advisorUserId: s.advisorId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    await markBlueprintReadyForClient(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });

    const result = await moveBlueprintToInternalReview(db, { pathwaysCaseId: s.pathwaysCaseId, revisionId: created.revisionId, advisorUserId: s.advisorId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("INVALID_TRANSITION");
  });

  // ---------------------------------------------------------------------
  // G. Revision creation & supersession
  // ---------------------------------------------------------------------

  async function advanceToReady(db: Database, pathwaysCaseId: string, revisionId: string, advisorUserId: string) {
    const current = await getCurrentBlueprintRevision(db, pathwaysCaseId);
    await saveBlueprintDraft(db, {
      pathwaysCaseId,
      revisionId,
      advisorUserId,
      expectedVersion: current!.version,
      content: completeContent(current!.content),
    });
    await moveBlueprintToInternalReview(db, { pathwaysCaseId, revisionId, advisorUserId });
    await markBlueprintReadyForClient(db, { pathwaysCaseId, revisionId, advisorUserId });
  }

  it("31. createNewBlueprintRevision requires the current revision be READY_FOR_CLIENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    const result = await createNewBlueprintRevision(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId, revisionReason: "FAMILY_UPDATE" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("CURRENT_NOT_READY");
  });

  it("32. createNewBlueprintRevision requires an explicit revisionReason", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await advanceToReady(db, s.pathwaysCaseId, created.revisionId, s.advisorId);
    const result = await createNewBlueprintRevision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      revisionReason: undefined as unknown as "FAMILY_UPDATE",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("REASON_REQUIRED");
  });

  it("33. a new revision starts from the prior revision's content, DRAFT, isCurrent, without superseding the prior revision yet", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await advanceToReady(db, s.pathwaysCaseId, created.revisionId, s.advisorId);
    const readyRevision = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);

    const newRev = await createNewBlueprintRevision(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId, revisionReason: "FAMILY_UPDATE" });
    expect(newRev.ok).toBe(true);
    if (!newRev.ok) throw new Error();
    expect(newRev.revisionNumber).toBe(2);

    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current?.id).toBe(newRev.revisionId);
    expect(current?.status).toBe("DRAFT");
    expect(current?.isCurrent).toBe(true);
    expect(current?.content.b12.summary).toBe(readyRevision?.content.b12.summary);

    const all = await listBlueprintRevisions(db, s.pathwaysCaseId);
    const priorRow = all.find((r) => r.id === created.revisionId);
    expect(priorRow?.status).toBe("READY_FOR_CLIENT");
    expect(priorRow?.isCurrent).toBe(false);
  });

  it("34. marking the new revision ready supersedes the prior revision in the same operation", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await advanceToReady(db, s.pathwaysCaseId, created.revisionId, s.advisorId);
    const newRev = await createNewBlueprintRevision(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId, revisionReason: "FAMILY_UPDATE" });
    if (!newRev.ok) throw new Error();

    await advanceToReady(db, s.pathwaysCaseId, newRev.revisionId, s.advisorId);

    const all = await listBlueprintRevisions(db, s.pathwaysCaseId);
    const priorRow = all.find((r) => r.id === created.revisionId);
    const newRow = all.find((r) => r.id === newRev.revisionId);
    expect(priorRow?.status).toBe("SUPERSEDED");
    expect(newRow?.status).toBe("READY_FOR_CLIENT");
  });

  it("35. getCurrentBlueprintRevision always reflects the isCurrent revision, even after a new one is created", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await advanceToReady(db, s.pathwaysCaseId, created.revisionId, s.advisorId);
    const newRev = await createNewBlueprintRevision(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId, revisionReason: "FAMILY_UPDATE" });
    if (!newRev.ok) throw new Error();
    const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(current?.id).toBe(newRev.revisionId);
    expect(current?.id).not.toBe(created.revisionId);
  });

  // ---------------------------------------------------------------------
  // H. Audit events & non-mutation of prior records
  // ---------------------------------------------------------------------

  it("36. every lifecycle action records its corresponding audit event, and the PlanningCallRecord/PathwaysCase source fields are never mutated by Blueprint actions", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
    if (!created.ok) throw new Error();
    await advanceToReady(db, s.pathwaysCaseId, created.revisionId, s.advisorId);
    const newRev = await createNewBlueprintRevision(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId, revisionReason: "FAMILY_UPDATE" });
    if (!newRev.ok) throw new Error();
    await advanceToReady(db, s.pathwaysCaseId, newRev.revisionId, s.advisorId);

    const events = await db.select({ action: auditEvent.action }).from(auditEvent);
    const actions = new Set(events.map((e) => e.action));
    for (const expected of [
      "BLUEPRINT_CREATED",
      "BLUEPRINT_DRAFT_SAVED",
      "BLUEPRINT_MOVED_TO_REVIEW",
      "BLUEPRINT_READY_FOR_CLIENT",
      "BLUEPRINT_REVISION_CREATED",
      "BLUEPRINT_REVISION_SUPERSEDED",
    ]) {
      expect(actions.has(expected)).toBe(true);
    }

    const planningCallAfter = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(planningCallAfter?.id).toBe(s.planningCallRecord.id);
    expect(planningCallAfter?.version).toBe(s.planningCallRecord.version);
    expect(planningCallAfter?.status).toBe("COMPLETED");

    const [caseRow] = await db.select().from(pathwaysCase).where(eq(pathwaysCase.id, s.pathwaysCaseId)).limit(1);
    expect(caseRow?.profileRevisionId).toBe(s.profileRevisionId);
    expect(caseRow?.reportSnapshotId).toBe(s.reportSnapshotId);
  });

  it("37. completenessIssues/isContentComplete correctly gate an empty vs. a filled content document", () => {
    const empty = parseBlueprintContent({
      schemaVersion: "1.0.0",
      b01: { sectionId: "B01_STUDENT_SNAPSHOT" },
      b02: { sectionId: "B02_FAMILY_GOALS" },
      b03: { sectionId: "B03_CURRENT_EDUCATIONAL_SITUATION" },
      b04: { sectionId: "B04_RECOMMENDED_EDUCATIONAL_STRATEGY" },
      b05: { sectionId: "B05_ACADEMIC_PLANNING" },
      b06: { sectionId: "B06_SCHEDULE_LIFESTYLE_PLAN" },
      b07: { sectionId: "B07_OPPORTUNITIES_TO_EXPLORE" },
      b08: { sectionId: "B08_SUPPORT_PLAN" },
      b09: { sectionId: "B09_VERIFICATION_ITEMS" },
      b10: { sectionId: "B10_ACTION_PLAN" },
      b11: { sectionId: "B11_ROADMAP" },
      b12: { sectionId: "B12_ADVISOR_PROFESSIONAL_SUMMARY" },
    });
    expect(completenessIssues(empty).length).toBeGreaterThan(0);
    expect(completeContent(empty) && completenessIssues(completeContent(empty)).length).toBe(0);
  });
});
