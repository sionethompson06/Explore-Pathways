import "server-only";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { discoverySession, consultationRequest, booking, workflowEvent } from "@/db/schema";
import { generateId } from "./ids";
import { isUniqueConstraintConflict } from "./db-conflict";
import {
  PLANNING_CALL_DURATION_MINUTES,
  PLANNING_RESOURCE_KEY,
  PLANNING_TIME_ZONE,
  generatePlanningSlotCandidates,
  isValidPlanningSlotStart,
} from "@/lib/consultation/scheduling-policy";
import { isValidIanaTimeZone } from "@/lib/consultation/timezone";

/**
 * Phase 6A.2 native Pathways booking domain service (docs/pathways
 * instruction section 16). Every function resolves the acting session
 * from an already-authenticated sessionId (the caller having read it
 * from the HttpOnly cookie) -- never from a client-supplied
 * student/consultation/booking id. This is the only module that reads
 * or writes the `booking` table for internal scheduling.
 */

const BOOKING_ACTIVE_PER_REQUEST_CONSTRAINT = "booking_active_per_request_unique_idx";
const BOOKING_RESOURCE_SLOT_CONSTRAINT = "booking_resource_slot_unique_idx";

/** The transaction-callback argument type, so helpers below can accept either a plain Database or an in-flight transaction. */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Queryable = Database | Tx;

/** Statuses a NEW internal booking may be created from (section 28). */
const BOOKABLE_STATUSES = ["REQUESTED", "PENDING_VERIFICATION"] as const;
/** Statuses that must never silently produce a new appointment (section 28) -- rescheduling is a later phase. */
const TERMINAL_STATUSES = ["COMPLETED", "NO_SHOW", "CANCELLED"] as const;

export interface BookingView {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  timeZone: string;
  bookerTimeZone: string | null;
  resourceKey: string;
}

function toBookingView(row: typeof booking.$inferSelect): BookingView {
  return {
    id: row.id,
    scheduledAt: row.scheduledAt!,
    durationMinutes: row.durationMinutes ?? PLANNING_CALL_DURATION_MINUTES,
    timeZone: row.timeZone ?? PLANNING_TIME_ZONE,
    bookerTimeZone: row.bookerTimeZone,
    resourceKey: row.resourceKey ?? PLANNING_RESOURCE_KEY,
  };
}

/**
 * Resolves this guest session's own most recent ConsultationRequest --
 * purely from the session-derived studentPathwayRecordId, never from a
 * client-supplied id. Returns null if this session has no student
 * record or no consultation request yet.
 */
async function resolveOwnedConsultationRequest(db: Queryable, sessionId: string) {
  const [sessionRow] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!sessionRow?.studentPathwayRecordId) return null;

  const [request] = await db
    .select()
    .from(consultationRequest)
    .where(eq(consultationRequest.studentPathwayRecordId, sessionRow.studentPathwayRecordId))
    .orderBy(desc(consultationRequest.createdAt))
    .limit(1);
  return request ?? null;
}

async function loadActiveBookingForRequest(db: Queryable, consultationRequestId: string) {
  const [row] = await db
    .select()
    .from(booking)
    .where(and(eq(booking.consultationRequestId, consultationRequestId), isNull(booking.cancelledAt)))
    .limit(1);
  return row ?? null;
}

export type AvailableSlotsResult =
  | { ok: true; alreadyBooked: false; slots: Date[]; windowStartIso: string }
  | { ok: true; alreadyBooked: true; booking: BookingView }
  | { ok: false; reason: "NO_ACTIVE_REQUEST" | "NOT_BOOKABLE" };

/**
 * Lists genuinely available Pathways planning-call slots for this
 * session's own active ConsultationRequest: the pure policy candidates
 * (src/lib/consultation/scheduling-policy.ts) minus any already
 * actively booked for PLANNING_RESOURCE_KEY. If this request already
 * has an active Booking, returns it instead (section 37: the caller
 * must redirect to the confirmation page, never offer another time).
 */
export async function getAvailableSlotsForSession(
  db: Database,
  sessionId: string,
  nowUtc: Date = new Date(),
): Promise<AvailableSlotsResult> {
  const request = await resolveOwnedConsultationRequest(db, sessionId);
  if (!request) return { ok: false, reason: "NO_ACTIVE_REQUEST" };

  if (request.status === "BOOKED") {
    const active = await loadActiveBookingForRequest(db, request.id);
    if (active) return { ok: true, alreadyBooked: true, booking: toBookingView(active) };
    return { ok: false, reason: "NOT_BOOKABLE" };
  }
  if (!BOOKABLE_STATUSES.includes(request.status as (typeof BOOKABLE_STATUSES)[number])) {
    return { ok: false, reason: "NOT_BOOKABLE" };
  }

  const candidates = generatePlanningSlotCandidates(nowUtc);
  if (candidates.length === 0) {
    return { ok: true, alreadyBooked: false, slots: [], windowStartIso: nowUtc.toISOString() };
  }

  const horizonStart = new Date(nowUtc.getTime());
  const horizonEnd = candidates[candidates.length - 1]!;
  const activeBookings = await db
    .select({ scheduledAt: booking.scheduledAt })
    .from(booking)
    .where(
      and(
        eq(booking.resourceKey, PLANNING_RESOURCE_KEY),
        isNull(booking.cancelledAt),
        gte(booking.scheduledAt, horizonStart),
        lte(booking.scheduledAt, horizonEnd),
      ),
    );
  const takenMs = new Set(activeBookings.map((b) => b.scheduledAt!.getTime()));

  const slots = candidates.filter((c) => !takenMs.has(c.getTime()));
  return { ok: true, alreadyBooked: false, slots, windowStartIso: nowUtc.toISOString() };
}

export type CreateInternalBookingResult =
  | { ok: true; alreadyBooked: boolean; booking: BookingView }
  | { ok: false; reason: "NO_ACTIVE_REQUEST" | "NOT_BOOKABLE" | "INVALID_SLOT" | "SLOT_TAKEN" };

/**
 * The section 29 booking transaction. Never accepts a
 * student/consultation/report/booking id from the browser -- only
 * `selectedStartIso` (re-validated server-side against the exact same
 * policy that generated it, section 18) and an optional
 * `bookerTimeZone` (display-only, validated, falls back to Pacific).
 *
 * Phase 6A.2a (sections 2-3): which ConsultationRequest this session
 * owns is resolved once, up front -- a session cannot switch which
 * request it owns mid-call. Its CURRENT *status*, however, is never
 * trusted from that pre-transaction read: another process (a legacy
 * Google handoff, a future admin action, a retried call) could
 * transition it between that read and this transaction's writes. The
 * status is instead re-read -- and locked via `SELECT ... FOR UPDATE`
 * -- inside the same atomic transaction that inserts the Booking, so a
 * concurrent status change either already committed (and is seen here)
 * or is blocked until this transaction commits/rolls back (and will
 * see this one) -- never a lost update racing a stale in-memory status.
 */
export async function createInternalBooking(
  db: Database,
  sessionId: string,
  input: { selectedStartIso: string; bookerTimeZone?: string | null },
  nowUtc: Date = new Date(),
): Promise<CreateInternalBookingResult> {
  const owned = await resolveOwnedConsultationRequest(db, sessionId);
  if (!owned) return { ok: false, reason: "NO_ACTIVE_REQUEST" };

  const candidateDate = new Date(input.selectedStartIso);
  if (!isValidPlanningSlotStart(candidateDate, nowUtc)) {
    return { ok: false, reason: "INVALID_SLOT" };
  }
  const bookerTimeZone = isValidIanaTimeZone(input.bookerTimeZone) ? input.bookerTimeZone : PLANNING_TIME_ZONE;

  return db.transaction(async (tx) => {
    // The single authoritative status check (section 3) -- locked and
    // re-read fresh, never the pre-transaction `owned` row.
    const [current] = await tx
      .select()
      .from(consultationRequest)
      .where(eq(consultationRequest.id, owned.id))
      .for("update")
      .limit(1);
    if (!current) return { ok: false, reason: "NO_ACTIVE_REQUEST" };

    if (current.status === "BOOKED") {
      const active = await loadActiveBookingForRequest(tx, current.id);
      if (active) return { ok: true, alreadyBooked: true, booking: toBookingView(active) };
      return { ok: false, reason: "NOT_BOOKABLE" };
    }
    if (
      TERMINAL_STATUSES.includes(current.status as (typeof TERMINAL_STATUSES)[number]) ||
      !BOOKABLE_STATUSES.includes(current.status as (typeof BOOKABLE_STATUSES)[number])
    ) {
      return { ok: false, reason: "NOT_BOOKABLE" };
    }

    const priorStatus = current.status;
    const candidateBookingId = generateId("booking");

    try {
      await tx.transaction(async (tx2) => {
        await tx2.insert(booking).values({
          id: candidateBookingId,
          consultationRequestId: current.id,
          source: "INTERNAL",
          resourceKey: PLANNING_RESOURCE_KEY,
          scheduledAt: candidateDate,
          durationMinutes: PLANNING_CALL_DURATION_MINUTES,
          timeZone: PLANNING_TIME_ZONE,
          bookerTimeZone,
          providerReference: null,
        });
      });
    } catch (err) {
      // Section 5-6: a same-consultation double submission can violate
      // EITHER unique index depending on timing/query plan -- idempotency
      // must never depend on which one Postgres happens to report first.
      // Whichever fires, the resolution rule is identical: prefer this
      // request's own active booking if one now exists; only fall back
      // to SLOT_TAKEN when it genuinely does not.
      const isRelevantConflict =
        isUniqueConstraintConflict(err, BOOKING_ACTIVE_PER_REQUEST_CONSTRAINT) ||
        isUniqueConstraintConflict(err, BOOKING_RESOURCE_SLOT_CONSTRAINT);
      if (!isRelevantConflict) throw err;

      const existingForThisRequest = await loadActiveBookingForRequest(tx, current.id);
      if (existingForThisRequest) {
        return { ok: true, alreadyBooked: true, booking: toBookingView(existingForThisRequest) };
      }
      // No active booking for THIS request -- the conflict can only be
      // the resource/slot already being held by another consultation.
      return { ok: false, reason: "SLOT_TAKEN" };
    }

    const [inserted] = await tx.select().from(booking).where(eq(booking.id, candidateBookingId)).limit(1);
    if (!inserted) throw new Error("Booking row vanished immediately after insert.");

    await tx
      .update(consultationRequest)
      .set({ status: "BOOKED", updatedAt: new Date() })
      .where(eq(consultationRequest.id, current.id));

    await tx.insert(workflowEvent).values({
      id: generateId("wfevent"),
      consultationRequestId: current.id,
      fromStatus: priorStatus,
      toStatus: "BOOKED",
      reason: "INTERNAL_BOOKING_CONFIRMED",
    });

    return { ok: true, alreadyBooked: false, booking: toBookingView(inserted) };
  });
}

/**
 * Session-scoped active-booking lookup (section 36) -- never from a
 * client-supplied booking id. Used by both the schedule page (redirect
 * to confirmation if already booked) and the confirmation page itself
 * (require an active booking to render at all).
 */
export async function getActiveBookingForSession(db: Database, sessionId: string): Promise<BookingView | null> {
  const request = await resolveOwnedConsultationRequest(db, sessionId);
  if (!request || request.status !== "BOOKED") return null;
  const active = await loadActiveBookingForRequest(db, request.id);
  return active ? toBookingView(active) : null;
}
