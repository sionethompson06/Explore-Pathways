import "server-only";
import { eq, and } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  pathwaysCase,
  planningCallRecord,
  auditEvent,
  workflowEvent,
  consultationRequest,
  type pathwaysCaseStatusEnum,
  type planningCallAttendanceEnum,
  type planningCallOutcomeEnum,
  type planningCallServiceFitEnum,
  type consultationStatusEnum,
} from "@/db/schema";
import { generateId } from "./ids";
import { isUniqueConstraintConflict } from "./db-conflict";
import { assertAdvisorCanAccessPathwaysCase, AuthorizationError } from "./access-control";
import { isValidCaseStatusTransition } from "./pathways-case";
import { loadTaxonomy } from "@/lib/contracts/loader";
import { sanitizeText } from "@/lib/discovery/validation";

/**
 * Phase 6D -- the Planning Call Workspace's domain service
 * (docs/pathways PHASE6D_PLANNING_CALL_WORKSPACE.md). Every write
 * function here re-derives authorization fresh via the UNCHANGED
 * `assertAdvisorCanAccessPathwaysCase` (Phase 6B/6C) -- an active
 * `ADVISOR` staff role AND an active assignment to this exact case,
 * always both. There is no ADMIN write path anywhere in this module:
 * admins may read a planning-call record for operational purposes
 * (src/server/staff-queue.ts's admin case detail), but per section 17
 * this phase deliberately does NOT implement admin corrections --
 * documented as a known limitation, never a silent side door.
 *
 * Attendance/consultation-status reuse (section 11): the existing
 * `consultationStatusEnum` already safely represents three of the
 * four attendance values (COMPLETED~ATTENDED, NO_SHOW, CANCELLED);
 * only RESCHEDULE_NEEDED has no equivalent there. Rather than force a
 * fourth value onto that enum (which many other, unrelated call paths
 * already read), Phase 6D introduces the small, purpose-built
 * `planningCallAttendanceEnum` and maps three of its four values onto
 * the existing `consultationRequest.status` (via the existing
 * `workflowEvent` audit table) where they align exactly;
 * RESCHEDULE_NEEDED intentionally leaves `consultationRequest.status`
 * untouched (the appointment nominally still stands, pending a human
 * reschedule this phase does not automate).
 */

export type PathwaysCaseStatus = (typeof pathwaysCaseStatusEnum.enumValues)[number];
export type PlanningCallAttendance = (typeof planningCallAttendanceEnum.enumValues)[number];
export type PlanningCallOutcome = (typeof planningCallOutcomeEnum.enumValues)[number];
export type PlanningCallServiceFit = (typeof planningCallServiceFitEnum.enumValues)[number];
type ConsultationStatus = (typeof consultationStatusEnum.enumValues)[number];

const PLANNING_CALL_RECORD_PRIMARY_PER_CASE_CONSTRAINT = "planning_call_record_primary_per_case_unique_idx";

/** Same transaction-callback argument pattern as src/server/pathways-case.ts and src/server/booking.ts. */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Queryable = Database | Tx;

/** Section 12: outcome -> case status. Only ever applied from BOOKED in practice (the only state a case should be in while its primary planning call is being completed); isValidCaseStatusTransition is still the authoritative gate, never bypassed. */
const OUTCOME_TO_CASE_STATUS: Record<PlanningCallOutcome, PathwaysCaseStatus> = {
  CONTINUE_TO_BLUEPRINT: "COMPLETED",
  NEEDS_INFORMATION: "NEEDS_INFORMATION",
  FOLLOW_UP: "FOLLOW_UP",
  NOT_CURRENT_SERVICE_FIT: "NOT_CURRENT_SERVICE_FIT",
  FAMILY_NOT_PROCEEDING: "FAMILY_NOT_PROCEEDING",
};

/** Section 11: attendance -> ConsultationRequest.status, where the existing enum already safely represents the concept. RESCHEDULE_NEEDED deliberately has no entry (see module doc comment). */
const ATTENDANCE_TO_CONSULTATION_STATUS: Partial<Record<PlanningCallAttendance, ConsultationStatus>> = {
  ATTENDED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
};

/** Section 12: CONTINUE_TO_BLUEPRINT may only be chosen when the call was actually attended -- you cannot conclude a family is ready for the next professional step in a call that did not happen. */
const OUTCOMES_ALLOWED_WITHOUT_ATTENDANCE: readonly PlanningCallOutcome[] = [
  "NEEDS_INFORMATION",
  "FOLLOW_UP",
  "NOT_CURRENT_SERVICE_FIT",
  "FAMILY_NOT_PROCEEDING",
];

export interface PathwayOption {
  id: string;
  label: string;
}

/** Section 7: read-only reference into the EXISTING taxonomy (contracts/taxonomy.json) -- never a free-form replacement model, never evaluated for recommendation purposes. */
export function listPathwayOptions(): PathwayOption[] {
  const taxonomy = loadTaxonomy();
  return taxonomy.base_models.map((m) => ({ id: m.id, label: m.label }));
}

function isValidPathwayIdList(ids: unknown): ids is string[] {
  if (!Array.isArray(ids)) return false;
  const known = new Set(listPathwayOptions().map((o) => o.id));
  return ids.every((id) => typeof id === "string" && known.has(id));
}

function sanitizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v): v is string => typeof v === "string")
    .map((v) => sanitizeText(v).trim())
    .filter((v) => v.length > 0)
    .slice(0, 20);
}

async function recordAuditEvent(
  db: Queryable,
  params: {
    action: string;
    targetType: "PlanningCallRecord" | "PathwaysCase";
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
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: params.metadata ?? null,
  });
}

/** The structured, provenance-tagged content fields a save may set (sections 6, 8, 9). Every field optional -- a save may touch only some of them. */
export interface PlanningCallContentInput {
  familyMainGoal?: string | undefined;
  currentEducationalSituation?: string | undefined;
  studentStrengths?: string | undefined;
  learningNeedsSupport?: string | undefined;
  scheduleLifestyleRequirements?: string | undefined;
  academicPlanningNotes?: string | undefined;
  pathwaysDiscussed?: string[] | undefined;
  advisorAssessment?: string | undefined;
  recommendedNextAction?: string | undefined;
  primaryGoalConfirmed?: boolean | undefined;
  currentModelConfirmed?: boolean | undefined;
  priorityQuestions?: string[] | undefined;
  verificationNeeded?: string[] | undefined;
  verifiedFacts?: string[] | undefined;
  serviceFit?: PlanningCallServiceFit | undefined;
  followUpRequired?: boolean | undefined;
}

function normalizeContentFields(input: PlanningCallContentInput) {
  const fields: Record<string, unknown> = {};
  if (input.familyMainGoal !== undefined) fields.familyMainGoal = sanitizeText(input.familyMainGoal);
  if (input.currentEducationalSituation !== undefined)
    fields.currentEducationalSituation = sanitizeText(input.currentEducationalSituation);
  if (input.studentStrengths !== undefined) fields.studentStrengths = sanitizeText(input.studentStrengths);
  if (input.learningNeedsSupport !== undefined)
    fields.learningNeedsSupport = sanitizeText(input.learningNeedsSupport);
  if (input.scheduleLifestyleRequirements !== undefined)
    fields.scheduleLifestyleRequirements = sanitizeText(input.scheduleLifestyleRequirements);
  if (input.academicPlanningNotes !== undefined)
    fields.academicPlanningNotes = sanitizeText(input.academicPlanningNotes);
  if (input.pathwaysDiscussed !== undefined) {
    if (!isValidPathwayIdList(input.pathwaysDiscussed)) {
      throw new Error("pathwaysDiscussed must reference only known taxonomy base_model ids");
    }
    fields.pathwaysDiscussed = input.pathwaysDiscussed;
  }
  if (input.advisorAssessment !== undefined) fields.advisorAssessment = sanitizeText(input.advisorAssessment);
  if (input.recommendedNextAction !== undefined)
    fields.recommendedNextAction = sanitizeText(input.recommendedNextAction);
  if (input.primaryGoalConfirmed !== undefined) fields.primaryGoalConfirmed = input.primaryGoalConfirmed;
  if (input.currentModelConfirmed !== undefined) fields.currentModelConfirmed = input.currentModelConfirmed;
  if (input.priorityQuestions !== undefined) fields.priorityQuestions = sanitizeStringArray(input.priorityQuestions);
  if (input.verificationNeeded !== undefined)
    fields.verificationNeeded = sanitizeStringArray(input.verificationNeeded);
  if (input.verifiedFacts !== undefined) fields.verifiedFacts = sanitizeStringArray(input.verifiedFacts);
  if (input.serviceFit !== undefined) fields.serviceFit = input.serviceFit;
  if (input.followUpRequired !== undefined) fields.followUpRequired = input.followUpRequired;
  return fields;
}

export type SaveDraftResult =
  | { ok: true; recordId: string; version: number }
  | {
      ok: false;
      reason: "NOT_AUTHORIZED" | "CASE_NOT_FOUND" | "ALREADY_COMPLETED" | "VERSION_CONFLICT";
    };

/**
 * Section 10: idempotent draft save. The FIRST save for a case creates
 * its primary PlanningCallRecord (status DRAFT); every subsequent save
 * updates that same row -- never a duplicate (the partial unique index
 * is the unconditional backstop against a genuine concurrent first
 * save). Section 19: `expectedVersion` must match the row's current
 * `version` or the save is rejected as a VERSION_CONFLICT rather than
 * silently overwriting a newer save from another tab/session.
 * `expectedVersion: 0` means "I believe no record exists yet."
 */
export async function savePlanningCallDraft(
  db: Database,
  input: {
    pathwaysCaseId: string;
    advisorUserId: string;
    expectedVersion: number;
    content: PlanningCallContentInput;
  },
): Promise<SaveDraftResult> {
  try {
    await assertAdvisorCanAccessPathwaysCase(db, input.advisorUserId, input.pathwaysCaseId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
    throw err;
  }

  const [caseRow] = await db
    .select({
      id: pathwaysCase.id,
      consultationRequestId: pathwaysCase.consultationRequestId,
      bookingId: pathwaysCase.bookingId,
      profileRevisionId: pathwaysCase.profileRevisionId,
      reportSnapshotId: pathwaysCase.reportSnapshotId,
    })
    .from(pathwaysCase)
    .where(eq(pathwaysCase.id, input.pathwaysCaseId))
    .limit(1);
  if (!caseRow) return { ok: false, reason: "CASE_NOT_FOUND" };

  const fields = normalizeContentFields(input.content);

  const [existing] = await db
    .select({ id: planningCallRecord.id, status: planningCallRecord.status, version: planningCallRecord.version })
    .from(planningCallRecord)
    .where(and(eq(planningCallRecord.pathwaysCaseId, input.pathwaysCaseId), eq(planningCallRecord.isPrimary, true)))
    .limit(1);

  if (existing) {
    if (existing.status === "COMPLETED") return { ok: false, reason: "ALREADY_COMPLETED" };
    if (existing.version !== input.expectedVersion) return { ok: false, reason: "VERSION_CONFLICT" };

    const now = new Date();
    const [updated] = await db
      .update(planningCallRecord)
      .set({ ...fields, lastEditedByUserId: input.advisorUserId, version: existing.version + 1, updatedAt: now })
      .where(and(eq(planningCallRecord.id, existing.id), eq(planningCallRecord.version, input.expectedVersion)))
      .returning({ id: planningCallRecord.id, version: planningCallRecord.version });
    if (!updated) return { ok: false, reason: "VERSION_CONFLICT" };

    await recordAuditEvent(db, {
      action: "PLANNING_CALL_DRAFT_SAVED",
      targetType: "PlanningCallRecord",
      targetId: updated.id,
      actorUserId: input.advisorUserId,
    });
    return { ok: true, recordId: updated.id, version: updated.version };
  }

  const newId = generateId("plancall");
  try {
    await db.insert(planningCallRecord).values({
      id: newId,
      pathwaysCaseId: input.pathwaysCaseId,
      consultationRequestId: caseRow.consultationRequestId,
      bookingId: caseRow.bookingId,
      profileRevisionId: caseRow.profileRevisionId,
      reportSnapshotId: caseRow.reportSnapshotId,
      createdByAdvisorUserId: input.advisorUserId,
      lastEditedByUserId: input.advisorUserId,
      isPrimary: true,
      status: "DRAFT",
      version: 1,
      ...fields,
    });
  } catch (err) {
    if (!isUniqueConstraintConflict(err, PLANNING_CALL_RECORD_PRIMARY_PER_CASE_CONSTRAINT)) throw err;
    // A genuine concurrent first save won the race -- never fabricate a
    // second primary record. Re-select and report it as a version
    // conflict so the caller reloads and tries again against the row
    // that actually exists, rather than silently discarding this save.
    return { ok: false, reason: "VERSION_CONFLICT" };
  }

  await recordAuditEvent(db, {
    action: "PLANNING_CALL_CREATED",
    targetType: "PlanningCallRecord",
    targetId: newId,
    actorUserId: input.advisorUserId,
  });
  return { ok: true, recordId: newId, version: 1 };
}

export type CompletePlanningCallResult =
  | { ok: true; recordId: string; caseStatus: PathwaysCaseStatus }
  | {
      ok: false;
      reason:
        | "NOT_AUTHORIZED"
        | "CASE_NOT_FOUND"
        | "ALREADY_COMPLETED"
        | "VERSION_CONFLICT"
        | "ATTENDANCE_REQUIRED"
        | "OUTCOME_REQUIRED"
        | "OUTCOME_NOT_ALLOWED_FOR_ATTENDANCE"
        | "INVALID_CASE_TRANSITION";
    };

/**
 * Sections 10-13: the one-time, explicit completion action. Requires
 * BOTH attendance and outcome (never inferred, never defaulted from a
 * past scheduled time -- there is no caller anywhere in this codebase
 * that invokes this function automatically). Transitions
 * PathwaysCase.status per OUTCOME_TO_CASE_STATUS, validated against
 * the existing, unchanged `isValidCaseStatusTransition` -- an illegal
 * transition is rejected, never silently skipped. Idempotent against
 * a double-submit: a record already COMPLETED returns
 * ALREADY_COMPLETED rather than re-running any side effect.
 */
export async function completePlanningCall(
  db: Database,
  input: {
    pathwaysCaseId: string;
    advisorUserId: string;
    expectedVersion: number;
    attendance: PlanningCallAttendance;
    outcome: PlanningCallOutcome;
    content: PlanningCallContentInput;
  },
): Promise<CompletePlanningCallResult> {
  try {
    await assertAdvisorCanAccessPathwaysCase(db, input.advisorUserId, input.pathwaysCaseId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
    throw err;
  }

  if (!input.attendance) return { ok: false, reason: "ATTENDANCE_REQUIRED" };
  if (!input.outcome) return { ok: false, reason: "OUTCOME_REQUIRED" };
  if (input.attendance !== "ATTENDED" && !OUTCOMES_ALLOWED_WITHOUT_ATTENDANCE.includes(input.outcome)) {
    return { ok: false, reason: "OUTCOME_NOT_ALLOWED_FOR_ATTENDANCE" };
  }

  const fields = normalizeContentFields(input.content);

  return db.transaction(async (tx) => {
    const [caseRow] = await tx
      .select({
        id: pathwaysCase.id,
        status: pathwaysCase.status,
        consultationRequestId: pathwaysCase.consultationRequestId,
        bookingId: pathwaysCase.bookingId,
        profileRevisionId: pathwaysCase.profileRevisionId,
        reportSnapshotId: pathwaysCase.reportSnapshotId,
      })
      .from(pathwaysCase)
      .where(eq(pathwaysCase.id, input.pathwaysCaseId))
      .for("update")
      .limit(1);
    if (!caseRow) return { ok: false, reason: "CASE_NOT_FOUND" };

    const nextCaseStatus = OUTCOME_TO_CASE_STATUS[input.outcome];
    if (!isValidCaseStatusTransition(caseRow.status, nextCaseStatus)) {
      return { ok: false, reason: "INVALID_CASE_TRANSITION" };
    }

    const [existing] = await tx
      .select({ id: planningCallRecord.id, status: planningCallRecord.status, version: planningCallRecord.version })
      .from(planningCallRecord)
      .where(and(eq(planningCallRecord.pathwaysCaseId, input.pathwaysCaseId), eq(planningCallRecord.isPrimary, true)))
      .limit(1);
    if (existing?.status === "COMPLETED") return { ok: false, reason: "ALREADY_COMPLETED" };
    if (existing && existing.version !== input.expectedVersion) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }

    const now = new Date();
    let recordId: string;
    if (existing) {
      const [updated] = await tx
        .update(planningCallRecord)
        .set({
          ...fields,
          attendance: input.attendance,
          attendanceRecordedAt: now,
          outcome: input.outcome,
          outcomeRecordedAt: now,
          status: "COMPLETED",
          completedAt: now,
          lastEditedByUserId: input.advisorUserId,
          version: existing.version + 1,
          updatedAt: now,
        })
        .where(and(eq(planningCallRecord.id, existing.id), eq(planningCallRecord.version, input.expectedVersion)))
        .returning({ id: planningCallRecord.id });
      if (!updated) return { ok: false, reason: "VERSION_CONFLICT" };
      recordId = updated.id;
    } else {
      const newId = generateId("plancall");
      try {
        await tx.insert(planningCallRecord).values({
          id: newId,
          pathwaysCaseId: input.pathwaysCaseId,
          consultationRequestId: caseRow.consultationRequestId,
          bookingId: caseRow.bookingId,
          profileRevisionId: caseRow.profileRevisionId,
          reportSnapshotId: caseRow.reportSnapshotId,
          createdByAdvisorUserId: input.advisorUserId,
          lastEditedByUserId: input.advisorUserId,
          isPrimary: true,
          status: "COMPLETED",
          version: 1,
          attendance: input.attendance,
          attendanceRecordedAt: now,
          outcome: input.outcome,
          outcomeRecordedAt: now,
          completedAt: now,
          ...fields,
        });
      } catch (err) {
        if (!isUniqueConstraintConflict(err, PLANNING_CALL_RECORD_PRIMARY_PER_CASE_CONSTRAINT)) throw err;
        return { ok: false, reason: "VERSION_CONFLICT" };
      }
      recordId = newId;
    }

    await recordAuditEvent(tx, {
      action: "CONSULTATION_ATTENDANCE_RECORDED",
      targetType: "PlanningCallRecord",
      targetId: recordId,
      actorUserId: input.advisorUserId,
      metadata: { attendance: input.attendance },
    });
    await recordAuditEvent(tx, {
      action: "PLANNING_CALL_OUTCOME_SET",
      targetType: "PlanningCallRecord",
      targetId: recordId,
      actorUserId: input.advisorUserId,
      metadata: { outcome: input.outcome },
    });
    await recordAuditEvent(tx, {
      action: "PLANNING_CALL_COMPLETED",
      targetType: "PlanningCallRecord",
      targetId: recordId,
      actorUserId: input.advisorUserId,
    });

    // Section 11: reuse the existing consultationRequest.status +
    // workflowEvent audit trail where the existing enum already
    // safely represents the attendance fact.
    const consultationStatus = ATTENDANCE_TO_CONSULTATION_STATUS[input.attendance];
    if (consultationStatus) {
      const [request] = await tx
        .select({ status: consultationRequest.status })
        .from(consultationRequest)
        .where(eq(consultationRequest.id, caseRow.consultationRequestId))
        .limit(1);
      if (request && request.status !== consultationStatus) {
        await tx
          .update(consultationRequest)
          .set({ status: consultationStatus, updatedAt: now })
          .where(eq(consultationRequest.id, caseRow.consultationRequestId));
        await tx.insert(workflowEvent).values({
          id: generateId("wfevent"),
          consultationRequestId: caseRow.consultationRequestId,
          fromStatus: request.status,
          toStatus: consultationStatus,
          reason: "PLANNING_CALL_ATTENDANCE",
          actorUserId: input.advisorUserId,
        });
      }
    }

    if (nextCaseStatus !== caseRow.status) {
      await tx
        .update(pathwaysCase)
        .set({ status: nextCaseStatus, updatedAt: now })
        .where(eq(pathwaysCase.id, caseRow.id));
      await recordAuditEvent(tx, {
        action: "CASE_STATUS_CHANGED",
        targetType: "PathwaysCase",
        targetId: caseRow.id,
        actorUserId: input.advisorUserId,
        metadata: { fromStatus: caseRow.status, toStatus: nextCaseStatus },
      });
    }

    return { ok: true, recordId, caseStatus: nextCaseStatus };
  });
}

export interface PlanningCallRecordDTO {
  id: string;
  status: (typeof planningCallRecord.$inferSelect)["status"];
  version: number;
  familyMainGoal: string | null;
  currentEducationalSituation: string | null;
  studentStrengths: string | null;
  learningNeedsSupport: string | null;
  scheduleLifestyleRequirements: string | null;
  academicPlanningNotes: string | null;
  pathwaysDiscussed: string[];
  advisorAssessment: string | null;
  recommendedNextAction: string | null;
  primaryGoalConfirmed: boolean | null;
  currentModelConfirmed: boolean | null;
  priorityQuestions: string[];
  verificationNeeded: string[];
  verifiedFacts: string[];
  serviceFit: PlanningCallServiceFit | null;
  followUpRequired: boolean | null;
  attendance: PlanningCallAttendance | null;
  outcome: PlanningCallOutcome | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

function toDTO(row: typeof planningCallRecord.$inferSelect): PlanningCallRecordDTO {
  return {
    id: row.id,
    status: row.status,
    version: row.version,
    familyMainGoal: row.familyMainGoal,
    currentEducationalSituation: row.currentEducationalSituation,
    studentStrengths: row.studentStrengths,
    learningNeedsSupport: row.learningNeedsSupport,
    scheduleLifestyleRequirements: row.scheduleLifestyleRequirements,
    academicPlanningNotes: row.academicPlanningNotes,
    pathwaysDiscussed: Array.isArray(row.pathwaysDiscussed) ? (row.pathwaysDiscussed as string[]) : [],
    advisorAssessment: row.advisorAssessment,
    recommendedNextAction: row.recommendedNextAction,
    primaryGoalConfirmed: row.primaryGoalConfirmed,
    currentModelConfirmed: row.currentModelConfirmed,
    priorityQuestions: Array.isArray(row.priorityQuestions) ? (row.priorityQuestions as string[]) : [],
    verificationNeeded: Array.isArray(row.verificationNeeded) ? (row.verificationNeeded as string[]) : [],
    verifiedFacts: Array.isArray(row.verifiedFacts) ? (row.verifiedFacts as string[]) : [],
    serviceFit: row.serviceFit,
    followUpRequired: row.followUpRequired,
    attendance: row.attendance,
    outcome: row.outcome,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

/**
 * Read-only lookup of a case's primary planning-call record, or null
 * if none exists yet (a case with no record at all is simply shown an
 * empty workspace form, never an error). This function performs NO
 * authorization of its own -- callers (the advisor/admin case-detail
 * routes) already resolved access via getCaseDetailForStaff /
 * assertAdvisorCanAccessPathwaysCase before ever reaching here, the
 * same convention staff-queue.ts's report-snapshot lookup follows.
 */
export async function getPrimaryPlanningCallRecord(
  db: Database,
  pathwaysCaseId: string,
): Promise<PlanningCallRecordDTO | null> {
  const [row] = await db
    .select()
    .from(planningCallRecord)
    .where(and(eq(planningCallRecord.pathwaysCaseId, pathwaysCaseId), eq(planningCallRecord.isPrimary, true)))
    .limit(1);
  return row ? toDTO(row) : null;
}

/** Section 14: operationally internal only -- never academic eligibility, acceptance, payment, or placement. Computed on read, never stored, so it can never drift from the record it describes. */
export function isBlueprintReady(record: PlanningCallRecordDTO | null): boolean {
  return record?.status === "COMPLETED" && record.outcome === "CONTINUE_TO_BLUEPRINT";
}

