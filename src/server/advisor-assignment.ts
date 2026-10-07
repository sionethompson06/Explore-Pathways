import "server-only";
import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { pathwaysCase, advisorAssignment, auditEvent } from "@/db/schema";
import { generateId } from "./ids";
import { isUniqueConstraintConflict } from "./db-conflict";
import { getStaffRole, CASE_ACCESS_ROLES } from "./access-control";

/**
 * Phase 6C -- the advisor-assignment domain service (docs/pathways
 * PHASE6C_ADVISOR_ASSIGNMENT_QUEUE.md). The administrator chooses the
 * advisor; the parent never does and never reaches any function here.
 * PathwaysCase.status is never read or written by anything in this
 * module (section 15: assignment ownership and case operational state
 * are different concepts -- an unassigned BOOKED case stays BOOKED
 * after assignment).
 */

const ADVISOR_ASSIGNMENT_ACTIVE_PER_CASE_CONSTRAINT = "advisor_assignment_active_per_case_unique_idx";

export type AssignAdvisorResult =
  | { ok: true; assignmentId: string; action: "ASSIGNED" | "REASSIGNED" | "NOOP_ALREADY_ASSIGNED" }
  | { ok: false; reason: "CASE_NOT_FOUND" | "NOT_ADMIN" | "TARGET_NOT_AUTHORIZED_ADVISOR" };

/**
 * The section 7-8/13 assignment transaction. `assignedByUserId` must
 * hold an active ADMIN staff role -- never inferred from a client
 * claim, always looked up fresh from `staff_role`. `advisorUserId`
 * (the target) must hold an active, authorized staff role from the
 * same `CASE_ACCESS_ROLES` set the existing per-case access-control
 * functions already recognize (ADVISOR or ADMIN) -- an ordinary user
 * can never be "assigned" as an advisor.
 *
 * Concurrency (section 13): the PathwaysCase row is locked
 * `FOR UPDATE` for the entire transaction, so two concurrent
 * assignment attempts against the SAME case serialize -- the second
 * one always sees the first one's committed result and acts as a
 * reassignment on top of it, never a race that could leave two active
 * rows. `advisor_assignment_active_per_case_unique_idx` is the
 * unconditional database-level backstop; if it is ever hit despite
 * the lock, this throws loudly rather than silently resolving a state
 * that should be structurally unreachable.
 *
 * Reassigning to the SAME currently-active advisor is a pure no-op --
 * no new row, no audit event -- so an accidental duplicate submit
 * never fabricates a reassignment that did not really happen.
 */
export async function assignAdvisorToCase(
  db: Database,
  input: { pathwaysCaseId: string; advisorUserId: string; assignedByUserId: string },
): Promise<AssignAdvisorResult> {
  const adminRole = await getStaffRole(db, input.assignedByUserId);
  if (adminRole !== "ADMIN") {
    return { ok: false, reason: "NOT_ADMIN" };
  }

  const targetRole = await getStaffRole(db, input.advisorUserId);
  if (!targetRole || !CASE_ACCESS_ROLES.includes(targetRole)) {
    return { ok: false, reason: "TARGET_NOT_AUTHORIZED_ADVISOR" };
  }

  return db.transaction(async (tx) => {
    const [caseRow] = await tx
      .select({ id: pathwaysCase.id, consultationRequestId: pathwaysCase.consultationRequestId })
      .from(pathwaysCase)
      .where(eq(pathwaysCase.id, input.pathwaysCaseId))
      .for("update")
      .limit(1);
    if (!caseRow) return { ok: false, reason: "CASE_NOT_FOUND" };

    const [currentActive] = await tx
      .select()
      .from(advisorAssignment)
      .where(and(eq(advisorAssignment.pathwaysCaseId, caseRow.id), isNull(advisorAssignment.unassignedAt)))
      .limit(1);

    if (currentActive && currentActive.advisorUserId === input.advisorUserId) {
      return { ok: true, assignmentId: currentActive.id, action: "NOOP_ALREADY_ASSIGNED" };
    }

    const now = new Date();
    if (currentActive) {
      await tx
        .update(advisorAssignment)
        .set({ unassignedAt: now })
        .where(eq(advisorAssignment.id, currentActive.id));
    }

    const newAssignmentId = generateId("advassign");
    try {
      await tx.transaction(async (tx2) => {
        await tx2.insert(advisorAssignment).values({
          id: newAssignmentId,
          consultationRequestId: caseRow.consultationRequestId,
          pathwaysCaseId: caseRow.id,
          advisorUserId: input.advisorUserId,
          assignedByUserId: input.assignedByUserId,
          assignedAt: now,
        });
      });
    } catch (err) {
      if (!isUniqueConstraintConflict(err, ADVISOR_ASSIGNMENT_ACTIVE_PER_CASE_CONSTRAINT)) throw err;
      // Structurally unreachable given the FOR UPDATE lock above --
      // fail loudly rather than fabricate a result if it ever fires.
      throw err;
    }

    await tx.insert(auditEvent).values({
      id: generateId("audit"),
      actorType: "ADMIN",
      actorUserId: input.assignedByUserId,
      action: currentActive ? "ADVISOR_REASSIGNED" : "ADVISOR_ASSIGNED",
      targetType: "PathwaysCase",
      targetId: caseRow.id,
      metadata: currentActive
        ? { previousAdvisorUserId: currentActive.advisorUserId, newAdvisorUserId: input.advisorUserId }
        : { advisorUserId: input.advisorUserId },
    });

    return {
      ok: true,
      assignmentId: newAssignmentId,
      action: currentActive ? "REASSIGNED" : "ASSIGNED",
    } as const;
  });
}

export type UnassignAdvisorResult =
  | { ok: true; unassigned: boolean }
  | { ok: false; reason: "CASE_NOT_FOUND" | "NOT_ADMIN" };

/**
 * Section 9: returns a case to the unassigned queue, explicitly and
 * auditably -- never inferred from deleting the assignment row (it is
 * only ever deactivated, via `unassignedAt`, so reassignment history
 * is preserved exactly like the assignment path above). A no-op
 * (ok: true, unassigned: false) when the case has no active assignment
 * to begin with -- never an error, since the end state the caller
 * wanted (no active advisor) already holds.
 */
export async function unassignAdvisorFromCase(
  db: Database,
  input: { pathwaysCaseId: string; actorUserId: string },
): Promise<UnassignAdvisorResult> {
  const adminRole = await getStaffRole(db, input.actorUserId);
  if (adminRole !== "ADMIN") {
    return { ok: false, reason: "NOT_ADMIN" };
  }

  return db.transaction(async (tx) => {
    const [caseRow] = await tx
      .select({ id: pathwaysCase.id })
      .from(pathwaysCase)
      .where(eq(pathwaysCase.id, input.pathwaysCaseId))
      .for("update")
      .limit(1);
    if (!caseRow) return { ok: false, reason: "CASE_NOT_FOUND" };

    const [currentActive] = await tx
      .select()
      .from(advisorAssignment)
      .where(and(eq(advisorAssignment.pathwaysCaseId, caseRow.id), isNull(advisorAssignment.unassignedAt)))
      .limit(1);
    if (!currentActive) return { ok: true, unassigned: false };

    const now = new Date();
    await tx
      .update(advisorAssignment)
      .set({ unassignedAt: now })
      .where(eq(advisorAssignment.id, currentActive.id));

    await tx.insert(auditEvent).values({
      id: generateId("audit"),
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      action: "ADVISOR_UNASSIGNED",
      targetType: "PathwaysCase",
      targetId: caseRow.id,
      metadata: { previousAdvisorUserId: currentActive.advisorUserId },
    });

    return { ok: true, unassigned: true };
  });
}

/** Read-only: the current active assignment for a case, or null. Used by the admin/advisor UI and tests -- never trusted as an authorization check by itself (see access-control.ts for that). */
export async function getActiveAssignmentForCase(db: Database, pathwaysCaseId: string) {
  const [row] = await db
    .select()
    .from(advisorAssignment)
    .where(and(eq(advisorAssignment.pathwaysCaseId, pathwaysCaseId), isNull(advisorAssignment.unassignedAt)))
    .limit(1);
  return row ?? null;
}
