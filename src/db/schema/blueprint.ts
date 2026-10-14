import { pgTable, text, timestamp, jsonb, boolean, integer, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth";
import { pathwaysCase } from "./case";
import { profileRevision, reportSnapshot } from "./pathway";
import { planningCallRecord } from "./planning-call";

/**
 * Phase 6E -- the Student Success Blueprint's durable parent/revision
 * architecture (docs/pathways PHASE6E_BLUEPRINT_AUTHORING.md). A
 * `StudentSuccessBlueprint` is a thin, stable identity anchor (one per
 * PathwaysCase, enforced below); all actual professional content lives
 * on `BlueprintRevision`, which is immutable once READY_FOR_CLIENT.
 * This mirrors, rather than duplicates, the parent/revision shape
 * already proven by ProfileRevision -- never a single 50+-column flat
 * table.
 */

export const blueprintRevisionStatusEnum = pgEnum("blueprint_revision_status", [
  "DRAFT",
  "INTERNAL_REVIEW",
  "READY_FOR_CLIENT",
  "SUPERSEDED",
  "ARCHIVED",
]);

export const blueprintRevisionReasonEnum = pgEnum("blueprint_revision_reason", [
  "FAMILY_UPDATE",
  "NEW_VERIFICATION",
  "EDUCATIONAL_PLAN_CHANGE",
  "CORRECTION",
  "OTHER",
]);

export const studentSuccessBlueprint = pgTable(
  "student_success_blueprint",
  {
    id: text("id").primaryKey(),
    // Section 6: exactly one Blueprint parent per PathwaysCase, enforced
    // at the database level -- a repeated "create" click can never
    // produce a second parent; the service reselects and reuses the
    // existing one instead.
    pathwaysCaseId: text("pathways_case_id")
      .notNull()
      .references(() => pathwaysCase.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("student_success_blueprint_case_unique_idx").on(table.pathwaysCaseId)],
);

export const blueprintRevision = pgTable(
  "blueprint_revision",
  {
    id: text("id").primaryKey(),
    blueprintId: text("blueprint_id")
      .notNull()
      .references(() => studentSuccessBlueprint.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    status: blueprintRevisionStatusEnum("status").notNull().default("DRAFT"),
    // Section 6: exactly one revision per blueprint is ever "current"
    // (the active working revision shown by default) -- mirrors the
    // `isPrimary` pattern already proven on `planningCallRecord`.
    // Moves to the newly-created revision immediately; the prior
    // revision's STATUS only changes to SUPERSEDED once the new one
    // itself reaches READY_FOR_CLIENT (section 33) -- `isCurrent`
    // moving and `status` becoming SUPERSEDED are deliberately two
    // separate events, never conflated.
    isCurrent: boolean("is_current").notNull().default(true),

    authoringAdvisorUserId: text("authoring_advisor_user_id")
      .notNull()
      .references(() => user.id),
    lastEditedByUserId: text("last_edited_by_user_id").references(() => user.id),

    contentSchemaVersion: text("content_schema_version").notNull(),
    // Strictly Zod-validated on every write (src/lib/blueprint/content-schema.ts)
    // before it ever reaches this column -- never an arbitrary
    // application-generated blob (section 9).
    content: jsonb("content").notNull(),

    // --- Source manifest (section 24) -------------------------------
    // The EXACT professional inputs this revision was authored from.
    // Never repointed after creation -- opening an existing Blueprint
    // never re-runs Discovery, regenerates the report, or silently
    // adopts a newer PlanningCallRecord.
    sourceProfileRevisionId: text("source_profile_revision_id")
      .notNull()
      .references(() => profileRevision.id),
    sourceReportSnapshotId: text("source_report_snapshot_id")
      .notNull()
      .references(() => reportSnapshot.id),
    sourcePlanningCallRecordId: text("source_planning_call_record_id")
      .notNull()
      .references(() => planningCallRecord.id),
    // A snapshot of PlanningCallRecord.version at the moment this
    // revision was created -- lets a reader know whether the planning
    // call has been edited further since, without ever re-deriving
    // this revision's own content from that later state.
    sourcePlanningCallRecordVersion: integer("source_planning_call_record_version").notNull(),

    // Section 19: optimistic concurrency for content edits, identical
    // pattern to planningCallRecord.version.
    version: integer("version").notNull().default(1),

    // Section 34: only ever set when a revision is created AFTER a
    // prior revision reached READY_FOR_CLIENT (i.e. revisionNumber > 1).
    revisionReason: blueprintRevisionReasonEnum("revision_reason"),
    revisionReasonOther: text("revision_reason_other"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    readyForClientAt: timestamp("ready_for_client_at", { withTimezone: true }),
  },
  (table) => [
    index("blueprint_revision_blueprint_idx").on(table.blueprintId),
    uniqueIndex("blueprint_revision_number_unique_idx").on(table.blueprintId, table.revisionNumber),
    uniqueIndex("blueprint_revision_current_per_blueprint_unique_idx")
      .on(table.blueprintId)
      .where(sql`${table.isCurrent} = true`),
  ],
);

export const studentSuccessBlueprintRelations = relations(studentSuccessBlueprint, ({ one, many }) => ({
  pathwaysCase: one(pathwaysCase, {
    fields: [studentSuccessBlueprint.pathwaysCaseId],
    references: [pathwaysCase.id],
  }),
  revisions: many(blueprintRevision),
}));

export const blueprintRevisionRelations = relations(blueprintRevision, ({ one }) => ({
  blueprint: one(studentSuccessBlueprint, {
    fields: [blueprintRevision.blueprintId],
    references: [studentSuccessBlueprint.id],
  }),
  authoringAdvisor: one(user, {
    fields: [blueprintRevision.authoringAdvisorUserId],
    references: [user.id],
  }),
  lastEditedBy: one(user, {
    fields: [blueprintRevision.lastEditedByUserId],
    references: [user.id],
  }),
  sourceProfileRevision: one(profileRevision, {
    fields: [blueprintRevision.sourceProfileRevisionId],
    references: [profileRevision.id],
  }),
  sourceReportSnapshot: one(reportSnapshot, {
    fields: [blueprintRevision.sourceReportSnapshotId],
    references: [reportSnapshot.id],
  }),
  sourcePlanningCallRecord: one(planningCallRecord, {
    fields: [blueprintRevision.sourcePlanningCallRecordId],
    references: [planningCallRecord.id],
  }),
}));
