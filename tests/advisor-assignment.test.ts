import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq, and, isNull } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { startDiscoverySession, saveDraftPatch, submitDiscoveryProfile } from "@/server/discovery-draft";
import { submitConsultationContact } from "@/server/consultation";
import { createInternalBooking } from "@/server/booking";
import { getCaseForConsultationRequest, ensureCaseForConsultationRequest } from "@/server/pathways-case";
import { assignAdvisorToCase, unassignAdvisorFromCase, getActiveAssignmentForCase } from "@/server/advisor-assignment";
import {
  assertAdvisorCanAccessPathwaysCase,
  AuthorizationError,
} from "@/server/access-control";
import {
  listOperationalCasesForAdmin,
  listAssignedCasesForAdvisor,
  getCaseDetailForStaff,
  applyAdminQueueFilters,
  sortAdvisorQueue,
  type StaffCaseRow,
} from "@/server/staff-queue";
import { advisorAssignment, auditEvent, user, staffRole, pathwaysCase } from "@/db/schema";
import { PLANNING_TIME_ZONE } from "@/lib/consultation/scheduling-policy";
import { zonedWallTimeToUtc } from "@/lib/consultation/timezone";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import type { Database } from "@/db/client";

/**
 * Phase 6C integration coverage (docs/pathways
 * PHASE6C_ADVISOR_ASSIGNMENT_QUEUE.md "Required tests", 20 scenarios)
 * -- all against real PostgreSQL, the same convention as
 * tests/pathways-case.test.ts and tests/booking.test.ts.
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
  await submitDiscoveryProfile(db, issued.id);
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
  return { sessionId: issued.id, consultationRequestId: result.consultationRequestId, pathwaysCaseId: theCase.id };
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

describe.skipIf(!hasTestDatabase)("Phase 6C advisor assignment + queues (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("assignment (sections 1-5, 7-8)", () => {
    it("1. an admin can assign an unassigned case", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisorId = await createStaffUser(db, "ADVISOR");

      const result = await assignAdvisorToCase(db, {
        pathwaysCaseId: a.pathwaysCaseId,
        advisorUserId: advisorId,
        assignedByUserId: adminId,
      });
      expect(result).toMatchObject({ ok: true, action: "ASSIGNED" });

      const active = await getActiveAssignmentForCase(db, a.pathwaysCaseId);
      expect(active?.advisorUserId).toBe(advisorId);
    });

    it("2. the assignment references the authorized active advisor, not merely a stored id", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisorId = await createStaffUser(db, "ADVISOR");

      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisorId, assignedByUserId: adminId });
      const [row] = await db.select().from(advisorAssignment).where(eq(advisorAssignment.pathwaysCaseId, a.pathwaysCaseId));
      expect(row?.advisorUserId).toBe(advisorId);
      expect(row?.assignedByUserId).toBe(adminId);
      expect(row?.consultationRequestId).toBe(a.consultationRequestId);
    });

    it("3. a non-admin (an advisor, or a plain staff-less user) cannot assign a case", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const advisorActingAsAssigner = await createStaffUser(db, "ADVISOR");
      const targetAdvisor = await createStaffUser(db, "ADVISOR");

      const result = await assignAdvisorToCase(db, {
        pathwaysCaseId: a.pathwaysCaseId,
        advisorUserId: targetAdvisor,
        assignedByUserId: advisorActingAsAssigner,
      });
      expect(result).toEqual({ ok: false, reason: "NOT_ADMIN" });
    });

    it("4. a public/guest actor (no staff_role row at all) cannot assign a case", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const plainUserId = await createStaffUser(db, null);
      const targetAdvisor = await createStaffUser(db, "ADVISOR");

      const result = await assignAdvisorToCase(db, {
        pathwaysCaseId: a.pathwaysCaseId,
        advisorUserId: targetAdvisor,
        assignedByUserId: plainUserId,
      });
      expect(result).toEqual({ ok: false, reason: "NOT_ADMIN" });
    });

    it("5. an invalid/non-advisor target cannot be assigned", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const plainUserTarget = await createStaffUser(db, null);

      const result = await assignAdvisorToCase(db, {
        pathwaysCaseId: a.pathwaysCaseId,
        advisorUserId: plainUserTarget,
        assignedByUserId: adminId,
      });
      expect(result).toEqual({ ok: false, reason: "TARGET_NOT_AUTHORIZED_ADVISOR" });

      const nonexistentTarget = "user_does_not_exist";
      const result2 = await assignAdvisorToCase(db, {
        pathwaysCaseId: a.pathwaysCaseId,
        advisorUserId: nonexistentTarget,
        assignedByUserId: adminId,
      });
      expect(result2).toEqual({ ok: false, reason: "TARGET_NOT_AUTHORIZED_ADVISOR" });
    });

    it("6. a case never has more than one active assignment at a time", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      const advisor2 = await createStaffUser(db, "ADVISOR");

      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor2, assignedByUserId: adminId });

      const activeRows = await db
        .select()
        .from(advisorAssignment)
        .where(and(eq(advisorAssignment.pathwaysCaseId, a.pathwaysCaseId), isNull(advisorAssignment.unassignedAt)));
      expect(activeRows).toHaveLength(1);
      expect(activeRows[0]!.advisorUserId).toBe(advisor2);

      const allRows = await db.select().from(advisorAssignment).where(eq(advisorAssignment.pathwaysCaseId, a.pathwaysCaseId));
      expect(allRows).toHaveLength(2); // history preserved
    });

    it("7. concurrent assignment attempts against the same case never create two active owners", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      const advisor2 = await createStaffUser(db, "ADVISOR");

      const [r1, r2] = await Promise.all([
        assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId }),
        assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor2, assignedByUserId: adminId }),
      ]);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);

      const activeRows = await db
        .select()
        .from(advisorAssignment)
        .where(and(eq(advisorAssignment.pathwaysCaseId, a.pathwaysCaseId), isNull(advisorAssignment.unassignedAt)));
      expect(activeRows).toHaveLength(1);
      // Whichever advisor ended up active, it must be exactly one of the two attempted targets.
      expect([advisor1, advisor2]).toContain(activeRows[0]!.advisorUserId);
    });

    it("8. reassignment preserves prior history (never deletes the old row)", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      const advisor2 = await createStaffUser(db, "ADVISOR");

      const first = await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      const second = await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor2, assignedByUserId: adminId });
      expect(first.ok && first.action).toBe("ASSIGNED");
      expect(second.ok && second.action).toBe("REASSIGNED");

      const allRows = await db.select().from(advisorAssignment).where(eq(advisorAssignment.pathwaysCaseId, a.pathwaysCaseId));
      expect(allRows).toHaveLength(2);
      const historical = allRows.find((r) => r.advisorUserId === advisor1);
      expect(historical?.unassignedAt).not.toBeNull();
    });

    it("9. reassignment creates the correct ADVISOR_REASSIGNED audit event with prior/new advisor metadata", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      const advisor2 = await createStaffUser(db, "ADVISOR");

      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor2, assignedByUserId: adminId });

      const events = await db.select().from(auditEvent).where(eq(auditEvent.targetId, a.pathwaysCaseId));
      const assigned = events.filter((e) => e.action === "ADVISOR_ASSIGNED");
      const reassigned = events.filter((e) => e.action === "ADVISOR_REASSIGNED");
      expect(assigned).toHaveLength(1);
      expect(reassigned).toHaveLength(1);
      expect(reassigned[0]!.metadata).toMatchObject({ previousAdvisorUserId: advisor1, newAdvisorUserId: advisor2 });
      expect(reassigned[0]!.actorUserId).toBe(adminId);
      expect(reassigned[0]!.actorType).toBe("ADMIN");
    });

    it("reassigning to the SAME currently-active advisor is a pure no-op", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");

      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      const second = await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      expect(second).toMatchObject({ ok: true, action: "NOOP_ALREADY_ASSIGNED" });

      const allRows = await db.select().from(advisorAssignment).where(eq(advisorAssignment.pathwaysCaseId, a.pathwaysCaseId));
      expect(allRows).toHaveLength(1);
      const events = await db.select().from(auditEvent).where(and(eq(auditEvent.targetId, a.pathwaysCaseId), eq(auditEvent.action, "ADVISOR_ASSIGNED")));
      expect(events).toHaveLength(1);
    });
  });

  describe("unassignment (section 9)", () => {
    it("an admin can return a case to the unassigned queue, auditably, without deleting history", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");

      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      const result = await unassignAdvisorFromCase(db, { pathwaysCaseId: a.pathwaysCaseId, actorUserId: adminId });
      expect(result).toEqual({ ok: true, unassigned: true });

      const active = await getActiveAssignmentForCase(db, a.pathwaysCaseId);
      expect(active).toBeNull();
      const allRows = await db.select().from(advisorAssignment).where(eq(advisorAssignment.pathwaysCaseId, a.pathwaysCaseId));
      expect(allRows).toHaveLength(1); // the row still exists, just deactivated

      const events = await db.select().from(auditEvent).where(and(eq(auditEvent.targetId, a.pathwaysCaseId), eq(auditEvent.action, "ADVISOR_UNASSIGNED")));
      expect(events).toHaveLength(1);
      expect(events[0]!.metadata).toMatchObject({ previousAdvisorUserId: advisor1 });
    });

    it("a non-admin cannot unassign", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });

      const result = await unassignAdvisorFromCase(db, { pathwaysCaseId: a.pathwaysCaseId, actorUserId: advisor1 });
      expect(result).toEqual({ ok: false, reason: "NOT_ADMIN" });
    });
  });

  describe("per-case authorization boundary (sections 10-12, 16)", () => {
    it("10. an advisor can access their own actively assigned case", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });

      await expect(assertAdvisorCanAccessPathwaysCase(db, advisor1, a.pathwaysCaseId)).resolves.toBeUndefined();
      const detail = await getCaseDetailForStaff(db, advisor1, a.pathwaysCaseId);
      expect(detail.ok).toBe(true);
    });

    it("11. an advisor cannot access another advisor's case, even knowing its exact UUID", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db, "family-a@example.com");
      const b = await completeDiscoveryWithContact(db, "family-b@example.com");
      const adminId = await createStaffUser(db, "ADMIN");
      const advisorA = await createStaffUser(db, "ADVISOR");
      const advisorB = await createStaffUser(db, "ADVISOR");
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisorA, assignedByUserId: adminId });
      await assignAdvisorToCase(db, { pathwaysCaseId: b.pathwaysCaseId, advisorUserId: advisorB, assignedByUserId: adminId });

      await expect(assertAdvisorCanAccessPathwaysCase(db, advisorA, b.pathwaysCaseId)).rejects.toThrow(AuthorizationError);
      const detail = await getCaseDetailForStaff(db, advisorA, b.pathwaysCaseId);
      expect(detail).toEqual({ ok: false, reason: "NOT_AUTHORIZED" });
    });

    it("12. a reassigned-away advisor immediately loses current-case access", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      const advisor2 = await createStaffUser(db, "ADVISOR");

      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      await expect(assertAdvisorCanAccessPathwaysCase(db, advisor1, a.pathwaysCaseId)).resolves.toBeUndefined();

      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor2, assignedByUserId: adminId });
      await expect(assertAdvisorCanAccessPathwaysCase(db, advisor1, a.pathwaysCaseId)).rejects.toThrow(AuthorizationError);
      await expect(assertAdvisorCanAccessPathwaysCase(db, advisor2, a.pathwaysCaseId)).resolves.toBeUndefined();
    });

    it("16. an explicitly unassigned (inactive) assignment grants no access", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      await unassignAdvisorFromCase(db, { pathwaysCaseId: a.pathwaysCaseId, actorUserId: adminId });

      await expect(assertAdvisorCanAccessPathwaysCase(db, advisor1, a.pathwaysCaseId)).rejects.toThrow(AuthorizationError);
    });

    it("an ADMIN with no case assignment still views the limited case detail (role-only admin boundary)", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");

      const detail = await getCaseDetailForStaff(db, adminId, a.pathwaysCaseId);
      expect(detail.ok).toBe(true);
    });
  });

  describe("admin operational queue (sections 5-6, 13)", () => {
    it("13. an admin can view the authorized operational queue across all cases, assigned or not", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db, "family-a@example.com");
      const b = await completeDiscoveryWithContact(db, "family-b@example.com");
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });

      const result = await listOperationalCasesForAdmin(db, adminId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const ids = result.cases.map((c) => c.pathwaysCaseId);
      expect(ids).toContain(a.pathwaysCaseId);
      expect(ids).toContain(b.pathwaysCaseId);

      const caseA = result.cases.find((c) => c.pathwaysCaseId === a.pathwaysCaseId);
      const caseB = result.cases.find((c) => c.pathwaysCaseId === b.pathwaysCaseId);
      expect(caseA?.currentAdvisor?.userId).toBe(advisor1);
      expect(caseB?.currentAdvisor).toBeNull();
    });

    it("a non-admin cannot view the operational queue", async () => {
      const db = testDb!;
      const advisor1 = await createStaffUser(db, "ADVISOR");
      const result = await listOperationalCasesForAdmin(db, advisor1);
      expect(result).toEqual({ ok: false, reason: "NOT_ADMIN" });
    });

    it("the safe admin DTO never includes an internal recommendation score or the full raw Discovery payload", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const result = await listOperationalCasesForAdmin(db, adminId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const json = JSON.stringify(result.cases.find((c) => c.pathwaysCaseId === a.pathwaysCaseId));
      expect(json).not.toMatch(/internalSortScore/i);
      expect(json).not.toMatch(/rawAnswers/i);
      expect(json).not.toMatch(/effectiveAnswers/i);
    });

    it("filters: assignment/caseStatus/advisor/booked narrow the queue deterministically", () => {
      const rows: (StaffCaseRow & { advisorUserId: string | null })[] = [
        {
          pathwaysCaseId: "c1",
          studentDisplayName: "Student",
          gradeBand: null,
          caseStatus: "CONTACT_RECEIVED",
          consultationStatus: "REQUESTED",
          bookingScheduledAt: null,
          preferredCallFormat: null,
          currentAdvisor: null,
          enteredWorkflowAt: "2026-01-01T00:00:00.000Z",
          advisorUserId: null,
        },
        {
          pathwaysCaseId: "c2",
          studentDisplayName: "Student",
          gradeBand: null,
          caseStatus: "BOOKED",
          consultationStatus: "BOOKED",
          bookingScheduledAt: "2026-01-10T15:00:00.000Z",
          preferredCallFormat: "VIDEO",
          currentAdvisor: { userId: "adv1", name: "Advisor One" },
          enteredWorkflowAt: "2026-01-02T00:00:00.000Z",
          advisorUserId: "adv1",
        },
      ];
      expect(applyAdminQueueFilters(rows, { assignment: "UNASSIGNED" }).map((r) => r.pathwaysCaseId)).toEqual(["c1"]);
      expect(applyAdminQueueFilters(rows, { assignment: "ASSIGNED" }).map((r) => r.pathwaysCaseId)).toEqual(["c2"]);
      expect(applyAdminQueueFilters(rows, { caseStatus: "BOOKED" }).map((r) => r.pathwaysCaseId)).toEqual(["c2"]);
      expect(applyAdminQueueFilters(rows, { advisorUserId: "adv1" }).map((r) => r.pathwaysCaseId)).toEqual(["c2"]);
      expect(applyAdminQueueFilters(rows, { booked: true }).map((r) => r.pathwaysCaseId)).toEqual(["c2"]);
      expect(applyAdminQueueFilters(rows, { booked: false }).map((r) => r.pathwaysCaseId)).toEqual(["c1"]);
      expect(applyAdminQueueFilters(rows, {}).map((r) => r.pathwaysCaseId)).toEqual(["c1", "c2"]);
    });
  });

  describe("advisor queue (sections 10, 14-15, 20)", () => {
    it("14/15. the advisor queue returns only this advisor's active assigned cases -- never an unassigned or another advisor's case", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db, "family-a@example.com");
      const b = await completeDiscoveryWithContact(db, "family-b@example.com");
      const c = await completeDiscoveryWithContact(db, "family-c@example.com"); // stays unassigned
      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      const advisor2 = await createStaffUser(db, "ADVISOR");
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });
      await assignAdvisorToCase(db, { pathwaysCaseId: b.pathwaysCaseId, advisorUserId: advisor2, assignedByUserId: adminId });

      const result = await listAssignedCasesForAdvisor(db, advisor1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const ids = result.cases.map((r) => r.pathwaysCaseId);
      expect(ids).toEqual([a.pathwaysCaseId]);
      expect(ids).not.toContain(b.pathwaysCaseId);
      expect(ids).not.toContain(c.pathwaysCaseId);
    });

    it("sortAdvisorQueue orders booked cases first (soonest first), then follow-up/needs-information, then the rest", () => {
      const base = {
        studentDisplayName: "Student",
        gradeBand: null,
        consultationStatus: "REQUESTED" as const,
        preferredCallFormat: null,
        currentAdvisor: null,
      };
      const rows: StaffCaseRow[] = [
        { ...base, pathwaysCaseId: "other", caseStatus: "CONTACT_RECEIVED", bookingScheduledAt: null, enteredWorkflowAt: "2026-01-03T00:00:00.000Z" },
        { ...base, pathwaysCaseId: "booked-later", caseStatus: "BOOKED", bookingScheduledAt: "2026-01-20T00:00:00.000Z", enteredWorkflowAt: "2026-01-01T00:00:00.000Z" },
        { ...base, pathwaysCaseId: "followup", caseStatus: "FOLLOW_UP", bookingScheduledAt: null, enteredWorkflowAt: "2026-01-02T00:00:00.000Z" },
        { ...base, pathwaysCaseId: "booked-sooner", caseStatus: "BOOKED", bookingScheduledAt: "2026-01-10T00:00:00.000Z", enteredWorkflowAt: "2026-01-01T00:00:00.000Z" },
      ];
      const sorted = sortAdvisorQueue(rows).map((r) => r.pathwaysCaseId);
      expect(sorted).toEqual(["booked-sooner", "booked-later", "followup", "other"]);
    });
  });

  describe("student display name (section 16)", () => {
    it("maps the existing optional student_display_name Discovery answer into StudentPathwayRecord.displayName on fresh case creation", async () => {
      const db = testDb!;
      const issued = await startDiscoverySession(db, null);
      for (const [field, value] of Object.entries({ ...minimalValidRaw(), student_display_name: "Jamie" })) {
        await saveDraftPatch(db, issued.id, { [field]: value });
      }
      await submitDiscoveryProfile(db, issued.id);
      const contactResult = await submitConsultationContact(db, issued.id, {
        guardianName: "Pat Guardian",
        email: "jamie-parent@example.com",
        mobilePhone: "555-123-4567",
        preferredCallFormat: "VIDEO",
        consentAcknowledged: true,
      });
      expect(contactResult.ok).toBe(true);
      if (!contactResult.ok) return;

      const theCase = await getCaseForConsultationRequest(db, contactResult.consultationRequestId);
      const adminId = await createStaffUser(db, "ADMIN");
      const detail = await getCaseDetailForStaff(db, adminId, theCase!.id);
      expect(detail.ok).toBe(true);
      if (detail.ok) expect(detail.detail.studentDisplayName).toBe("Jamie");
    });

    it("falls back to a neutral 'Student' label when no name was ever supplied", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const adminId = await createStaffUser(db, "ADMIN");
      const detail = await getCaseDetailForStaff(db, adminId, a.pathwaysCaseId);
      expect(detail.ok).toBe(true);
      if (detail.ok) expect(detail.detail.studentDisplayName).toBe("Student");
    });
  });

  describe("case status / assignment decoupling (section 15)", () => {
    it("assigning an advisor never changes PathwaysCase.status -- an unassigned BOOKED case stays BOOKED after assignment", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      await createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      const [beforeAssign] = await db.select({ status: pathwaysCase.status }).from(pathwaysCase).where(eq(pathwaysCase.id, a.pathwaysCaseId));
      expect(beforeAssign?.status).toBe("BOOKED");

      const adminId = await createStaffUser(db, "ADMIN");
      const advisor1 = await createStaffUser(db, "ADVISOR");
      await assignAdvisorToCase(db, { pathwaysCaseId: a.pathwaysCaseId, advisorUserId: advisor1, assignedByUserId: adminId });

      const [afterAssign] = await db.select({ status: pathwaysCase.status }).from(pathwaysCase).where(eq(pathwaysCase.id, a.pathwaysCaseId));
      expect(afterAssign?.status).toBe("BOOKED");
    });
  });

  describe("regression: Phase 6A/6B behavior unaffected (sections 17-19)", () => {
    it("17. the guest consultation flow still works without any parent account being created", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const booked = await createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      expect(booked.ok).toBe(true);
      const users = await db.select().from(user);
      expect(users).toHaveLength(0);
    });

    it("18. Phase 6B case creation remains idempotent under a repeated contact submission", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      await ensureCaseForConsultationRequest(db, {
        studentPathwayRecordId: (await getCaseForConsultationRequest(db, a.consultationRequestId))!.studentPathwayRecordId,
        consultationRequestId: a.consultationRequestId,
        profileRevisionId: (await getCaseForConsultationRequest(db, a.consultationRequestId))!.profileRevisionId,
        reportSnapshotId: (await getCaseForConsultationRequest(db, a.consultationRequestId))!.reportSnapshotId,
      });
      const rows = await db.select().from(pathwaysCase).where(eq(pathwaysCase.consultationRequestId, a.consultationRequestId));
      expect(rows).toHaveLength(1);
    });

    it("19. Phase 6A.2 booking concurrency protections remain intact", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const [first, second] = await Promise.all([
        createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
        createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
      ]);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (first.ok && second.ok) expect(first.booking.id).toBe(second.booking.id);
    });
  });
});
