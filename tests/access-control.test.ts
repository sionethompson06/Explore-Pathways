import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import {
  createTestUser,
  createTestStudent,
  linkGuardianToStudent,
  revokeGuardianAccess,
  attachStudentToSession,
  createConsultationRequest,
  assignAdvisor,
  unassignAdvisor,
  grantStaffRole,
} from "./helpers/factories";
import {
  getStudentForGuestToken,
  listStudentsForGuardian,
  assertGuardianCanAccessStudent,
  listActiveCasesForAdvisor,
  assertAdvisorCanAccessCase,
  requireStaffRole,
  getStaffRole,
  AuthorizationError,
} from "@/server/access-control";
import { createGuestSession } from "@/server/session";

describe.skipIf(!hasTestDatabase)("record-level authorization (real PostgreSQL)", () => {
  const db = () => testDb!;

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("guest-to-guest isolation", () => {
    it("session A can never resolve session B's student, even with B's exact record ID known", async () => {
      const studentA = await createTestStudent(db());
      const studentB = await createTestStudent(db());
      const sessionA = await createGuestSession(db());
      const sessionB = await createGuestSession(db());

      // Attach each session to its own student directly (bypassing
      // the not-yet-built Phase 3 profile flow, since this test is
      // about the read path, not the write path).
      await attachStudentToSession(db(), sessionA.id, studentA);
      await attachStudentToSession(db(), sessionB.id, studentB);

      const resolvedForA = await getStudentForGuestToken(db(), sessionA.token);
      expect(resolvedForA?.id).toBe(studentA);
      expect(resolvedForA?.id).not.toBe(studentB);

      // There is no parameter through which session A's token could
      // ever be made to return student B -- the function takes only
      // a token, never a target student id. This assertion documents
      // that structural guarantee rather than attempting to "hack"
      // around it, since there is no such code path to attempt.
      const resolvedForB = await getStudentForGuestToken(db(), sessionB.token);
      expect(resolvedForB?.id).toBe(studentB);
    });

    it("an unattached guest session resolves to no student at all", async () => {
      const orphanSession = await createGuestSession(db());
      const resolved = await getStudentForGuestToken(db(), orphanSession.token);
      expect(resolved).toBeNull();
    });
  });

  describe("guardian-to-guardian isolation", () => {
    it("guardian A cannot access guardian B's student", async () => {
      const guardianA = await createTestUser(db());
      const guardianB = await createTestUser(db());
      const studentA = await createTestStudent(db());
      const studentB = await createTestStudent(db());
      await linkGuardianToStudent(db(), guardianA, studentA);
      await linkGuardianToStudent(db(), guardianB, studentB);

      await expect(
        assertGuardianCanAccessStudent(db(), guardianA, studentB),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        assertGuardianCanAccessStudent(db(), guardianA, studentA),
      ).resolves.toBeUndefined();
    });

    it("listStudentsForGuardian never includes another guardian's student", async () => {
      const guardianA = await createTestUser(db());
      const guardianB = await createTestUser(db());
      const studentA = await createTestStudent(db());
      const studentB = await createTestStudent(db());
      await linkGuardianToStudent(db(), guardianA, studentA);
      await linkGuardianToStudent(db(), guardianB, studentB);

      const resultsForA = await listStudentsForGuardian(db(), guardianA);
      expect(resultsForA).toHaveLength(1);
      expect(resultsForA[0]!.student.id).toBe(studentA);
    });

    it("exact record ID knowledge does not substitute for a real link", async () => {
      const guardianA = await createTestUser(db());
      const studentB = await createTestStudent(db()); // guardianA has NO link to this
      await expect(
        assertGuardianCanAccessStudent(db(), guardianA, studentB),
      ).rejects.toThrow(AuthorizationError);
    });

    it("a revoked link denies access even though it once existed", async () => {
      const guardian = await createTestUser(db());
      const student = await createTestStudent(db());
      const accessId = await linkGuardianToStudent(db(), guardian, student);

      await expect(
        assertGuardianCanAccessStudent(db(), guardian, student),
      ).resolves.toBeUndefined();

      await revokeGuardianAccess(db(), accessId);

      await expect(
        assertGuardianCanAccessStudent(db(), guardian, student),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe("unauthorized advisor access rejection", () => {
    it("an advisor with no assignment cannot access a case", async () => {
      const advisor = await createTestUser(db());
      const student = await createTestStudent(db());
      const caseId = await createConsultationRequest(db(), student);

      await expect(
        assertAdvisorCanAccessCase(db(), advisor, caseId),
      ).rejects.toThrow(AuthorizationError);
    });

    it("an advisor gains access only after explicit assignment, and loses it on unassignment", async () => {
      const advisor = await createTestUser(db());
      const student = await createTestStudent(db());
      const caseId = await createConsultationRequest(db(), student);

      const assignmentId = await assignAdvisor(db(), advisor, caseId);
      await expect(
        assertAdvisorCanAccessCase(db(), advisor, caseId),
      ).resolves.toBeUndefined();

      await unassignAdvisor(db(), assignmentId);
      await expect(
        assertAdvisorCanAccessCase(db(), advisor, caseId),
      ).rejects.toThrow(AuthorizationError);
    });

    it("advisor A cannot access advisor B's assigned case", async () => {
      const advisorA = await createTestUser(db());
      const advisorB = await createTestUser(db());
      const student = await createTestStudent(db());
      const caseForB = await createConsultationRequest(db(), student);
      await assignAdvisor(db(), advisorB, caseForB);

      await expect(
        assertAdvisorCanAccessCase(db(), advisorA, caseForB),
      ).rejects.toThrow(AuthorizationError);

      const casesForA = await listActiveCasesForAdvisor(db(), advisorA);
      expect(casesForA).toHaveLength(0);
    });
  });

  describe("staff role / privilege escalation prevention", () => {
    it("a plain user with no staff_role row is denied any staff-only action", async () => {
      const plainUser = await createTestUser(db());
      const role = await getStaffRole(db(), plainUser);
      expect(role).toBeNull();
      await expect(
        requireStaffRole(db(), plainUser, ["ADVISOR", "ADMIN"]),
      ).rejects.toThrow(AuthorizationError);
    });

    it("a user cannot escalate by any means other than an explicit staff_role row", async () => {
      // There is no field on the `user` table itself that could ever
      // be read as a role -- this test documents that by checking a
      // user with an otherwise "admin-looking" email/name is still
      // denied without the actual staff_role row.
      const suspiciousUser = await createTestUser(db(), {
        email: "admin@pathways.example",
        name: "Admin",
      });
      await expect(
        requireStaffRole(db(), suspiciousUser, ["ADMIN"]),
      ).rejects.toThrow(AuthorizationError);
    });

    it("granting ADVISOR does not also grant ADMIN", async () => {
      const advisorUser = await createTestUser(db());
      await grantStaffRole(db(), advisorUser, "ADVISOR");

      await expect(
        requireStaffRole(db(), advisorUser, ["ADVISOR"]),
      ).resolves.toBe("ADVISOR");
      await expect(
        requireStaffRole(db(), advisorUser, ["ADMIN"]),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe("missing/invalid input fails safe (deny), never defaults to allow", () => {
    it("a nonexistent guardian/student pair is denied, not treated as ambiguous-allow", async () => {
      await expect(
        assertGuardianCanAccessStudent(db(), "user_does_not_exist", "student_does_not_exist"),
      ).rejects.toThrow(AuthorizationError);
    });

    it("a nonexistent advisor/case pair is denied", async () => {
      await expect(
        assertAdvisorCanAccessCase(db(), "user_does_not_exist", "consult_does_not_exist"),
      ).rejects.toThrow(AuthorizationError);
    });

    it("an unresolvable guest token never falls back to any student", async () => {
      const resolved = await getStudentForGuestToken(db(), "totally-invalid-token");
      expect(resolved).toBeNull();
    });
  });
});
