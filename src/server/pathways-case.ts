import "server-only";
import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  pathwaysCase,
  auditEvent,
  profileRevision,
  studentPathwayRecord,
  type pathwaysCaseStatusEnum,
  type actorTypeEnum,
} from "@/db/schema";
import { generateId } from "./ids";
import { isUniqueConstraintConflict } from "./db-conflict";
import { sanitizeText } from "@/lib/discovery/validation";

/**
 * Phase 6B -- the PathwaysCase domain service (docs/pathways
 * PHASE6B_CASE_FOUNDATION.md). A PathwaysCase is created exactly once
 * per ConsultationRequest, at the narrowest technically sound point
 * consistent with the existing Phase 6A flow: the moment a family's
 * contact information is received (see
 * src/server/consultation.ts's submitConsultationContact, the only
 * caller of ensureCaseForConsultationRequest). No UI in this phase
 * reads or writes a case directly -- this module exists purely to
 * prove the data/authorization foundation, for Phase 6C's advisor
 * workspace to build on.
 */

const PATHWAYS_CASE_CONSULTATION_REQUEST_CONSTRAINT = "pathways_case_consultation_request_unique_idx";

export type PathwaysCaseStatus = (typeof pathwaysCaseStatusEnum.enumValues)[number];
type ActorType = (typeof actorTypeEnum.enumValues)[number];

/** The transaction-callback argument type, so this module's functions accept either a plain Database or an in-flight transaction -- same pattern as src/server/booking.ts. */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Queryable = Database | Tx;

/**
 * The full Phase 6B case-status lifecycle (section 9). Deliberately a
 * distinct scale from ConsultationRequest.status (consultation.ts's
 * consultationStatusEnum) and from Booking's own scheduledAt/
 * cancelledAt fields -- never auto-derived from either.
 * `ConsultationRequest.status = BOOKED` drives the case toward BOOKED
 * (see linkBookingToCase below) because an internal booking actually
 * existing is itself the fact a case needs to record; but COMPLETED is
 * reachable only from BOOKED and ONLY ever by an explicit, future
 * advisor action -- no code anywhere in this phase sets COMPLETED, and
 * a scheduled call's time simply passing never does either.
 */
const ALLOWED_CASE_STATUS_TRANSITIONS: Record<PathwaysCaseStatus, readonly PathwaysCaseStatus[]> = {
  NEW: ["CONTACT_RECEIVED", "CLOSED"],
  CONTACT_RECEIVED: ["BOOKED", "NEEDS_INFORMATION", "FOLLOW_UP", "NOT_CURRENT_SERVICE_FIT", "CLOSED"],
  BOOKED: ["COMPLETED", "NEEDS_INFORMATION", "FOLLOW_UP", "NOT_CURRENT_SERVICE_FIT", "CLOSED"],
  COMPLETED: ["FOLLOW_UP", "CLOSED"],
  NEEDS_INFORMATION: ["CONTACT_RECEIVED", "BOOKED", "CLOSED"],
  FOLLOW_UP: ["BOOKED", "COMPLETED", "NOT_CURRENT_SERVICE_FIT", "CLOSED"],
  NOT_CURRENT_SERVICE_FIT: ["CLOSED"],
  CLOSED: [],
};

/** Pure, exported so both this module and its tests (and a future Phase 6C advisor action) share one source of truth for what transitions are legal. A same-status "transition" is never valid -- callers that only want to no-op on an unchanged status should check that separately. */
export function isValidCaseStatusTransition(from: PathwaysCaseStatus, to: PathwaysCaseStatus): boolean {
  if (from === to) return false;
  return ALLOWED_CASE_STATUS_TRANSITIONS[from].includes(to);
}

async function recordCaseAuditEvent(
  db: Queryable,
  params: {
    action: "CASE_CREATED" | "BOOKING_LINKED" | "CASE_STATUS_CHANGED";
    pathwaysCaseId: string;
    actorType: ActorType;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditEvent).values({
    id: generateId("audit"),
    actorType: params.actorType,
    action: params.action,
    targetType: "PathwaysCase",
    targetId: params.pathwaysCaseId,
    metadata: params.metadata ?? null,
  });
}

/**
 * Phase 6C (section 16): maps the SAME existing, optional,
 * already-approved `student_display_name` parent-supplied answer
 * (DISC_001 -- see src/lib/report/profile-context.ts's identical
 * extraction for the report's own `studentLabel`) into
 * StudentPathwayRecord.displayName, through this one safe server-side
 * path only. No new question is added anywhere to populate this --
 * if the parent never supplied one, displayName simply stays null and
 * every UI surface falls back to a neutral label ("Student").
 */
function extractStudentDisplayName(rawAnswers: unknown): string | undefined {
  if (typeof rawAnswers !== "object" || rawAnswers === null) return undefined;
  const value = (rawAnswers as Record<string, unknown>)["student_display_name"];
  if (typeof value !== "string") return undefined;
  const sanitized = sanitizeText(value).trim();
  return sanitized.length > 0 ? sanitized : undefined;
}

export interface EnsureCaseInput {
  studentPathwayRecordId: string;
  consultationRequestId: string;
  profileRevisionId: string;
  reportSnapshotId: string;
}

/**
 * Section 8 idempotency boundary: at most one PathwaysCase per
 * ConsultationRequest, enforced at the database level
 * (pathways_case_consultation_request_unique_idx) -- a concurrent or
 * retried call against the same ConsultationRequest never creates a
 * second case row, via the same SAVEPOINT + 23505-catch + re-select
 * pattern already proven in src/server/discovery-draft.ts and
 * src/server/consultation.ts.
 *
 * Always called from WITHIN the same transaction that creates/reuses
 * the ConsultationRequest and upserts contact info. A case is
 * therefore always created directly in CONTACT_RECEIVED status --
 * never NEW, which stays reserved in the schema enum for a
 * hypothetical future, earlier trigger point (e.g. report-view-only
 * funnel entry) this phase does not implement. Returns the case id
 * either way; only emits a CASE_CREATED audit event when a case was
 * actually newly inserted by this call (never a duplicate audit row
 * for a replay).
 */
export async function ensureCaseForConsultationRequest(
  db: Queryable,
  input: EnsureCaseInput,
): Promise<{ pathwaysCaseId: string; created: boolean }> {
  const candidateId = generateId("pwcase");
  try {
    await db.transaction(async (tx2) => {
      await tx2.insert(pathwaysCase).values({
        id: candidateId,
        studentPathwayRecordId: input.studentPathwayRecordId,
        consultationRequestId: input.consultationRequestId,
        profileRevisionId: input.profileRevisionId,
        reportSnapshotId: input.reportSnapshotId,
        status: "CONTACT_RECEIVED",
      });
    });
  } catch (err) {
    if (!isUniqueConstraintConflict(err, PATHWAYS_CASE_CONSULTATION_REQUEST_CONSTRAINT)) throw err;
    const [existing] = await db
      .select({ id: pathwaysCase.id })
      .from(pathwaysCase)
      .where(eq(pathwaysCase.consultationRequestId, input.consultationRequestId))
      .limit(1);
    if (!existing) throw err; // Constraint name matched but the row vanished -- do not fabricate a result.
    return { pathwaysCaseId: existing.id, created: false };
  }

  await recordCaseAuditEvent(db, {
    action: "CASE_CREATED",
    pathwaysCaseId: candidateId,
    actorType: "GUEST",
    metadata: { status: "CONTACT_RECEIVED" },
  });

  // Section 16: only on a genuinely fresh case, only when the record
  // doesn't already have a displayName (never overwrite one a prior
  // revision already supplied), and only when this revision actually
  // carries the optional answer.
  const [revisionRow] = await db
    .select({ rawAnswers: profileRevision.rawAnswers })
    .from(profileRevision)
    .where(eq(profileRevision.id, input.profileRevisionId))
    .limit(1);
  const displayName = revisionRow ? extractStudentDisplayName(revisionRow.rawAnswers) : undefined;
  if (displayName) {
    await db
      .update(studentPathwayRecord)
      .set({ displayName, updatedAt: new Date() })
      .where(
        and(
          eq(studentPathwayRecord.id, input.studentPathwayRecordId),
          isNull(studentPathwayRecord.displayName),
        ),
      );
  }

  return { pathwaysCaseId: candidateId, created: true };
}

/**
 * Called by src/server/booking.ts's createInternalBooking immediately
 * after a genuinely NEW booking row is committed (never for an
 * idempotent "alreadyBooked" replay, which already linked everything
 * the first time this request was booked). Links the case to its
 * booking and advances case status toward BOOKED -- a direct,
 * deterministic consequence of an internal booking actually existing,
 * never a guess about attendance. If the case has already progressed
 * past a status BOOKED can legally follow (see
 * ALLOWED_CASE_STATUS_TRANSITIONS), the status is left untouched --
 * never regressed. No-op (does nothing, throws nothing) if no case
 * exists yet for this request, so a booking can never fail because of
 * this bookkeeping step.
 */
export async function linkBookingToCase(
  db: Queryable,
  consultationRequestId: string,
  bookingId: string,
): Promise<void> {
  const [existingCase] = await db
    .select({ id: pathwaysCase.id, status: pathwaysCase.status })
    .from(pathwaysCase)
    .where(eq(pathwaysCase.consultationRequestId, consultationRequestId))
    .limit(1);
  if (!existingCase) return;

  const nextStatus: PathwaysCaseStatus = "BOOKED";
  const canTransition = isValidCaseStatusTransition(existingCase.status, nextStatus);

  await db
    .update(pathwaysCase)
    .set({
      bookingId,
      status: canTransition ? nextStatus : existingCase.status,
      updatedAt: new Date(),
    })
    .where(eq(pathwaysCase.id, existingCase.id));

  await recordCaseAuditEvent(db, {
    action: "BOOKING_LINKED",
    pathwaysCaseId: existingCase.id,
    actorType: "GUEST",
    metadata: { bookingId },
  });

  if (canTransition) {
    await recordCaseAuditEvent(db, {
      action: "CASE_STATUS_CHANGED",
      pathwaysCaseId: existingCase.id,
      actorType: "GUEST",
      metadata: { fromStatus: existingCase.status, toStatus: nextStatus },
    });
  }
}

/** Read-only lookup, used by tests and by future authorization/advisor code -- never by anything that trusts a client-supplied case id without a prior authorization check (see src/server/access-control.ts). */
export async function getCaseForConsultationRequest(db: Queryable, consultationRequestId: string) {
  const [row] = await db
    .select()
    .from(pathwaysCase)
    .where(eq(pathwaysCase.consultationRequestId, consultationRequestId))
    .limit(1);
  return row ?? null;
}
