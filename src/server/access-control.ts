import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  studentPathwayRecord,
  guardianStudentAccess,
  discoverySession,
  consultationRequest,
  advisorAssignment,
  staffRole,
  type staffRoleEnum,
} from "@/db/schema";
import { getGuestSessionByToken } from "./session";

/**
 * The shared, server-only data-access layer. Every function here is
 * an object-level authorization check first and a data fetch second
 * -- per the master prompt's nonnegotiable behavior 8 ("Parent A must
 * not access Parent B's record even with its exact ID") and the
 * owner's Phase 1 authorization section E. Nothing outside this
 * module (and session.ts) should query these tables directly for an
 * access-controlled read; that would bypass these checks by
 * construction, which is exactly the mistake this module exists to
 * make structurally hard.
 *
 * "Missing configuration must fail safely, not disable security":
 * every function below denies (returns null / empty / throws) on any
 * ambiguous or missing input, never on a best-effort default-allow.
 */

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

// ---------------------------------------------------------------------------
// Guest access -- scoped strictly to the session's own linked student.
// ---------------------------------------------------------------------------

/**
 * Returns the student pathway record belonging to this guest session,
 * or null if the session is invalid/expired or has no linked student
 * yet. A guest can never reach any other student's record through
 * this function, structurally -- there is no student-id parameter to
 * pass the wrong value into.
 */
export async function getStudentForGuestToken(db: Database, token: string) {
  const session = await getGuestSessionByToken(db, token);
  if (!session || !session.studentPathwayRecordId) return null;

  const [record] = await db
    .select()
    .from(studentPathwayRecord)
    .where(
      and(
        eq(studentPathwayRecord.id, session.studentPathwayRecordId),
        isNull(studentPathwayRecord.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}

// ---------------------------------------------------------------------------
// Guardian access -- explicit per-child links only.
// ---------------------------------------------------------------------------

/**
 * Every student explicitly, actively linked to this guardian. A
 * guardian sharing an email domain, a household, or even a family
 * name with another guardian gains nothing from that alone -- only an
 * explicit guardian_student_access row with no revokedAt grants
 * anything.
 */
export async function listStudentsForGuardian(
  db: Database,
  guardianUserId: string,
) {
  return db
    .select({ student: studentPathwayRecord })
    .from(guardianStudentAccess)
    .innerJoin(
      studentPathwayRecord,
      eq(guardianStudentAccess.studentPathwayRecordId, studentPathwayRecord.id),
    )
    .where(
      and(
        eq(guardianStudentAccess.guardianUserId, guardianUserId),
        isNull(guardianStudentAccess.revokedAt),
        isNull(studentPathwayRecord.deletedAt),
      ),
    );
}

/**
 * Throws AuthorizationError unless an explicit, active link exists.
 * Callers must call this (or use listStudentsForGuardian, which is
 * self-scoping) before any read or write touching a specific student
 * on a guardian's behalf. Knowing the student's ID -- e.g. from a URL
 * a guardian typed or guessed -- is never sufficient by itself.
 */
export async function assertGuardianCanAccessStudent(
  db: Database,
  guardianUserId: string,
  studentPathwayRecordId: string,
): Promise<void> {
  const [link] = await db
    .select({ id: guardianStudentAccess.id })
    .from(guardianStudentAccess)
    .where(
      and(
        eq(guardianStudentAccess.guardianUserId, guardianUserId),
        eq(
          guardianStudentAccess.studentPathwayRecordId,
          studentPathwayRecordId,
        ),
        isNull(guardianStudentAccess.revokedAt),
      ),
    )
    .limit(1);

  if (!link) {
    throw new AuthorizationError(
      "Guardian does not have an active, explicit link to this student.",
    );
  }
}

// ---------------------------------------------------------------------------
// Advisor access -- explicit case assignment only.
// ---------------------------------------------------------------------------

/**
 * Every consultation case actively assigned to this advisor. An
 * advisor sees nothing by simply being staff -- only cases someone
 * (another advisor/admin, per the Phase 7 workflow, not built yet)
 * explicitly assigned to them and has not since unassigned.
 */
export async function listActiveCasesForAdvisor(
  db: Database,
  advisorUserId: string,
) {
  return db
    .select({ case: consultationRequest })
    .from(advisorAssignment)
    .innerJoin(
      consultationRequest,
      eq(advisorAssignment.consultationRequestId, consultationRequest.id),
    )
    .where(
      and(
        eq(advisorAssignment.advisorUserId, advisorUserId),
        isNull(advisorAssignment.unassignedAt),
      ),
    );
}

/** Throws unless the advisor has an active assignment to this exact case. */
export async function assertAdvisorCanAccessCase(
  db: Database,
  advisorUserId: string,
  consultationRequestId: string,
): Promise<void> {
  const [assignment] = await db
    .select({ id: advisorAssignment.id })
    .from(advisorAssignment)
    .where(
      and(
        eq(advisorAssignment.advisorUserId, advisorUserId),
        eq(advisorAssignment.consultationRequestId, consultationRequestId),
        isNull(advisorAssignment.unassignedAt),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw new AuthorizationError(
      "Advisor does not have an active assignment to this case.",
    );
  }
}

// ---------------------------------------------------------------------------
// Staff role -- never self-selected, never trusted from a client claim.
// ---------------------------------------------------------------------------

type StaffRoleValue = (typeof staffRoleEnum.enumValues)[number];

/**
 * The only source of truth for "is this user staff, and with which
 * role." Never derived from a session field, a request header, or
 * anything the caller supplies about themselves -- only from this
 * table, which nothing outside a server-side/DB action ever writes
 * to (see src/db/schema/staff.ts).
 */
export async function getStaffRole(
  db: Database,
  userId: string,
): Promise<StaffRoleValue | null> {
  const [row] = await db
    .select({ role: staffRole.role })
    .from(staffRole)
    .where(and(eq(staffRole.userId, userId), isNull(staffRole.revokedAt)))
    .limit(1);
  return row?.role ?? null;
}

/** Throws unless the user currently holds one of the allowed roles. */
export async function requireStaffRole(
  db: Database,
  userId: string,
  allowedRoles: readonly StaffRoleValue[],
): Promise<StaffRoleValue> {
  const role = await getStaffRole(db, userId);
  if (!role || !allowedRoles.includes(role)) {
    throw new AuthorizationError(
      `User does not hold a required staff role (${allowedRoles.join(", ")}).`,
    );
  }
  return role;
}
