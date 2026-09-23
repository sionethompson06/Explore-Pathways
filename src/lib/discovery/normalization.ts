import "server-only";
import { computeActiveFlow } from "./branching";
import type { DerivedFacts, EffectiveAnswers, RawAnswers, RawAnswerValue } from "./types";

/**
 * Raw -> effective normalization (Phase 3 instructions §27/§28/§51).
 * Only currently-active fields are copied into `answers`; anything
 * behind a since-closed branch is neutralized here, on every call --
 * never patched in place on the stored raw answers, which are kept
 * exactly as the parent entered them. This is the ONLY function that
 * produces what a future recommendation engine, AI, report, or export
 * may read; nothing else in this codebase may reach into raw answers
 * directly for that purpose.
 */

function asStringArray(value: RawAnswerValue): string[] {
  return Array.isArray(value) ? value : [];
}

function includesAny(values: string[], candidates: readonly string[]): boolean {
  return values.some((v) => candidates.includes(v));
}

export function computeEffectiveAnswers(raw: RawAnswers): EffectiveAnswers {
  const { activeFields, gradeBand } = computeActiveFlow(raw);
  const activeSet = new Set(activeFields);

  const answers: Record<string, RawAnswerValue> = {};
  for (const field of activeFields) {
    const value = raw[field];
    if (value !== undefined) {
      answers[field] = value;
    }
  }

  const activeRaw = (field: string): RawAnswerValue => (activeSet.has(field) ? raw[field] : undefined);

  const athleticsInterest =
    asStringArray(raw.discovery_reasons).includes("ATHLETICS") ||
    includesAny(asStringArray(activeRaw("flexibility_reasons")), [
      "ATHLETIC_TRAINING",
      "COMPETITION",
      "ATHLETIC_TRAVEL",
    ]);

  const homeschoolInterest =
    asStringArray(raw.discovery_reasons).includes("HOMESCHOOL") ||
    asStringArray(raw.desired_delivery).includes("HOMESCHOOL");

  const homeOrOnlineInterest =
    homeschoolInterest ||
    includesAny(asStringArray(raw.desired_delivery), [
      "ONLINE_SELF_PACED",
      "ONLINE_TEACHER_SUPPORTED",
    ]) ||
    asStringArray(raw.discovery_reasons).includes("ONLINE");

  const travelFrequency = activeRaw("athletic_travel_frequency");
  const frequentTravel = travelFrequency === "SEVERAL_MONTH" || travelFrequency === "WEEKLY";

  const foundationConcern =
    includesAny(asStringArray(raw.reported_support_needs), [
      "PHONICS",
      "READING",
      "MATH",
      "WRITING",
    ]) ||
    asStringArray(activeRaw("foundational_learning_priorities")).some(
      (v) => v !== "NONE" && v !== "UNKNOWN",
    );

  const supplementalNeed =
    includesAny(asStringArray(raw.discovery_reasons), [
      "ACADEMIC_SUPPORT",
      "ACADEMIC_ACCELERATION",
      "ADVANCED_COURSES",
      "COLLEGE_ADVANCEMENT",
    ]) ||
    includesAny(asStringArray(raw.reported_support_needs), [
      "READING",
      "WRITING",
      "MATH",
      "SCIENCE",
      "STUDY_SKILLS",
    ]) ||
    asStringArray(activeRaw("advancement_interests")).some(
      (v) => v !== "NONE" && v !== "UNKNOWN",
    );

  const ncaaInterest = (activeRaw("ncaa_interest") as string | undefined) ?? "NOT_APPLICABLE";

  const derived: DerivedFacts = {
    grade_band: gradeBand,
    athletics_interest: athleticsInterest,
    homeschool_interest: homeschoolInterest,
    home_or_online_interest: homeOrOnlineInterest,
    frequent_travel: frequentTravel,
    foundation_concern: foundationConcern,
    supplemental_need: supplementalNeed,
    ncaa_interest: ncaaInterest,
  };

  return { answers, derived };
}
