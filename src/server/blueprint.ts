import "server-only";
import { eq, and, desc } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  pathwaysCase,
  studentSuccessBlueprint,
  blueprintRevision,
  auditEvent,
  type blueprintRevisionStatusEnum,
  type blueprintRevisionReasonEnum,
} from "@/db/schema";
import { generateId } from "./ids";
import { isUniqueConstraintConflict } from "./db-conflict";
import { assertAdvisorCanAccessPathwaysCase, AuthorizationError } from "./access-control";
import { getPrimaryPlanningCallRecord, isBlueprintReady } from "./planning-call";
import {
  CONTENT_SCHEMA_VERSION,
  emptyBlueprintContent,
  parseBlueprintContent,
  completenessIssues,
  type BlueprintContent,
} from "@/lib/blueprint/content-schema";
import { sanitizeText } from "@/lib/discovery/validation";
import { loadTaxonomy } from "@/lib/contracts/loader";

export interface TaxonomyOption {
  id: string;
  label: string;
}

/** Section 15/18/19: read-only references into the EXISTING taxonomy (contracts/taxonomy.json) for the Blueprint authoring form -- never a free-form replacement model, never evaluated for recommendation purposes. */
export function listBlueprintBaseModelOptions(): TaxonomyOption[] {
  return loadTaxonomy().base_models.map((m) => ({ id: m.id, label: m.label }));
}
export function listBlueprintOverlayOptions(): TaxonomyOption[] {
  return loadTaxonomy().overlays.map((m) => ({ id: m.id, label: m.label }));
}
export function listBlueprintSupportOptions(): TaxonomyOption[] {
  return loadTaxonomy().supports.map((m) => ({ id: m.id, label: m.label }));
}
export function listBlueprintOpportunityOptions(): TaxonomyOption[] {
  return loadTaxonomy().opportunities.map((m) => ({ id: m.id, label: m.label }));
}

/**
 * Phase 6E -- the Student Success Blueprint's domain service
 * (docs/pathways PHASE6E_BLUEPRINT_AUTHORING.md). Every write function
 * here re-derives authorization fresh via the UNCHANGED
 * `assertAdvisorCanAccessPathwaysCase` (Phase 6B/6C/6D) -- an active
 * `ADVISOR` staff role AND an active assignment to this exact case,
 * always both. There is no ADMIN write path anywhere in this module;
 * admins may read a Blueprint for operational purposes, never author
 * or transition one.
 *
 * Revision lifecycle (section 10-11, 33-34): DRAFT -> INTERNAL_REVIEW
 * -> READY_FOR_CLIENT is the only advisor-driven path this phase
 * implements; a READY_FOR_CLIENT revision is immutable (no function
 * below ever updates its `content`). SUPERSEDED is set on the PRIOR
 * revision only once a NEW revision itself reaches READY_FOR_CLIENT --
 * never at the moment the new revision is merely created (it starts
 * DRAFT, `isCurrent=true`, while the prior revision keeps its
 * READY_FOR_CLIENT status until superseded). ARCHIVED stays reserved
 * in the schema enum for a hypothetical future retraction workflow
 * this phase does not implement -- same documented-reserved
 * convention as PathwaysCaseStatus's own NEW value.
 */

export type BlueprintRevisionStatus = (typeof blueprintRevisionStatusEnum.enumValues)[number];
export type BlueprintRevisionReason = (typeof blueprintRevisionReasonEnum.enumValues)[number];

const STUDENT_SUCCESS_BLUEPRINT_CASE_CONSTRAINT = "student_success_blueprint_case_unique_idx";

/** Same transaction-callback argument pattern as src/server/planning-call.ts and src/server/pathways-case.ts. */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Queryable = Database | Tx;

/** Only the three transitions this phase's functions actually drive -- no advisor-facing function moves a revision backward or into SUPERSEDED/ARCHIVED directly (SUPERSEDED is a system-side-effect of markBlueprintReadyForClient on the prior revision, never a direct target here). */
const ALLOWED_BLUEPRINT_REVISION_STATUS_TRANSITIONS: Record<BlueprintRevisionStatus, readonly BlueprintRevisionStatus[]> = {
  DRAFT: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["READY_FOR_CLIENT"],
  READY_FOR_CLIENT: [],
  SUPERSEDED: [],
  ARCHIVED: [],
};

export function isValidBlueprintRevisionStatusTransition(
  from: BlueprintRevisionStatus,
  to: BlueprintRevisionStatus,
): boolean {
  if (from === to) return false;
  return ALLOWED_BLUEPRINT_REVISION_STATUS_TRANSITIONS[from].includes(to);
}

async function recordAuditEvent(
  db: Queryable,
  params: {
    action: string;
    targetType: "StudentSuccessBlueprint" | "BlueprintRevision";
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

export interface BlueprintRevisionDTO {
  id: string;
  blueprintId: string;
  revisionNumber: number;
  status: BlueprintRevisionStatus;
  isCurrent: boolean;
  version: number;
  content: BlueprintContent;
  sourceProfileRevisionId: string;
  sourceReportSnapshotId: string;
  sourcePlanningCallRecordId: string;
  sourcePlanningCallRecordVersion: number;
  revisionReason: BlueprintRevisionReason | null;
  revisionReasonOther: string | null;
  createdAt: string;
  updatedAt: string;
  readyForClientAt: string | null;
}

function toRevisionDTO(row: typeof blueprintRevision.$inferSelect): BlueprintRevisionDTO {
  return {
    id: row.id,
    blueprintId: row.blueprintId,
    revisionNumber: row.revisionNumber,
    status: row.status,
    isCurrent: row.isCurrent,
    version: row.version,
    content: parseBlueprintContent(row.content),
    sourceProfileRevisionId: row.sourceProfileRevisionId,
    sourceReportSnapshotId: row.sourceReportSnapshotId,
    sourcePlanningCallRecordId: row.sourcePlanningCallRecordId,
    sourcePlanningCallRecordVersion: row.sourcePlanningCallRecordVersion,
    revisionReason: row.revisionReason,
    revisionReasonOther: row.revisionReasonOther,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readyForClientAt: row.readyForClientAt ? row.readyForClientAt.toISOString() : null,
  };
}

/**
 * Read-only lookup of a case's current Blueprint revision, or null if
 * no Blueprint has been created for this case yet. Performs NO
 * authorization of its own -- callers (advisor/admin case-detail
 * routes) already resolved access before ever reaching here, the same
 * convention getPrimaryPlanningCallRecord follows.
 */
export async function getCurrentBlueprintRevision(
  db: Database,
  pathwaysCaseId: string,
): Promise<BlueprintRevisionDTO | null> {
  const [row] = await db
    .select({ revision: blueprintRevision })
    .from(studentSuccessBlueprint)
    .innerJoin(
      blueprintRevision,
      and(eq(blueprintRevision.blueprintId, studentSuccessBlueprint.id), eq(blueprintRevision.isCurrent, true)),
    )
    .where(eq(studentSuccessBlueprint.pathwaysCaseId, pathwaysCaseId))
    .limit(1);
  return row ? toRevisionDTO(row.revision) : null;
}

/** Read-only full revision history for a case's Blueprint, newest first -- never authorized on its own (same no-auth-of-its-own convention as getCurrentBlueprintRevision). Empty array if no Blueprint exists yet. */
export async function listBlueprintRevisions(db: Database, pathwaysCaseId: string): Promise<BlueprintRevisionDTO[]> {
  const rows = await db
    .select({ revision: blueprintRevision })
    .from(blueprintRevision)
    .innerJoin(studentSuccessBlueprint, eq(blueprintRevision.blueprintId, studentSuccessBlueprint.id))
    .where(eq(studentSuccessBlueprint.pathwaysCaseId, pathwaysCaseId))
    .orderBy(desc(blueprintRevision.revisionNumber));
  return rows.map((r) => toRevisionDTO(r.revision));
}

export type CreateOrOpenBlueprintResult =
  | { ok: true; blueprintId: string; revisionId: string; created: boolean }
  | { ok: false; reason: "NOT_AUTHORIZED" | "CASE_NOT_FOUND" | "NOT_ELIGIBLE" };

/**
 * Section 6: idempotent create-or-open. The FIRST call for an
 * eligible case creates the Blueprint parent + its revision 1 (DRAFT);
 * every subsequent call simply reselects and returns the existing
 * parent and its current revision -- never a duplicate (the partial
 * unique index on `pathways_case_id` is the unconditional backstop
 * against a genuine concurrent first call). Eligibility (section 1) is
 * re-checked fresh on every call, never cached: a completed Planning
 * Call with outcome CONTINUE_TO_BLUEPRINT, via the UNCHANGED
 * `isBlueprintReady`.
 */
export async function createOrOpenBlueprint(
  db: Database,
  input: { pathwaysCaseId: string; advisorUserId: string },
): Promise<CreateOrOpenBlueprintResult> {
  try {
    await assertAdvisorCanAccessPathwaysCase(db, input.advisorUserId, input.pathwaysCaseId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
    throw err;
  }

  const [caseRow] = await db
    .select({ id: pathwaysCase.id, profileRevisionId: pathwaysCase.profileRevisionId, reportSnapshotId: pathwaysCase.reportSnapshotId })
    .from(pathwaysCase)
    .where(eq(pathwaysCase.id, input.pathwaysCaseId))
    .limit(1);
  if (!caseRow) return { ok: false, reason: "CASE_NOT_FOUND" };

  async function selectExisting(): Promise<CreateOrOpenBlueprintResult | null> {
    const [existingBlueprint] = await db
      .select({ id: studentSuccessBlueprint.id })
      .from(studentSuccessBlueprint)
      .where(eq(studentSuccessBlueprint.pathwaysCaseId, input.pathwaysCaseId))
      .limit(1);
    if (!existingBlueprint) return null;

    const [currentRevision] = await db
      .select({ id: blueprintRevision.id })
      .from(blueprintRevision)
      .where(and(eq(blueprintRevision.blueprintId, existingBlueprint.id), eq(blueprintRevision.isCurrent, true)))
      .limit(1);
    if (!currentRevision) throw new Error("Blueprint exists with no current revision -- invariant violated.");
    return { ok: true, blueprintId: existingBlueprint.id, revisionId: currentRevision.id, created: false };
  }

  const existingResult = await selectExisting();
  if (existingResult) return existingResult;

  const planningCall = await getPrimaryPlanningCallRecord(db, input.pathwaysCaseId);
  if (!isBlueprintReady(planningCall)) return { ok: false, reason: "NOT_ELIGIBLE" };
  const record = planningCall!;

  const blueprintId = generateId("blueprint");
  const revisionId = generateId("bprev");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(studentSuccessBlueprint).values({ id: blueprintId, pathwaysCaseId: input.pathwaysCaseId });
      await tx.insert(blueprintRevision).values({
        id: revisionId,
        blueprintId,
        revisionNumber: 1,
        status: "DRAFT",
        isCurrent: true,
        authoringAdvisorUserId: input.advisorUserId,
        lastEditedByUserId: input.advisorUserId,
        contentSchemaVersion: CONTENT_SCHEMA_VERSION,
        content: emptyBlueprintContent(),
        sourceProfileRevisionId: caseRow.profileRevisionId,
        sourceReportSnapshotId: caseRow.reportSnapshotId,
        sourcePlanningCallRecordId: record.id,
        sourcePlanningCallRecordVersion: record.version,
        version: 1,
      });
      await recordAuditEvent(tx, {
        action: "BLUEPRINT_CREATED",
        targetType: "StudentSuccessBlueprint",
        targetId: blueprintId,
        actorUserId: input.advisorUserId,
      });
    });
  } catch (err) {
    if (!isUniqueConstraintConflict(err, STUDENT_SUCCESS_BLUEPRINT_CASE_CONSTRAINT)) throw err;
    // A genuine concurrent first call won the race -- never fabricate a
    // second parent. Re-select the one that actually exists instead.
    const existingAfterConflict = await selectExisting();
    if (!existingAfterConflict) throw err;
    return existingAfterConflict;
  }

  return { ok: true, blueprintId, revisionId, created: true };
}

async function loadEditableRevision(
  db: Queryable,
  pathwaysCaseId: string,
  revisionId: string,
) {
  const [row] = await db
    .select({ revision: blueprintRevision })
    .from(blueprintRevision)
    .innerJoin(studentSuccessBlueprint, eq(blueprintRevision.blueprintId, studentSuccessBlueprint.id))
    .where(and(eq(blueprintRevision.id, revisionId), eq(studentSuccessBlueprint.pathwaysCaseId, pathwaysCaseId)))
    .limit(1);
  return row?.revision ?? null;
}

export type SaveBlueprintDraftResult =
  | { ok: true; revisionId: string; version: number }
  | {
      ok: false;
      reason: "NOT_AUTHORIZED" | "REVISION_NOT_FOUND" | "NOT_EDITABLE" | "VERSION_CONFLICT" | "INVALID_CONTENT";
    };

/**
 * Section 8, 19: content edits are legal while the revision is DRAFT
 * or INTERNAL_REVIEW (self-review is not a lock -- only
 * READY_FOR_CLIENT is immutable). `expectedVersion` must match the
 * row's current `version` or the save is rejected as a
 * VERSION_CONFLICT rather than silently overwriting a newer save from
 * another tab/session. `content` is strictly re-validated on every
 * write via `parseBlueprintContent` -- never trusted as already-valid
 * merely because it round-tripped through a form.
 */
export async function saveBlueprintDraft(
  db: Database,
  input: { pathwaysCaseId: string; revisionId: string; advisorUserId: string; expectedVersion: number; content: unknown },
): Promise<SaveBlueprintDraftResult> {
  try {
    await assertAdvisorCanAccessPathwaysCase(db, input.advisorUserId, input.pathwaysCaseId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
    throw err;
  }

  let parsedContent: BlueprintContent;
  try {
    parsedContent = parseBlueprintContent(input.content);
  } catch {
    return { ok: false, reason: "INVALID_CONTENT" };
  }

  const revision = await loadEditableRevision(db, input.pathwaysCaseId, input.revisionId);
  if (!revision) return { ok: false, reason: "REVISION_NOT_FOUND" };
  if (revision.status !== "DRAFT" && revision.status !== "INTERNAL_REVIEW") {
    return { ok: false, reason: "NOT_EDITABLE" };
  }
  if (revision.version !== input.expectedVersion) return { ok: false, reason: "VERSION_CONFLICT" };

  const now = new Date();
  const [updated] = await db
    .update(blueprintRevision)
    .set({ content: parsedContent, lastEditedByUserId: input.advisorUserId, version: revision.version + 1, updatedAt: now })
    .where(and(eq(blueprintRevision.id, revision.id), eq(blueprintRevision.version, input.expectedVersion)))
    .returning({ id: blueprintRevision.id, version: blueprintRevision.version });
  if (!updated) return { ok: false, reason: "VERSION_CONFLICT" };

  await recordAuditEvent(db, {
    action: "BLUEPRINT_DRAFT_SAVED",
    targetType: "BlueprintRevision",
    targetId: updated.id,
    actorUserId: input.advisorUserId,
  });
  return { ok: true, revisionId: updated.id, version: updated.version };
}

export type MoveToInternalReviewResult =
  | { ok: true; revisionId: string }
  | { ok: false; reason: "NOT_AUTHORIZED" | "REVISION_NOT_FOUND" | "INVALID_TRANSITION" };

export async function moveBlueprintToInternalReview(
  db: Database,
  input: { pathwaysCaseId: string; revisionId: string; advisorUserId: string },
): Promise<MoveToInternalReviewResult> {
  try {
    await assertAdvisorCanAccessPathwaysCase(db, input.advisorUserId, input.pathwaysCaseId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
    throw err;
  }

  const revision = await loadEditableRevision(db, input.pathwaysCaseId, input.revisionId);
  if (!revision) return { ok: false, reason: "REVISION_NOT_FOUND" };
  if (!isValidBlueprintRevisionStatusTransition(revision.status, "INTERNAL_REVIEW")) {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }

  await db
    .update(blueprintRevision)
    .set({ status: "INTERNAL_REVIEW", updatedAt: new Date() })
    .where(eq(blueprintRevision.id, revision.id));

  await recordAuditEvent(db, {
    action: "BLUEPRINT_MOVED_TO_REVIEW",
    targetType: "BlueprintRevision",
    targetId: revision.id,
    actorUserId: input.advisorUserId,
  });
  return { ok: true, revisionId: revision.id };
}

export type MarkReadyForClientResult =
  | { ok: true; revisionId: string; readyForClientAt: string }
  | {
      ok: false;
      reason: "NOT_AUTHORIZED" | "REVISION_NOT_FOUND" | "INVALID_TRANSITION" | "INCOMPLETE";
      issues?: string[];
    };

/**
 * Section 30, 33-34: the completeness gate (completenessIssues) is the
 * only thing standing between INTERNAL_REVIEW and READY_FOR_CLIENT --
 * once past it, this revision's `content` is never updated by any
 * function in this module again. If this is revision N>1, the prior
 * revision (N-1) is transitioned READY_FOR_CLIENT -> SUPERSEDED in the
 * SAME transaction, now, not at the moment the new revision was
 * created.
 */
export async function markBlueprintReadyForClient(
  db: Database,
  input: { pathwaysCaseId: string; revisionId: string; advisorUserId: string },
): Promise<MarkReadyForClientResult> {
  try {
    await assertAdvisorCanAccessPathwaysCase(db, input.advisorUserId, input.pathwaysCaseId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
    throw err;
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ revision: blueprintRevision })
      .from(blueprintRevision)
      .innerJoin(studentSuccessBlueprint, eq(blueprintRevision.blueprintId, studentSuccessBlueprint.id))
      .where(and(eq(blueprintRevision.id, input.revisionId), eq(studentSuccessBlueprint.pathwaysCaseId, input.pathwaysCaseId)))
      .for("update")
      .limit(1);
    if (!row) return { ok: false, reason: "REVISION_NOT_FOUND" };
    const revision = row.revision;

    if (!isValidBlueprintRevisionStatusTransition(revision.status, "READY_FOR_CLIENT")) {
      return { ok: false, reason: "INVALID_TRANSITION" };
    }

    const issues = completenessIssues(parseBlueprintContent(revision.content));
    if (issues.length > 0) return { ok: false, reason: "INCOMPLETE", issues };

    const now = new Date();
    await tx
      .update(blueprintRevision)
      .set({ status: "READY_FOR_CLIENT", readyForClientAt: now, updatedAt: now })
      .where(eq(blueprintRevision.id, revision.id));
    await recordAuditEvent(tx, {
      action: "BLUEPRINT_READY_FOR_CLIENT",
      targetType: "BlueprintRevision",
      targetId: revision.id,
      actorUserId: input.advisorUserId,
    });

    if (revision.revisionNumber > 1) {
      const [prior] = await tx
        .select({ id: blueprintRevision.id, status: blueprintRevision.status })
        .from(blueprintRevision)
        .where(
          and(
            eq(blueprintRevision.blueprintId, revision.blueprintId),
            eq(blueprintRevision.revisionNumber, revision.revisionNumber - 1),
          ),
        )
        .limit(1);
      if (prior && prior.status === "READY_FOR_CLIENT") {
        await tx.update(blueprintRevision).set({ status: "SUPERSEDED", updatedAt: now }).where(eq(blueprintRevision.id, prior.id));
        await recordAuditEvent(tx, {
          action: "BLUEPRINT_REVISION_SUPERSEDED",
          targetType: "BlueprintRevision",
          targetId: prior.id,
          actorUserId: input.advisorUserId,
        });
      }
    }

    return { ok: true, revisionId: revision.id, readyForClientAt: now.toISOString() };
  });
}

export type CreateNewRevisionResult =
  | { ok: true; revisionId: string; revisionNumber: number }
  | { ok: false; reason: "NOT_AUTHORIZED" | "BLUEPRINT_NOT_FOUND" | "CURRENT_NOT_READY" | "REASON_REQUIRED" };

/**
 * Section 12, 34: only legal from a current revision already
 * READY_FOR_CLIENT, and only with an explicit, controlled
 * `revisionReason`. The new revision starts from the prior revision's
 * own content (an amendment, not a blank slate), status DRAFT,
 * `isCurrent=true` immediately -- but the prior revision's `status`
 * stays READY_FOR_CLIENT until THIS new revision itself later reaches
 * READY_FOR_CLIENT (see markBlueprintReadyForClient).
 */
export async function createNewBlueprintRevision(
  db: Database,
  input: {
    pathwaysCaseId: string;
    advisorUserId: string;
    revisionReason: BlueprintRevisionReason;
    revisionReasonOther?: string;
  },
): Promise<CreateNewRevisionResult> {
  try {
    await assertAdvisorCanAccessPathwaysCase(db, input.advisorUserId, input.pathwaysCaseId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
    throw err;
  }
  if (!input.revisionReason) return { ok: false, reason: "REASON_REQUIRED" };

  const [caseRow] = await db
    .select({ profileRevisionId: pathwaysCase.profileRevisionId, reportSnapshotId: pathwaysCase.reportSnapshotId })
    .from(pathwaysCase)
    .where(eq(pathwaysCase.id, input.pathwaysCaseId))
    .limit(1);
  if (!caseRow) return { ok: false, reason: "BLUEPRINT_NOT_FOUND" };

  const [blueprintRow] = await db
    .select({ id: studentSuccessBlueprint.id })
    .from(studentSuccessBlueprint)
    .where(eq(studentSuccessBlueprint.pathwaysCaseId, input.pathwaysCaseId))
    .limit(1);
  if (!blueprintRow) return { ok: false, reason: "BLUEPRINT_NOT_FOUND" };

  const planningCall = await getPrimaryPlanningCallRecord(db, input.pathwaysCaseId);
  if (!planningCall) return { ok: false, reason: "BLUEPRINT_NOT_FOUND" };

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ revision: blueprintRevision })
      .from(blueprintRevision)
      .where(and(eq(blueprintRevision.blueprintId, blueprintRow.id), eq(blueprintRevision.isCurrent, true)))
      .for("update")
      .limit(1);
    if (!current) return { ok: false, reason: "BLUEPRINT_NOT_FOUND" };
    if (current.revision.status !== "READY_FOR_CLIENT") return { ok: false, reason: "CURRENT_NOT_READY" };

    const now = new Date();
    const newRevisionNumber = current.revision.revisionNumber + 1;
    const newId = generateId("bprev");

    // Section 6/34: `isCurrent` must move atomically within this
    // transaction -- the old row is set false BEFORE the new row is
    // inserted true, so the partial unique index never sees two
    // `isCurrent=true` rows for this blueprint at once.
    await tx.update(blueprintRevision).set({ isCurrent: false, updatedAt: now }).where(eq(blueprintRevision.id, current.revision.id));

    await tx.insert(blueprintRevision).values({
      id: newId,
      blueprintId: blueprintRow.id,
      revisionNumber: newRevisionNumber,
      status: "DRAFT",
      isCurrent: true,
      authoringAdvisorUserId: input.advisorUserId,
      lastEditedByUserId: input.advisorUserId,
      contentSchemaVersion: CONTENT_SCHEMA_VERSION,
      content: parseBlueprintContent(current.revision.content),
      sourceProfileRevisionId: caseRow.profileRevisionId,
      sourceReportSnapshotId: caseRow.reportSnapshotId,
      sourcePlanningCallRecordId: planningCall.id,
      sourcePlanningCallRecordVersion: planningCall.version,
      version: 1,
      revisionReason: input.revisionReason,
      revisionReasonOther: input.revisionReasonOther ? sanitizeText(input.revisionReasonOther) : null,
    });

    await recordAuditEvent(tx, {
      action: "BLUEPRINT_REVISION_CREATED",
      targetType: "BlueprintRevision",
      targetId: newId,
      actorUserId: input.advisorUserId,
      metadata: { revisionNumber: newRevisionNumber, revisionReason: input.revisionReason },
    });

    return { ok: true, revisionId: newId, revisionNumber: newRevisionNumber };
  });
}
