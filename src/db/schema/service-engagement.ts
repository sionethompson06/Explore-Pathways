import { pgTable, text, timestamp, integer, boolean, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { pathwaysCase } from "./case";
import { blueprintRevision } from "./blueprint";

/**
 * Phase 6F -- the commercial handoff after a Student Success Blueprint
 * reaches READY_FOR_CLIENT (docs/pathways PHASE6F_SERVICE_ENGAGEMENT.md).
 * A `ServiceEngagement` is a single, mutable record per PathwaysCase
 * (enforced by the unique index below) capturing what the family
 * decided, what consulting arrangement and payment terms were agreed
 * to, and whether the case has moved into ACTIVE CONSULTANCY. Per
 * section 25 of the phase instruction, this is deliberately ONE
 * current record plus audit-event history, never a revisioned
 * contract-versioning architecture -- there is exactly one engagement
 * per case, ever, by construction.
 *
 * This is NOT the Blueprint and never modifies it: `sourceBlueprintRevisionId`
 * is a read-only reference captured at creation time (never repointed),
 * mirroring the established "exact source manifest" convention
 * (blueprintRevision's own sourcePlanningCallRecordId, etc.) -- never a
 * duplication of Blueprint content, never evidence used in educational
 * scoring.
 */

export const familyDecisionEnum = pgEnum("family_decision", [
  "CONTINUE_WITH_PATHWAYS",
  "BLUEPRINT_ONLY",
  "FOLLOW_UP_NEEDED",
  "NOT_PROCEEDING",
]);

export const serviceArrangementEnum = pgEnum("service_arrangement", [
  "ONGOING_PATHWAYS_CONSULTING",
  "CUSTOM_ENGAGEMENT",
]);

export const paymentStructureEnum = pgEnum("payment_structure", [
  "ONE_TIME",
  "MONTHLY",
  "INSTALLMENTS",
  "CUSTOM",
  "WAIVED",
  "PENDING",
]);

// Section 9: operational statuses only -- never a claim that Explore
// Pathways processed a payment. Derived deterministically from
// (paymentStructure, paymentHandledExternally) by the domain service,
// never client-settable directly.
export const paymentStatusEnum = pgEnum("payment_status", [
  "NOT_REQUIRED",
  "TERMS_PENDING",
  "TERMS_CONFIRMED",
  "PAYMENT_HANDLED_EXTERNALLY",
]);

// Section 13: a small, separate lifecycle from Blueprint status.
// PENDING_DECISION (no final family decision yet, or decision recorded
// but no engagement pursued) -> TERMS_PENDING (continuing, but payment
// structure not yet finalized) -> CONFIRMED (terms confirmed by staff)
// -> ACTIVE (activation conditions met, section 12). DECLINED and
// CLOSED are the two terminal outcomes for BLUEPRINT_ONLY/
// NOT_PROCEEDING -- never a sales pipeline beyond this.
export const serviceEngagementStatusEnum = pgEnum("service_engagement_status", [
  "PENDING_DECISION",
  "TERMS_PENDING",
  "CONFIRMED",
  "ACTIVE",
  "DECLINED",
  "CLOSED",
]);

export const serviceEngagement = pgTable(
  "service_engagement",
  {
    id: text("id").primaryKey(),
    // Section 5: exactly one engagement per PathwaysCase, enforced at
    // the database level -- there is no multi-row history to
    // accidentally accumulate simultaneous active engagements from.
    pathwaysCaseId: text("pathways_case_id")
      .notNull()
      .references(() => pathwaysCase.id, { onDelete: "cascade" }),
    // Section 16: the exact READY_FOR_CLIENT Blueprint revision in view
    // when this engagement was created. Never repointed; never used to
    // modify Blueprint content; proves the gate was satisfied without
    // duplicating any Blueprint field.
    sourceBlueprintRevisionId: text("source_blueprint_revision_id")
      .notNull()
      .references(() => blueprintRevision.id),

    familyDecision: familyDecisionEnum("family_decision").notNull(),
    familyDecisionRecordedAt: timestamp("family_decision_recorded_at", { withTimezone: true }).notNull(),
    familyDecisionRecordedByUserId: text("family_decision_recorded_by_user_id")
      .notNull()
      .references(() => user.id),

    // --- Service arrangement (section 6) -- only meaningful when
    // familyDecision = CONTINUE_WITH_PATHWAYS. ---------------------
    serviceArrangement: serviceArrangementEnum("service_arrangement"),
    serviceArrangementDescription: text("service_arrangement_description"),

    // --- Payment arrangement (sections 7-9) -- integer cents only,
    // never floating-point. Default currency USD; no multi-currency
    // support built in this phase. --------------------------------
    paymentStructure: paymentStructureEnum("payment_structure"),
    paymentStatus: paymentStatusEnum("payment_status"),
    currency: text("currency").notNull().default("USD"),
    agreedTotalAmountCents: integer("agreed_total_amount_cents"),
    paymentAmountCents: integer("payment_amount_cents"),
    installmentCount: integer("installment_count"),
    firstPaymentDate: timestamp("first_payment_date", { withTimezone: true }),
    termsNote: text("terms_note"),
    paymentMethodNote: text("payment_method_note"),
    // Section 9: an explicit, narrow opt-in for "staff is recording a
    // confirmed external payment," never a pseudo-ledger -- see
    // src/server/service-engagement.ts's derivePaymentStatus.
    paymentHandledExternally: boolean("payment_handled_externally").notNull().default(false),

    // --- Follow-up (section 17) -- only meaningful when familyDecision
    // = FOLLOW_UP_NEEDED. Operational context only, never a
    // scheduling/reminder system. --------------------------------
    followUpNote: text("follow_up_note"),
    followUpDate: timestamp("follow_up_date", { withTimezone: true }),

    // --- Not proceeding (section 19) -- only meaningful when
    // familyDecision = NOT_PROCEEDING. Never required, never used in
    // educational scoring. ----------------------------------------
    notProceedingReason: text("not_proceeding_reason"),

    status: serviceEngagementStatusEnum("status").notNull().default("PENDING_DECISION"),

    // Section 20: when/who confirmed the engagement (any decision,
    // including a non-CONTINUE one -- "confirming staff" is required
    // for NOT_PROCEEDING too, per section 19).
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByUserId: text("confirmed_by_user_id").references(() => user.id),
    // Section 24: set once, the first time activation conditions are
    // met; never cleared, never overwritten by a later save (section
    // 22's activation-idempotency requirement).
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    // Section 26: optimistic concurrency, identical pattern to
    // blueprintRevision.version / planningCallRecord.version.
    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("service_engagement_case_unique_idx").on(table.pathwaysCaseId),
    index("service_engagement_blueprint_revision_idx").on(table.sourceBlueprintRevisionId),
  ],
);

export const serviceEngagementRelations = relations(serviceEngagement, ({ one }) => ({
  pathwaysCase: one(pathwaysCase, {
    fields: [serviceEngagement.pathwaysCaseId],
    references: [pathwaysCase.id],
  }),
  sourceBlueprintRevision: one(blueprintRevision, {
    fields: [serviceEngagement.sourceBlueprintRevisionId],
    references: [blueprintRevision.id],
  }),
  familyDecisionRecordedBy: one(user, {
    fields: [serviceEngagement.familyDecisionRecordedByUserId],
    references: [user.id],
  }),
  confirmedBy: one(user, {
    fields: [serviceEngagement.confirmedByUserId],
    references: [user.id],
  }),
}));
