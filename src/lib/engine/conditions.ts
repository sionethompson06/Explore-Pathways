import type { EffectiveAnswers } from "@/lib/discovery/types";
import type { RuleCondition } from "@/lib/contracts/schemas";

/**
 * Typed condition evaluation over an already-computed EffectiveAnswers.
 * Only the three closed operators declared in contracts/rules.json's
 * schema (eq, in, contains_any) are supported -- there is no dynamic
 * eval and no arbitrary JavaScript from JSON
 * (PHASE4_DECISION_ENGINE_SPEC_V1.md section 31).
 */

/**
 * A rule condition field is either a raw question-bank field (read from
 * `effective.answers`) or a declared derived-fact field (read from
 * `effective.derived`, per rules.json's `normalized_fact_fields`).
 * Contract validation (src/lib/contracts/validate.ts) already guarantees
 * every condition field is one or the other -- this function is not
 * itself a validation step.
 */
export function readConditionField(
  effective: EffectiveAnswers,
  normalizedFactFields: readonly string[],
  field: string,
): unknown {
  if (normalizedFactFields.includes(field)) {
    return (effective.derived as unknown as Record<string, unknown>)[field];
  }
  return effective.answers[field];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

export function evaluateCondition(
  effective: EffectiveAnswers,
  normalizedFactFields: readonly string[],
  condition: RuleCondition,
): boolean {
  const actual = readConditionField(effective, normalizedFactFields, condition.field);

  switch (condition.op) {
    case "eq":
      return actual === condition.value;
    case "in": {
      const allowed = Array.isArray(condition.value) ? condition.value : [condition.value];
      return typeof actual === "string" && (allowed as string[]).includes(actual);
    }
    case "contains_any": {
      const candidates = Array.isArray(condition.value) ? condition.value : [condition.value];
      const actualArray = asStringArray(actual);
      return (candidates as string[]).some((c) => actualArray.includes(c));
    }
    default:
      return false;
  }
}

export function evaluateAllConditions(
  effective: EffectiveAnswers,
  normalizedFactFields: readonly string[],
  conditions: readonly RuleCondition[],
): boolean {
  return conditions.every((condition) =>
    evaluateCondition(effective, normalizedFactFields, condition),
  );
}
