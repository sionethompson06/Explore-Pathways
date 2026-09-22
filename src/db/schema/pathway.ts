import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

/**
 * Guest/profile/engine/report core, per
 * docs/pathways/pack/specifications/07_ARCHITECTURE.md "Data objects"
 * and "Ownership and privacy". Implements only what Phase 1
 * authorizes: guest session, profile revisions, engine runs, report
 * snapshots, guardian access. No course, grade, transcript, or
 * provider-enrollment table exists here or anywhere in this schema.
 */

// ---------------------------------------------------------------------------
// StudentPathwayRecord
// ---------------------------------------------------------------------------

export const studentPathwayRecord = pgTable("student_pathway_record", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Retention/deletion marker (Spec 06 item 15: report storage is
  // subordinate to an approved retention/deletion policy). A non-null
  // value means the record is logically deleted; actual retention
  // periods and a real cleanup job are a launch decision (DEC-D4),
  // not implemented in Phase 1.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// GuardianStudentAccess -- explicit per-child links only, never a
// broad "same email/family" shortcut.
// ---------------------------------------------------------------------------

export const guardianStudentAccess = pgTable(
  "guardian_student_access",
  {
    id: text("id").primaryKey(),
    guardianUserId: text("guardian_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    studentPathwayRecordId: text("student_pathway_record_id")
      .notNull()
      .references(() => studentPathwayRecord.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // A non-null value revokes this specific link without deleting
    // its history -- an audit-preserving revoke, not a hard delete.
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("guardian_student_access_unique_idx").on(
      table.guardianUserId,
      table.studentPathwayRecordId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// DiscoverySession -- the guest session behind the HttpOnly cookie.
// ---------------------------------------------------------------------------

export const discoverySession = pgTable(
  "discovery_session",
  {
    id: text("id").primaryKey(),
    // The raw session token lives only in the HttpOnly cookie sent to
    // the browser; only a salted hash of it is ever persisted, so a
    // database read alone can never be replayed as a valid session
    // (OWASP API1:2023: an identifier alone must not grant
    // authorization). See src/server/session.ts (Phase 1, task 9).
    tokenHash: text("token_hash").notNull(),
    studentPathwayRecordId: text("student_pathway_record_id").references(
      () => studentPathwayRecord.id,
      { onDelete: "set null" },
    ),
    // Set once this guest session is claimed by a verified guardian
    // (Phase 6 flow). Null means it is still an anonymous guest
    // session; its presence is what "GUEST" vs "VERIFIED_SAVED"
    // record persistence state (report-contract.json) is derived
    // from -- never inferred from whether an email string was merely
    // typed somewhere.
    claimedByGuardianUserId: text("claimed_by_guardian_user_id").references(
      () => user.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("discovery_session_token_hash_unique_idx").on(
      table.tokenHash,
    ),
  ],
);

// ---------------------------------------------------------------------------
// ProfileRevision -- raw vs. effective answers kept separate
// (Specification 02 "State and validation").
// ---------------------------------------------------------------------------

export const profileRevision = pgTable(
  "profile_revision",
  {
    id: text("id").primaryKey(),
    studentPathwayRecordId: text("student_pathway_record_id")
      .notNull()
      .references(() => studentPathwayRecord.id, { onDelete: "cascade" }),
    discoverySessionId: text("discovery_session_id").references(
      () => discoverySession.id,
      { onDelete: "set null" },
    ),
    revisionNumber: integer("revision_number").notNull(),
    // As actually submitted by the parent, including answers to
    // questions later hidden by a branch change. Never read by the
    // engine directly -- see effectiveAnswers.
    rawAnswers: jsonb("raw_answers").notNull(),
    // Recomputed server-side on every submit per the active branch
    // rules: excludes any answer whose question is no longer shown.
    // This is what the engine, AI, report, and exports actually read.
    effectiveAnswers: jsonb("effective_answers").notNull(),
    gradeBand: text("grade_band"),
    questionBankVersion: text("question_bank_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("profile_revision_record_revision_unique_idx").on(
      table.studentPathwayRecordId,
      table.revisionNumber,
    ),
    index("profile_revision_record_idx").on(table.studentPathwayRecordId),
  ],
);

// ---------------------------------------------------------------------------
// EngineRun -- server-only internal record. Never exposed via a
// public DTO (report-contract.json forbidden_in_public).
// ---------------------------------------------------------------------------

export const engineRun = pgTable(
  "engine_run",
  {
    id: text("id").primaryKey(),
    profileRevisionId: text("profile_revision_id")
      .notNull()
      .references(() => profileRevision.id, { onDelete: "cascade" }),
    effectiveProfileHash: text("effective_profile_hash").notNull(),
    triggeredRuleIds: jsonb("triggered_rule_ids").notNull(),
    positiveGroupsByModel: jsonb("positive_groups_by_model").notNull(),
    scopedReviewSignals: jsonb("scoped_review_signals").notNull(),
    contributions: jsonb("contributions").notNull(),
    internalSortScoreByModel: jsonb("internal_sort_score_by_model").notNull(),
    excludedCandidates: jsonb("excluded_candidates").notNull(),
    displayGateReasons: jsonb("display_gate_reasons").notNull(),
    rulesVersion: text("rules_version").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    scoringPolicyVersion: text("scoring_policy_version").notNull(),
    contentVersion: text("content_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("engine_run_profile_revision_idx").on(table.profileRevisionId)],
);

// ---------------------------------------------------------------------------
// ReportSnapshot -- the public DTO, versioned and immutable-by-edit.
// ---------------------------------------------------------------------------

export const reportContentStatusEnum = pgEnum("report_content_status", [
  "PERSONALIZED",
  "LIMITED_INFORMATION",
  "ADVISOR_FIRST",
]);

export const reportGenerationStateEnum = pgEnum("report_generation_state", [
  "TEMPLATE",
  "AI_ASSISTED",
  "FALLBACK",
  "FAILED",
]);

export const reportSnapshot = pgTable(
  "report_snapshot",
  {
    id: text("id").primaryKey(),
    engineRunId: text("engine_run_id")
      .notNull()
      .references(() => engineRun.id, { onDelete: "cascade" }),
    profileRevisionId: text("profile_revision_id")
      .notNull()
      .references(() => profileRevision.id, { onDelete: "cascade" }),
    contentStatus: reportContentStatusEnum("content_status").notNull(),
    generationState: reportGenerationStateEnum("generation_state").notNull(),
    // The exact public DTO shape from report-contract.json's
    // public_dto -- R01-R07 -- and nothing else. No internal score,
    // staff note, or raw answer belongs in this column; that is
    // enforced by what the report assembler (Phase 5, not built yet)
    // is allowed to write here, not by this table definition alone.
    publicContent: jsonb("public_content").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("report_snapshot_profile_revision_idx").on(
      table.profileRevisionId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const studentPathwayRecordRelations = relations(
  studentPathwayRecord,
  ({ many }) => ({
    guardianAccess: many(guardianStudentAccess),
    profileRevisions: many(profileRevision),
  }),
);

export const guardianStudentAccessRelations = relations(
  guardianStudentAccess,
  ({ one }) => ({
    guardian: one(user, {
      fields: [guardianStudentAccess.guardianUserId],
      references: [user.id],
    }),
    studentPathwayRecord: one(studentPathwayRecord, {
      fields: [guardianStudentAccess.studentPathwayRecordId],
      references: [studentPathwayRecord.id],
    }),
  }),
);

export const discoverySessionRelations = relations(
  discoverySession,
  ({ one }) => ({
    studentPathwayRecord: one(studentPathwayRecord, {
      fields: [discoverySession.studentPathwayRecordId],
      references: [studentPathwayRecord.id],
    }),
    claimedByGuardian: one(user, {
      fields: [discoverySession.claimedByGuardianUserId],
      references: [user.id],
    }),
  }),
);

export const profileRevisionRelations = relations(
  profileRevision,
  ({ one, many }) => ({
    studentPathwayRecord: one(studentPathwayRecord, {
      fields: [profileRevision.studentPathwayRecordId],
      references: [studentPathwayRecord.id],
    }),
    discoverySession: one(discoverySession, {
      fields: [profileRevision.discoverySessionId],
      references: [discoverySession.id],
    }),
    engineRuns: many(engineRun),
  }),
);

export const engineRunRelations = relations(engineRun, ({ one, many }) => ({
  profileRevision: one(profileRevision, {
    fields: [engineRun.profileRevisionId],
    references: [profileRevision.id],
  }),
  reportSnapshots: many(reportSnapshot),
}));

export const reportSnapshotRelations = relations(reportSnapshot, ({ one }) => ({
  engineRun: one(engineRun, {
    fields: [reportSnapshot.engineRunId],
    references: [engineRun.id],
  }),
  profileRevision: one(profileRevision, {
    fields: [reportSnapshot.profileRevisionId],
    references: [profileRevision.id],
  }),
}));
