import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  discoverySession,
  consultationRequest,
  consultationContact,
  workflowEvent,
  type consultationStatusEnum,
} from "@/db/schema";
import { generateId } from "./ids";
import { isUniqueConstraintConflict } from "./db-conflict";
import { resolveReportOutcomeForConsultation } from "./report-outcome";
import { getConsultationCapability } from "./consultation-capability";
import { ensureCaseForConsultationRequest } from "./pathways-case";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import { PLANNING_CONTACT_CONSENT_VERSION } from "@/lib/consultation/constants";

/**
 * Phase 6A contact-capture domain logic (docs/pathways instruction
 * sections 17-27). Every function here resolves the acting session
 * from an already-authenticated sessionId (the caller having read it
 * from the HttpOnly cookie -- see app/discover/consultation/actions.ts) --
 * never from a client-supplied consultation/student/revision id.
 */

const CONSULTATION_REQUEST_IDEMPOTENCY_CONSTRAINT = "consultation_request_profile_revision_unique_idx";

type ConsultationStatus = (typeof consultationStatusEnum.enumValues)[number];

export type SubmitConsultationContactResult =
  | { ok: true; consultationRequestId: string }
  | { ok: false; reason: "NO_SESSION" | "NO_COMPLETED_PROFILE" };

/**
 * The section 27 contact-submission transaction: resolves this
 * session's own StudentPathwayRecord and exact completed
 * ProfileRevision/ReportSnapshot (persisting them if they somehow
 * don't exist yet -- section 64), then idempotently creates or reuses
 * exactly one ConsultationRequest per originating ProfileRevision
 * (section 26 -- a double-click/retry never creates a duplicate),
 * upserts the pre-auth ConsultationContact, and records a WorkflowEvent
 * only when a NONE->REQUESTED transition genuinely occurred in this
 * call -- never a duplicate audit row for a pure network retry, and
 * never a fabricated "fromStatus=PENDING_VERIFICATION toStatus=REQUESTED"
 * row when the request had already progressed past REQUESTED and this
 * resubmission left its status untouched (Phase 6A.1 fix: the audit
 * log must only ever claim a transition that actually happened).
 * Never downgrades a request that has already progressed past
 * REQUESTED (e.g. PENDING_VERIFICATION) back to REQUESTED -- a parent
 * re-submitting this form after already reaching the scheduler handoff
 * must not undo that progress.
 */
export async function submitConsultationContact(
  db: Database,
  sessionId: string,
  input: ConsultationContactInput,
): Promise<SubmitConsultationContactResult> {
  const [sessionRow] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!sessionRow) return { ok: false, reason: "NO_SESSION" };
  if (!sessionRow.studentPathwayRecordId) return { ok: false, reason: "NO_COMPLETED_PROFILE" };

  // Phase 6A.1: links to the latest already-persisted ReportSnapshot
  // for this revision (the report the parent actually saw) rather than
  // silently recomputing a possibly-different one at submission time;
  // only falls back to ensure/persist when none exists yet.
  const outcome = await resolveReportOutcomeForConsultation(db, sessionId);
  if (!outcome) return { ok: false, reason: "NO_COMPLETED_PROFILE" };

  const studentPathwayRecordId = sessionRow.studentPathwayRecordId;
  const { revisionId, reportSnapshotId } = outcome;

  const consultationRequestId = await db.transaction(async (tx) => {
    let requestId: string;
    // True only when this call actually moved the row from NONE to
    // REQUESTED -- either by creating it fresh (implicit NONE origin)
    // or by updating an existing NONE row. Never derived from
    // "statusBefore !== REQUESTED" alone, since a farther-along status
    // (PENDING_VERIFICATION, BOOKED, ...) also satisfies that but must
    // never be reported as a REQUESTED transition.
    let didTransitionToRequested = false;

    const candidateId = generateId("crequest");
    try {
      await tx.transaction(async (tx2) => {
        await tx2.insert(consultationRequest).values({
          id: candidateId,
          studentPathwayRecordId,
          profileRevisionId: revisionId,
          reportSnapshotId,
          status: "REQUESTED",
        });
      });
      requestId = candidateId;
      didTransitionToRequested = true;
    } catch (err) {
      if (!isUniqueConstraintConflict(err, CONSULTATION_REQUEST_IDEMPOTENCY_CONSTRAINT)) throw err;
      const [existing] = await tx
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.profileRevisionId, revisionId))
        .limit(1);
      if (!existing) throw err; // Constraint name matched but the row vanished -- do not fabricate a result.
      requestId = existing.id;
      if (existing.status === "NONE") {
        await tx
          .update(consultationRequest)
          .set({ status: "REQUESTED", updatedAt: new Date() })
          .where(eq(consultationRequest.id, requestId));
        didTransitionToRequested = true;
      }
      // existing.status === "REQUESTED": already there, no change, no event.
      // existing.status is farther along (PENDING_VERIFICATION/BOOKED/...):
      // never regressed, no change, no event.
    }

    const now = new Date();
    await tx
      .insert(consultationContact)
      .values({
        id: generateId("ccontact"),
        consultationRequestId: requestId,
        guardianName: input.guardianName,
        email: input.email,
        mobilePhone: input.mobilePhone,
        preferredCallFormat: input.preferredCallFormat,
        contactConsentVersion: PLANNING_CONTACT_CONSENT_VERSION,
        contactConsentGrantedAt: now,
      })
      .onConflictDoUpdate({
        target: consultationContact.consultationRequestId,
        set: {
          guardianName: input.guardianName,
          email: input.email,
          mobilePhone: input.mobilePhone,
          preferredCallFormat: input.preferredCallFormat,
          contactConsentVersion: PLANNING_CONTACT_CONSENT_VERSION,
          contactConsentGrantedAt: now,
          updatedAt: now,
        },
      });

    if (didTransitionToRequested) {
      await tx.insert(workflowEvent).values({
        id: generateId("wfevent"),
        consultationRequestId: requestId,
        fromStatus: "NONE",
        toStatus: "REQUESTED",
        reason: "CONTACT_RECEIVED",
      });
    }

    // Phase 6B (section 8): the family has now meaningfully entered the
    // consultation/service workflow -- this is the narrowest
    // technically sound point to establish the operational
    // PathwaysCase, inside the exact same transaction so case
    // creation is atomic with the request/contact upsert above.
    // Idempotent regardless of whether this call is a fresh REQUESTED
    // transition or a contact resubmission against an existing request.
    await ensureCaseForConsultationRequest(tx, {
      studentPathwayRecordId,
      consultationRequestId: requestId,
      profileRevisionId: revisionId,
      reportSnapshotId,
    });

    return requestId;
  });

  return { ok: true, consultationRequestId };
}

export interface ActiveConsultationRequestView {
  id: string;
  status: ConsultationStatus;
  /** The call format the parent already chose during contact capture (Phase 6A.2 section 26: scheduling never re-asks this). Null only if the contact row is somehow missing. */
  preferredCallFormat: "VIDEO" | "PHONE" | null;
}

/**
 * Resolves this guest session's own active ConsultationRequest, purely
 * from the session-derived studentPathwayRecordId -- never from a
 * client-supplied consultation/request id. Returns null if this
 * session has no student record or no consultation request yet.
 */
export async function getActiveConsultationRequestForSession(
  db: Database,
  sessionId: string,
): Promise<ActiveConsultationRequestView | null> {
  const [sessionRow] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!sessionRow?.studentPathwayRecordId) return null;

  const [request] = await db
    .select({
      id: consultationRequest.id,
      status: consultationRequest.status,
      preferredCallFormat: consultationContact.preferredCallFormat,
    })
    .from(consultationRequest)
    .leftJoin(consultationContact, eq(consultationContact.consultationRequestId, consultationRequest.id))
    .where(eq(consultationRequest.studentPathwayRecordId, sessionRow.studentPathwayRecordId))
    .orderBy(desc(consultationRequest.createdAt))
    .limit(1);
  return request ? { ...request, preferredCallFormat: request.preferredCallFormat ?? null } : null;
}

export type ScheduleHandoffResult =
  | { ok: true; scheduleUrl: string }
  | { ok: false; reason: "NO_ACTIVE_REQUEST" | "SCHEDULING_UNAVAILABLE" };

/** Farther along than REQUESTED -- a handoff never regresses one of these back down (section 30's "if not already farther along"). */
const STATUSES_FARTHER_THAN_REQUESTED: readonly ConsultationStatus[] = [
  "PENDING_VERIFICATION",
  "BOOKED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
];

/**
 * The section 30 legacy Google scheduler handoff -- dormant unless
 * provider is explicitly GOOGLE_EXTERNAL (Phase 6A.2 section 39: this
 * route must never activate for provider=INTERNAL, even though
 * INTERNAL's capability also happens to carry state=REQUEST_ONLY).
 * Verifies capability is actually GOOGLE_EXTERNAL with a configured
 * URL, locates this session's own active ConsultationRequest (never a
 * client-supplied id), transactionally transitions
 * REQUESTED -> PENDING_VERIFICATION only if not already farther along,
 * appends the WorkflowEvent, and returns the server-configured schedule
 * URL for the caller to redirect to. Never returns/accepts any URL not
 * read directly from this server's own configuration (open-redirect
 * prevention).
 */
export async function handOffToGoogleScheduler(
  db: Database,
  sessionId: string,
): Promise<ScheduleHandoffResult> {
  const capability = getConsultationCapability();
  if (capability.provider !== "GOOGLE_EXTERNAL" || !capability.scheduleUrl) {
    return { ok: false, reason: "SCHEDULING_UNAVAILABLE" };
  }
  const scheduleUrl = capability.scheduleUrl;

  const [sessionRow] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!sessionRow?.studentPathwayRecordId) return { ok: false, reason: "NO_ACTIVE_REQUEST" };
  const studentPathwayRecordId = sessionRow.studentPathwayRecordId;

  const found = await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(consultationRequest)
      .where(eq(consultationRequest.studentPathwayRecordId, studentPathwayRecordId))
      .orderBy(desc(consultationRequest.createdAt))
      .limit(1);
    if (!request) return false;

    if (!STATUSES_FARTHER_THAN_REQUESTED.includes(request.status)) {
      await tx
        .update(consultationRequest)
        .set({ status: "PENDING_VERIFICATION", updatedAt: new Date() })
        .where(eq(consultationRequest.id, request.id));
      await tx.insert(workflowEvent).values({
        id: generateId("wfevent"),
        consultationRequestId: request.id,
        fromStatus: request.status,
        toStatus: "PENDING_VERIFICATION",
        reason: "GOOGLE_SCHEDULER_HANDOFF",
      });
    }
    return true;
  });

  if (!found) return { ok: false, reason: "NO_ACTIVE_REQUEST" };
  return { ok: true, scheduleUrl };
}
