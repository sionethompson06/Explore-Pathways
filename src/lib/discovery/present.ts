import "server-only";
import { getQuestionByField } from "./registry";
import { getOptionLabelForQuestion, getQuestionWording, LOCATION_STATE_VALUES } from "./labels";
import { computeActiveFlow } from "./branching";
import { STAGE_LABELS, STAGE_ORDER, fieldsForStage } from "./stages";
import type { GradeBand, RawAnswers, RawAnswerValue, StageId } from "./types";
import type {
  OptionDescriptor,
  QuestionDescriptor,
  ReviewSection,
} from "@/components/discovery/types";

/**
 * Builds the plain, serializable descriptors the Client Component
 * renders -- the ONE place question wording/options are resolved to
 * friendly, presentation-ready shapes before crossing the server/
 * client boundary (Phase 3 instruction §48). Nothing downstream of
 * this file re-labels a raw enum value.
 */

function describeQuestion(field: string, gradeBand: GradeBand): QuestionDescriptor | undefined {
  const question = getQuestionByField(field);
  if (!question) return undefined;

  // Phase 3E: when the registry defines a grade-tiered option set, the
  // NEW-entry list a family actually sees is that tier's list, not the
  // full `allowed_values` (which still includes every legacy/retired
  // value so historical raw answers keep validating and Review keeps
  // reading back correctly).
  const allowedValues = question.grade_band_allowed_values?.[gradeBand] ?? question.allowed_values;

  const options: OptionDescriptor[] | undefined = allowedValues?.map((value) => ({
    value,
    label: getOptionLabelForQuestion(field, value, gradeBand),
    ...(question.option_helpers?.[value] ? { helper: question.option_helpers[value] } : {}),
  }));

  const locationStates =
    question.input_type === "location"
      ? LOCATION_STATE_VALUES.map((value) => ({ value, label: getOptionLabelForQuestion(field, value, gradeBand) }))
      : undefined;

  const textMaxLength =
    field === "student_display_name"
      ? 40
      : field === "primary_sport"
        ? 60
        : field === "parent_context"
          ? 750
          : undefined;

  return {
    id: question.id,
    field: question.field,
    wording: getQuestionWording(field, gradeBand),
    inputType: question.input_type,
    required: question.required_when_shown,
    ...(options ? { options } : {}),
    ...(question.max_selections ? { maxSelections: question.max_selections } : {}),
    ...(textMaxLength ? { textMaxLength } : {}),
    ...(locationStates ? { locationStates } : {}),
    ...(question.helper_text ? { helperText: question.helper_text } : {}),
  };
}

/**
 * DISC_007's options are dynamic (restricted to the family's current
 * DISC_006 selections) -- resolved here from the live raw answers,
 * never from the static allowed_values list.
 */
function describeQuestionWithDynamicOptions(
  field: string,
  gradeBand: GradeBand,
  raw: RawAnswers,
): QuestionDescriptor | undefined {
  const base = describeQuestion(field, gradeBand);
  if (!base) return undefined;
  if (field !== "primary_discovery_reason") return base;

  const reasons = Array.isArray(raw.discovery_reasons) ? raw.discovery_reasons : [];
  return {
    ...base,
    options: reasons.map((value) => ({
      value,
      label: getOptionLabelForQuestion("discovery_reasons", value, gradeBand),
    })),
  };
}

export function describeQuestionsForStage(
  stage: Exclude<StageId, "REVIEW">,
  raw: RawAnswers,
): QuestionDescriptor[] {
  const { activeFields, gradeBand } = computeActiveFlow(raw);
  const fields = fieldsForStage(stage, activeFields);
  const descriptors: QuestionDescriptor[] = [];
  for (const field of fields) {
    const descriptor = describeQuestionWithDynamicOptions(field, gradeBand, raw);
    if (descriptor) descriptors.push(descriptor);
  }
  return descriptors;
}

function formatValueLabel(field: string, value: RawAnswerValue, gradeBand: GradeBand): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((v) => getOptionLabelForQuestion(field, v, gradeBand)).join(", ");
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const location = value as { state: string; zip?: string };
    const stateLabel = getOptionLabelForQuestion("residence", location.state, gradeBand);
    return location.zip ? `${stateLabel} (${location.zip})` : stateLabel;
  }
  return getOptionLabelForQuestion(field, value, gradeBand);
}

/** Every currently ACTIVE and ANSWERED field, grouped by stage, for the Review screen -- never a hidden/stale answer. */
export function buildReviewSections(raw: RawAnswers): ReviewSection[] {
  const { activeFields, gradeBand } = computeActiveFlow(raw);
  const activeSet = new Set(activeFields);

  const sections: ReviewSection[] = [];
  for (const stage of STAGE_ORDER) {
    const fields = fieldsForStage(stage, activeFields);
    const items = fields
      .filter((field) => activeSet.has(field) && raw[field] !== undefined)
      .map((field) => {
        const question = getQuestionByField(field)!;
        return {
          field,
          wording: getQuestionWording(field, gradeBand),
          valueLabel: formatValueLabel(field, raw[field], gradeBand),
        };
      })
      .filter((item) => item.valueLabel.length > 0);
    if (items.length > 0) {
      sections.push({ stageId: stage, stageLabel: STAGE_LABELS[stage], items });
    }
  }
  return sections;
}
