import { createHash } from "node:crypto";
import type { EffectiveAnswers } from "@/lib/discovery/types";

/**
 * Deterministic hashing for EngineEvaluation provenance (section 34).
 * No randomness, no wall-clock, no object-insertion-order dependence --
 * `canonicalStringify` sorts every object's keys recursively before
 * hashing, so the same logical value always hashes identically
 * regardless of how it was constructed.
 */

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf-8").digest("hex");
}

/** Hashes the FULL effective profile (answers + derived), including *_other_text sidecar fields -- this hash MAY legitimately differ when only free-text elaboration changes (M03). */
export function hashEffectiveProfile(effective: EffectiveAnswers): string {
  return sha256Hex(canonicalStringify(effective));
}

/**
 * Fields that can never contribute to any rule condition, B01 continuity
 * logic, or scoring (contracts/rules.json contract-validation guarantees
 * and PHASE4_DECISION_ENGINE_SPEC_V1.md section 33) -- stripped before
 * hashing so the decision-input hash reflects only what the decision
 * body actually depends on.
 */
const DECISION_IRRELEVANT_FIELD_SUFFIXES = ["_other_text"];
const DECISION_IRRELEVANT_FIELDS = ["desired_start_timeline", "parent_context"];

function isDecisionIrrelevantField(field: string): boolean {
  return (
    DECISION_IRRELEVANT_FIELDS.includes(field) ||
    DECISION_IRRELEVANT_FIELD_SUFFIXES.some((suffix) => field.endsWith(suffix))
  );
}

/** Hashes only the decision-relevant subset of the effective profile -- see isDecisionIrrelevantField. */
export function hashDecisionInput(effective: EffectiveAnswers): string {
  const filteredAnswers: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(effective.answers)) {
    if (!isDecisionIrrelevantField(field)) filteredAnswers[field] = value;
  }
  return sha256Hex(canonicalStringify({ answers: filteredAnswers, derived: effective.derived }));
}
