import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { startDiscoverySession, saveDraftPatch, submitDiscoveryProfile } from "@/server/discovery-draft";
import { submitConsultationContact } from "@/server/consultation";
import { createInternalBooking } from "@/server/booking";
import {
  ensureCaseForConsultationRequest,
  getCaseForConsultationRequest,
  isValidCaseStatusTransition,
  type PathwaysCaseStatus,
} from "@/server/pathways-case";
import {
  assertAdvisorCanAccessPathwaysCase,
  getPathwaysCaseForGuestSession,
  listStudentsForGuardian,
  assertGuardianCanAccessStudent,
  AuthorizationError,
} from "@/server/access-control";
import {
  pathwaysCase,
  auditEvent,
  advisorAssignment,
  staffRole,
  user,
  guardianStudentAccess,
  reportSnapshot,
} from "@/db/schema";
import { PLANNING_TIME_ZONE } from "@/lib/consultation/scheduling-policy";
import { zonedWallTimeToUtc } from "@/lib/consultation/timezone";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import type { Database } from "@/db/client";

/**
 * Phase 6B integration coverage (docs/pathways
 * PHASE6B_CASE_FOUNDATION.md "Required tests"): case creation exactly
 * once, idempotency under sequential/concurrent retry, historical
 * ProfileRevision/ReportSnapshot integrity, booking linkage, cross-
 * guest security, and the staff/advisor authorization foundation --
 * all against real PostgreSQL, the same convention as
 * tests/booking.test.ts and tests/consultation.test.ts.
 */

function minimalValidRaw(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

async function completeDiscoveryWithContact(db: Database, email = "pat@example.com") {
  const issued = await startDiscoverySession(db, null);
  for (const [field, value] of Object.entries(minimalValidRaw())) {
    await saveDraftPatch(db, issued.id, { [field]: value });
  }
  const submitted = await submitDiscoveryProfile(db, issued.id);
  const contact: ConsultationContactInput = {
    guardianName: "Pat Guardian",
    email,
    mobilePhone: "555-123-4567",
    preferredCallFormat: "VIDEO",
    consentAcknowledged: true,
  };
  const result = await submitConsultationContact(db, issued.id, contact);
  if (!result.ok) throw new Error("Setup failed: contact submission did not succeed");
  return {
    sessionId: issued.id,
    consultationRequestId: result.consultationRequestId,
    revisionId: submitted.ok ? submitted.revisionId : null,
  };
}

const NOW = new Date("2026-01-05T15:00:00.000Z"); // Monday 7 AM Pacific
const VALID_SLOT = zonedWallTimeToUtc(2026, 1, 7, 10, 0, 0, PLANNING_TIME_ZONE); // Wed 10 AM Pacific

describe.skipIf(!hasTestDatabase)("Phase 6B PathwaysCase foundation (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("existing guest funnel regression", () => {
    it("a guest completes Discovery -> Report -> Contact -> Booking without any parent account being created", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const booked = await createInternalBooking(
        db,
        a.sessionId,
        { selectedStartIso: VALID_SLOT.toISOString() },
        NOW,
      );
      expect(booked.ok).toBe(true);
      const users = await db.select().from(user);
      expect(users).toHaveLength(0); // No Better Auth user row was ever created by this guest journey.
    });
  });

  describe("case creation (sections 2-4, 8)", () => {
    it("the consultation workflow establishes exactly one PathwaysCase for a new request", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const rows = await db
        .select()
        .from(pathwaysCase)
        .where(eq(pathwaysCase.consultationRequestId, a.consultationRequestId));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe("CONTACT_RECEIVED");
    });

    it("a repeated contact submission against the same request does not create a second case", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const contact: ConsultationContactInput = {
        guardianName: "Pat Guardian Updated",
        email: "pat@example.com",
        mobilePhone: "555-999-0000",
        preferredCallFormat: "PHONE",
        consentAcknowledged: true,
      };
      const second = await submitConsultationContact(db, a.sessionId, contact);
      expect(second.ok).toBe(true);
      if (second.ok) expect(second.consultationRequestId).toBe(a.consultationRequestId);

      const rows = await db
        .select()
        .from(pathwaysCase)
        .where(eq(pathwaysCase.consultationRequestId, a.consultationRequestId));
      expect(rows).toHaveLength(1);
    });

    it("concurrent ensureCaseForConsultationRequest calls against the same request never create duplicate cases", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      // The request/contact transaction already created one case; fire
      // several more concurrent idempotent attempts directly against
      // the domain function to prove the database-level uniqueness
      // constraint (not merely an application-level check) holds under
      // a genuine race.
      const [existing] = await db
        .select()
        .from(pathwaysCase)
        .where(eq(pathwaysCase.consultationRequestId, a.consultationRequestId));
      expect(existing).toBeTruthy();

      const input = {
        studentPathwayRecordId: existing!.studentPathwayRecordId,
        consultationRequestId: a.consultationRequestId,
        profileRevisionId: existing!.profileRevisionId,
        reportSnapshotId: existing!.reportSnapshotId,
      };
      const results = await Promise.all([
        ensureCaseForConsultationRequest(db, input),
        ensureCaseForConsultationRequest(db, input),
        ensureCaseForConsultationRequest(db, input),
      ]);
      const uniqueIds = new Set(results.map((r) => r.pathwaysCaseId));
      expect(uniqueIds.size).toBe(1);
      expect([...uniqueIds][0]).toBe(existing!.id);
      // Exactly one of the concurrent calls (the original creation, not
      // these three) ever reported created -- none of these three did.
      expect(results.every((r) => r.created === false)).toBe(true);

      const rows = await db
        .select()
        .from(pathwaysCase)
        .where(eq(pathwaysCase.consultationRequestId, a.consultationRequestId));
      expect(rows).toHaveLength(1);
    });

    it("exactly one CASE_CREATED audit event is recorded, never one per retry", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      await submitConsultationContact(db, a.sessionId, {
        guardianName: "Pat Guardian",
        email: "pat@example.com",
        mobilePhone: "555-123-4567",
        preferredCallFormat: "VIDEO",
        consentAcknowledged: true,
      });
      const [theCase] = await db
        .select()
        .from(pathwaysCase)
        .where(eq(pathwaysCase.consultationRequestId, a.consultationRequestId));
      const events = await db
        .select()
        .from(auditEvent)
        .where(eq(auditEvent.targetId, theCase!.id));
      const created = events.filter((e) => e.action === "CASE_CREATED");
      expect(created).toHaveLength(1);
      expect(created[0]!.targetType).toBe("PathwaysCase");
      expect(created[0]!.actorType).toBe("GUEST");
    });
  });

  describe("historical integrity (sections 5, 7)", () => {
    it("the case links the exact ProfileRevision and ReportSnapshot the parent saw, and the snapshot is never regenerated or modified", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const [theCase] = await db
        .select()
        .from(pathwaysCase)
        .where(eq(pathwaysCase.consultationRequestId, a.consultationRequestId));
      expect(theCase!.profileRevisionId).toBe(a.revisionId);

      const [snapshotBefore] = await db
        .select()
        .from(reportSnapshot)
        .where(eq(reportSnapshot.id, theCase!.reportSnapshotId));
      expect(snapshotBefore).toBeTruthy();
      const contentHashBefore = snapshotBefore!.contentHash;

      // A second, unrelated action (another contact resubmission)
      // happening later must never mutate the historical snapshot.
      await submitConsultationContact(db, a.sessionId, {
        guardianName: "Pat Guardian",
        email: "pat@example.com",
        mobilePhone: "555-123-4567",
        preferredCallFormat: "VIDEO",
        consentAcknowledged: true,
      });
      const [snapshotAfter] = await db
        .select()
        .from(reportSnapshot)
        .where(eq(reportSnapshot.id, theCase!.reportSnapshotId));
      expect(snapshotAfter!.contentHash).toBe(contentHashBefore);
      expect(snapshotAfter!.publicContent).toEqual(snapshotBefore!.publicContent);
    });
  });

  describe("booking linkage (sections 8-9)", () => {
    it("an existing Booking links correctly to the case and advances its status to BOOKED", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const booked = await createInternalBooking(
        db,
        a.sessionId,
        { selectedStartIso: VALID_SLOT.toISOString() },
        NOW,
      );
      expect(booked.ok).toBe(true);
      if (!booked.ok) return;

      const theCase = await getCaseForConsultationRequest(db, a.consultationRequestId);
      expect(theCase).toBeTruthy();
      expect(theCase!.bookingId).toBe(booked.booking.id);
      expect(theCase!.status).toBe("BOOKED");

      const events = await db.select().from(auditEvent).where(eq(auditEvent.targetId, theCase!.id));
      expect(events.some((e) => e.action === "BOOKING_LINKED")).toBe(true);
      expect(events.some((e) => e.action === "CASE_STATUS_CHANGED")).toBe(true);
    });

    it("double-booking protections remain intact: a second concurrent booking attempt never creates a second case-booking link", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const [first, second] = await Promise.all([
        createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
        createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
      ]);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.booking.id).toBe(second.booking.id);

      const theCase = await getCaseForConsultationRequest(db, a.consultationRequestId);
      expect(theCase!.bookingId).toBe(first.booking.id);
      const events = await db.select().from(auditEvent).where(eq(auditEvent.targetId, theCase!.id));
      expect(events.filter((e) => e.action === "BOOKING_LINKED")).toHaveLength(1);
    });
  });

  describe("case status transition rules (section 9)", () => {
    it("never confuses case status with consultation/booking status: a BOOKED case is not automatically COMPLETED", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      await createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      const theCase = await getCaseForConsultationRequest(db, a.consultationRequestId);
      expect(theCase!.status).toBe("BOOKED");
      expect(theCase!.status).not.toBe("COMPLETED");
    });

    it.each([
      ["NEW", "CONTACT_RECEIVED", true],
      ["CONTACT_RECEIVED", "BOOKED", true],
      ["BOOKED", "COMPLETED", true],
      ["COMPLETED", "BOOKED", false], // never regresses out of a terminal-ish outcome back into an earlier operational stage
      ["CLOSED", "NEW", false], // CLOSED is terminal
      ["NEW", "NEW", false], // same-status is never a "transition"
      ["NOT_CURRENT_SERVICE_FIT", "CLOSED", true],
    ] as const)("isValidCaseStatusTransition(%s -> %s) === %s", (from, to, expected) => {
      expect(isValidCaseStatusTransition(from as PathwaysCaseStatus, to as PathwaysCaseStatus)).toBe(expected);
    });
  });

  describe("cross-family security (sections 10, 14)", () => {
    it("guest A's case lookup never resolves guest B's case, even though both exist", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db, "family-a@example.com");
      const b = await completeDiscoveryWithContact(db, "family-b@example.com");

      const caseA = await getPathwaysCaseForGuestSession(db, a.sessionId);
      const caseB = await getPathwaysCaseForGuestSession(db, b.sessionId);
      expect(caseA).toBeTruthy();
      expect(caseB).toBeTruthy();
      expect(caseA!.id).not.toBe(caseB!.id);

      // Family A's own session can never resolve to family B's case id,
      // structurally -- there is no case-id parameter to misuse.
      expect(caseA!.id).not.toBe(caseB!.consultationRequestId);
    });

    it("an unattached guest session resolves to no case at all", async () => {
      const db = testDb!;
      const issued = await startDiscoverySession(db, null);
      const result = await getPathwaysCaseForGuestSession(db, issued.id);
      expect(result).toBeNull();
    });
  });

  describe("staff authorization foundation (sections 11, 14-15)", () => {
    it("an advisor with an active staff role but no assignment to a specific case is denied", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const theCase = await getCaseForConsultationRequest(db, a.consultationRequestId);
      const advisorUserId = "test_advisor_1";
      await db.insert(user).values({ id: advisorUserId, email: "advisor1@pathways.test", name: "Advisor One" });
      await db.insert(staffRole).values({ id: "test_role_1", userId: advisorUserId, role: "ADVISOR" });

      await expect(
        assertAdvisorCanAccessPathwaysCase(db, advisorUserId, theCase!.id),
      ).rejects.toThrow(AuthorizationError);
    });

    it("an advisor assigned to a DIFFERENT case cannot access this one -- the unassigned-advisor case boundary holds", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db, "family-a@example.com");
      const b = await completeDiscoveryWithContact(db, "family-b@example.com");
      const caseA = await getCaseForConsultationRequest(db, a.consultationRequestId);
      const caseB = await getCaseForConsultationRequest(db, b.consultationRequestId);

      const advisorUserId = "test_advisor_2";
      await db.insert(user).values({ id: advisorUserId, email: "advisor2@pathways.test", name: "Advisor Two" });
      await db.insert(staffRole).values({ id: "test_role_2", userId: advisorUserId, role: "ADVISOR" });
      // Assigned only to case A, never B -- a provisioning step only an
      // already-authorized actor could have performed; never a public
      // self-selection path.
      await db.insert(advisorAssignment).values({
        id: "test_assignment_1",
        consultationRequestId: a.consultationRequestId,
        pathwaysCaseId: caseA!.id,
        advisorUserId,
        assignedByUserId: null,
      });

      await expect(assertAdvisorCanAccessPathwaysCase(db, advisorUserId, caseA!.id)).resolves.toBeUndefined();
      await expect(
        assertAdvisorCanAccessPathwaysCase(db, advisorUserId, caseB!.id),
      ).rejects.toThrow(AuthorizationError);
    });

    it("an ADMIN role alone, without an explicit case assignment, is still denied -- no blanket admin bypass", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const theCase = await getCaseForConsultationRequest(db, a.consultationRequestId);
      const adminUserId = "test_admin_1";
      await db.insert(user).values({ id: adminUserId, email: "admin1@pathways.test", name: "Admin One" });
      await db.insert(staffRole).values({ id: "test_role_3", userId: adminUserId, role: "ADMIN" });

      await expect(
        assertAdvisorCanAccessPathwaysCase(db, adminUserId, theCase!.id),
      ).rejects.toThrow(AuthorizationError);
    });

    it("a plain user with no staff_role row can never access a case, regardless of any other state", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const theCase = await getCaseForConsultationRequest(db, a.consultationRequestId);
      const plainUserId = "test_plain_user_1";
      await db.insert(user).values({ id: plainUserId, email: "plain1@pathways.test", name: "Plain One" });

      await expect(
        assertAdvisorCanAccessPathwaysCase(db, plainUserId, theCase!.id),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe("multi-student architecture (section 16)", () => {
    it("one future guardian can be explicitly linked to two StudentPathwayRecords (each with its own case) without record leakage between them", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db, "guardian@example.com");
      const b = await completeDiscoveryWithContact(db, "guardian@example.com");
      const caseA = await getCaseForConsultationRequest(db, a.consultationRequestId);
      const caseB = await getCaseForConsultationRequest(db, b.consultationRequestId);
      expect(caseA!.studentPathwayRecordId).not.toBe(caseB!.studentPathwayRecordId);

      const guardianUserId = "test_guardian_1";
      await db.insert(user).values({ id: guardianUserId, email: "guardian@example.com", name: "Guardian" });
      await db.insert(guardianStudentAccess).values([
        { id: "test_link_1", guardianUserId, studentPathwayRecordId: caseA!.studentPathwayRecordId },
        { id: "test_link_2", guardianUserId, studentPathwayRecordId: caseB!.studentPathwayRecordId },
      ]);

      const students = await listStudentsForGuardian(db, guardianUserId);
      expect(students).toHaveLength(2);
      const ids = students.map((s) => s.student.id).sort();
      expect(ids).toEqual([caseA!.studentPathwayRecordId, caseB!.studentPathwayRecordId].sort());

      await expect(
        assertGuardianCanAccessStudent(db, guardianUserId, caseA!.studentPathwayRecordId),
      ).resolves.toBeUndefined();
      await expect(
        assertGuardianCanAccessStudent(db, guardianUserId, caseB!.studentPathwayRecordId),
      ).resolves.toBeUndefined();
    });
  });
});
