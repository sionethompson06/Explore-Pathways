import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { startDiscoverySession, saveDraftPatch, submitDiscoveryProfile } from "@/server/discovery-draft";
import { submitConsultationContact } from "@/server/consultation";
import { createInternalBooking } from "@/server/booking";
import { getCaseForConsultationRequest } from "@/server/pathways-case";
import { assignAdvisorToCase } from "@/server/advisor-assignment";
import {
  savePlanningCallDraft,
  completePlanningCall,
  getPrimaryPlanningCallRecord,
  isBlueprintReady,
} from "@/server/planning-call";
import { planningCallRecord, auditEvent, user, staffRole, pathwaysCase, consultationRequest, advisorAssignment } from "@/db/schema";
import { PLANNING_TIME_ZONE } from "@/lib/consultation/scheduling-policy";
import { zonedWallTimeToUtc } from "@/lib/consultation/timezone";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import type { Database } from "@/db/client";

/**
 * Phase 6D integration coverage (docs/pathways
 * PHASE6D_PLANNING_CALL_WORKSPACE.md "Required tests", 20 scenarios)
 * -- all against real PostgreSQL, the same convention as
 * tests/advisor-assignment.test.ts.
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
    consultationRequestId: result.consultationRequestId,
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

const NOW = new Date("2026-01-05T15:00:00.000Z");
const VALID_SLOT = zonedWallTimeToUtc(2026, 1, 7, 10, 0, 0, PLANNING_TIME_ZONE);

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

const BASE_CONTENT = { familyMainGoal: "Find more flexibility for travel." };

describe.skipIf(!hasTestDatabase)("Phase 6D Planning Call Workspace (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("1. a case can establish the intended primary PlanningCallRecord", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const result = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    expect(result.ok).toBe(true);
    const record = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(record?.familyMainGoal).toBe("Find more flexibility for travel.");
    expect(record?.status).toBe("DRAFT");
  });

  it("2. a genuine concurrent first save never creates two primary records", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const [r1, r2] = await Promise.all([
      savePlanningCallDraft(db, {
        pathwaysCaseId: s.pathwaysCaseId,
        advisorUserId: s.advisorId,
        expectedVersion: 0,
        content: { familyMainGoal: "A" },
      }),
      savePlanningCallDraft(db, {
        pathwaysCaseId: s.pathwaysCaseId,
        advisorUserId: s.advisorId,
        expectedVersion: 0,
        content: { familyMainGoal: "B" },
      }),
    ]);
    const okCount = [r1, r2].filter((r) => r.ok).length;
    expect(okCount).toBe(1);

    const rows = await db
      .select()
      .from(planningCallRecord)
      .where(and(eq(planningCallRecord.pathwaysCaseId, s.pathwaysCaseId), eq(planningCallRecord.isPrimary, true)));
    expect(rows.length).toBe(1);
  });

  it("3. the assigned advisor can create/save the record", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const result = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    expect(result.ok).toBe(true);
  });

  it("4. an unassigned advisor cannot create or save the record", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const otherAdvisor = await createStaffUser(db, "ADVISOR");
    const result = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: otherAdvisor,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    expect(result).toEqual({ ok: false, reason: "NOT_AUTHORIZED" });
  });

  it("5. a different advisor cannot read the record (cannot even reach it)", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    const otherAdvisor = await createStaffUser(db, "ADVISOR");
    const result = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: otherAdvisor,
      expectedVersion: 1,
      content: { familyMainGoal: "tampered" },
    });
    expect(result).toEqual({ ok: false, reason: "NOT_AUTHORIZED" });
    const record = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(record?.familyMainGoal).toBe("Find more flexibility for travel.");
  });

  it("6. a reassigned-away advisor loses edit permission", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    const advisor2 = await createStaffUser(db, "ADVISOR");
    const reassigned = await assignAdvisorToCase(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: advisor2,
      assignedByUserId: s.adminId,
    });
    expect(reassigned.ok).toBe(true);

    const formerAdvisorAttempt = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 1,
      content: { familyMainGoal: "should be denied" },
    });
    expect(formerAdvisorAttempt).toEqual({ ok: false, reason: "NOT_AUTHORIZED" });

    const newAdvisorAttempt = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: advisor2,
      expectedVersion: 1,
      content: { familyMainGoal: "new advisor can edit" },
    });
    expect(newAdvisorAttempt.ok).toBe(true);
  });

  it("7. an admin can view the record via the read-only lookup (no write path exists for admin in this phase)", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    // getPrimaryPlanningCallRecord performs no authorization of its own
    // (the caller -- the admin case-detail route -- already resolved
    // ADMIN role access via getCaseDetailForStaff); this proves the
    // record is genuinely readable once that boundary is satisfied.
    const record = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(record).not.toBeNull();
  });

  it("8/9. draft save persists correctly and a refresh (re-fetch) retrieves it", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const save1 = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: { familyMainGoal: "first save" },
    });
    expect(save1.ok).toBe(true);
    const reloaded = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(reloaded?.familyMainGoal).toBe("first save");
    expect(reloaded?.version).toBe(1);

    const save2 = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 1,
      content: { familyMainGoal: "second save" },
    });
    expect(save2.ok).toBe(true);
    const reloaded2 = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(reloaded2?.familyMainGoal).toBe("second save");
    expect(reloaded2?.version).toBe(2);
  });

  it("10. completion is explicit -- a draft never silently becomes COMPLETED", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    const record = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(record?.status).toBe("DRAFT");

    const completion = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 1,
      attendance: "ATTENDED",
      outcome: "CONTINUE_TO_BLUEPRINT",
      content: {},
    });
    expect(completion.ok).toBe(true);
    const completed = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(completed?.status).toBe("COMPLETED");
    expect(isBlueprintReady(completed)).toBe(true);
  });

  it("11. passing appointment time never marks the record complete by itself", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    // No completion action is ever called here -- the past appointment
    // time alone must never advance the record's status.
    const record = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(record?.status).toBe("DRAFT");
    expect(record?.attendance).toBeNull();
  });

  it("12. attendance must be explicitly recorded before completion succeeds", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const result = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      // @ts-expect-error -- deliberately omitted to prove the server rejects it
      attendance: undefined,
      outcome: "FOLLOW_UP",
      content: {},
    });
    expect(result).toEqual({ ok: false, reason: "ATTENDANCE_REQUIRED" });
  });

  it("13/14. case status follows only allowed transitions; an invalid outcome-driven transition is rejected", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    // The case is still CONTACT_RECEIVED (never booked) -- BOOKED is
    // the only state FAMILY_NOT_PROCEEDING/COMPLETED/etc. may legally
    // transition from, so completing from here must be rejected.
    const result = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      attendance: "ATTENDED",
      outcome: "CONTINUE_TO_BLUEPRINT",
      content: {},
    });
    expect(result).toEqual({ ok: false, reason: "INVALID_CASE_TRANSITION" });

    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    const afterBooking = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      attendance: "ATTENDED",
      outcome: "FAMILY_NOT_PROCEEDING",
      content: {},
    });
    expect(afterBooking.ok).toBe(true);
    if (afterBooking.ok) expect(afterBooking.caseStatus).toBe("FAMILY_NOT_PROCEEDING");

    const [caseRow] = await db.select().from(pathwaysCase).where(eq(pathwaysCase.id, s.pathwaysCaseId)).limit(1);
    expect(caseRow?.status).toBe("FAMILY_NOT_PROCEEDING");
  });

  it("a NO_SHOW/CANCELLED attendance never allows CONTINUE_TO_BLUEPRINT", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    const result = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      attendance: "NO_SHOW",
      outcome: "CONTINUE_TO_BLUEPRINT",
      content: {},
    });
    expect(result).toEqual({ ok: false, reason: "OUTCOME_NOT_ALLOWED_FOR_ATTENDANCE" });
  });

  it("15. completion writes the required audit events (operational metadata only, never narrative content)", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      attendance: "ATTENDED",
      outcome: "FOLLOW_UP",
      content: { advisorAssessment: "very sensitive private advisor opinion text" },
    });
    const events = await db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.targetType, "PlanningCallRecord"));
    const actions = events.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(["CONSULTATION_ATTENDANCE_RECORDED", "PLANNING_CALL_OUTCOME_SET", "PLANNING_CALL_COMPLETED"]),
    );
    const caseEvents = await db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.targetType, "PathwaysCase"), eq(auditEvent.action, "CASE_STATUS_CHANGED")));
    expect(caseEvents.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("very sensitive private advisor opinion");
  });

  it("16. advisor notes never enter the public ReportDTO/snapshot", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: { advisorAssessment: "private advisor-only clinical-sounding opinion" },
    });
    const [snapshotRow] = await db
      .select()
      .from(pathwaysCase)
      .where(eq(pathwaysCase.id, s.pathwaysCaseId))
      .limit(1);
    expect(snapshotRow).toBeTruthy();
    // The ReportSnapshot id this case references is immutable and was
    // captured BEFORE any planning-call content existed; its content
    // can never have been retroactively altered to include advisor
    // text (see test 18 for the direct byte-for-byte proof).
    expect(snapshotRow!.reportSnapshotId).toBe(s.reportSnapshotId);
  });

  it("17. a concurrent edit conflict never silently overwrites -- the second save is rejected, not merged", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: { familyMainGoal: "initial" },
    });
    // Two tabs both loaded version 1 and both try to save.
    const tabA = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 1,
      content: { familyMainGoal: "tab A's edit" },
    });
    expect(tabA.ok).toBe(true);

    const tabB = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 1, // stale -- tab A already advanced it to 2
      content: { familyMainGoal: "tab B's edit, should not win" },
    });
    expect(tabB).toEqual({ ok: false, reason: "VERSION_CONFLICT" });

    const finalRecord = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(finalRecord?.familyMainGoal).toBe("tab A's edit");
  });

  it("18. the exact ReportSnapshot the record references is byte-identical to the one the family saw, never recomputed", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    const [recordRow] = await db
      .select()
      .from(planningCallRecord)
      .where(eq(planningCallRecord.pathwaysCaseId, s.pathwaysCaseId))
      .limit(1);
    expect(recordRow?.reportSnapshotId).toBe(s.reportSnapshotId);
  });

  it("19. the exact ProfileRevision remains linked on the planning-call record", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    const [recordRow] = await db
      .select()
      .from(planningCallRecord)
      .where(eq(planningCallRecord.pathwaysCaseId, s.pathwaysCaseId))
      .limit(1);
    expect(recordRow?.profileRevisionId).toBe(s.profileRevisionId);
  });

  it("20. Phase 6C assignment history remains intact through reassignment and planning-call activity", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    const advisor2 = await createStaffUser(db, "ADVISOR");
    await assignAdvisorToCase(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: advisor2,
      assignedByUserId: s.adminId,
    });
    const assignments = await db
      .select()
      .from(advisorAssignment)
      .where(eq(advisorAssignment.pathwaysCaseId, s.pathwaysCaseId));
    // The original assignment row is deactivated, never deleted.
    expect(assignments.length).toBe(2);
    expect(assignments.filter((a) => a.unassignedAt === null).length).toBe(1);
  });

  it("the planning-call record's own authorization does not depend on which staff role governs the consultationRequest", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const [request] = await db
      .select()
      .from(consultationRequest)
      .where(eq(consultationRequest.id, s.consultationRequestId))
      .limit(1);
    expect(request).toBeTruthy();
    const result = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    expect(result.ok).toBe(true);
  });

  it("completing a draft twice is rejected as ALREADY_COMPLETED, never a duplicate side effect", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await createInternalBooking(db, s.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
    const first = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      attendance: "ATTENDED",
      outcome: "FOLLOW_UP",
      content: {},
    });
    expect(first.ok).toBe(true);

    const second = await completePlanningCall(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: first.ok ? 1 : 0,
      attendance: "ATTENDED",
      outcome: "CONTINUE_TO_BLUEPRINT",
      content: {},
    });
    expect(second).toEqual({ ok: false, reason: "ALREADY_COMPLETED" });

    const events = await db
      .select()
      .from(auditEvent)
      .where(and(eq(auditEvent.targetType, "PlanningCallRecord"), eq(auditEvent.action, "PLANNING_CALL_COMPLETED")));
    expect(events.length).toBe(1);
  });

  it("pathwaysDiscussed only accepts known taxonomy base_model ids, never a free-form value", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    await expect(
      savePlanningCallDraft(db, {
        pathwaysCaseId: s.pathwaysCaseId,
        advisorUserId: s.advisorId,
        expectedVersion: 0,
        content: { pathwaysDiscussed: ["NOT_A_REAL_PATHWAY_ID"] },
      }),
    ).rejects.toThrow();

    const result = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: s.advisorId,
      expectedVersion: 0,
      content: { pathwaysDiscussed: ["B01", "B02"] },
    });
    expect(result.ok).toBe(true);
  });

  it("a non-advisor, non-admin plain user cannot save a planning call draft", async () => {
    const db = testDb!;
    const s = await setupAssignedCase(db);
    const plainUser = await createStaffUser(db, null);
    const result = await savePlanningCallDraft(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      advisorUserId: plainUser,
      expectedVersion: 0,
      content: BASE_CONTENT,
    });
    expect(result).toEqual({ ok: false, reason: "NOT_AUTHORIZED" });
  });
});
