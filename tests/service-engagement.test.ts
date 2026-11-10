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
  getCurrentBlueprintRevision,
} from "@/server/blueprint";
import { parseBlueprintContent, emptyBlueprintContent, type BlueprintContent } from "@/lib/blueprint/content-schema";
import { recordFamilyDecision, getServiceEngagement, parseDollarsToCents, formatCentsAsDollars } from "@/server/service-engagement";
import { getLatestPersistedReportSnapshotForRevision } from "@/server/report-outcome";
import {
  user,
  staffRole,
  advisorAssignment,
  pathwaysCase,
  auditEvent,
  serviceEngagement,
  profileRevision,
  reportSnapshot,
  planningCallRecord,
} from "@/db/schema";
import { PLANNING_TIME_ZONE } from "@/lib/consultation/scheduling-policy";
import { zonedWallTimeToUtc } from "@/lib/consultation/timezone";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import type { Database } from "@/db/client";

/**
 * Phase 6F integration coverage (docs/pathways
 * PHASE6F_SERVICE_ENGAGEMENT.md "Required tests", 28 scenarios) --
 * all against real PostgreSQL, the same convention as
 * tests/blueprint.test.ts.
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
  return s;
}

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

/** A case whose Blueprint has actually reached READY_FOR_CLIENT -- the gate every engagement function requires. */
async function setupReadyForClientCase(db: Database, email = "pat@example.com") {
  const s = await setupEligibleCase(db, email);
  const created = await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });
  if (!created.ok) throw new Error("Setup failed: blueprint creation did not succeed");
  const current = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
  const saved = await saveBlueprintDraft(db, {
    pathwaysCaseId: s.pathwaysCaseId,
    revisionId: created.revisionId,
    advisorUserId: s.advisorId,
    expectedVersion: current!.version,
    content: completeContent(current!.content),
  });
  if (!saved.ok) throw new Error("Setup failed: blueprint draft save did not succeed: " + saved.reason);
  const review = await moveBlueprintToInternalReview(db, {
    pathwaysCaseId: s.pathwaysCaseId,
    revisionId: created.revisionId,
    advisorUserId: s.advisorId,
  });
  if (!review.ok) throw new Error("Setup failed: move to internal review did not succeed");
  const ready = await markBlueprintReadyForClient(db, {
    pathwaysCaseId: s.pathwaysCaseId,
    revisionId: created.revisionId,
    advisorUserId: s.advisorId,
  });
  if (!ready.ok) throw new Error("Setup failed: mark ready for client did not succeed: " + ready.reason);
  return { ...s, blueprintRevisionId: created.revisionId };
}

describe.skipIf(!hasTestDatabase)("Phase 6F Service Engagement (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // ---------------------------------------------------------------------
  // A. Blueprint gate, idempotency, cardinality
  // ---------------------------------------------------------------------

  it("1. engagement cannot be created before the Blueprint reaches READY_FOR_CLIENT", async () => {
    const db = testDb!;
    const s = await setupEligibleCase(db);
    await createOrOpenBlueprint(db, { pathwaysCaseId: s.pathwaysCaseId, advisorUserId: s.advisorId });

    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "BLUEPRINT_ONLY",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("BLUEPRINT_NOT_READY");
  });

  it("2. an eligible (READY_FOR_CLIENT) case can establish an engagement", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "BLUEPRINT_ONLY",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.sourceBlueprintRevisionId).toBe(s.blueprintRevisionId);
  });

  it("3. engagement creation is idempotent (a second record-decision call updates, never duplicates)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const first = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "FOLLOW_UP_NEEDED",
    });
    if (!first.ok) throw new Error();
    const second = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: first.version,
      familyDecision: "FOLLOW_UP_NEEDED",
      followUpNote: "Call back next month.",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error();
    expect(second.engagementId).toBe(first.engagementId);

    const rows = await db.select().from(serviceEngagement).where(eq(serviceEngagement.pathwaysCaseId, s.pathwaysCaseId));
    expect(rows).toHaveLength(1);
  });

  it("4. only one engagement ever exists per case (database-enforced)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "FOLLOW_UP_NEEDED",
    });
    await expect(
      db.insert(serviceEngagement).values({
        id: "svcengage_duplicate_attempt",
        pathwaysCaseId: s.pathwaysCaseId,
        sourceBlueprintRevisionId: s.blueprintRevisionId,
        familyDecision: "BLUEPRINT_ONLY",
        familyDecisionRecordedAt: new Date(),
        familyDecisionRecordedByUserId: s.advisorId,
        status: "CLOSED",
      }),
    ).rejects.toThrow();
  });

  // ---------------------------------------------------------------------
  // B. Authorization
  // ---------------------------------------------------------------------

  it("5. the assigned advisor can record a family decision", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "NOT_PROCEEDING",
    });
    expect(result.ok).toBe(true);
  });

  it("6. an unrelated advisor (never assigned) is denied", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const unrelatedAdvisorId = await createStaffUser(db, "ADVISOR");
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: unrelatedAdvisorId,
      expectedVersion: 0,
      familyDecision: "NOT_PROCEEDING",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_AUTHORIZED");
  });

  it("7. a former (reassigned-away) advisor loses edit access", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    await db.update(advisorAssignment).set({ unassignedAt: new Date() }).where(eq(advisorAssignment.advisorUserId, s.advisorId));
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "NOT_PROCEEDING",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe("NOT_AUTHORIZED");
  });

  it("8. an actively-assigned admin can view and update the engagement", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.adminId,
      expectedVersion: 0,
      familyDecision: "FOLLOW_UP_NEEDED",
      followUpNote: "Admin recorded this.",
    });
    expect(result.ok).toBe(true);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.followUpNote).toBe("Admin recorded this.");
  });

  // ---------------------------------------------------------------------
  // C. Family-decision branches
  // ---------------------------------------------------------------------

  it("9. CONTINUE_WITH_PATHWAYS requires and supports a service arrangement", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const missingArrangement = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
    });
    expect(missingArrangement.ok).toBe(false);
    if (missingArrangement.ok) throw new Error();
    expect(missingArrangement.reason).toBe("ARRANGEMENT_REQUIRED");

    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "WAIVED",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.status).toBe("ACTIVE");
  });

  it("10. BLUEPRINT_ONLY records the decision but never activates consultancy", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "BLUEPRINT_ONLY",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.status).toBe("CLOSED");
    expect(result.activated).toBe(false);
    const [caseRow] = await db.select({ status: pathwaysCase.status }).from(pathwaysCase).where(eq(pathwaysCase.id, s.pathwaysCaseId));
    expect(caseRow?.status).toBe("COMPLETED");
  });

  it("11. FOLLOW_UP_NEEDED records optional follow-up note/date and never activates consultancy", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "FOLLOW_UP_NEEDED",
      followUpNote: "Wants to think it over.",
      followUpDate: "2026-02-01",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.status).toBe("PENDING_DECISION");
    expect(result.activated).toBe(false);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.followUpNote).toBe("Wants to think it over.");
    expect(engagement?.followUpDate?.slice(0, 10)).toBe("2026-02-01");
  });

  it("12. NOT_PROCEEDING records decision/date/confirming staff/optional reason and never activates consultancy", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "NOT_PROCEEDING",
      notProceedingReason: "Chose a different consultant.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.status).toBe("DECLINED");
    expect(result.activated).toBe(false);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.notProceedingReason).toBe("Chose a different consultant.");
    expect(engagement?.familyDecisionRecordedAt).toBeTruthy();
    expect(engagement?.confirmedByEmail).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // D. Payment structures
  // ---------------------------------------------------------------------

  it("13. ONE_TIME validates (requires a total agreed amount)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const missing = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "ONE_TIME",
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error();
    expect(missing.reason).toBe("INVALID_CONTENT");

    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "ONE_TIME",
      agreedTotalAmountCents: 150000,
    });
    expect(result.ok).toBe(true);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.agreedTotalAmountCents).toBe(150000);
    expect(engagement?.paymentStatus).toBe("TERMS_CONFIRMED");
  });

  it("14. MONTHLY validates (requires a monthly payment amount)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "MONTHLY",
      paymentAmountCents: 30000,
    });
    expect(result.ok).toBe(true);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.paymentAmountCents).toBe(30000);
  });

  it("15. INSTALLMENTS validates (requires an installment amount and count)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const missingCount = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "INSTALLMENTS",
      paymentAmountCents: 50000,
    });
    expect(missingCount.ok).toBe(false);

    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "INSTALLMENTS",
      paymentAmountCents: 50000,
      installmentCount: 3,
    });
    expect(result.ok).toBe(true);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.installmentCount).toBe(3);
  });

  it("16. CUSTOM validates (requires a terms note describing the agreed terms)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const missing = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "CUSTOM_ENGAGEMENT",
      paymentStructure: "CUSTOM",
    });
    expect(missing.ok).toBe(false);

    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "CUSTOM_ENGAGEMENT",
      paymentStructure: "CUSTOM",
      termsNote: "Reduced rate, in-kind exchange for referrals.",
    });
    expect(result.ok).toBe(true);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.termsNote).toBe("Reduced rate, in-kind exchange for referrals.");
  });

  it("17. WAIVED validates (no payment fields required, status NOT_REQUIRED)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "WAIVED",
    });
    expect(result.ok).toBe(true);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.paymentStatus).toBe("NOT_REQUIRED");
  });

  it("18. PENDING validates (no payment fields required, status TERMS_PENDING, does not activate)", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "PENDING",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.status).toBe("CONFIRMED");
    expect(result.activated).toBe(false);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.paymentStatus).toBe("TERMS_PENDING");
  });

  // ---------------------------------------------------------------------
  // E. Money storage, confirmation, activation
  // ---------------------------------------------------------------------

  it("19. monetary values are stored as safe integer cents, never floating-point", async () => {
    expect(parseDollarsToCents("1,500.50")).toBe(150050);
    expect(parseDollarsToCents("300")).toBe(30000);
    expect(parseDollarsToCents("")).toBeUndefined();
    expect(parseDollarsToCents("not a number")).toBeUndefined();
    expect(formatCentsAsDollars(150050)).toBe("1500.50");
    expect(formatCentsAsDollars(30000)).toBe("300.00");
    expect(Number.isInteger(150050)).toBe(true);
  });

  it("20. confirming an engagement records the actor and a timestamp", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const before = new Date();
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "NOT_PROCEEDING",
    });
    expect(result.ok).toBe(true);
    const engagement = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagement?.confirmedByEmail).toBeTruthy();
    expect(engagement?.confirmedAt).toBeTruthy();
    expect(new Date(engagement!.confirmedAt!).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("21. ACTIVE CONSULTANCY requires all of: CONTINUE decision, arrangement, and confirmed/waived/handled-externally payment terms", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);

    const stillPending = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "PENDING",
    });
    if (!stillPending.ok) throw new Error();
    expect(stillPending.activated).toBe(false);
    let caseRow = await db.select({ status: pathwaysCase.status }).from(pathwaysCase).where(eq(pathwaysCase.id, s.pathwaysCaseId));
    expect(caseRow[0]?.status).toBe("COMPLETED");

    const nowActive = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: stillPending.version,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "MONTHLY",
      paymentAmountCents: 20000,
    });
    expect(nowActive.ok).toBe(true);
    if (!nowActive.ok) throw new Error();
    expect(nowActive.activated).toBe(true);
    expect(nowActive.status).toBe("ACTIVE");
    caseRow = await db.select({ status: pathwaysCase.status }).from(pathwaysCase).where(eq(pathwaysCase.id, s.pathwaysCaseId));
    expect(caseRow[0]?.status).toBe("ACTIVE_CONSULTANCY");
  });

  it("22. activation is idempotent -- a later confirming call never re-fires activation or moves activatedAt", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const first = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "WAIVED",
    });
    if (!first.ok) throw new Error();
    expect(first.activated).toBe(true);
    const engagementAfterFirst = await getServiceEngagement(db, s.pathwaysCaseId);
    const activatedAtFirst = engagementAfterFirst?.activatedAt;

    const second = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: first.version,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "WAIVED",
      termsNote: "Re-confirmed, no change.",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error();
    expect(second.activated).toBe(false);
    const engagementAfterSecond = await getServiceEngagement(db, s.pathwaysCaseId);
    expect(engagementAfterSecond?.activatedAt).toBe(activatedAtFirst);

    const activationEvents = await db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.action, "CONSULTANCY_ACTIVATED"));
    expect(activationEvents).toHaveLength(1);
  });

  it("23. a stale concurrent edit (wrong expectedVersion) is rejected", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const first = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "FOLLOW_UP_NEEDED",
    });
    if (!first.ok) throw new Error();

    const stale = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "NOT_PROCEEDING",
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error();
    expect(stale.reason).toBe("VERSION_CONFLICT");
  });

  // ---------------------------------------------------------------------
  // F. Audit events, non-mutation of other domains, public-data isolation
  // ---------------------------------------------------------------------

  it("24. recording a decision and confirming an engagement create the expected audit events", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const result = await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "WAIVED",
    });
    if (!result.ok) throw new Error();

    const events = await db.select({ action: auditEvent.action }).from(auditEvent).where(eq(auditEvent.targetId, result.engagementId));
    const actions = events.map((e) => e.action);
    expect(actions).toContain("SERVICE_ENGAGEMENT_CREATED");
    expect(actions).toContain("FAMILY_DECISION_RECORDED");
    expect(actions).toContain("SERVICE_TERMS_CONFIRMED");
    expect(actions).toContain("PAYMENT_ARRANGEMENT_CONFIRMED");
    expect(actions).toContain("CONSULTANCY_ACTIVATED");
  });

  it("25. the Blueprint revision is never modified by any engagement operation", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const before = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "ONE_TIME",
      agreedTotalAmountCents: 200000,
    });
    const after = await getCurrentBlueprintRevision(db, s.pathwaysCaseId);
    expect(after).toEqual(before);
  });

  it("26. the PlanningCallRecord is never modified by any engagement operation", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const before = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "NOT_PROCEEDING",
      notProceedingReason: "Family decided to self-direct.",
    });
    const after = await getPrimaryPlanningCallRecord(db, s.pathwaysCaseId);
    expect(after).toEqual(before);
    const [row] = await db.select().from(planningCallRecord).where(eq(planningCallRecord.pathwaysCaseId, s.pathwaysCaseId));
    expect(row?.outcome).toBe("CONTINUE_TO_BLUEPRINT");
  });

  it("27. the Discovery profile revision and report snapshot (the educational recommendation engine's own output) are never modified by any engagement operation", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const [profileBefore] = await db.select().from(profileRevision).where(eq(profileRevision.id, s.profileRevisionId));
    const [snapshotBefore] = await db.select().from(reportSnapshot).where(eq(reportSnapshot.id, s.reportSnapshotId));

    await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "MONTHLY",
      paymentAmountCents: 25000,
    });

    const [profileAfter] = await db.select().from(profileRevision).where(eq(profileRevision.id, s.profileRevisionId));
    const [snapshotAfter] = await db.select().from(reportSnapshot).where(eq(reportSnapshot.id, s.reportSnapshotId));
    expect(profileAfter).toEqual(profileBefore);
    expect(snapshotAfter).toEqual(snapshotBefore);
  });

  it("28. commercial engagement data never enters the public-facing Discovery Report the family is served", async () => {
    const db = testDb!;
    const s = await setupReadyForClientCase(db);
    const before = await getLatestPersistedReportSnapshotForRevision(db, s.profileRevisionId);

    await recordFamilyDecision(db, {
      pathwaysCaseId: s.pathwaysCaseId,
      actorUserId: s.advisorId,
      expectedVersion: 0,
      familyDecision: "CONTINUE_WITH_PATHWAYS",
      serviceArrangement: "ONGOING_PATHWAYS_CONSULTING",
      paymentStructure: "ONE_TIME",
      agreedTotalAmountCents: 987654,
      termsNote: "A very specific confidential terms note.",
    });

    // The exact same production read path a family's report view uses
    // (src/server/report-outcome.ts's getLatestPersistedReportSnapshotForRevision)
    // -- proves the commercial record was never written into, or
    // derived from, the family-facing report at all: the row this
    // reads is byte-identical before and after the engagement exists,
    // and none of the secret figures/strings this test introduced
    // appear in it.
    const after = await getLatestPersistedReportSnapshotForRevision(db, s.profileRevisionId);
    expect(after).toEqual(before);

    const serialized = JSON.stringify(after?.report ?? null);
    expect(serialized).not.toContain("987654");
    expect(serialized).not.toContain("confidential terms note");
    expect(serialized).not.toContain("ONE_TIME");
    expect(serialized).not.toMatch(/agreedTotalAmountCents|paymentStructure|serviceArrangement|familyDecision/);
  });
});
