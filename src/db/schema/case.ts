import { pgTable, text, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { studentPathwayRecord, profileRevision, reportSnapshot } from "./pathway";
import { consultationRequest, booking } from "./consultation";

/**
 * Phase 6B -- the operational case foundation (docs/pathways
 * PHASE6B_CASE_FOUNDATION.md). A PathwaysCase is the central record for
 * future advising: it exists once a family has meaningfully entered the
 * consultation/service workflow, and it preserves exactly which
 * Discovery profile revision and report snapshot the parent saw at that
 * moment -- never a recomputed or re-derived substitute. It references
 * canonical records (StudentPathwayRecord, ProfileRevision,
 * ReportSnapshot, ConsultationRequest, Booking) rather than duplicating
 * their content.
 *
 * Case status is a distinct operational lifecycle from
 * ConsultationRequest.status (see consultation.ts's
 * consultationStatusEnum) and from Booking's own scheduledAt/
 * cancelledAt fields -- never confused or auto-derived from either.
 * In particular, COMPLETED is never set automatically because a
 * scheduled time has passed; it requires an explicit future advisor
 * action (not built in Phase 6B). See pathwaysCaseStatusEnum's allowed
 * transitions in src/server/pathways-case.ts.
 */

export const pathwaysCaseStatusEnum = pgEnum("pathways_case_status", [
  "NEW",
  "CONTACT_RECEIVED",
  "BOOKED",
  "COMPLETED",
  "NEEDS_INFORMATION",
  "FOLLOW_UP",
  "NOT_CURRENT_SERVICE_FIT",
  "CLOSED",
]);

export const pathwaysCase = pgTable(
  "pathways_case",
  {
    id: text("id").primaryKey(),
    studentPathwayRecordId: text("student_pathway_record_id")
      .notNull()
      .references(() => studentPathwayRecord.id, { onDelete: "cascade" }),
    // Exactly one case per ConsultationRequest (see the unique index
    // below) -- the case's own identity is anchored to the specific
    // consultation workflow instance it was created for.
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    // The EXACT ProfileRevision/ReportSnapshot the parent saw when this
    // case was created (section 7) -- intentionally NOT NULL and never
    // repointed to a later revision/snapshot after creation. No
    // onDelete behavior is specified (Postgres default NO ACTION): a
    // ProfileRevision or ReportSnapshot a case still references can
    // never be deleted out from under it.
    profileRevisionId: text("profile_revision_id")
      .notNull()
      .references(() => profileRevision.id),
    reportSnapshotId: text("report_snapshot_id")
      .notNull()
      .references(() => reportSnapshot.id),
    // Set once an internal Booking exists for this case's
    // ConsultationRequest (src/server/pathways-case.ts's
    // linkBookingToCase). Null until then; never required at creation.
    bookingId: text("booking_id").references(() => booking.id, { onDelete: "set null" }),
    status: pathwaysCaseStatusEnum("status").notNull().default("NEW"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Section 8 idempotency boundary: at most one case per
    // ConsultationRequest, enforced at the database level -- a
    // concurrent or retried case-creation attempt is rejected (23505)
    // rather than racing to insert a duplicate.
    uniqueIndex("pathways_case_consultation_request_unique_idx").on(
      table.consultationRequestId,
    ),
    index("pathways_case_student_idx").on(table.studentPathwayRecordId),
    index("pathways_case_booking_idx").on(table.bookingId),
  ],
);

// ---------------------------------------------------------------------------
// AdvisorAssignment lives in consultation.ts (Phase 1) but is extended
// there with a nullable pathwaysCaseId -- see consultation.ts for the
// column and its relation back to this table.
// ---------------------------------------------------------------------------

export const pathwaysCaseRelations = relations(pathwaysCase, ({ one }) => ({
  studentPathwayRecord: one(studentPathwayRecord, {
    fields: [pathwaysCase.studentPathwayRecordId],
    references: [studentPathwayRecord.id],
  }),
  consultationRequest: one(consultationRequest, {
    fields: [pathwaysCase.consultationRequestId],
    references: [consultationRequest.id],
  }),
  profileRevision: one(profileRevision, {
    fields: [pathwaysCase.profileRevisionId],
    references: [profileRevision.id],
  }),
  reportSnapshot: one(reportSnapshot, {
    fields: [pathwaysCase.reportSnapshotId],
    references: [reportSnapshot.id],
  }),
  booking: one(booking, {
    fields: [pathwaysCase.bookingId],
    references: [booking.id],
  }),
}));
