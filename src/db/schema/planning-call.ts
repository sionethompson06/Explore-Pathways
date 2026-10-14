import { pgTable, text, timestamp, jsonb, boolean, integer, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth";
import { pathwaysCase } from "./case";
import { consultationRequest, booking } from "./consultation";
import { profileRevision, reportSnapshot } from "./pathway";

/**
 * Phase 6D -- the Planning Call Workspace's durable professional
 * record (docs/pathways PHASE6D_PLANNING_CALL_WORKSPACE.md). A
 * PlanningCallRecord is where Pathways moves from algorithmic
 * preliminary exploration (the Discovery Report, referenced here by
 * exact id, never duplicated or recomputed) to professional human
 * investigation. This is NOT the Student Success Blueprint -- it is
 * the structured input a future Blueprint-authoring phase will read.
 *
 * Cardinality (section 5): at most one PRIMARY record per
 * PathwaysCase, enforced by the partial unique index below. A future
 * phase may add non-primary (follow-up conversation) records against
 * the same case -- the `isPrimary` column and the partial index exist
 * so that extension never requires a schema change, but Phase 6D
 * itself only ever creates the one primary record; no UI in this
 * phase creates a second.
 */

export const planningCallRecordStatusEnum = pgEnum("planning_call_record_status", [
  "DRAFT",
  "COMPLETED",
]);

// Section 11: explicit staff action only -- never inferred from the
// passage of a scheduled time. RESCHEDULE_NEEDED has no equivalent in
// the existing consultationStatusEnum, which is exactly why this is a
// small, separate, purpose-built enum rather than a reuse of that one
// (see the module doc comment in src/server/planning-call.ts for the
// full reasoning and the partial reuse that DOES happen).
export const planningCallAttendanceEnum = pgEnum("planning_call_attendance", [
  "ATTENDED",
  "NO_SHOW",
  "CANCELLED",
  "RESCHEDULE_NEEDED",
]);

// Section 12: the advisor's explicit operational decision. ONLY
// CONTINUE_TO_BLUEPRINT may ever be interpreted as "ready for the next
// professional step" -- and even that is purely operational routing,
// never an academic-eligibility, acceptance, payment, or placement
// claim (section 14).
export const planningCallOutcomeEnum = pgEnum("planning_call_outcome", [
  "CONTINUE_TO_BLUEPRINT",
  "NEEDS_INFORMATION",
  "FOLLOW_UP",
  "NOT_CURRENT_SERVICE_FIT",
  "FAMILY_NOT_PROCEEDING",
]);

// Section 9's "service_fit" structured field -- the advisor's own
// professional judgment captured during Section I (Advisor
// Assessment), distinct from the formal `outcome` decision above
// (service_fit informs the outcome; it is not itself the operational
// routing decision).
export const planningCallServiceFitEnum = pgEnum("planning_call_service_fit", [
  "GOOD_FIT",
  "POSSIBLE_FIT",
  "NOT_CURRENT_FIT",
  "UNDETERMINED",
]);

export const planningCallRecord = pgTable(
  "planning_call_record",
  {
    id: text("id").primaryKey(),
    pathwaysCaseId: text("pathways_case_id")
      .notNull()
      .references(() => pathwaysCase.id, { onDelete: "cascade" }),
    // Denormalized convenience references, matching the existing
    // advisorAssignment/pathwaysCase pattern -- never duplicated
    // content, only ids.
    consultationRequestId: text("consultation_request_id")
      .notNull()
      .references(() => consultationRequest.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").references(() => booking.id, { onDelete: "set null" }),
    // The EXACT ProfileRevision/ReportSnapshot in view at creation time
    // (section 22) -- NOT NULL, never repointed. If the family later
    // edits Discovery answers, that creates a new revision/snapshot
    // under the existing architecture; this record's references are
    // never silently updated to follow it.
    profileRevisionId: text("profile_revision_id")
      .notNull()
      .references(() => profileRevision.id),
    reportSnapshotId: text("report_snapshot_id")
      .notNull()
      .references(() => reportSnapshot.id),

    isPrimary: boolean("is_primary").notNull().default(true),
    status: planningCallRecordStatusEnum("status").notNull().default("DRAFT"),

    createdByAdvisorUserId: text("created_by_advisor_user_id")
      .notNull()
      .references(() => user.id),
    // Section 17: tracks who last saved this record. Phase 6D does not
    // permit ADMIN writes (see the domain service), so in practice
    // this is always the currently (or formerly, pre-reassignment)
    // assigned advisor -- never silently attributed to someone else.
    lastEditedByUserId: text("last_edited_by_user_id").references(() => user.id),

    // --- Structured sections A-J (section 8) -----------------------
    // Discrete, labeled fields rather than one blank notes field, per
    // section 9's explicit instruction. Each is rendered in the UI
    // under its own provenance-labeled heading (see
    // src/components/staff/PlanningCallForm.tsx).
    familyMainGoal: text("family_main_goal"), // A
    currentEducationalSituation: text("current_educational_situation"), // B
    studentStrengths: text("student_strengths"), // C
    learningNeedsSupport: text("learning_needs_support"), // D
    scheduleLifestyleRequirements: text("schedule_lifestyle_requirements"), // E
    academicPlanningNotes: text("academic_planning_notes"), // F
    // G: references the EXISTING taxonomy base_model ids
    // (contracts/taxonomy.json, read-only via loadTaxonomy()) -- never
    // a free-form replacement model. string[] of base_model ids.
    pathwaysDiscussed: jsonb("pathways_discussed").notNull().default([]),
    advisorAssessment: text("advisor_assessment"), // I -- advisor-authored, labeled as such
    recommendedNextAction: text("recommended_next_action"), // J narrative

    // --- Structured controlled fields (section 9) ------------------
    primaryGoalConfirmed: boolean("primary_goal_confirmed"),
    currentModelConfirmed: boolean("current_model_confirmed"),
    // H / "Open Questions" (section 21): items still needing follow-up
    // or clarification -- NOT the same list as verificationNeeded
    // below (this is forward-looking "what to ask next"; that is
    // "what the advisor has not yet confirmed").
    priorityQuestions: jsonb("priority_questions").notNull().default([]),
    // Section 6 provenance category "Needs verification".
    verificationNeeded: jsonb("verification_needed").notNull().default([]),
    // Section 6 provenance category "Verified information" -- facts
    // the advisor has actually confirmed from an appropriate source.
    // Kept as its own list, never blended into verificationNeeded.
    verifiedFacts: jsonb("verified_facts").notNull().default([]),
    serviceFit: planningCallServiceFitEnum("service_fit"),
    followUpRequired: boolean("follow_up_required"),

    // --- Attendance / outcome (sections 11-12) ---------------------
    attendance: planningCallAttendanceEnum("attendance"),
    attendanceRecordedAt: timestamp("attendance_recorded_at", { withTimezone: true }),
    outcome: planningCallOutcomeEnum("outcome"),
    outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),

    // Section 19: optimistic concurrency. Every save must supply the
    // version it loaded; a mismatch means someone else saved more
    // recently, and the write is rejected rather than silently
    // overwriting their changes.
    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("planning_call_record_case_idx").on(table.pathwaysCaseId),
    index("planning_call_record_consultation_request_idx").on(table.consultationRequestId),
    // Section 5's cardinality rule, enforced at the database level: at
    // most one PRIMARY record per case. A historical/non-primary
    // record (a future follow-up conversation) never counts against
    // this.
    uniqueIndex("planning_call_record_primary_per_case_unique_idx")
      .on(table.pathwaysCaseId)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const planningCallRecordRelations = relations(planningCallRecord, ({ one }) => ({
  pathwaysCase: one(pathwaysCase, {
    fields: [planningCallRecord.pathwaysCaseId],
    references: [pathwaysCase.id],
  }),
  consultationRequest: one(consultationRequest, {
    fields: [planningCallRecord.consultationRequestId],
    references: [consultationRequest.id],
  }),
  booking: one(booking, {
    fields: [planningCallRecord.bookingId],
    references: [booking.id],
  }),
  profileRevision: one(profileRevision, {
    fields: [planningCallRecord.profileRevisionId],
    references: [profileRevision.id],
  }),
  reportSnapshot: one(reportSnapshot, {
    fields: [planningCallRecord.reportSnapshotId],
    references: [reportSnapshot.id],
  }),
  createdByAdvisor: one(user, {
    fields: [planningCallRecord.createdByAdvisorUserId],
    references: [user.id],
  }),
  lastEditedBy: one(user, {
    fields: [planningCallRecord.lastEditedByUserId],
    references: [user.id],
  }),
}));
