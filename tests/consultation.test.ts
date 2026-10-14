import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { hasTestDatabase, testDb, resetTestDatabase, closeTestDb } from "./helpers/db";
import { startDiscoverySession, saveDraftPatch, submitDiscoveryProfile } from "@/server/discovery-draft";
import { ensureReportOutcomeForSession } from "@/server/report-outcome";
import {
  submitConsultationContact,
  getActiveConsultationRequestForSession,
  handOffToGoogleScheduler,
} from "@/server/consultation";
import {
  consultationRequest,
  consultationContact,
  workflowEvent,
  engineRun,
  reportSnapshot,
  booking,
  advisorAssignment,
  user,
  session as authSession,
  account,
} from "@/db/schema";
import { loadContracts } from "@/lib/contracts/loader";
import { resolvePrimaryAction } from "@/lib/report/cta";
import { PLANNING_CONTACT_CONSENT_VERSION } from "@/lib/consultation/constants";
import type { ConsultationContactInput } from "@/lib/consultation/validation";
import type { Database } from "@/db/client";

/**
 * Phase 6A integration coverage (docs/pathways instruction sections
 * 49-56): report-snapshot persistence + idempotency, contact capture
 * (all linkages, guardianUserId null, consent, WorkflowEvent),
 * retry/concurrent idempotency, cross-session security, no Better
 * Auth account creation, Google handoff, and the hard "no false
 * booking" acceptance test -- all against real PostgreSQL, mirroring
 * tests/discovery-draft.test.ts's established pattern.
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

async function completeDiscovery(db: Database) {
  const issued = await startDiscoverySession(db, null);
  for (const [field, value] of Object.entries(minimalValidRaw())) {
    await saveDraftPatch(db, issued.id, { [field]: value });
  }
  const result = await submitDiscoveryProfile(db, issued.id);
  return { issued, result };
}

const validContact: ConsultationContactInput = {
  guardianName: "Pat Guardian",
  email: "pat@example.com",
  mobilePhone: "555-123-4567",
  preferredCallFormat: "VIDEO",
  consentAcknowledged: true,
};

describe.skipIf(!hasTestDatabase)("Phase 6A report persistence + consultation (real PostgreSQL)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("report snapshot persistence + idempotency", () => {
    it("persists an EngineRun + ReportSnapshot linked to the exact profile revision", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const outcome = await ensureReportOutcomeForSession(db, issued.id);
      expect(outcome).not.toBeNull();

      const [run] = await db.select().from(engineRun).where(eq(engineRun.id, outcome!.engineRunId));
      expect(run).toBeDefined();
      expect(run!.profileRevisionId).toBe(outcome!.revisionId);

      const [snap] = await db.select().from(reportSnapshot).where(eq(reportSnapshot.id, outcome!.reportSnapshotId));
      expect(snap).toBeDefined();
      expect(snap!.profileRevisionId).toBe(outcome!.revisionId);
      expect(snap!.engineRunId).toBe(outcome!.engineRunId);
      expect(snap!.generationState).toBe("TEMPLATE");
      expect((snap!.publicContent as { reportId: string }).reportId).toBe(outcome!.report.reportId);
    });

    it("publicContent is exactly the assembled DTO -- no staff/internal/contact field sneaks in", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const outcome = await ensureReportOutcomeForSession(db, issued.id);
      const [snap] = await db.select().from(reportSnapshot).where(eq(reportSnapshot.id, outcome!.reportSnapshotId));
      expect(Object.keys(snap!.publicContent as object).sort()).toEqual(Object.keys(outcome!.report).sort());
    });

    it("is idempotent: repeated calls under the same revision reuse the same engine run + snapshot, not duplicates", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const first = await ensureReportOutcomeForSession(db, issued.id);
      const second = await ensureReportOutcomeForSession(db, issued.id);
      expect(second!.engineRunId).toBe(first!.engineRunId);
      expect(second!.reportSnapshotId).toBe(first!.reportSnapshotId);

      const runs = await db.select().from(engineRun).where(eq(engineRun.profileRevisionId, first!.revisionId));
      expect(runs).toHaveLength(1);
      const snaps = await db.select().from(reportSnapshot).where(eq(reportSnapshot.profileRevisionId, first!.revisionId));
      expect(snaps).toHaveLength(1);
    });

    it("survives concurrent/retried calls without creating duplicate rows", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const [a, b, c] = await Promise.all([
        ensureReportOutcomeForSession(db, issued.id),
        ensureReportOutcomeForSession(db, issued.id),
        ensureReportOutcomeForSession(db, issued.id),
      ]);
      expect(a!.reportSnapshotId).toBe(b!.reportSnapshotId);
      expect(b!.reportSnapshotId).toBe(c!.reportSnapshotId);

      const snaps = await db.select().from(reportSnapshot).where(eq(reportSnapshot.profileRevisionId, a!.revisionId));
      expect(snaps).toHaveLength(1);
      const runs = await db.select().from(engineRun).where(eq(engineRun.profileRevisionId, a!.revisionId));
      expect(runs).toHaveLength(1);
    });
  });

  describe("contact capture", () => {
    it("creates an operational ConsultationRequest linked to the exact revision + snapshot; guardianUserId null; status REQUESTED; consent + WorkflowEvent recorded", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const outcome = await ensureReportOutcomeForSession(db, issued.id);

      const result = await submitConsultationContact(db, issued.id, validContact);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const [request] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, result.consultationRequestId));
      expect(request!.status).toBe("REQUESTED");
      expect(request!.guardianUserId).toBeNull();
      expect(request!.profileRevisionId).toBe(outcome!.revisionId);
      expect(request!.reportSnapshotId).toBe(outcome!.reportSnapshotId);

      const [contact] = await db
        .select()
        .from(consultationContact)
        .where(eq(consultationContact.consultationRequestId, request!.id));
      expect(contact!.guardianName).toBe("Pat Guardian");
      expect(contact!.email).toBe("pat@example.com");
      expect(contact!.mobilePhone).toBe("555-123-4567");
      expect(contact!.preferredCallFormat).toBe("VIDEO");
      expect(contact!.contactConsentVersion).toBe(PLANNING_CONTACT_CONSENT_VERSION);
      expect(contact!.contactConsentGrantedAt).toBeInstanceOf(Date);

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, request!.id));
      expect(events).toHaveLength(1);
      expect(events[0]!.fromStatus).toBe("NONE");
      expect(events[0]!.toStatus).toBe("REQUESTED");
      expect(events[0]!.reason).toBe("CONTACT_RECEIVED");
    });

    it("is idempotent: a double-submit under the same revision reuses the same ConsultationRequest, not a duplicate", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      await ensureReportOutcomeForSession(db, issued.id);

      const first = await submitConsultationContact(db, issued.id, validContact);
      const second = await submitConsultationContact(db, issued.id, validContact);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.consultationRequestId).toBe(second.consultationRequestId);

      const rows = await db.select().from(consultationRequest);
      expect(rows).toHaveLength(1);
      const contacts = await db.select().from(consultationContact);
      expect(contacts).toHaveLength(1);
      // No duplicate audit row for a replay that never changed status.
      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, first.consultationRequestId));
      expect(events).toHaveLength(1);
    });

    it("survives concurrent double-submit (network retry) without creating duplicates", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      await ensureReportOutcomeForSession(db, issued.id);

      const [a, b] = await Promise.all([
        submitConsultationContact(db, issued.id, validContact),
        submitConsultationContact(db, issued.id, validContact),
      ]);
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(a.consultationRequestId).toBe(b.consultationRequestId);

      const rows = await db.select().from(consultationRequest);
      expect(rows).toHaveLength(1);
    });

    it("a genuinely new Discovery revision gets its own separate ConsultationRequest", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      await submitConsultationContact(db, issued.id, validContact);

      // An intentional edit + resubmit creates revision 2.
      await saveDraftPatch(db, issued.id, { current_grade: "9" });
      await submitDiscoveryProfile(db, issued.id);
      const second = await submitConsultationContact(db, issued.id, validContact);
      expect(second.ok).toBe(true);

      const rows = await db.select().from(consultationRequest);
      expect(rows).toHaveLength(2);
    });

    it("never creates a Better Auth user/session/account for this pre-auth submission", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      await submitConsultationContact(db, issued.id, validContact);

      expect(await db.select().from(user)).toHaveLength(0);
      expect(await db.select().from(authSession)).toHaveLength(0);
      expect(await db.select().from(account)).toHaveLength(0);
    });
  });

  describe("audit trail correctness (Phase 6A.1)", () => {
    it("A. a brand-new contact submission records exactly one NONE -> REQUESTED WorkflowEvent", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const result = await submitConsultationContact(db, issued.id, validContact);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, result.consultationRequestId));
      expect(events).toHaveLength(1);
      expect(events[0]!.fromStatus).toBe("NONE");
      expect(events[0]!.toStatus).toBe("REQUESTED");
      expect(events[0]!.reason).toBe("CONTACT_RECEIVED");
    });

    it("B. an ordinary replay while still REQUESTED never appends a duplicate WorkflowEvent", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const first = await submitConsultationContact(db, issued.id, validContact);
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      await submitConsultationContact(db, issued.id, validContact);

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, first.consultationRequestId));
      expect(events).toHaveLength(1);
    });

    it("C. a request already progressed to PENDING_VERIFICATION never regresses, and a resubmission never fabricates a PENDING_VERIFICATION -> REQUESTED event", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const first = await submitConsultationContact(db, issued.id, validContact);
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      // Simulate the request having already progressed past REQUESTED
      // (e.g. via the real Google handoff) without exercising that
      // flow's own env-dependent capability gate here.
      await db
        .update(consultationRequest)
        .set({ status: "PENDING_VERIFICATION" })
        .where(eq(consultationRequest.id, first.consultationRequestId));

      const second = await submitConsultationContact(db, issued.id, validContact);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.consultationRequestId).toBe(first.consultationRequestId);

      const [request] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, first.consultationRequestId));
      expect(request!.status).toBe("PENDING_VERIFICATION"); // never regressed

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, first.consultationRequestId));
      // Only the original NONE->REQUESTED event -- no fabricated
      // PENDING_VERIFICATION->REQUESTED (or any other) transition.
      expect(events).toHaveLength(1);
      expect(events[0]!.toStatus).toBe("REQUESTED");
      expect(events.some((e) => e.toStatus === "REQUESTED" && e.fromStatus === "PENDING_VERIFICATION")).toBe(false);
    });

    it("D. resubmission against BOOKED/COMPLETED/CANCELLED/NO_SHOW never writes a backwards REQUESTED event either", async () => {
      const db = testDb!;
      for (const farStatus of ["BOOKED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
        await resetTestDatabase();
        const { issued } = await completeDiscovery(db);
        const first = await submitConsultationContact(db, issued.id, validContact);
        expect(first.ok).toBe(true);
        if (!first.ok) continue;

        await db
          .update(consultationRequest)
          .set({ status: farStatus })
          .where(eq(consultationRequest.id, first.consultationRequestId));

        const second = await submitConsultationContact(db, issued.id, validContact);
        expect(second.ok).toBe(true);

        const [request] = await db
          .select()
          .from(consultationRequest)
          .where(eq(consultationRequest.id, first.consultationRequestId));
        expect(request!.status).toBe(farStatus); // never regressed to REQUESTED

        const events = await db
          .select()
          .from(workflowEvent)
          .where(eq(workflowEvent.consultationRequestId, first.consultationRequestId));
        expect(events).toHaveLength(1); // only the original NONE->REQUESTED event
      }
    });
  });

  describe("cross-session security", () => {
    it("guest A's session cannot see or affect guest B's consultation request, even with a completed profile of their own", async () => {
      const db = testDb!;
      const a = await completeDiscovery(db);
      const b = await completeDiscovery(db);

      const aResult = await submitConsultationContact(db, a.issued.id, validContact);
      expect(aResult.ok).toBe(true);
      if (!aResult.ok) return;

      // Guest B's own session-derived lookup never returns guest A's request.
      const bView = await getActiveConsultationRequestForSession(db, b.issued.id);
      expect(bView).toBeNull();

      // Guest B submitting their own contact creates an independent request.
      const bResult = await submitConsultationContact(db, b.issued.id, validContact);
      expect(bResult.ok).toBe(true);
      if (!bResult.ok) return;
      expect(bResult.consultationRequestId).not.toBe(aResult.consultationRequestId);

      const aView = await getActiveConsultationRequestForSession(db, a.issued.id);
      expect(aView!.id).toBe(aResult.consultationRequestId);
    });
  });

  describe("no false booking (hard acceptance)", () => {
    it("contact submission and an unconfigured scheduler handoff attempt never create a Booking, never set BOOKED, never assign an advisor", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const result = await submitConsultationContact(db, issued.id, validContact);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // SCHEDULER_MODE is UNCONFIGURED in this test environment -- the
      // handoff must refuse honestly, never fake progress.
      const handoff = await handOffToGoogleScheduler(db, issued.id);
      expect(handoff.ok).toBe(false);

      const [request] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, result.consultationRequestId));
      expect(request!.status).toBe("REQUESTED"); // never advanced

      expect(await db.select().from(booking)).toHaveLength(0);
      expect(await db.select().from(advisorAssignment)).toHaveLength(0);
    });
  });

  describe("Google scheduler handoff (REQUEST_ONLY, configured)", () => {
    const ORIGINAL_ENV = { ...process.env };

    afterEach(() => {
      process.env = { ...ORIGINAL_ENV };
    });

    it("transitions REQUESTED -> PENDING_VERIFICATION, appends a WorkflowEvent, and returns only the server-configured URL", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const contactResult = await submitConsultationContact(db, issued.id, validContact);
      expect(contactResult.ok).toBe(true);
      if (!contactResult.ok) return;

      process.env = {
        ...ORIGINAL_ENV,
        SCHEDULER_MODE: "REQUEST_ONLY",
        GOOGLE_APPOINTMENT_SCHEDULE_URL: "https://calendar.google.com/appointments/schedules/EXAMPLE",
      };
      vi.resetModules();
      const { handOffToGoogleScheduler: freshHandOff } = await import("@/server/consultation");

      const handoff = await freshHandOff(db, issued.id);
      expect(handoff.ok).toBe(true);
      if (handoff.ok) {
        expect(handoff.scheduleUrl).toBe("https://calendar.google.com/appointments/schedules/EXAMPLE");
      }

      const [request] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, contactResult.consultationRequestId));
      expect(request!.status).toBe("PENDING_VERIFICATION");

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, contactResult.consultationRequestId));
      expect(
        events.some((e) => e.toStatus === "PENDING_VERIFICATION" && e.reason === "GOOGLE_SCHEDULER_HANDOFF"),
      ).toBe(true);

      // Redirecting to Google is still never proof of an actual booking.
      expect(await db.select().from(booking)).toHaveLength(0);
    });

    it("a second handoff call never regresses PENDING_VERIFICATION back down or duplicates the WorkflowEvent", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const contactResult = await submitConsultationContact(db, issued.id, validContact);
      expect(contactResult.ok).toBe(true);
      if (!contactResult.ok) return;

      process.env = {
        ...ORIGINAL_ENV,
        SCHEDULER_MODE: "REQUEST_ONLY",
        GOOGLE_APPOINTMENT_SCHEDULE_URL: "https://calendar.google.com/appointments/schedules/EXAMPLE",
      };
      vi.resetModules();
      const { handOffToGoogleScheduler: freshHandOff } = await import("@/server/consultation");

      await freshHandOff(db, issued.id);
      const second = await freshHandOff(db, issued.id);
      expect(second.ok).toBe(true);

      const events = await db
        .select()
        .from(workflowEvent)
        .where(eq(workflowEvent.consultationRequestId, contactResult.consultationRequestId));
      expect(events.filter((e) => e.reason === "GOOGLE_SCHEDULER_HANDOFF")).toHaveLength(1);
    });
  });

  describe("report-snapshot provenance (Phase 6A.1)", () => {
    it("reuses the already-persisted ReportSnapshot for the revision instead of creating a new one", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);
      const { getLatestPersistedReportSnapshotForRevision, resolveReportOutcomeForConsultation } = await import(
        "@/server/report-outcome"
      );

      const snapshotA = await ensureReportOutcomeForSession(db, issued.id);
      expect(snapshotA).not.toBeNull();

      const resolved = await resolveReportOutcomeForConsultation(db, issued.id);
      expect(resolved!.reportSnapshotId).toBe(snapshotA!.reportSnapshotId);

      const snaps = await db
        .select()
        .from(reportSnapshot)
        .where(eq(reportSnapshot.profileRevisionId, snapshotA!.revisionId));
      expect(snaps).toHaveLength(1); // no second snapshot created

      const lookedUp = await getLatestPersistedReportSnapshotForRevision(db, snapshotA!.revisionId);
      expect(lookedUp!.reportSnapshotId).toBe(snapshotA!.reportSnapshotId);

      const contactResult = await submitConsultationContact(db, issued.id, validContact);
      expect(contactResult.ok).toBe(true);
      if (!contactResult.ok) return;
      const [request] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, contactResult.consultationRequestId));
      expect(request!.reportSnapshotId).toBe(snapshotA!.reportSnapshotId);
    });

    it("falls back to the ensure/persist pipeline when no ReportSnapshot exists yet (direct navigation to consultation)", async () => {
      const db = testDb!;
      const { issued, result } = await completeDiscovery(db);
      expect(result.ok).toBe(true);

      // No call to ensureReportOutcomeForSession/the report route yet --
      // zero EngineRun/ReportSnapshot rows exist for this revision.
      const preSnaps = await db.select().from(reportSnapshot);
      expect(preSnaps).toHaveLength(0);

      const contactResult = await submitConsultationContact(db, issued.id, validContact);
      expect(contactResult.ok).toBe(true);
      if (!contactResult.ok) return;

      const [request] = await db
        .select()
        .from(consultationRequest)
        .where(eq(consultationRequest.id, contactResult.consultationRequestId));
      expect(request!.reportSnapshotId).not.toBeNull();

      const postSnaps = await db.select().from(reportSnapshot);
      expect(postSnaps).toHaveLength(1); // safely created via the fallback pipeline
      expect(postSnaps[0]!.id).toBe(request!.reportSnapshotId);
    });

    it("a consultation-capability change after the report was shown never silently creates/links a second snapshot", async () => {
      const db = testDb!;
      const { issued } = await completeDiscovery(db);

      // Report displayed under this environment's real (UNCONFIGURED)
      // capability -- persists Snapshot A.
      const snapshotA = await ensureReportOutcomeForSession(db, issued.id);
      expect(snapshotA).not.toBeNull();

      const ORIGINAL_ENV = { ...process.env };
      try {
        process.env = {
          ...ORIGINAL_ENV,
          SCHEDULER_MODE: "REQUEST_ONLY",
          GOOGLE_APPOINTMENT_SCHEDULE_URL: "https://calendar.google.com/appointments/schedules/EXAMPLE",
        };
        vi.resetModules();
        const { submitConsultationContact: freshSubmit } = await import("@/server/consultation");

        const contactResult = await freshSubmit(db, issued.id, validContact);
        expect(contactResult.ok).toBe(true);
        if (!contactResult.ok) return;

        const [request] = await db
          .select()
          .from(consultationRequest)
          .where(eq(consultationRequest.id, contactResult.consultationRequestId));
        // Still links to the snapshot the parent actually saw -- the
        // capability change never triggered a silent recompute/relink.
        expect(request!.reportSnapshotId).toBe(snapshotA!.reportSnapshotId);

        const snaps = await db
          .select()
          .from(reportSnapshot)
          .where(eq(reportSnapshot.profileRevisionId, snapshotA!.revisionId));
        expect(snaps).toHaveLength(1); // never a second, differently-configured snapshot
      } finally {
        process.env = { ...ORIGINAL_ENV };
      }
    });
  });
});

describe("CTA operational-safety resolution (pure, no database)", () => {
  const contracts = loadContracts();

  it("UNCONFIGURED keeps the existing safe informational CTA", () => {
    const action = resolvePrimaryAction("UNCONFIGURED", "Some intent label", contracts.reportContent);
    expect(action.label).toBe("See What Comes Next");
    expect(action.href).toBe("/how-it-works");
  });

  it("REQUEST_ONLY resolves to the real Phase 6A conversion path", () => {
    const action = resolvePrimaryAction("REQUEST_ONLY", "Some intent label", contracts.reportContent);
    expect(action.label).toBe("Schedule My Free Pathways Planning Call");
    expect(action.href).toBe("/discover/consultation");
  });

  it("LIVE_VERIFIED never claims the real conversion path either (not implemented in Phase 6A)", () => {
    const action = resolvePrimaryAction("LIVE_VERIFIED", "Some intent label", contracts.reportContent);
    expect(action.href).toBe("/how-it-works");
  });
});
