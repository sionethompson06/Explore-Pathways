import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { studentPathwayRecord } from "./pathway";

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
  ],
);

// ---------------------------------------------------------------------------
// Booking -- distinct from the request; a request is never conflated
// with a confirmed appointment (Specification 05/07).
// ---------------------------------------------------------------------------

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    // Opaque reference into whatever scheduler provider is eventually
    // configured (Phase 6); never populated in Phase 1.
    providerReference: text("provider_reference"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    timeZone: text("time_zone"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rescheduledFromBookingId: text("rescheduled_from_booking_id"),
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
    advisorUserId: text("advisor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
  },
  (table) => [
    index("advisor_assignment_consultation_request_idx").on(
      table.consultationRequestId,
    ),
    index("advisor_assignment_advisor_idx").on(table.advisorUserId),
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
    bookings: many(booking),
    advisorAssignments: many(advisorAssignment),
    advisorNotes: many(advisorNote),
    workflowEvents: many(workflowEvent),
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
    advisor: one(user, {
      fields: [advisorAssignment.advisorUserId],
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
