import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { startDiscoverySession, saveDraftPatch, submitDiscoveryProfile } from "@/server/discovery-draft";
import { submitConsultationContact } from "@/server/consultation";
import {
  getAvailableSlotsForSession,
  createInternalBooking,
  getActiveBookingForSession,
} from "@/server/booking";
import {
  consultationRequest,
  workflowEvent,
  booking,
  advisorAssignment,
  user,
  session as authSession,
  account,
} from "@/db/schema";
import { PLANNING_RESOURCE_KEY, PLANNING_TIME_ZONE } from "@/lib/consultation/scheduling-policy";
import { zonedWallTimeToUtc } from "@/lib/consultation/timezone";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import type { Database } from "@/db/client";

/**
 * Phase 6A.2 native booking integration coverage (docs/pathways
 * instruction sections 52-60): slot removal/restoration, successful
 * booking, double-booking race, double-click idempotency, arbitrary
 * slot rejection, cross-session security, timezone input validation,
 * status transitions, and no external side effects -- all against
 * real PostgreSQL.
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

async function completeDiscoveryWithContact(db: Database) {
  const issued = await startDiscoverySession(db, null);
  for (const [field, value] of Object.entries(minimalValidRaw())) {
    await saveDraftPatch(db, issued.id, { [field]: value });
  }
  await submitDiscoveryProfile(db, issued.id);
  const contact: ConsultationContactInput = {
    guardianName: "Pat Guardian",
    email: "pat@example.com",
    mobilePhone: "555-123-4567",
    preferredCallFormat: "VIDEO",
    consentAcknowledged: true,
  };
  const result = await submitConsultationContact(db, issued.id, contact);
  if (!result.ok) throw new Error("Setup failed: contact submission did not succeed");
  return { sessionId: issued.id, consultationRequestId: result.consultationRequestId };
}

// A fixed, deterministic "now" (Monday 7:00 AM Pacific / 15:00 UTC, Jan 5 2026)
// and a valid slot comfortably inside the 24h-notice/30-day-horizon window.
const NOW = new Date("2026-01-05T15:00:00.000Z");
const VALID_SLOT = zonedWallTimeToUtc(2026, 1, 7, 10, 0, 0, PLANNING_TIME_ZONE); // Wed 10 AM Pacific
const VALID_SLOT_2 = zonedWallTimeToUtc(2026, 1, 7, 11, 0, 0, PLANNING_TIME_ZONE); // Wed 11 AM Pacific

describe.skipIf(!hasTestDatabase)("Phase 6A.2 native booking (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("slot removal + restoration (section 52)", () => {
    it("an actively booked slot is no longer returned as available; cancelling it restores availability", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const before = await getAvailableSlotsForSession(db, a.sessionId, NOW);
      expect(before.ok).toBe(true);
      if (!before.ok || before.alreadyBooked) return;
      expect(before.slots.some((s) => s.getTime() === VALID_SLOT.getTime())).toBe(true);

      const result = await createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const b = await completeDiscoveryWithContact(db);
      const afterBooked = await getAvailableSlotsForSession(db, b.sessionId, NOW);
      expect(afterBooked.ok).toBe(true);
      if (!afterBooked.ok || afterBooked.alreadyBooked) return;
      expect(afterBooked.slots.some((s) => s.getTime() === VALID_SLOT.getTime())).toBe(false);

      // Cancel the booking -- slot becomes available again.
      await db.update(booking).set({ cancelledAt: new Date() }).where(eq(booking.id, result.booking.id));
      const afterCancelled = await getAvailableSlotsForSession(db, b.sessionId, NOW);
      expect(afterCancelled.ok).toBe(true);
      if (!afterCancelled.ok || afterCancelled.alreadyBooked) return;
      expect(afterCancelled.slots.some((s) => s.getTime() === VALID_SLOT.getTime())).toBe(true);
    });
  });

  describe("successful booking (section 53)", () => {
    it("books a valid slot with all fields set correctly, transitions status, and assigns no advisor", async () => {
      const db = testDb!;
      const { sessionId, consultationRequestId } = await completeDiscoveryWithContact(db);

      const result = await createInternalBooking(
        db,
        sessionId,
        { selectedStartIso: VALID_SLOT.toISOString(), bookerTimeZone: "America/New_York" },
        NOW,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.alreadyBooked).toBe(false);

      const [row] = await db.select().from(booking).where(eq(booking.id, result.booking.id));
      expect(row).toBeDefined();
      expect(row!.source).toBe("INTERNAL");
      expect(row!.resourceKey).toBe(PLANNING_RESOURCE_KEY);
      expect(row!.scheduledAt!.getTime()).toBe(VALID_SLOT.getTime());
      expect(row!.durationMinutes).toBe(45);
      expect(row!.timeZone).toBe(PLANNING_TIME_ZONE);
      expect(row!.bookerTimeZone).toBe("America/New_York");
      expect(row!.providerReference).toBeNull();

      const [requestRow] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, consultationRequestId));
      expect(requestRow!.status).toBe("BOOKED");

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, consultationRequestId));
      const bookedEvents = events.filter((e) => e.toStatus === "BOOKED");
      expect(bookedEvents).toHaveLength(1);
      expect(bookedEvents[0]!.reason).toBe("INTERNAL_BOOKING_CONFIRMED");
      expect(bookedEvents[0]!.fromStatus).toBe("REQUESTED");

      expect(await db.select().from(advisorAssignment)).toHaveLength(0);
    });
  });

  describe("double-booking race (section 54, mandatory real concurrency)", () => {
    it("exactly one of two concurrent bookings for the same slot succeeds", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const b = await completeDiscoveryWithContact(db);

      const [resultA, resultB] = await Promise.all([
        createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
        createInternalBooking(db, b.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
      ]);

      const outcomes = [resultA, resultB];
      const succeeded = outcomes.filter((r) => r.ok && !r.alreadyBooked);
      const slotTaken = outcomes.filter((r) => !r.ok && r.reason === "SLOT_TAKEN");
      expect(succeeded).toHaveLength(1);
      expect(slotTaken).toHaveLength(1);

      const activeBookings = await db
        .select()
        .from(booking)
        .where(eq(booking.resourceKey, PLANNING_RESOURCE_KEY));
      const activeAtSlot = activeBookings.filter(
        (r) => r.scheduledAt?.getTime() === VALID_SLOT.getTime() && r.cancelledAt === null,
      );
      expect(activeAtSlot).toHaveLength(1);

      const [requestA] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, a.consultationRequestId));
      const [requestB] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, b.consultationRequestId));
      const bookedStatuses = [requestA!.status, requestB!.status].filter((s) => s === "BOOKED");
      expect(bookedStatuses).toHaveLength(1); // the losing case never becomes BOOKED
    });
  });

  describe("double-click idempotency (section 55)", () => {
    it("the same consultation submitting the same booking concurrently ends with exactly one active booking, no duplicate WorkflowEvent", async () => {
      const db = testDb!;
      const { sessionId, consultationRequestId } = await completeDiscoveryWithContact(db);

      const [r1, r2] = await Promise.all([
        createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
        createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW),
      ]);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (!r1.ok || !r2.ok) return;
      expect(r1.booking.id).toBe(r2.booking.id);

      const activeBookings = await db
        .select()
        .from(booking)
        .where(eq(booking.consultationRequestId, consultationRequestId));
      expect(activeBookings.filter((b) => b.cancelledAt === null)).toHaveLength(1);

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, consultationRequestId));
      expect(events.filter((e) => e.toStatus === "BOOKED")).toHaveLength(1);

      // A subsequent ordinary retry (sequential, not concurrent) is also idempotent.
      const r3 = await createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      expect(r3.ok).toBe(true);
      if (!r3.ok) return;
      expect(r3.alreadyBooked).toBe(true);
      expect(r3.booking.id).toBe(r1.booking.id);
    });
  });

  describe("arbitrary slot rejection (section 56)", () => {
    it("rejects Friday/Sunday/8AM/5:30PM/6PM/inside-24h/outside-horizon even posted directly", async () => {
      const db = testDb!;
      const { sessionId } = await completeDiscoveryWithContact(db);

      const friday = zonedWallTimeToUtc(2026, 1, 9, 9, 0, 0, PLANNING_TIME_ZONE);
      const sunday = zonedWallTimeToUtc(2026, 1, 11, 9, 0, 0, PLANNING_TIME_ZONE);
      const eightAm = zonedWallTimeToUtc(2026, 1, 13, 8, 0, 0, PLANNING_TIME_ZONE);
      const fiveThirty = zonedWallTimeToUtc(2026, 1, 13, 17, 30, 0, PLANNING_TIME_ZONE);
      const sixPm = zonedWallTimeToUtc(2026, 1, 13, 18, 0, 0, PLANNING_TIME_ZONE);
      const insideNotice = new Date(NOW.getTime() + 2 * 3_600_000); // 2h from now
      const outsideHorizon = zonedWallTimeToUtc(2026, 3, 1, 9, 0, 0, PLANNING_TIME_ZONE); // >30 days out

      for (const bad of [friday, sunday, eightAm, fiveThirty, sixPm, insideNotice, outsideHorizon]) {
        const result = await createInternalBooking(db, sessionId, { selectedStartIso: bad.toISOString() }, NOW);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("INVALID_SLOT");
      }

      expect(await db.select().from(booking)).toHaveLength(0);
    });
  });

  describe("cross-session security (section 57)", () => {
    it("guest B can never read, change, or confirm guest A's booking, even knowing raw ids", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const b = await completeDiscoveryWithContact(db);

      const bookedA = await createInternalBooking(db, a.sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      expect(bookedA.ok).toBe(true);

      // Guest B's own session-scoped lookup never sees guest A's booking.
      const bView = await getActiveBookingForSession(db, b.sessionId);
      expect(bView).toBeNull();

      // Guest B booking a DIFFERENT slot creates an independent booking, never touching A's.
      const bookedB = await createInternalBooking(db, b.sessionId, { selectedStartIso: VALID_SLOT_2.toISOString() }, NOW);
      expect(bookedB.ok).toBe(true);
      if (!bookedA.ok || !bookedB.ok) return;
      expect(bookedB.booking.id).not.toBe(bookedA.booking.id);

      const aView = await getActiveBookingForSession(db, a.sessionId);
      expect(aView!.id).toBe(bookedA.booking.id);
    });
  });

  describe("timezone input validation (section 58)", () => {
    it("stores a valid IANA timezone; falls back to Pacific for an invalid one; scheduling validity is unaffected either way", async () => {
      const db = testDb!;
      const a = await completeDiscoveryWithContact(db);
      const resultValid = await createInternalBooking(
        db,
        a.sessionId,
        { selectedStartIso: VALID_SLOT.toISOString(), bookerTimeZone: "Asia/Tokyo" },
        NOW,
      );
      expect(resultValid.ok).toBe(true);
      if (resultValid.ok) expect(resultValid.booking.bookerTimeZone).toBe("Asia/Tokyo");

      const b = await completeDiscoveryWithContact(db);
      const resultInvalid = await createInternalBooking(
        db,
        b.sessionId,
        { selectedStartIso: VALID_SLOT_2.toISOString(), bookerTimeZone: "Not/A/Real/Zone" },
        NOW,
      );
      expect(resultInvalid.ok).toBe(true);
      if (resultInvalid.ok) expect(resultInvalid.booking.bookerTimeZone).toBe(PLANNING_TIME_ZONE);
    });
  });

  describe("status transitions (section 59)", () => {
    it("REQUESTED -> internal booking -> BOOKED", async () => {
      const db = testDb!;
      const { sessionId, consultationRequestId } = await completeDiscoveryWithContact(db);
      const result = await createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      expect(result.ok).toBe(true);
      const [row] = await db.select().from(consultationRequest).where(eq(consultationRequest.id, consultationRequestId));
      expect(row!.status).toBe("BOOKED");
    });

    it("PENDING_VERIFICATION -> internal booking -> BOOKED (legacy-handoff backward compatibility)", async () => {
      const db = testDb!;
      const { sessionId, consultationRequestId } = await completeDiscoveryWithContact(db);
      await db
        .update(consultationRequest)
        .set({ status: "PENDING_VERIFICATION" })
        .where(eq(consultationRequest.id, consultationRequestId));

      const result = await createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      expect(result.ok).toBe(true);
      const [row] = await db.select().from(consultationRequest).where(eq(consultationRequest.id, consultationRequestId));
      expect(row!.status).toBe("BOOKED");

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, consultationRequestId));
      const bookedEvent = events.find((e) => e.toStatus === "BOOKED");
      expect(bookedEvent!.fromStatus).toBe("PENDING_VERIFICATION");
    });

    it("BOOKED -> retry -> remains BOOKED (no false audit event)", async () => {
      const db = testDb!;
      const { sessionId, consultationRequestId } = await completeDiscoveryWithContact(db);
      await createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      const retry = await createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
      expect(retry.ok).toBe(true);
      if (retry.ok) expect(retry.alreadyBooked).toBe(true);

      const [row] = await db.select().from(consultationRequest).where(eq(consultationRequest.id, consultationRequestId));
      expect(row!.status).toBe("BOOKED");
      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, consultationRequestId));
      expect(events.filter((e) => e.toStatus === "BOOKED")).toHaveLength(1);
    });

    it("COMPLETED/CANCELLED/NO_SHOW reject a booking attempt honestly, without creating one", async () => {
      const db = testDb!;
      for (const terminal of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
        await resetTestDatabase();
        const { sessionId, consultationRequestId } = await completeDiscoveryWithContact(db);
        await db.update(consultationRequest).set({ status: terminal }).where(eq(consultationRequest.id, consultationRequestId));

        const result = await createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("NOT_BOOKABLE");

        expect(await db.select().from(booking)).toHaveLength(0);
        const [row] = await db.select().from(consultationRequest).where(eq(consultationRequest.id, consultationRequestId));
        expect(row!.status).toBe(terminal); // never changed
      }
    });
  });

  describe("no external side effects (section 60)", () => {
    it("internal booking creates no Better Auth user/session/account and no advisor assignment", async () => {
      const db = testDb!;
      const { sessionId } = await completeDiscoveryWithContact(db);
      await createInternalBooking(db, sessionId, { selectedStartIso: VALID_SLOT.toISOString() }, NOW);

      expect(await db.select().from(user)).toHaveLength(0);
      expect(await db.select().from(authSession)).toHaveLength(0);
      expect(await db.select().from(account)).toHaveLength(0);
      expect(await db.select().from(advisorAssignment)).toHaveLength(0);
    });
  });
});
