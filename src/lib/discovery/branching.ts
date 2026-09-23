import "server-only";
import { QUESTIONS, getQuestionByField } from "./registry";
import type { GradeBand, RawAnswers, RawAnswerValue } from "./types";

/**
 * The single shared branching module (Phase 3 instruction §12/§29):
 * grade-band derivation, every named branch predicate, and the
 * ordered active-question computation. Both the Server Component
 * flow and server actions (draft save, submission validation) import
 * this file; nothing re-implements branching in a Client Component or
 * a second server module.
 *
 * Evaluation order matters: a branch predicate may read another
 * question's *raw* answer only if that question is guaranteed already
 * evaluated (and found active or inactive) earlier in
 * `EVALUATION_ORDER` below. This makes "is DISC_014 active" resolved
 * before "does ATHLETICS_INTEREST read DISC_014's raw value" ever
 * runs, so a stale raw answer behind a since-closed branch is never
 * mistaken for a live one (Phase 3 instruction §28, "hidden answer
 * neutralization").
 */

function asStringValue(value: RawAnswerValue): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: RawAnswerValue): string[] {
  return Array.isArray(value) ? value : [];
}

function includesAny(values: string[], candidates: readonly string[]): boolean {
  return values.some((v) => candidates.includes(v));
}

export function gradeBandFromGrade(grade: string | undefined): GradeBand {
  if (!grade) return "UNDETERMINED";
  if (["K", "1", "2", "3", "4"].includes(grade)) return "ELEMENTARY";
  if (["5", "6", "7", "8"].includes(grade)) return "MIDDLE";
  if (["9", "10", "11", "12"].includes(grade)) return "HIGH_SCHOOL";
  return "UNDETERMINED"; // OTHER or UNKNOWN, per instruction §11 -- never inferred from age.
}

/**
 * If exactly one nonexclusive Discovery reason is selected, it is the
 * effective primary reason with no DISC_007 shown (§13). If two or
 * more, the effective primary reason is whatever DISC_007 currently
 * holds, restricted to the current DISC_006 selections; an
 * out-of-sync DISC_007 answer (its reason no longer selected) is
 * treated as unresolved, not as a stale truth.
 */
export function derivePrimaryReason(raw: RawAnswers): string | undefined {
  const reasons = asStringArray(raw.discovery_reasons);
  if (reasons.length === 0) return undefined;
  if (reasons.length === 1) return reasons[0];
  const chosen = asStringValue(raw.primary_discovery_reason);
  if (chosen && reasons.includes(chosen)) return chosen;
  return undefined;
}

// ---------------------------------------------------------------------------
// Branch predicates. Each takes the raw answers plus already-resolved
// context (grade band, primary reason, and an `isActive` lookup for
// questions evaluated earlier in EVALUATION_ORDER).
// ---------------------------------------------------------------------------

interface BranchContext {
  raw: RawAnswers;
  gradeBand: GradeBand;
  primaryReason: string | undefined;
  isActive: (field: string) => boolean;
}

function rawIfActive(ctx: BranchContext, field: string): RawAnswerValue {
  return ctx.isActive(field) ? ctx.raw[field] : undefined;
}

export function isMultipleDiscoveryReasons(ctx: BranchContext): boolean {
  return asStringArray(ctx.raw.discovery_reasons).length >= 2;
}

/** Primary reason is OTHER/EXPLORING, or not yet resolvable at all (see derivePrimaryReason). */
export function isPrimaryReasonUnclear(ctx: BranchContext): boolean {
  if (!ctx.primaryReason) return true;
  return ctx.primaryReason === "OTHER" || ctx.primaryReason === "EXPLORING";
}

export function isFlexibilitySomewhatOrHigher(ctx: BranchContext): boolean {
  const value = asStringValue(ctx.raw.flexibility_importance);
  return value === "SOMEWHAT" || value === "VERY_IMPORTANT" || value === "ESSENTIAL";
}

export function isFlexibilityVeryOrEssential(ctx: BranchContext): boolean {
  const value = asStringValue(ctx.raw.flexibility_importance);
  return value === "VERY_IMPORTANT" || value === "ESSENTIAL";
}

const ATHLETIC_FLEXIBILITY_REASONS = ["ATHLETIC_TRAINING", "COMPETITION", "ATHLETIC_TRAVEL"] as const;

export function isAthleticsInterest(ctx: BranchContext): boolean {
  if (asStringArray(ctx.raw.discovery_reasons).includes("ATHLETICS")) return true;
  const flexibilityReasons = asStringArray(rawIfActive(ctx, "flexibility_reasons"));
  return includesAny(flexibilityReasons, ATHLETIC_FLEXIBILITY_REASONS);
}

export function isAthleticsInterestAndMiddleOrHs(ctx: BranchContext): boolean {
  return (
    isAthleticsInterest(ctx) && (ctx.gradeBand === "MIDDLE" || ctx.gradeBand === "HIGH_SCHOOL")
  );
}

export function isAthleticsInterestAndMiddleOrHsAndCollegeAthleticsDefinitelyOrPossibly(
  ctx: BranchContext,
): boolean {
  if (!isAthleticsInterestAndMiddleOrHs(ctx)) return false;
  const value = asStringValue(rawIfActive(ctx, "college_athletics_interest"));
  return value === "DEFINITELY" || value === "POSSIBLY";
}

export function isGradePlanningReasonAndMiddleOrHs(ctx: BranchContext): boolean {
  return (
    asStringArray(ctx.raw.discovery_reasons).includes("GRADE_PLANNING") &&
    (ctx.gradeBand === "MIDDLE" || ctx.gradeBand === "HIGH_SCHOOL")
  );
}

const ADVANCEMENT_REASONS = ["ACADEMIC_ACCELERATION", "ADVANCED_COURSES"] as const;
/** DISC_008 values read as "advancement-oriented" for this branch -- see docs/pathways/DECISION_LOG.md DEC-G2. */
const ADVANCEMENT_DESIRED_CHANGES = ["CHALLENGE", "COLLEGE_COURSES"] as const;

export function isAdvancementInterestOrReportedAheadOrMixed(ctx: BranchContext): boolean {
  if (includesAny(asStringArray(ctx.raw.discovery_reasons), ADVANCEMENT_REASONS)) return true;
  const desiredChange = asStringValue(rawIfActive(ctx, "desired_primary_change"));
  if (desiredChange && (ADVANCEMENT_DESIRED_CHANGES as readonly string[]).includes(desiredChange)) {
    return true;
  }
  const academicPosition = asStringValue(ctx.raw.reported_academic_position);
  return academicPosition === "AHEAD" || academicPosition === "MIXED";
}

export function isHighSchoolOrMiddleWithAdvancementInterest(ctx: BranchContext): boolean {
  if (ctx.gradeBand === "HIGH_SCHOOL") return true;
  return ctx.gradeBand === "MIDDLE" && isAdvancementInterestOrReportedAheadOrMixed(ctx);
}

export function isHighSchool(ctx: BranchContext): boolean {
  return ctx.gradeBand === "HIGH_SCHOOL";
}

const MISSING_CREDITS_VALUE = "MISSING_CREDITS";

export function isHighSchoolAndGraduationOrCreditConcern(ctx: BranchContext): boolean {
  if (!isHighSchool(ctx)) return false;
  const graduationStatus = asStringValue(rawIfActive(ctx, "reported_graduation_status"));
  if (graduationStatus === "MOSTLY" || graduationStatus === "NO" || graduationStatus === "UNKNOWN") {
    return true;
  }
  if (asStringArray(ctx.raw.discovery_reasons).includes("CREDIT_RECOVERY")) return true;
  return asStringArray(ctx.raw.reported_support_needs).includes(MISSING_CREDITS_VALUE);
}

const FOUNDATIONAL_OVERLAP_VALUES = ["READING", "PHONICS", "WRITING", "MATH"] as const;

export function isElementaryAndSupportPrioritiesNotAlreadyKnown(ctx: BranchContext): boolean {
  if (ctx.gradeBand !== "ELEMENTARY") return false;
  const supportNeeds = asStringArray(ctx.raw.reported_support_needs);
  return !includesAny(supportNeeds, FOUNDATIONAL_OVERLAP_VALUES);
}

const HOME_BASED_SUPPORT_LEVELS = [
  "REGULAR_GUIDANCE",
  "CLOSE_ADULT_SUPPORT",
  "INDEPENDENT_WORK_DIFFICULT",
] as const;

// desired_delivery (DISC_033) and learning_support_pattern (DISC_011)
// are both show_when: "ALL", i.e. unconditionally active regardless of
// EVALUATION_ORDER position -- reading ctx.raw directly for them
// (rather than through rawIfActive) is correct, not a shortcut around
// the ordering rule, since there is no "inactive" state to guard
// against for an always-shown question.
function isHomeBasedInterest(ctx: BranchContext): boolean {
  if (asStringArray(ctx.raw.discovery_reasons).includes("HOMESCHOOL")) return true;
  return asStringArray(ctx.raw.desired_delivery).includes("HOMESCHOOL");
}

export function isElementaryOrHomeBasedInterestWithSupportNeed(ctx: BranchContext): boolean {
  if (ctx.gradeBand === "ELEMENTARY") return true;
  if (!isHomeBasedInterest(ctx)) return false;
  const supportPattern = asStringValue(ctx.raw.learning_support_pattern);
  return Boolean(supportPattern && (HOME_BASED_SUPPORT_LEVELS as readonly string[]).includes(supportPattern));
}

// ---------------------------------------------------------------------------
// Evaluation order + active-question computation
// ---------------------------------------------------------------------------

/** Every field id in an order where each question's own show_when only ever depends on fields earlier in this list (or grade band / primary reason, both resolved from ALWAYS-active questions at the top). */
const EVALUATION_ORDER: readonly string[] = [
  "student_display_name",
  "current_grade",
  "student_age",
  "residence",
  "current_education_model",
  "discovery_reasons",
  "primary_discovery_reason",
  "desired_primary_change",
  "reported_academic_position",
  "reported_support_needs",
  "learning_support_pattern",
  "preferred_learning_environment",
  "flexibility_importance",
  "flexibility_reasons",
  "preferred_academic_time",
  "primary_sport",
  "athletic_level",
  "weekly_athletic_commitment",
  "athletic_travel_frequency",
  "college_athletics_interest",
  "ncaa_interest",
  "reclassification_interest",
  "advancement_interests",
  "college_intent",
  "reported_graduation_status",
  "credit_recovery_need",
  "family_priorities",
  "desired_parent_involvement",
  "cost_preference",
  "desired_start_timeline",
  "parent_context",
  "foundational_learning_priorities",
  "daytime_support_person",
  "in_person_peer_preference",
  "daytime_support_availability",
  "school_change_preference",
  "unavailable_academic_times",
  "desired_delivery",
  "subject_advancement_interests",
];

if (EVALUATION_ORDER.length !== QUESTIONS.length) {
  throw new Error(
    `Discovery branching EVALUATION_ORDER (${EVALUATION_ORDER.length} fields) is out of sync with question-bank.json (${QUESTIONS.length} questions) -- every canonical field must appear exactly once.`,
  );
}

const BRANCH_PREDICATES: Record<string, (ctx: BranchContext) => boolean> = {
  ALL: () => true,
  MULTIPLE_DISCOVERY_REASONS: isMultipleDiscoveryReasons,
  PRIMARY_REASON_UNCLEAR: isPrimaryReasonUnclear,
  FLEXIBILITY_SOMEWHAT_OR_HIGHER: isFlexibilitySomewhatOrHigher,
  FLEXIBILITY_VERY_OR_ESSENTIAL: isFlexibilityVeryOrEssential,
  ATHLETICS_INTEREST: isAthleticsInterest,
  ATHLETICS_INTEREST_AND_MIDDLE_OR_HS: isAthleticsInterestAndMiddleOrHs,
  ATHLETICS_INTEREST_AND_MIDDLE_OR_HS_AND_COLLEGE_ATHLETICS_DEFINITELY_OR_POSSIBLY:
    isAthleticsInterestAndMiddleOrHsAndCollegeAthleticsDefinitelyOrPossibly,
  GRADE_PLANNING_REASON_AND_MIDDLE_OR_HS: isGradePlanningReasonAndMiddleOrHs,
  ADVANCEMENT_INTEREST_OR_REPORTED_AHEAD_OR_MIXED: isAdvancementInterestOrReportedAheadOrMixed,
  HIGH_SCHOOL_OR_MIDDLE_WITH_ADVANCEMENT_INTEREST: isHighSchoolOrMiddleWithAdvancementInterest,
  HIGH_SCHOOL: isHighSchool,
  HIGH_SCHOOL_AND_GRADUATION_OR_CREDIT_CONCERN: isHighSchoolAndGraduationOrCreditConcern,
  ELEMENTARY_AND_SUPPORT_PRIORITIES_NOT_ALREADY_KNOWN: isElementaryAndSupportPrioritiesNotAlreadyKnown,
  ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED: isElementaryOrHomeBasedInterestWithSupportNeed,
};

export interface ActiveFlowResult {
  gradeBand: GradeBand;
  primaryReason: string | undefined;
  /** Ordered, matching EVALUATION_ORDER, of every field currently active (shown). */
  activeFields: string[];
}

/**
 * The one function that decides what is currently active. Both the
 * questionnaire flow (what to render/require next) and submission
 * validation (what must be answered, what to keep as effective) call
 * this -- never a second implementation.
 */
export function computeActiveFlow(raw: RawAnswers): ActiveFlowResult {
  const gradeBand = gradeBandFromGrade(asStringValue(raw.current_grade));
  const primaryReason = derivePrimaryReason(raw);
  const activeSet = new Set<string>();

  const ctx: BranchContext = {
    raw,
    gradeBand,
    primaryReason,
    isActive: (field: string) => activeSet.has(field),
  };

  const activeFields: string[] = [];
  for (const field of EVALUATION_ORDER) {
    const question = getQuestionByField(field);
    if (!question) continue;
    const predicate = BRANCH_PREDICATES[question.show_when];
    if (!predicate) {
      throw new Error(
        `Discovery branching has no predicate registered for show_when "${question.show_when}" (question ${question.id}).`,
      );
    }
    if (predicate(ctx)) {
      activeSet.add(field);
      activeFields.push(field);
    }
  }

  return { gradeBand, primaryReason, activeFields };
}
