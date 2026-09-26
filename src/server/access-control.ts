import "server-only";
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
 *
 * Every `guardianUserId` / `advisorUserId` / `userId` parameter below
 * is a raw ID-based internal check: it must be supplied only from an
 * ID that already came out of a verified Principal (see
 * src/server/principal.ts), never directly from client-supplied
 * input (a request body field, query param, or header). These
 * functions have no way to verify that on their own -- that
 * verification is principal.ts's job, at the request-facing boundary,
 * before any of these are ever called. Treat every function in this
 * file as internal to that boundary, not as something a route handler
 * calls directly on unverified input.
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
 * Throws AuthorizationError unless an explicit, active link exists
 * AND the student record itself still exists and is not soft-deleted
 * -- matching listStudentsForGuardian's restriction exactly, so a
 * single-record check can never be more permissive than the list
 * (previously it was: this used to check only the link, not the
 * student's deletedAt, unlike the list; fixed here per Phase 1A
 * repair item 3). Callers must call this (or use
 * listStudentsForGuardian, which is self-scoping) before any read or
 * write touching a specific student on a guardian's behalf. Knowing
 * the student's ID -- e.g. from a URL a guardian typed or guessed --
 * is never sufficient by itself.
 */
export async function assertGuardianCanAccessStudent(
  db: Database,
  guardianUserId: string,
  studentPathwayRecordId: string,
): Promise<void> {
  const [link] = await db
    .select({ id: guardianStudentAccess.id })
    .from(guardianStudentAccess)
    .innerJoin(
      studentPathwayRecord,
      eq(guardianStudentAccess.studentPathwayRecordId, studentPathwayRecord.id),
    )
    .where(
      and(
        eq(guardianStudentAccess.guardianUserId, guardianUserId),
        eq(
          guardianStudentAccess.studentPathwayRecordId,
          studentPathwayRecordId,
        ),
        isNull(guardianStudentAccess.revokedAt),
        isNull(studentPathwayRecord.deletedAt),
      ),
    )
    .limit(1);

  if (!link) {
    throw new AuthorizationError(
      "Guardian does not have an active, explicit link to an existing, non-deleted student.",
    );
  }
}

// ---------------------------------------------------------------------------
// Staff role -- never self-selected, never trusted from a client
// claim. Defined before the advisor-access section below, which
// depends on it.
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

// ---------------------------------------------------------------------------
// Advisor access -- BOTH an active authorized staff role AND an
// active case assignment are required, always, for both list and
// single-case functions (Phase 1A repair item 3). Neither check
// alone is sufficient: an active assignment left over after a staff
// role is revoked must deny (a former advisor's old assignments do
// not survive their staff status), and simply holding a staff role
// must never itself grant visibility into a case nobody assigned.
//
// ADMIN is included in the allowed-role set alongside ADVISOR, but
// gets no different treatment: an ADMIN with no assignment to a case
// is denied exactly like anyone else. There is deliberately no
// "if admin, skip the assignment check" branch anywhere in this file
// -- that would be the blanket admin bypass the Phase 1A repair
// explicitly prohibits. An admin who needs to see a specific case
// must be explicitly assigned to it, the same as an advisor.
// ---------------------------------------------------------------------------

const CASE_ACCESS_ROLES = ["ADVISOR", "ADMIN"] as const satisfies readonly StaffRoleValue[];

/**
 * Every consultation case actively assigned to this advisor, but only
 * if they currently hold an active, authorized staff role at all. An
 * advisor sees nothing by simply being staff -- only cases someone
 * (another advisor/admin, per the Phase 7 workflow, not built yet)
 * explicitly assigned to them and has not since unassigned -- and
 * sees nothing at all, regardless of old assignments, once their
 * staff role is revoked.
 */
export async function listActiveCasesForAdvisor(
  db: Database,
  advisorUserId: string,
) {
  const role = await getStaffRole(db, advisorUserId);
  if (!role || !CASE_ACCESS_ROLES.includes(role)) return [];

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

/**
 * Throws unless the advisor BOTH currently holds an active,
 * authorized staff role AND has an active assignment to this exact
 * case. Checked in that order so a revoked staff role fails fast
 * without needing to also look up the assignment.
 */
export async function assertAdvisorCanAccessCase(
  db: Database,
  advisorUserId: string,
  consultationRequestId: string,
): Promise<void> {
  const role = await getStaffRole(db, advisorUserId);
  if (!role || !CASE_ACCESS_ROLES.includes(role)) {
    throw new AuthorizationError(
      "User does not hold an active, authorized staff role required for case access.",
    );
  }

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
