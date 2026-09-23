import "server-only";
import { z } from "zod";
import { getQuestionByField, KNOWN_FIELDS } from "./registry";
import { computeActiveFlow } from "./branching";
import { LOCATION_STATE_VALUES } from "./labels";
import type {
  CompletedProfileValidationResult,
  DraftValidationResult,
  EffectiveAnswers,
  FieldValidationError,
  Question,
  RawAnswers,
  RawAnswerValue,
} from "./types";
import { computeEffectiveAnswers } from "./normalization";

/** Per-field text limits (Phase 3 instruction §18) -- not in the registry's own shape, so kept here alongside the rest of validation. */
const TEXT_MAX_LENGTH: Record<string, number> = {
  student_display_name: 40,
  primary_sport: 60,
  parent_context: 750,
};

/** Multi-select values that deselect every other choice when picked, per field. Defaults to whichever of NONE/UNKNOWN the question's own allowed_values contains. */
const EXTRA_EXCLUSIVE_VALUES: Record<string, string[]> = {
  discovery_reasons: ["EXPLORING"],
};

function exclusiveValuesFor(question: Question): string[] {
  const fromAllowed = (question.allowed_values ?? []).filter(
    (v) => v === "NONE" || v === "UNKNOWN",
  );
  return [...fromAllowed, ...(EXTRA_EXCLUSIVE_VALUES[question.field] ?? [])];
}

/**
 * Strips any markup and control characters from free text before it
 * is stored or rendered anywhere -- Phase 3 instruction §18 "Sanitize
 * free text. Do not render raw unsanitized HTML." Length limits are
 * enforced on the sanitized result, not the raw input, so markup
 * cannot be used to smuggle extra characters past the limit.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

function error(question: Question, code: FieldValidationError["code"], message: string): FieldValidationError {
  return { field: question.field, questionId: question.id, code, message };
}

const locationValueSchema = z.strictObject({
  state: z.enum(LOCATION_STATE_VALUES as [string, ...string[]]),
  zip: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "ZIP must look like 12345 or 12345-6789.")
    .optional(),
});

/**
 * Builds the Zod schema for one question's value shape (allowed
 * values, cardinality, text length, location shape). Every server
 * boundary in this module validates through one of these -- never a
 * hand-rolled `typeof` check -- per Phase 3 instruction §30 "Use Zod
 * at every server boundary." Cross-field concerns Zod alone cannot
 * express here (NONE/UNKNOWN exclusivity, and DISC_007's
 * single_from_previous dynamic allowed-set) are layered on top in
 * validateAnswerValue below, not inside this schema.
 */
function buildValueSchema(
  question: Question,
  context: { activeDiscoveryReasons?: string[] },
): z.ZodType {
  switch (question.input_type) {
    case "short_text": {
      const max = TEXT_MAX_LENGTH[question.field] ?? 750;
      return z.string().transform(sanitizeText).pipe(z.string().max(max));
    }
    case "single":
      return z.enum((question.allowed_values ?? []) as [string, ...string[]]);
    case "single_from_previous": {
      const allowed = context.activeDiscoveryReasons ?? [];
      if (allowed.length === 0) {
        // No valid choice can exist yet; any value is a fail.
        return z.never();
      }
      return z.enum(allowed as [string, ...string[]]);
    }
    case "multi": {
      const base = z.array(z.enum((question.allowed_values ?? []) as [string, ...string[]]));
      return question.max_selections
        ? base.max(question.max_selections, `Choose up to ${question.max_selections}.`)
        : base;
    }
    case "integer_or_unknown":
      return z.union([z.literal("UNKNOWN"), z.number().int().min(0).max(100)]);
    case "location":
      return locationValueSchema;
    default:
      return z.unknown();
  }
}

/**
 * Validates ONE field's value against its own question definition.
 * Does not know about branch activation or requiredness -- callers
 * (validateDraftPatch, validateCompletedProfile) apply that
 * separately, since a field can be a syntactically valid answer to a
 * question that is not currently active.
 */
export function validateAnswerValue(
  question: Question,
  value: RawAnswerValue,
  context: { activeDiscoveryReasons?: string[] } = {},
): FieldValidationError[] {
  if (value === undefined) return [];

  const schema = buildValueSchema(question, context);
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const isLengthIssue = issue?.code === "too_big" || issue?.code === "too_small";
    const code: FieldValidationError["code"] =
      question.input_type === "short_text" && isLengthIssue
        ? "TEXT_TOO_LONG"
        : question.input_type === "multi" && isLengthIssue
          ? "TOO_MANY_SELECTIONS"
          : question.input_type === "location" ||
              question.input_type === "integer_or_unknown" ||
              question.input_type === "short_text"
            ? "INVALID_SHAPE"
            : "INVALID_VALUE";
    return [error(question, code, issue?.message ?? "Not a valid answer.")];
  }

  if (question.input_type === "multi" && Array.isArray(value)) {
    const exclusive = exclusiveValuesFor(question);
    const chosenExclusive = value.filter((v) => exclusive.includes(v));
    if (chosenExclusive.length > 0 && value.length > chosenExclusive.length) {
      return [
        error(
          question,
          "INVALID_VALUE",
          `"${chosenExclusive[0]}" cannot be combined with another selection.`,
        ),
      ];
    }
  }

  return [];
}

/**
 * Validates a partial set of field updates from the client against
 * the CURRENT raw answers (so single_from_previous / NONE-UNKNOWN
 * exclusivity can be checked against up-to-date sibling values). Never
 * trusts the browser: an unknown field name is rejected outright, not
 * silently dropped.
 */
export function validateDraftPatch(
  patch: Record<string, unknown>,
  currentRaw: RawAnswers,
): DraftValidationResult {
  const errors: FieldValidationError[] = [];
  const merged: RawAnswers = { ...currentRaw };

  for (const [field, value] of Object.entries(patch)) {
    const question = getQuestionByField(field);
    if (!question || !KNOWN_FIELDS.has(field)) {
      errors.push({
        field,
        questionId: "UNKNOWN",
        code: "UNKNOWN_FIELD",
        message: `"${field}" is not a canonical Discovery field.`,
      });
      continue;
    }
    merged[field] = value as RawAnswerValue;
  }

  if (errors.length > 0) return { ok: false, errors };

  const activeDiscoveryReasons =
    (merged.discovery_reasons as string[] | undefined) ?? [];

  for (const [field, value] of Object.entries(patch)) {
    const question = getQuestionByField(field)!;
    errors.push(
      ...validateAnswerValue(question, value as RawAnswerValue, { activeDiscoveryReasons }),
    );
  }

  return { ok: errors.length === 0, errors };
}

/**
 * The server-authoritative completion check (Phase 3 instruction
 * §36): recomputes the active flow from raw answers, validates every
 * active field's value, requires a valid response for every active
 * required_when_shown question (an explicit UNKNOWN counts; a missing
 * key does not), and -- only if everything passes -- returns the
 * recomputed effective answers. The browser's own idea of what is
 * required or valid is never trusted here.
 */
export function validateCompletedProfile(raw: RawAnswers): CompletedProfileValidationResult {
  const { activeFields, primaryReason } = computeActiveFlow(raw);
  const activeSet = new Set(activeFields);
  const activeDiscoveryReasons = (raw.discovery_reasons as string[] | undefined) ?? [];
  const errors: FieldValidationError[] = [];

  for (const field of activeFields) {
    const question = getQuestionByField(field)!;
    const value = raw[field];

    if (question.required_when_shown && value === undefined) {
      errors.push(error(question, "REQUIRED", "This question needs an answer -- \"I'm not sure\" is fine."));
      continue;
    }

    errors.push(...validateAnswerValue(question, value, { activeDiscoveryReasons }));
  }

  // DISC_007, if active, must resolve to one of the current DISC_006
  // choices -- a value that fell out of sync (its reason deselected)
  // fails completion rather than silently reusing a stale answer.
  if (activeSet.has("primary_discovery_reason") && !primaryReason) {
    const question = getQuestionByField("primary_discovery_reason")!;
    errors.push(
      error(question, "REQUIRED", "Please choose which reason matters most right now."),
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const effective: EffectiveAnswers = computeEffectiveAnswers(raw);
  return { ok: true, errors: [], effective };
}

/** Exposed for the tests/UI: whether a value counts as "answered" (present), distinct from valid. */
export function isAnswered(value: RawAnswerValue): boolean {
  return value !== undefined;
}
