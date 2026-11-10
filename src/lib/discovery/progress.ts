import "server-only";
import { computeActiveFlow } from "./branching";
import { getQuestionByField } from "./registry";
import { STAGE_LABELS, STAGE_ORDER, fieldsForStage } from "./stages";
import type { RawAnswers, StageId } from "./types";

/**
 * Adaptive progress (Phase 3 instruction §32): computed fresh from
 * the CURRENT active flow every time, never against the full
 * 39-question registry and never presented as a fixed "question N of
 * 39." A stage's `total`/`answered` can both change the moment an
 * earlier answer opens or closes a branch -- that is expected, not an
 * error state.
 */

export interface StageProgress {
  id: StageId;
  label: string;
  total: number;
  answered: number;
  complete: boolean;
}

export interface ProgressResult {
  stages: StageProgress[];
  /** The first stage with an incomplete required question, or "REVIEW" if every active required question is answered. */
  currentStageId: StageId;
  isReadyForReview: boolean;
}

function isRequiredAndAnswered(field: string, raw: RawAnswers): { required: boolean; answered: boolean } {
  const question = getQuestionByField(field);
  if (!question) return { required: false, answered: true };
  return { required: question.required_when_shown, answered: raw[field] !== undefined };
}

export function computeProgress(raw: RawAnswers): ProgressResult {
  const { activeFields } = computeActiveFlow(raw);
  let currentStageId: StageId = "REVIEW";
  let foundIncomplete = false;

  const stages: StageProgress[] = STAGE_ORDER.map((stageId) => {
    const fields = fieldsForStage(stageId, activeFields);
    let answered = 0;
    let stageComplete = true;
    for (const field of fields) {
      const { required, answered: hasAnswer } = isRequiredAndAnswered(field, raw);
      if (hasAnswer) answered += 1;
      if (required && !hasAnswer) stageComplete = false;
    }
    if (!stageComplete && !foundIncomplete) {
      currentStageId = stageId;
      foundIncomplete = true;
    }
    return {
      id: stageId,
      label: STAGE_LABELS[stageId],
      total: fields.length,
      answered,
      complete: stageComplete,
    };
  });

  return { stages, currentStageId, isReadyForReview: !foundIncomplete };
}
