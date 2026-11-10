import "server-only";
import { eq, and } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  pathwaysCase,
  serviceEngagement,
  auditEvent,
  user,
  type familyDecisionEnum,
  type serviceArrangementEnum,
  type paymentStructureEnum,
  type paymentStatusEnum,
  type serviceEngagementStatusEnum,
} from "@/db/schema";
import { generateId } from "./ids";
import { assertAdvisorCanAccessPathwaysCase, getStaffRole, CASE_ACCESS_ROLES, AuthorizationError } from "./access-control";
import { getCurrentBlueprintRevision } from "./blueprint";
import { isValidCaseStatusTransition } from "./pathways-case";
import { sanitizeText } from "@/lib/discovery/validation";

/**
 * Phase 6F -- the commercial handoff domain service (docs/pathways
 * PHASE6F_SERVICE_ENGAGEMENT.md). Every write function re-derives
 * authorization fresh: an ADVISOR must hold an active assignment to
 * the exact case (the UNCHANGED `assertAdvisorCanAccessPathwaysCase`,
 * same boundary as Phase 6B/6C/6D/6E); an ADMIN needs only the role
 * itself, never an assignment -- the same "any admin, not
 * assignment-gated" rule `src/server/staff-queue.ts`'s
 * `getCaseDetailForStaff` already applies to case reads everywhere in
 * this codebase. Section 15 explicitly wants admin writes here (unlike
 * Blueprint's ADVISOR-only authoring module), so this module extends
 * that existing read rule to writes rather than inventing a new one.
 *
 * One mutable `ServiceEngagement` row per PathwaysCase (section 25:
 * "acceptable to maintain one current engagement record plus audit
 * history rather than building full contract versioning"), gated on
 * an existing READY_FOR_CLIENT Blueprint revision (section 16) that is
 * never itself modified by anything in this module.
 */

export type FamilyDecision = (typeof familyDecisionEnum.enumValues)[number];
export type ServiceArrangement = (typeof serviceArrangementEnum.enumValues)[number];
export type PaymentStructure = (typeof paymentStructureEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type ServiceEngagementStatus = (typeof serviceEngagementStatusEnum.enumValues)[number];

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Queryable = Database | Tx;

async function recordAuditEvent(
  db: Queryable,
  params: {
    action: string;
    targetId: string;
    actorUserId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditEvent).values({
    id: generateId("audit"),
    actorType: "ADVISOR",
    actorUserId: params.actorUserId,
    action: params.action,
    targetType: "ServiceEngagement",
    targetId: params.targetId,
    metadata: params.metadata ?? null,
  });
}

/**
 * Parses a user-typed dollar amount ("1,500" / "1500.00" / "1500") into
 * safe integer cents -- never floating-point arithmetic. Returns
 * undefined for empty/invalid input (callers treat that as "not
 * provided," not as zero).
 */
export function parseDollarsToCents(raw: string | null | undefined): number | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.replace(/[,$\s]/g, "");
  if (cleaned.length === 0) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [wholeRaw = "0", fractionRaw = ""] = cleaned.split(".");
  const whole = Number.parseInt(wholeRaw, 10);
  if (!Number.isFinite(whole)) return undefined;
  const fraction = Number.parseInt(fractionRaw.padEnd(2, "0"), 10) || 0;
  return whole * 100 + fraction;
}

/** The exact inverse of parseDollarsToCents, for pre-filling a form/summary -- integer arithmetic only. */
export function formatCentsAsDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const remainder = abs % 100;
  return `${negative ? "-" : ""}${dollars}.${String(remainder).padStart(2, "0")}`;
}

/** Section 9: derived deterministically from the chosen structure -- never independently client-settable. */
function derivePaymentStatus(structure: PaymentStructure, paymentHandledExternally: boolean): PaymentStatus {
  if (structure === "WAIVED") return "NOT_REQUIRED";
  if (structure === "PENDING") return "TERMS_PENDING";
  return paymentHandledExternally ? "PAYMENT_HANDLED_EXTERNALLY" : "TERMS_CONFIRMED";
}

export interface PaymentFieldsInput {
  agreedTotalAmountCents?: number | undefined;
  paymentAmountCents?: number | undefined;
  installmentCount?: number | undefined;
}

/** Sections 7, 27 (items 13-18): the minimum fields each payment structure actually needs -- never more than necessary. */
function validatePaymentFields(structure: PaymentStructure, fields: PaymentFieldsInput, termsNote: string | undefined): string[] {
  const issues: string[] = [];
  switch (structure) {
    case "ONE_TIME":
      if (!fields.agreedTotalAmountCents || fields.agreedTotalAmountCents <= 0) {
        issues.push("Enter the total agreed amount for a one-time payment.");
      }
      break;
    case "MONTHLY":
      if (!fields.paymentAmountCents || fields.paymentAmountCents <= 0) {
        issues.push("Enter the monthly payment amount.");
      }
      break;
    case "INSTALLMENTS":
      if (!fields.paymentAmountCents || fields.paymentAmountCents <= 0) {
        issues.push("Enter the installment payment amount.");
      }
      if (!fields.installmentCount || fields.installmentCount < 1) {
        issues.push("Enter the number of installments.");
      }
      break;
    case "CUSTOM":
      if (!termsNote || termsNote.trim().length === 0) {
        issues.push("Describe the agreed custom terms.");
      }
      break;
    case "WAIVED":
    case "PENDING":
      break;
  }
  return issues;
}

export interface RecordFamilyDecisionInput {
  pathwaysCaseId: string;
  actorUserId: string;
  expectedVersion: number;
  familyDecision: FamilyDecision;
  // CONTINUE_WITH_PATHWAYS only:
  serviceArrangement?: ServiceArrangement | undefined;
  serviceArrangementDescription?: string | undefined;
  paymentStructure?: PaymentStructure | undefined;
  agreedTotalAmountCents?: number | undefined;
  paymentAmountCents?: number | undefined;
  installmentCount?: number | undefined;
  firstPaymentDate?: string | undefined;
  termsNote?: string | undefined;
  paymentMethodNote?: string | undefined;
  paymentHandledExternally?: boolean | undefined;
  // FOLLOW_UP_NEEDED only:
  followUpNote?: string | undefined;
  followUpDate?: string | undefined;
  // NOT_PROCEEDING only:
  notProceedingReason?: string | undefined;
}

export type RecordFamilyDecisionResult =
  | { ok: true; engagementId: string; version: number; status: ServiceEngagementStatus; activated: boolean }
  | {
      ok: false;
      reason:
        | "NOT_AUTHORIZED"
        | "CASE_NOT_FOUND"
        | "BLUEPRINT_NOT_READY"
        | "VERSION_CONFLICT"
        | "ARRANGEMENT_REQUIRED"
        | "PAYMENT_STRUCTURE_REQUIRED"
        | "INVALID_CONTENT";
      issues?: string[];
    };

/**
 * Section 14's single "Confirm Engagement" action: records the family
 * decision and, when it is CONTINUE_WITH_PATHWAYS, the consulting
 * arrangement and payment terms in the same call. Idempotent creation
 * (the FIRST call for an eligible case creates the engagement row;
 * every subsequent call updates that same row under optimistic
 * concurrency) -- gated on the Blueprint reaching READY_FOR_CLIENT
 * (section 16), which this function never modifies. Activation
 * (section 12, 24) happens here, atomically, the first time its
 * conditions are met; `activatedAt` is never cleared or overwritten on
 * a later call (section 22's idempotency requirement).
 */
export async function recordFamilyDecision(
  db: Database,
  input: RecordFamilyDecisionInput,
): Promise<RecordFamilyDecisionResult> {
  // Section 15: an ADVISOR must hold an active assignment to this exact
  // case (the same boundary every other advisor write in this codebase
  // uses). An ADMIN needs only the role itself -- the same "any admin,
  // not assignment-gated" rule src/server/staff-queue.ts's
  // getCaseDetailForStaff already applies to case *reads* everywhere
  // in this codebase; Phase 6F is simply the first place ADMIN also
  // gets a genuine write path under that same rule, per section 15's
  // "Admin: may view and update."
  const role = await getStaffRole(db, input.actorUserId);
  if (!role || !CASE_ACCESS_ROLES.includes(role)) return { ok: false, reason: "NOT_AUTHORIZED" };
  if (role === "ADVISOR") {
    try {
      await assertAdvisorCanAccessPathwaysCase(db, input.actorUserId, input.pathwaysCaseId);
    } catch (err) {
      if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
      throw err;
    }
  }

  const [caseRow] = await db
    .select({ id: pathwaysCase.id, status: pathwaysCase.status })
    .from(pathwaysCase)
    .where(eq(pathwaysCase.id, input.pathwaysCaseId))
    .limit(1);
  if (!caseRow) return { ok: false, reason: "CASE_NOT_FOUND" };

  const currentBlueprint = await getCurrentBlueprintRevision(db, input.pathwaysCaseId);
  if (!currentBlueprint || currentBlueprint.status !== "READY_FOR_CLIENT") {
    return { ok: false, reason: "BLUEPRINT_NOT_READY" };
  }

  let serviceArrangement: ServiceArrangement | null = null;
  let serviceArrangementDescription: string | null = null;
  let paymentStructure: PaymentStructure | null = null;
  let paymentStatus: PaymentStatus | null = null;
  let agreedTotalAmountCents: number | null = null;
  let paymentAmountCents: number | null = null;
  let installmentCount: number | null = null;
  let firstPaymentDate: Date | null = null;
  let termsNote: string | null = null;
  let paymentMethodNote: string | null = null;
  let paymentHandledExternally = false;
  let followUpNote: string | null = null;
  let followUpDate: Date | null = null;
  let notProceedingReason: string | null = null;

  if (input.familyDecision === "CONTINUE_WITH_PATHWAYS") {
    if (!input.serviceArrangement) return { ok: false, reason: "ARRANGEMENT_REQUIRED" };
    if (!input.paymentStructure) return { ok: false, reason: "PAYMENT_STRUCTURE_REQUIRED" };

    serviceArrangement = input.serviceArrangement;
    serviceArrangementDescription =
      input.serviceArrangement === "CUSTOM_ENGAGEMENT" && input.serviceArrangementDescription
        ? sanitizeText(input.serviceArrangementDescription).trim() || null
        : null;

    const normalizedTermsNote = input.termsNote ? sanitizeText(input.termsNote).trim() || undefined : undefined;
    const issues = validatePaymentFields(
      input.paymentStructure,
      {
        agreedTotalAmountCents: input.agreedTotalAmountCents,
        paymentAmountCents: input.paymentAmountCents,
        installmentCount: input.installmentCount,
      },
      normalizedTermsNote,
    );
    if (issues.length > 0) return { ok: false, reason: "INVALID_CONTENT", issues };

    paymentStructure = input.paymentStructure;
    paymentHandledExternally = input.paymentHandledExternally ?? false;
    paymentStatus = derivePaymentStatus(paymentStructure, paymentHandledExternally);
    agreedTotalAmountCents = input.agreedTotalAmountCents ?? null;
    paymentAmountCents = input.paymentAmountCents ?? null;
    installmentCount = input.installmentCount ?? null;
    firstPaymentDate = input.firstPaymentDate ? new Date(input.firstPaymentDate) : null;
    termsNote = normalizedTermsNote ?? null;
    paymentMethodNote = input.paymentMethodNote ? sanitizeText(input.paymentMethodNote).trim() || null : null;
  } else if (input.familyDecision === "FOLLOW_UP_NEEDED") {
    followUpNote = input.followUpNote ? sanitizeText(input.followUpNote).trim() || null : null;
    followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;
  } else if (input.familyDecision === "NOT_PROCEEDING") {
    notProceedingReason = input.notProceedingReason ? sanitizeText(input.notProceedingReason).trim() || null : null;
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(serviceEngagement)
      .where(eq(serviceEngagement.pathwaysCaseId, input.pathwaysCaseId))
      .for("update")
      .limit(1);

    if (existing && existing.version !== input.expectedVersion) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }

    const previousStatus: ServiceEngagementStatus = existing?.status ?? "PENDING_DECISION";
    const previousActivatedAt = existing?.activatedAt ?? null;

    let status: ServiceEngagementStatus;
    if (input.familyDecision === "BLUEPRINT_ONLY") {
      status = "CLOSED";
    } else if (input.familyDecision === "NOT_PROCEEDING") {
      status = "DECLINED";
    } else if (input.familyDecision === "FOLLOW_UP_NEEDED") {
      status = "PENDING_DECISION";
    } else {
      // CONTINUE_WITH_PATHWAYS
      status = paymentStructure === "PENDING" ? "CONFIRMED" : "ACTIVE";
    }
    // Section 25: never silently regress a confirmed/active engagement
    // just because a later save's computed status would be earlier in
    // the lifecycle than one already reached from a prior CONTINUE
    // decision -- once ACTIVE, stays ACTIVE.
    if (previousStatus === "ACTIVE") status = "ACTIVE";

    const activating = status === "ACTIVE" && previousActivatedAt === null;
    const now = new Date();

    const values = {
      familyDecision: input.familyDecision,
      familyDecisionRecordedAt: now,
      familyDecisionRecordedByUserId: input.actorUserId,
      serviceArrangement,
      serviceArrangementDescription,
      paymentStructure,
      paymentStatus,
      agreedTotalAmountCents,
      paymentAmountCents,
      installmentCount,
      firstPaymentDate,
      termsNote,
      paymentMethodNote,
      paymentHandledExternally,
      followUpNote,
      followUpDate,
      notProceedingReason,
      status,
      confirmedAt: now,
      confirmedByUserId: input.actorUserId,
      activatedAt: activating ? now : previousActivatedAt,
      updatedAt: now,
    };

    let engagementId: string;
    if (existing) {
      const [updated] = await tx
        .update(serviceEngagement)
        .set({ ...values, version: existing.version + 1 })
        .where(and(eq(serviceEngagement.id, existing.id), eq(serviceEngagement.version, input.expectedVersion)))
        .returning({ id: serviceEngagement.id, version: serviceEngagement.version });
      if (!updated) return { ok: false, reason: "VERSION_CONFLICT" };
      engagementId = updated.id;
    } else {
      engagementId = generateId("svcengage");
      await tx.insert(serviceEngagement).values({
        id: engagementId,
        pathwaysCaseId: input.pathwaysCaseId,
        sourceBlueprintRevisionId: currentBlueprint.id,
        version: 1,
        ...values,
      });
      await recordAuditEvent(tx, {
        action: "SERVICE_ENGAGEMENT_CREATED",
        targetId: engagementId,
        actorUserId: input.actorUserId,
      });
    }

    await recordAuditEvent(tx, {
      action: "FAMILY_DECISION_RECORDED",
      targetId: engagementId,
      actorUserId: input.actorUserId,
      metadata: { pathwaysCaseId: input.pathwaysCaseId, familyDecision: input.familyDecision },
    });

    if (input.familyDecision === "CONTINUE_WITH_PATHWAYS") {
      await recordAuditEvent(tx, {
        action: "SERVICE_TERMS_CONFIRMED",
        targetId: engagementId,
        actorUserId: input.actorUserId,
        metadata: { pathwaysCaseId: input.pathwaysCaseId, paymentStructure },
      });
      await recordAuditEvent(tx, {
        action: "PAYMENT_ARRANGEMENT_CONFIRMED",
        targetId: engagementId,
        actorUserId: input.actorUserId,
        metadata: { pathwaysCaseId: input.pathwaysCaseId, paymentStructure, paymentStatus },
      });
    } else if (input.familyDecision === "NOT_PROCEEDING") {
      await recordAuditEvent(tx, {
        action: "ENGAGEMENT_DECLINED",
        targetId: engagementId,
        actorUserId: input.actorUserId,
        metadata: { pathwaysCaseId: input.pathwaysCaseId },
      });
    }

    if (activating) {
      await recordAuditEvent(tx, {
        action: "CONSULTANCY_ACTIVATED",
        targetId: engagementId,
        actorUserId: input.actorUserId,
        metadata: { pathwaysCaseId: input.pathwaysCaseId },
      });

      if (isValidCaseStatusTransition(caseRow.status, "ACTIVE_CONSULTANCY")) {
        await tx
          .update(pathwaysCase)
          .set({ status: "ACTIVE_CONSULTANCY", updatedAt: now })
          .where(eq(pathwaysCase.id, caseRow.id));
        await tx.insert(auditEvent).values({
          id: generateId("audit"),
          actorType: "ADVISOR",
          actorUserId: input.actorUserId,
          action: "CASE_STATUS_CHANGED",
          targetType: "PathwaysCase",
          targetId: caseRow.id,
          metadata: { fromStatus: caseRow.status, toStatus: "ACTIVE_CONSULTANCY" },
        });
      }
    }

    return { ok: true, engagementId, version: existing ? existing.version + 1 : 1, status, activated: activating };
  });
}

export interface ServiceEngagementDTO {
  id: string;
  pathwaysCaseId: string;
  sourceBlueprintRevisionId: string;
  version: number;
  familyDecision: FamilyDecision;
  familyDecisionRecordedAt: string;
  serviceArrangement: ServiceArrangement | null;
  serviceArrangementDescription: string | null;
  paymentStructure: PaymentStructure | null;
  paymentStatus: PaymentStatus | null;
  currency: string;
  agreedTotalAmountCents: number | null;
  paymentAmountCents: number | null;
  installmentCount: number | null;
  firstPaymentDate: string | null;
  termsNote: string | null;
  paymentMethodNote: string | null;
  paymentHandledExternally: boolean;
  followUpNote: string | null;
  followUpDate: string | null;
  notProceedingReason: string | null;
  status: ServiceEngagementStatus;
  confirmedAt: string | null;
  confirmedByEmail: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(row: typeof serviceEngagement.$inferSelect, confirmedByEmail: string | null): ServiceEngagementDTO {
  return {
    id: row.id,
    pathwaysCaseId: row.pathwaysCaseId,
    sourceBlueprintRevisionId: row.sourceBlueprintRevisionId,
    version: row.version,
    familyDecision: row.familyDecision,
    familyDecisionRecordedAt: row.familyDecisionRecordedAt.toISOString(),
    serviceArrangement: row.serviceArrangement,
    serviceArrangementDescription: row.serviceArrangementDescription,
    paymentStructure: row.paymentStructure,
    paymentStatus: row.paymentStatus,
    currency: row.currency,
    agreedTotalAmountCents: row.agreedTotalAmountCents,
    paymentAmountCents: row.paymentAmountCents,
    installmentCount: row.installmentCount,
    firstPaymentDate: row.firstPaymentDate ? row.firstPaymentDate.toISOString() : null,
    termsNote: row.termsNote,
    paymentMethodNote: row.paymentMethodNote,
    paymentHandledExternally: row.paymentHandledExternally,
    followUpNote: row.followUpNote,
    followUpDate: row.followUpDate ? row.followUpDate.toISOString() : null,
    notProceedingReason: row.notProceedingReason,
    status: row.status,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    confirmedByEmail,
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Read-only lookup, or null if no engagement has been recorded for
 * this case yet. Performs NO authorization of its own -- callers
 * (advisor/admin Blueprint routes) already resolved access before
 * reaching here, the same convention as getCurrentBlueprintRevision.
 * Left-joins the confirming staff member's email for section 23's
 * "Confirmed by" display -- never any other user field.
 */
export async function getServiceEngagement(db: Database, pathwaysCaseId: string): Promise<ServiceEngagementDTO | null> {
  const [row] = await db
    .select({ engagement: serviceEngagement, confirmedByEmail: user.email })
    .from(serviceEngagement)
    .leftJoin(user, eq(serviceEngagement.confirmedByUserId, user.id))
    .where(eq(serviceEngagement.pathwaysCaseId, pathwaysCaseId))
    .limit(1);
  return row ? toDTO(row.engagement, row.confirmedByEmail ?? null) : null;
}
