import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth";
import {
  studentPathwayRecord,
  profileRevision,
  reportSnapshot,
} from "./pathway";
import { pathwaysCase } from "./case";

/**
 * Consent, consultation workflow, advisor assignment/notes. Phase 1
 * establishes the shape only; the actual save/consultation flows are
 * Phase 6/7, not built here. No payment, enrollment, or document
 * table exists -- out of scope per the master prompt's "Not yet"
 * list.
 */

// ---------------------------------------------------------------------------
// ConsentEvent -- delivery request, marketing opt-in, and SMS consent
// are separate, versioned, never defaulted to granted.
// ---------------------------------------------------------------------------

export const consentPurposeEnum = pgEnum("consent_purpose", [
  "EMAIL_DELIVERY",
  "EMAIL_MARKETING",
  "SMS",
]);

export const consentActionEnum = pgEnum("consent_action", [
  "GRANTED",
  "REVOKED",
]);

export const consentEvent = pgTable(
  "consent_event",
  {
    id: text("id").primaryKey(),
    guardianUserId: text("guardian_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    purpose: consentPurposeEnum("purpose").notNull(),
    action: consentActionEnum("action").notNull(),
    // Version of the consent copy/terms the guardian actually saw,
    // so a later wording change never silently reinterprets an old
    // consent record.
    version: text("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("consent_event_guardian_idx").on(table.guardianUserId)],
);

// ---------------------------------------------------------------------------
// ConsultationRequest -- request status distinct from Booking, per
// Specification 07. Timeline is lead-context only, never read by the
// recommendation engine (Specification 04 "Independent lead
// workflow").
// ---------------------------------------------------------------------------

export const consultationStatusEnum = pgEnum("consultation_status", [
  "NONE",
  "REQUESTED",
  "PENDING_VERIFICATION",
  "BOOKED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
]);

export const consultationTimelineEnum = pgEnum("consultation_timeline", [
  "READY_NOW",
  "PLANNING",
  "EXPLORING",
  "UNKNOWN",
]);

export const consultationRequest = pgTable(
  "consultation_request",
  {
    id: text("id").primaryKey(),
    studentPathwayRecordId: text("student_pathway_record_id")
      .notNull()
      .references(() => studentPathwayRecord.id, { onDelete: "cascade" }),
    guardianUserId: text("guardian_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Phase 6A: the exact Discovery profile revision and report
    // snapshot this consultation converted from (sections 25/45).
    // Nullable and backward-compatible -- pre-Phase-6A rows never had a
    // originating revision recorded and stay exactly as they are; every
    // new Phase 6A conversion populates both. This pair is also the
    // idempotency boundary for "one active request per conversion
    // source" (section 26): a profileRevisionId is already globally
    // unique per revision, and a Postgres unique index permits multiple
    // NULLs, so old rows are unaffected while a double-submit against
    // the same revision is rejected at the database level.
    profileRevisionId: text("profile_revision_id").references(
      () => profileRevision.id,
      { onDelete: "set null" },
    ),
    reportSnapshotId: text("report_snapshot_id").references(
      () => reportSnapshot.id,
      { onDelete: "set null" },
    ),
    status: consultationStatusEnum("status").notNull().default("NONE"),
    timeline: consultationTimelineEnum("timeline").notNull().default("UNKNOWN"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("consultation_request_student_idx").on(
      table.studentPathwayRecordId,
    ),
    index("consultation_request_profile_revision_idx").on(
      table.profileRevisionId,
    ),
    index("consultation_request_report_snapshot_idx").on(
      table.reportSnapshotId,
    ),
    uniqueIndex("consultation_request_profile_revision_unique_idx").on(
      table.profileRevisionId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// ConsultationContact -- Phase 6A pre-auth parent/guardian contact
// capture. Deliberately NOT named GuardianUser and NOT a Better Auth
// table: no account, session, or verification record is created here
// (section 22/23). One row per ConsultationRequest.
// ---------------------------------------------------------------------------

export const consultationCallFormatEnum = pgEnum("consultation_call_format", [
  "VIDEO",
  "PHONE",
]);

export const consultationContact = pgTable(
  "consultation_contact",
  {
    id: text("id").primaryKey(),
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    guardianName: text("guardian_name").notNull(),
    email: text("email").notNull(),
    mobilePhone: text("mobile_phone").notNull(),
    preferredCallFormat: consultationCallFormatEnum("preferred_call_format")
      .notNull()
      .default("VIDEO"),
    // Explicit contact-consent version/timestamp (section 21) --
    // deliberately separate from consentEvent, which requires an
    // authenticated guardianUserId this pre-auth flow never has.
    contactConsentVersion: text("contact_consent_version").notNull(),
    contactConsentGrantedAt: timestamp("contact_consent_granted_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("consultation_contact_request_unique_idx").on(
      table.consultationRequestId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Booking -- distinct from the request; a request is never conflated
// with a confirmed appointment (Specification 05/07). Phase 6A.2 adds
// the smallest useful fields to support native Pathways-internal
// scheduling (source/resourceKey/durationMinutes/bookerTimeZone)
// without creating a parallel Appointment table.
// ---------------------------------------------------------------------------

export const bookingSourceEnum = pgEnum("booking_source", ["INTERNAL", "EXTERNAL"]);

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    // Opaque reference into whatever EXTERNAL scheduler provider was
    // used (Phase 6 legacy Google handoff); always null for an
    // INTERNAL booking, since Pathways itself is the source of truth.
    providerReference: text("provider_reference"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    timeZone: text("time_zone"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rescheduledFromBookingId: text("rescheduled_from_booking_id"),
    // Phase 6A.2: which scheduling path created this row. Defaults to
    // EXTERNAL (the pre-6A.2 legacy assumption) since no code path in
    // this codebase has ever actually inserted a Booking row yet --
    // this default only matters for a hypothetical future insert that
    // omits it, never read as evidence one was assumed before this column existed.
    source: bookingSourceEnum("source").notNull().default("EXTERNAL"),
    // The scheduling resource this booking occupies -- see
    // PLANNING_RESOURCE_KEY ("PATHWAYS_PLANNING") in
    // src/lib/consultation/scheduling-policy.ts. A plain string key
    // (not a foreign key to a "resources" table) so a future phase can
    // introduce advisor-specific or specialized resources without
    // changing this column's shape -- see section 43.
    resourceKey: text("resource_key"),
    durationMinutes: integer("duration_minutes"),
    // The parent/browser timezone captured for display purposes only
    // (section 19-20) -- never used to determine business-hour
    // validity, which is always computed in PLANNING_TIME_ZONE.
    bookerTimeZone: text("booker_time_zone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("booking_consultation_request_idx").on(
      table.consultationRequestId,
    ),
    // Section 13: a ConsultationRequest may have only one ACTIVE
    // booking at a time -- a cancelled/rescheduled historical row
    // (cancelledAt set) never counts against this, and stays possible
    // to keep for history (never made impossible by this index).
    uniqueIndex("booking_active_per_request_unique_idx")
      .on(table.consultationRequestId)
      .where(sql`${table.cancelledAt} IS NULL`),
    // Section 14 (mandatory): the same scheduling resource may have
    // only one ACTIVE booking at a given start time -- enforced at the
    // database level, not merely by a SELECT-then-INSERT check in
    // application code, which two concurrent requests could both pass.
    uniqueIndex("booking_resource_slot_unique_idx")
      .on(table.resourceKey, table.scheduledAt)
      .where(
        sql`${table.resourceKey} IS NOT NULL AND ${table.scheduledAt} IS NOT NULL AND ${table.cancelledAt} IS NULL`,
      ),
  ],
);

// ---------------------------------------------------------------------------
// AdvisorAssignment / AdvisorNote -- staff-only content, excluded
// from every public DTO.
// ---------------------------------------------------------------------------

export const advisorAssignment = pgTable(
  "advisor_assignment",
  {
    id: text("id").primaryKey(),
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    // Phase 6B: additive, nullable -- the future PathwaysCase an
    // assignment is actually scoped to (sections 10/14). Nullable
    // because no code path has ever written an advisorAssignment row
    // yet (no advisor-assignment UI exists before Phase 6C); kept
    // alongside consultationRequestId rather than replacing it so
    // either lookup direction stays possible without a breaking
    // rename/removal.
    pathwaysCaseId: text("pathways_case_id").references(() => pathwaysCase.id, {
      onDelete: "cascade",
    }),
    advisorUserId: text("advisor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Phase 6B: who performed the assignment (an admin, or a future
    // auto-assignment rule attributed to a system actor) -- distinct
    // from advisorUserId, the person assigned. Nullable: a first
    // assignment made by a not-yet-modeled process must never block on
    // this.
    assignedByUserId: text("assigned_by_user_id").references(() => user.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
  },
  (table) => [
    index("advisor_assignment_consultation_request_idx").on(
      table.consultationRequestId,
    ),
    index("advisor_assignment_pathways_case_idx").on(table.pathwaysCaseId),
    index("advisor_assignment_advisor_idx").on(table.advisorUserId),
    // Phase 6C (section 13): at most one ACTIVE advisor assignment per
    // PathwaysCase, enforced at the database level -- a concurrent
    // assignment/reassignment race can never create two active owners.
    // A historical (unassignedAt set) row never counts against this,
    // so reassignment history is never blocked. The application-level
    // defense (src/server/advisor-assignment.ts locks the PathwaysCase
    // row for the duration of the transaction) is the primary
    // mechanism; this index is the unconditional backstop.
    uniqueIndex("advisor_assignment_active_per_case_unique_idx")
      .on(table.pathwaysCaseId)
      .where(sql`${table.unassignedAt} IS NULL AND ${table.pathwaysCaseId} IS NOT NULL`),
  ],
);

export const advisorNote = pgTable(
  "advisor_note",
  {
    id: text("id").primaryKey(),
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    advisorUserId: text("advisor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("advisor_note_consultation_request_idx").on(
      table.consultationRequestId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// WorkflowEvent -- an attributed audit trail of status transitions,
// never a silent overwrite.
// ---------------------------------------------------------------------------

export const workflowEvent = pgTable(
  "workflow_event",
  {
    id: text("id").primaryKey(),
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    actorUserId: text("actor_user_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workflow_event_consultation_request_idx").on(
      table.consultationRequestId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const consultationRequestRelations = relations(
  consultationRequest,
  ({ one, many }) => ({
    studentPathwayRecord: one(studentPathwayRecord, {
      fields: [consultationRequest.studentPathwayRecordId],
      references: [studentPathwayRecord.id],
    }),
    guardian: one(user, {
      fields: [consultationRequest.guardianUserId],
      references: [user.id],
    }),
    profileRevision: one(profileRevision, {
      fields: [consultationRequest.profileRevisionId],
      references: [profileRevision.id],
    }),
    reportSnapshot: one(reportSnapshot, {
      fields: [consultationRequest.reportSnapshotId],
      references: [reportSnapshot.id],
    }),
    contact: one(consultationContact, {
      fields: [consultationRequest.id],
      references: [consultationContact.consultationRequestId],
    }),
    bookings: many(booking),
    advisorAssignments: many(advisorAssignment),
    advisorNotes: many(advisorNote),
    workflowEvents: many(workflowEvent),
  }),
);

export const consultationContactRelations = relations(
  consultationContact,
  ({ one }) => ({
    consultationRequest: one(consultationRequest, {
      fields: [consultationContact.consultationRequestId],
      references: [consultationRequest.id],
    }),
  }),
);

export const bookingRelations = relations(booking, ({ one }) => ({
  consultationRequest: one(consultationRequest, {
    fields: [booking.consultationRequestId],
    references: [consultationRequest.id],
  }),
}));

export const advisorAssignmentRelations = relations(
  advisorAssignment,
  ({ one }) => ({
    consultationRequest: one(consultationRequest, {
      fields: [advisorAssignment.consultationRequestId],
      references: [consultationRequest.id],
    }),
    pathwaysCase: one(pathwaysCase, {
      fields: [advisorAssignment.pathwaysCaseId],
      references: [pathwaysCase.id],
    }),
    advisor: one(user, {
      fields: [advisorAssignment.advisorUserId],
      references: [user.id],
    }),
    assignedBy: one(user, {
      fields: [advisorAssignment.assignedByUserId],
      references: [user.id],
    }),
  }),
);

export const advisorNoteRelations = relations(advisorNote, ({ one }) => ({
  consultationRequest: one(consultationRequest, {
    fields: [advisorNote.consultationRequestId],
    references: [consultationRequest.id],
  }),
  advisor: one(user, {
    fields: [advisorNote.advisorUserId],
    references: [user.id],
  }),
}));

export const workflowEventRelations = relations(workflowEvent, ({ one }) => ({
  consultationRequest: one(consultationRequest, {
    fields: [workflowEvent.consultationRequestId],
    references: [consultationRequest.id],
  }),
  actor: one(user, {
    fields: [workflowEvent.actorUserId],
    references: [user.id],
  }),
}));
