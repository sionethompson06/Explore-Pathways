import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { discoverySession, profileRevision, studentPathwayRecord } from "@/db/schema";
import { generateId } from "./ids";
import { createGuestSession, getGuestSessionByToken, type IssuedGuestSession } from "./session";
import { QUESTION_BANK_VERSION } from "@/lib/discovery/registry";
import { computeActiveFlow } from "@/lib/discovery/branching";
import {
  sanitizeText,
  validateCompletedProfile,
  validateDraftPatch,
} from "@/lib/discovery/validation";
import type {
  DraftValidationResult,
  FieldValidationError,
  RawAnswers,
  RawAnswerValue,
} from "@/lib/discovery/types";
import { isGoalInterest, type GoalInterest } from "@/content/goals";

/**
 * Server-authoritative Discovery draft persistence (Phase 3
 * instructions §7-9, §27-28, §36-39). Every function here takes an
 * already-authenticated session id or token -- callers (route
 * handlers / server actions) are responsible for reading the
 * HttpOnly cookie and never trust a client-supplied session id
 * instead (see src/server/session.ts's own doc comment on the same
 * point).
 */

// ---------------------------------------------------------------------------
// Marketing interest handoff (§6)
// ---------------------------------------------------------------------------

/** Marketing-level interest id (src/content/goals.ts) -> canonical DISC_006 enum value. Never the reverse; never used to redefine a canonical value's meaning. */
const INTEREST_HINT_MAP: Record<GoalInterest, string> = {
  athletics: "ATHLETICS",
  flexible_schedule: "SCHEDULE_FLEXIBILITY",
  homeschool_support: "HOMESCHOOL",
  academic_challenge: "ACADEMIC_ACCELERATION",
  different_environment: "DIFFERENT_ENVIRONMENT",
  unsure: "EXPLORING",
};

export function mapMarketingInterestToHint(interest: string | null | undefined): string | null {
  if (!interest || !isGoalInterest(interest)) return null;
  return INTEREST_HINT_MAP[interest];
}

// ---------------------------------------------------------------------------
// Session start
// ---------------------------------------------------------------------------

/**
 * Starts (or is called to start) a guest Discovery session. Reuses
 * the existing generic guest-session primitive unchanged, then
 * records the current question-bank version and an optional,
 * EDITABLE marketing-interest hint -- never written into the
 * committed draft answers themselves (§6: "do not silently write it
 * as a confirmed education answer before the parent sees DISC_006").
 */
export async function startDiscoverySession(
  db: Database,
  interestHint: string | null,
): Promise<IssuedGuestSession> {
  const issued = await createGuestSession(db);
  await db
    .update(discoverySession)
    .set({
      draftQuestionBankVersion: QUESTION_BANK_VERSION,
      draftInterestHint: interestHint,
    })
    .where(eq(discoverySession.id, issued.id));
  return issued;
}

export interface ResumeOrStartResult {
  token: string;
  /** False when an existing valid session was resumed and no new cookie needs to be (re-)set. */
  isNew: boolean;
}

/**
 * Section 7's "create or resume the valid guest session," in one
 * place. An existing, still-valid token is resumed as-is (its
 * in-progress draft answers are never disturbed); only a missing or
 * expired token results in a new session. Either way, an explicit
 * fresh marketing interest hint is applied -- but only as the
 * editable preselection described in startDiscoverySession's doc
 * comment, never overwriting a real, already-saved discovery_reasons
 * answer.
 */
export async function resumeOrStartDiscoverySession(
  db: Database,
  existingToken: string | undefined,
  interestHint: string | null,
): Promise<ResumeOrStartResult> {
  if (existingToken) {
    const existing = await getGuestSessionByToken(db, existingToken);
    if (existing) {
      if (interestHint && existing.draftAnswers && !(existing.draftAnswers as RawAnswers).discovery_reasons) {
        await db
          .update(discoverySession)
          .set({ draftInterestHint: interestHint })
          .where(eq(discoverySession.id, existing.id));
      }
      return { token: existingToken, isNew: false };
    }
  }
  const issued = await startDiscoverySession(db, interestHint);
  return { token: issued.token, isNew: true };
}

// ---------------------------------------------------------------------------
// Draft load
// ---------------------------------------------------------------------------

export interface DraftView {
  sessionId: string;
  rawAnswers: RawAnswers;
  interestHint: string | null;
  studentPathwayRecordId: string | null;
  /** True when this session's question-bank version no longer matches the currently loaded registry (§50). */
  isStaleQuestionBankVersion: boolean;
}

/** Looks up a session by its raw bearer token (never by row id alone -- see session.ts). Returns null for missing/expired/unknown, indistinguishable to the caller. */
export async function loadDraftByToken(db: Database, token: string): Promise<DraftView | null> {
  const row = await getGuestSessionByToken(db, token);
  if (!row) return null;
  return {
    sessionId: row.id,
    rawAnswers: (row.draftAnswers ?? {}) as RawAnswers,
    interestHint: row.draftInterestHint,
    studentPathwayRecordId: row.studentPathwayRecordId,
    isStaleQuestionBankVersion: Boolean(
      row.draftQuestionBankVersion && row.draftQuestionBankVersion !== QUESTION_BANK_VERSION,
    ),
  };
}

// ---------------------------------------------------------------------------
// Draft save
// ---------------------------------------------------------------------------

export interface SaveDraftResult extends DraftValidationResult {
  activeFields?: string[];
}

/**
 * Validates and persists a partial answer update. Sanitizes every
 * short_text value before it ever reaches the database (§18) --
 * validation alone is not enough, since validation only rejects
 * *oversized* text, not markup. Clears the marketing preselection
 * hint the moment a real discovery_reasons answer is saved, since at
 * that point it has been confirmed-or-changed, not merely
 * pre-checked.
 */
export async function saveDraftPatch(
  db: Database,
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<SaveDraftResult> {
  const [row] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!row) {
    const notFound: FieldValidationError = {
      field: "session",
      questionId: "NONE",
      code: "UNKNOWN_FIELD",
      message: "This Discovery session could not be found.",
    };
    return { ok: false, errors: [notFound] };
  }

  const currentRaw = (row.draftAnswers ?? {}) as RawAnswers;
  const validation = validateDraftPatch(patch, currentRaw);
  if (!validation.ok) return validation;

  const sanitizedPatch: RawAnswers = {};
  for (const [field, value] of Object.entries(patch)) {
    sanitizedPatch[field] =
      typeof value === "string" ? sanitizeText(value) : (value as RawAnswerValue);
  }

  const merged: RawAnswers = { ...currentRaw, ...sanitizedPatch };
  const clearHint = Object.prototype.hasOwnProperty.call(sanitizedPatch, "discovery_reasons");

  await db
    .update(discoverySession)
    .set({
      draftAnswers: merged,
      draftQuestionBankVersion: QUESTION_BANK_VERSION,
      draftUpdatedAt: new Date(),
      ...(clearHint ? { draftInterestHint: null } : {}),
    })
    .where(eq(discoverySession.id, sessionId));

  return { ok: true, errors: [], activeFields: computeActiveFlow(merged).activeFields };
}

// ---------------------------------------------------------------------------
// Submission (§36-37)
// ---------------------------------------------------------------------------

/**
 * Idempotency key = a deterministic hash of (session, question-bank
 * version, canonicalized raw answers) -- not a client-supplied nonce.
 * A network retry of the exact same submit necessarily re-hashes to
 * the same key, so the database's unique index
 * (profile_revision_session_idempotency_unique_idx) rejects the
 * duplicate insert and the caller re-selects the already-created
 * revision instead of making a second one. An intentional edit
 * changes the raw answers and therefore the hash, so it always
 * produces a genuinely new key and a new revision -- with no
 * additional state to track across requests, and no reliance on
 * client-side nonce lifecycle.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value].map(canonicalize).sort();
  }
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function computeSubmissionIdempotencyKey(
  sessionId: string,
  questionBankVersion: string,
  rawAnswers: RawAnswers,
): string {
  const canonical = JSON.stringify(
    canonicalize({ sessionId, questionBankVersion, rawAnswers }),
  );
  return createHash("sha256").update(canonical).digest("hex");
}

const IDEMPOTENCY_CONSTRAINT_NAME = "profile_revision_session_idempotency_unique_idx";

function isIdempotencyConflict(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string; constraint?: string } } | undefined)?.cause;
  const code = cause?.code ?? (err as { code?: string } | undefined)?.code;
  const constraint =
    cause?.constraint ?? (err as { constraint?: string } | undefined)?.constraint;
  return code === "23505" && constraint === IDEMPOTENCY_CONSTRAINT_NAME;
}

export interface SubmitResult {
  ok: boolean;
  errors?: FieldValidationError[];
  revisionId?: string;
  revisionNumber?: number;
  studentPathwayRecordId?: string;
  /** True when this call returned a previously created revision rather than creating a new one. */
  replay?: boolean;
}

/**
 * The server-authoritative completion path. Recomputes and validates
 * everything from the stored draft -- never trusts a client-supplied
 * "this is done" flag or a client-supplied effective profile. Creates
 * at most one new StudentPathwayRecord (only if this session does not
 * already own one -- see reopenForEditing for the resubmit path) and
 * exactly one new ProfileRevision per genuinely new submission,
 * inside a single transaction.
 */
export async function submitDiscoveryProfile(
  db: Database,
  sessionId: string,
): Promise<SubmitResult> {
  const [row] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!row) {
    return {
      ok: false,
      errors: [
        {
          field: "session",
          questionId: "NONE",
          code: "UNKNOWN_FIELD",
          message: "This Discovery session could not be found.",
        },
      ],
    };
  }

  const rawAnswers = (row.draftAnswers ?? {}) as RawAnswers;
  const validation = validateCompletedProfile(rawAnswers);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }
  const effective = validation.effective!;
  const idempotencyKey = computeSubmissionIdempotencyKey(sessionId, QUESTION_BANK_VERSION, rawAnswers);

  return db.transaction(async (tx) => {
    let studentPathwayRecordId = row.studentPathwayRecordId;
    if (!studentPathwayRecordId) {
      studentPathwayRecordId = generateId("student");
      await tx.insert(studentPathwayRecord).values({ id: studentPathwayRecordId });
      await tx
        .update(discoverySession)
        .set({ studentPathwayRecordId })
        .where(eq(discoverySession.id, sessionId));
    }

    const [maxRevisionRow] = await tx
      .select({
        maxRevision: sql<number>`coalesce(max(${profileRevision.revisionNumber}), 0)`,
      })
      .from(profileRevision)
      .where(eq(profileRevision.studentPathwayRecordId, studentPathwayRecordId));
    const maxRevision = maxRevisionRow?.maxRevision ?? 0;

    const revisionId = generateId("rev");
    const revisionNumber = Number(maxRevision) + 1;

    // The insert runs inside a nested transaction (a SAVEPOINT) so
    // that a unique-constraint failure only rolls back to just before
    // the insert -- not the whole outer transaction -- letting the
    // idempotent-replay SELECT below still run in the same
    // transaction afterward. Postgres otherwise aborts an entire
    // transaction on any statement error (25P02) until rollback.
    try {
      await tx.transaction(async (tx2) => {
        await tx2.insert(profileRevision).values({
          id: revisionId,
          studentPathwayRecordId,
          discoverySessionId: sessionId,
          revisionNumber,
          rawAnswers,
          effectiveAnswers: effective,
          gradeBand: effective.derived.grade_band,
          questionBankVersion: QUESTION_BANK_VERSION,
          submissionIdempotencyKey: idempotencyKey,
        });
      });
      return { ok: true, revisionId, revisionNumber, studentPathwayRecordId, replay: false };
    } catch (err) {
      if (!isIdempotencyConflict(err)) throw err;
      const [existing] = await tx
        .select()
        .from(profileRevision)
        .where(
          and(
            eq(profileRevision.discoverySessionId, sessionId),
            eq(profileRevision.submissionIdempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (!existing) throw err; // Constraint name matched but the row vanished -- do not fabricate a result.
      return {
        ok: true,
        revisionId: existing.id,
        revisionNumber: existing.revisionNumber,
        studentPathwayRecordId,
        replay: true,
      };
    }
  });
}

// ---------------------------------------------------------------------------
// Reopen for editing (§39)
// ---------------------------------------------------------------------------

/**
 * Loads the latest completed revision's raw answers back into the
 * session's editable draft. Never mutates the existing
 * ProfileRevision -- historical revisions stay immutable; only a
 * fresh call to submitDiscoveryProfile (with the edited answers, thus
 * a new idempotency key) can create the next one.
 */
export async function reopenForEditing(db: Database, sessionId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!row?.studentPathwayRecordId) return false;

  const [latest] = await db
    .select()
    .from(profileRevision)
    .where(eq(profileRevision.studentPathwayRecordId, row.studentPathwayRecordId))
    .orderBy(desc(profileRevision.revisionNumber))
    .limit(1);
  if (!latest) return false;

  await db
    .update(discoverySession)
    .set({
      draftAnswers: latest.rawAnswers as RawAnswers,
      draftQuestionBankVersion: QUESTION_BANK_VERSION,
      draftUpdatedAt: new Date(),
    })
    .where(eq(discoverySession.id, sessionId));
  return true;
}

/** Whether this session already owns at least one completed profile revision -- used by /discover/report to decide the honest completion state. */
export async function hasCompletedRevision(db: Database, sessionId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(discoverySession)
    .where(eq(discoverySession.id, sessionId))
    .limit(1);
  if (!row?.studentPathwayRecordId) return false;
  const [existing] = await db
    .select({ id: profileRevision.id })
    .from(profileRevision)
    .where(eq(profileRevision.studentPathwayRecordId, row.studentPathwayRecordId))
    .limit(1);
  return Boolean(existing);
}
