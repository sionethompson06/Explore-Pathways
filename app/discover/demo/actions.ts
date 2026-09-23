"use server";

import {
  buildReviewSections,
  computeProgress,
  describeQuestionsForStage,
  getOptionLabelForQuestion,
  gradeBandFromGrade,
  validateCompletedProfile,
  validateDraftPatch,
  QUESTION_BANK_VERSION,
} from "@/lib/discovery";
import type { RawAnswers, StageId } from "@/lib/discovery/types";
import type {
  FieldErrorView,
  QuestionDescriptor,
  ReviewSection,
  StageProgressView,
} from "@/components/discovery/types";

/**
 * Preview Demo Mode (Phase 3C, instruction "PREVIEW DISCOVERY DEMO
 * MODE ONLY"): a stateless, database-free recompute layer. Every call
 * receives the ENTIRE current in-memory answer snapshot from the
 * client and returns a freshly recomputed view -- nothing is stored
 * here, and this file imports nothing from @/db, @/server/session, or
 * @/server/discovery-draft. It reuses the exact same canonical
 * registry/branching/normalization/validation/labeling functions the
 * real, database-backed Discovery flow uses (@/lib/discovery); there
 * is no second question bank and no duplicated branch or validation
 * logic anywhere in this file.
 */

export interface DemoState {
  stageId: StageId;
  stages: StageProgressView[];
  questions: QuestionDescriptor[];
  reviewSections: ReviewSection[];
  isReadyForReview: boolean;
  questionBankVersion: string;
  /** The homepage marketing-interest hint's human label, re-resolved against the CURRENT grade band every call (DEC-G6 parity) -- never stale. */
  interestHintLabel: string | null;
}

function buildState(
  rawAnswers: RawAnswers,
  requestedStageId: StageId | undefined,
  interestHint: string | null,
): DemoState {
  const progress = computeProgress(rawAnswers);
  const activeStages = progress.stages.filter((s) => s.total > 0);
  const validStageIds = new Set<string>([...activeStages.map((s) => s.id), "REVIEW"]);
  const stageId: StageId =
    requestedStageId && validStageIds.has(requestedStageId)
      ? requestedStageId
      : progress.currentStageId;

  const isReview = stageId === "REVIEW";
  const gradeBand = gradeBandFromGrade(
    typeof rawAnswers.current_grade === "string" ? rawAnswers.current_grade : undefined,
  );

  return {
    stageId,
    stages: activeStages,
    questions: isReview ? [] : describeQuestionsForStage(stageId, rawAnswers),
    reviewSections: isReview ? buildReviewSections(rawAnswers) : [],
    isReadyForReview: progress.isReadyForReview,
    questionBankVersion: QUESTION_BANK_VERSION,
    interestHintLabel: interestHint
      ? getOptionLabelForQuestion("discovery_reasons", interestHint, gradeBand)
      : null,
  };
}

/** Initial load and pure stage navigation (Back/Continue/Edit) -- no answer change, no validation. */
export async function computeDemoState(
  rawAnswers: RawAnswers,
  requestedStageId: StageId | undefined,
  interestHint: string | null,
): Promise<DemoState> {
  return buildState(rawAnswers, requestedStageId, interestHint);
}

export interface DemoCommitResult {
  ok: boolean;
  errors: FieldErrorView[];
  rawAnswers: RawAnswers;
  state: DemoState;
}

/**
 * One field commit. Validated with the same validateDraftPatch the
 * real saveAnswerAction uses (checked against the CURRENT snapshot so
 * single_from_previous / NONE-UNKNOWN exclusivity is checked against
 * up-to-date sibling answers) -- then the patch is merged into the
 * in-memory snapshot and echoed back to the client, which is the only
 * place this merged snapshot lives.
 */
export async function commitDemoAnswer(
  currentRaw: RawAnswers,
  patch: Record<string, unknown>,
  requestedStageId: StageId | undefined,
  interestHint: string | null,
): Promise<DemoCommitResult> {
  const validation = validateDraftPatch(patch, currentRaw);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map((e) => ({ field: e.field, message: e.message })),
      rawAnswers: currentRaw,
      state: buildState(currentRaw, requestedStageId, interestHint),
    };
  }

  const merged: RawAnswers = { ...currentRaw };
  for (const [field, value] of Object.entries(patch)) {
    merged[field] = value as RawAnswers[string];
  }

  return {
    ok: true,
    errors: [],
    rawAnswers: merged,
    state: buildState(merged, requestedStageId, interestHint),
  };
}

export interface DemoCompletionResult {
  ok: boolean;
  errors: FieldErrorView[];
}

/**
 * The same server-authoritative completeness check submitProfileAction
 * relies on (validateCompletedProfile) -- but this never writes
 * anything anywhere. A true result only unlocks the client's own
 * "Discovery Demo Complete" screen; it never generates a
 * recommendation, ranking, or pathway result (Phase 4 is not
 * authorized).
 */
export async function validateDemoCompletion(
  rawAnswers: RawAnswers,
): Promise<DemoCompletionResult> {
  const result = validateCompletedProfile(rawAnswers);
  if (!result.ok) {
    return { ok: false, errors: result.errors.map((e) => ({ field: e.field, message: e.message })) };
  }
  return { ok: true, errors: [] };
}
