import "server-only";
import type { StageId } from "./types";

/**
 * Parent-facing stage grouping (Phase 3 instruction §10). Presentation
 * only: this file decides display order and section headings, never
 * a question's meaning, requiredness, or active/inactive status --
 * that is entirely branching.ts's job. A field not currently active
 * (per computeActiveFlow) is simply skipped wherever it would have
 * appeared; the underlying DISC id and stage grouping never change.
 */

export const STAGE_LABELS: Record<StageId, string> = {
  STUDENT: "Student",
  GOALS: "Goals",
  LEARNING: "Learning",
  SCHEDULE: "Schedule",
  ATHLETICS: "Athletics",
  PLANNING: "Planning",
  FAMILY: "Family",
  REVIEW: "Review",
};

/** Every non-REVIEW stage, in the order a family walks through them. */
export const STAGE_ORDER: readonly Exclude<StageId, "REVIEW">[] = [
  "STUDENT",
  "GOALS",
  "LEARNING",
  "SCHEDULE",
  "ATHLETICS",
  "PLANNING",
  "FAMILY",
];

const STAGE_FIELDS: Record<Exclude<StageId, "REVIEW">, readonly string[]> = {
  STUDENT: [
    "student_display_name",
    "current_grade",
    "student_age",
    "residence",
    "current_education_model",
    "school_change_preference",
  ],
  GOALS: [
    "discovery_reasons",
    "primary_discovery_reason",
    "desired_primary_change",
    "family_priorities",
  ],
  LEARNING: [
    "reported_academic_position",
    "reported_support_needs",
    "learning_support_pattern",
    "preferred_learning_environment",
    "foundational_learning_priorities",
    "subject_advancement_interests",
  ],
  SCHEDULE: [
    "flexibility_importance",
    "flexibility_reasons",
    "preferred_academic_time",
    "unavailable_academic_times",
    "desired_delivery",
  ],
  ATHLETICS: [
    "primary_sport",
    "athletic_level",
    "weekly_athletic_commitment",
    "athletic_travel_frequency",
    "college_athletics_interest",
    "ncaa_interest",
  ],
  PLANNING: [
    "reclassification_interest",
    "advancement_interests",
    "college_intent",
    "reported_graduation_status",
    "credit_recovery_need",
  ],
  FAMILY: [
    "daytime_support_person",
    "in_person_peer_preference",
    "daytime_support_availability",
    "desired_parent_involvement",
    "cost_preference",
    "desired_start_timeline",
    "parent_context",
  ],
};

const FIELD_TO_STAGE = new Map<string, StageId>();
for (const stage of STAGE_ORDER) {
  for (const field of STAGE_FIELDS[stage]) {
    FIELD_TO_STAGE.set(field, stage);
  }
}

/** Every valid stage id, including REVIEW -- for validating a `?stage=` URL param against something real. */
export const ALL_STAGE_IDS: readonly StageId[] = [...STAGE_ORDER, "REVIEW"];

function getStageForField(field: string): StageId | undefined {
  return FIELD_TO_STAGE.get(field);
}

/** The active fields for one stage, in this file's presentation order -- intersected with (and filtered by) the caller's currently-active field list. */
export function fieldsForStage(stage: Exclude<StageId, "REVIEW">, activeFields: readonly string[]): string[] {
  const active = new Set(activeFields);
  return STAGE_FIELDS[stage].filter((field) => active.has(field));
}
