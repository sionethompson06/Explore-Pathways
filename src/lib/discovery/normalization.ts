import "server-only";
import { loadLegacyAliases } from "@/lib/contracts/loader";
import { computeActiveFlow } from "./branching";
import { getParentQuestionForOtherTextField, OTHER_TEXT_FIELDS } from "./registry";
import type {
  AdvancementOpportunityFlags,
  AthleticScheduleDemand,
  DerivedFacts,
  EffectiveAnswers,
  FamilyManagementPreference,
  RawAnswers,
  RawAnswerValue,
  ScheduleFlexibilityNeed,
  SupportStructureNeed,
} from "./types";

/**
 * Raw -> effective normalization (Phase 3 instructions §27/§28/§51).
 * Only currently-active fields are copied into `answers`; anything
 * behind a since-closed branch is neutralized here, on every call --
 * never patched in place on the stored raw answers, which are kept
 * exactly as the parent entered them. This is the ONLY function that
 * produces what a future recommendation engine, AI, report, or export
 * may read; nothing else in this codebase may reach into raw answers
 * directly for that purpose.
 *
 * Phase 3E additionally applies legacy VALUE aliasing/removal here
 * (docs/pathways/DISCOVERY_CALIBRATION_SPEC_V2.md section 14) -- a
 * retired option a family picked years ago still reads back exactly as
 * entered on Review, but here it is translated (or, if it carries no
 * forward-compatible meaning, dropped) so downstream code only ever
 * sees canonical current values.
 */

const legacyAliases = loadLegacyAliases();
const QUESTION_VALUE_ALIASES = legacyAliases.question_value_aliases ?? {};
const QUESTION_VALUE_REMOVALS = legacyAliases.question_value_removals ?? {};

function asStringArray(value: RawAnswerValue): string[] {
  return Array.isArray(value) ? value : [];
}

function includesAny(values: string[], candidates: readonly string[]): boolean {
  return values.some((v) => candidates.includes(v));
}

/** Applies this field's legacy alias map and removal list to one array value, deduplicating any resulting collisions (e.g. two legacy synonyms both aliasing to the same canonical value). */
function normalizeMultiValue(field: string, values: string[]): string[] {
  const aliasMap = QUESTION_VALUE_ALIASES[field];
  const removals = new Set(QUESTION_VALUE_REMOVALS[field] ?? []);
  const mapped = values
    .filter((v) => !removals.has(v))
    .map((v) => aliasMap?.[v] ?? v);
  return Array.from(new Set(mapped));
}

/** Same aliasing for a single-value field (legacy removal of a single-select value is not currently used, but handled for completeness). */
function normalizeSingleValue(field: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (QUESTION_VALUE_REMOVALS[field]?.includes(value)) return undefined;
  return QUESTION_VALUE_ALIASES[field]?.[value] ?? value;
}

export function computeEffectiveAnswers(raw: RawAnswers): EffectiveAnswers {
  const { activeFields, gradeBand } = computeActiveFlow(raw);
  const activeSet = new Set(activeFields);

  const answers: Record<string, RawAnswerValue> = {};
  for (const field of activeFields) {
    const value = raw[field];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      answers[field] = normalizeMultiValue(field, value);
    } else if (typeof value === "string") {
      const normalized = normalizeSingleValue(field, value);
      if (normalized !== undefined) answers[field] = normalized;
    } else {
      answers[field] = value;
    }
  }

  // Phase 3F: an "Other" sidecar free-text value is effective only
  // while its parent question is active AND its parent's (already
  // legacy-normalized) effective value still includes OTHER --
  // regardless of whether the client remembered to clear it itself.
  // Context only: never read by any derived fact below.
  for (const otherTextField of OTHER_TEXT_FIELDS) {
    const parent = getParentQuestionForOtherTextField(otherTextField);
    if (!parent) continue;
    const parentEffective = answers[parent.field];
    const parentHasOther = Array.isArray(parentEffective) && parentEffective.includes("OTHER");
    const text = raw[otherTextField];
    if (parentHasOther && typeof text === "string" && text.trim().length > 0) {
      answers[otherTextField] = text;
    }
  }

  const activeRaw = (field: string): RawAnswerValue => (activeSet.has(field) ? raw[field] : undefined);

  // Legacy-normalized effective arrays, used both for the answers map
  // above and for derived-fact computation below -- always read
  // through these, never through `raw.discovery_reasons` etc. directly,
  // so a retired value can never silently drive a derived fact.
  const discoveryReasons = normalizeMultiValue("discovery_reasons", asStringArray(raw.discovery_reasons));
  const advancementInterests = normalizeMultiValue(
    "advancement_interests",
    asStringArray(activeRaw("advancement_interests")),
  );

  const athleticsInterest =
    discoveryReasons.includes("ATHLETICS") ||
    includesAny(asStringArray(activeRaw("flexibility_reasons")), [
      "ATHLETIC_TRAINING",
      "COMPETITION",
      "ATHLETIC_TRAVEL",
    ]);

  const homeschoolInterest =
    discoveryReasons.includes("HOMESCHOOL") ||
    asStringArray(raw.desired_delivery).includes("HOMESCHOOL");

  const homeOrOnlineInterest =
    homeschoolInterest ||
    includesAny(asStringArray(raw.desired_delivery), [
      "ONLINE_SELF_PACED",
      "ONLINE_TEACHER_SUPPORTED",
    ]) ||
    discoveryReasons.includes("ONLINE");

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
    includesAny(discoveryReasons, [
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
    advancementInterests.some((v) => v !== "NONE_CURRENTLY" && v !== "UNKNOWN");

  const ncaaInterest = (activeRaw("ncaa_interest") as string | undefined) ?? "NOT_APPLICABLE";

  // --- Phase 3E derived facts (DISCOVERY_CALIBRATION_SPEC_V2.md sections 4/6/8/10/11) ---
  // Each is a conservative, deterministic tier from currently-active
  // evidence only -- UNKNOWN means "not enough active evidence yet,"
  // never a real tier of need. None of these are a public score, and
  // none feed a Phase 4 evaluator that does not yet exist.

  const supportStructureNeed = deriveSupportStructureNeed(activeRaw);
  const scheduleFlexibilityNeed = deriveScheduleFlexibilityNeed(activeRaw, discoveryReasons);
  const athleticScheduleDemand = deriveAthleticScheduleDemand(activeRaw);
  const familyManagementPreference = deriveFamilyManagementPreference(activeRaw);
  const advancementOpportunities = deriveAdvancementOpportunities(
    advancementInterests,
    asStringArray(activeRaw("subject_advancement_interests")),
  );

  const derived: DerivedFacts = {
    grade_band: gradeBand,
    athletics_interest: athleticsInterest,
    homeschool_interest: homeschoolInterest,
    home_or_online_interest: homeOrOnlineInterest,
    frequent_travel: frequentTravel,
    foundation_concern: foundationConcern,
    supplemental_need: supplementalNeed,
    ncaa_interest: ncaaInterest,
    support_structure_need: supportStructureNeed,
    schedule_flexibility_need: scheduleFlexibilityNeed,
    athletic_schedule_demand: athleticScheduleDemand,
    family_management_preference: familyManagementPreference,
    advancement_opportunities: advancementOpportunities,
  };

  return { answers, derived };
}

type ActiveRawReader = (field: string) => RawAnswerValue;

/** DISC_011 is the primary signal; STRUCTURE_ACCOUNTABILITY (DISC_026) and a live-teacher/small-group/one-to-one preference (DISC_012) can only raise the tier, never invent HIGH on their own. */
function deriveSupportStructureNeed(activeRaw: ActiveRawReader): SupportStructureNeed {
  const pattern = activeRaw("learning_support_pattern") as string | undefined;
  const familyPriorities = asStringArray(activeRaw("family_priorities"));
  const environment = asStringArray(activeRaw("preferred_learning_environment"));
  const structureSignal = familyPriorities.includes("STRUCTURE_ACCOUNTABILITY");
  const liveSupportSignal = includesAny(environment, ["LIVE_TEACHER", "SMALL_GROUP", "ONE_TO_ONE"]);
  const secondarySignal = structureSignal || liveSupportSignal;

  switch (pattern) {
    case "CLOSE_ADULT_SUPPORT":
    case "INDEPENDENT_WORK_DIFFICULT":
      return "HIGH";
    case "REGULAR_GUIDANCE":
      return secondarySignal ? "HIGH" : "MODERATE";
    case "OCCASIONAL_CHECK_INS":
      return secondarySignal ? "MODERATE" : "LOW";
    case "INDEPENDENT":
      return "LOW";
    default:
      return secondarySignal ? "MODERATE" : "UNKNOWN";
  }
}

/**
 * DISC_013 sets the subjective baseline; a real scheduling constraint
 * can only raise it -- a mild "somewhat important" answer (or no
 * answer yet) next to a genuine weekly conflict is not treated as the
 * family's true need. discovery_reasons (ATHLETICS/TRAVEL/ARTS) is
 * read directly, not through activeRaw, because it is show_when "ALL"
 * and so already-answered regardless of DISC_013; flexibility_reasons
 * (DISC_014), by contrast, is itself gated behind
 * isFlexibilitySomewhatOrHigher and so can never independently supply
 * this "already exists" signal for a family who rated flexibility
 * NOT_IMPORTANT or hasn't answered DISC_013 at all.
 */
function deriveScheduleFlexibilityNeed(
  activeRaw: ActiveRawReader,
  discoveryReasons: string[],
): ScheduleFlexibilityNeed {
  const importance = activeRaw("flexibility_importance") as string | undefined;
  const unavailable = asStringArray(activeRaw("unavailable_academic_times"));
  const flexibilityReasons = asStringArray(activeRaw("flexibility_reasons"));

  const hasRealConstraint =
    includesAny(unavailable, ["MORNING", "AFTERNOON", "EVENING", "VARIES"]) ||
    includesAny(flexibilityReasons, [
      "ATHLETIC_TRAINING",
      "COMPETITION",
      "ATHLETIC_TRAVEL",
      "FAMILY_TRAVEL",
      "WORK",
      "BUSINESS",
    ]) ||
    includesAny(discoveryReasons, ["ATHLETICS", "TRAVEL", "ARTS"]);

  let tier: ScheduleFlexibilityNeed;
  switch (importance) {
    case "ESSENTIAL":
      tier = "VERY_HIGH";
      break;
    case "VERY_IMPORTANT":
      tier = "HIGH";
      break;
    case "SOMEWHAT":
      tier = "MODERATE";
      break;
    case "NOT_IMPORTANT":
      tier = "LOW";
      break;
    default:
      tier = "UNKNOWN";
  }

  if (tier === "UNKNOWN") {
    return hasRealConstraint ? "MODERATE" : "UNKNOWN";
  }
  if (hasRealConstraint && (tier === "LOW" || tier === "MODERATE")) {
    return tier === "LOW" ? "MODERATE" : "HIGH";
  }
  return tier;
}

/** Weekly hours and travel frequency only -- never DISC_017's athletic_level (prestige/level must never drive perceived scheduling demand, per Section 8). */
function deriveAthleticScheduleDemand(activeRaw: ActiveRawReader): AthleticScheduleDemand {
  const weekly = activeRaw("weekly_athletic_commitment") as string | undefined;
  const travel = activeRaw("athletic_travel_frequency") as string | undefined;
  const unavailable = asStringArray(activeRaw("unavailable_academic_times"));

  if (weekly === undefined && travel === undefined) return "UNKNOWN";

  const heavyHours = weekly === "HOURS_16_20" || weekly === "HOURS_21_PLUS";
  const moderateHours = weekly === "HOURS_11_15";
  const lightHours = weekly === "UNDER_5" || weekly === "HOURS_5_10";
  const heavyTravel = travel === "SEVERAL_MONTH" || travel === "WEEKLY";
  const moderateTravel = travel === "MONTHLY";
  const realAcademicConflict = includesAny(unavailable, ["MORNING", "AFTERNOON", "EVENING"]);

  if ((heavyHours || heavyTravel) && realAcademicConflict) return "HIGHLY_CONSTRAINED";
  if (heavyHours || heavyTravel) return "SUBSTANTIAL";
  if (moderateHours || moderateTravel || realAcademicConflict) return "MODERATE";
  if (lightHours) return "LIGHT";
  return "UNKNOWN";
}

/** A direct, 1:1 map from DISC_027 -- no other question contributes, so there is nothing to combine or weigh. */
function deriveFamilyManagementPreference(activeRaw: ActiveRawReader): FamilyManagementPreference {
  const value = activeRaw("desired_parent_involvement") as string | undefined;
  switch (value) {
    case "VERY_INVOLVED":
      return "HIGH_FAMILY_INVOLVEMENT";
    case "REGULAR_SUPPORT":
      return "SHARED_RESPONSIBILITY";
    case "CHECK_INS":
      return "LIGHT_FAMILY_MANAGEMENT";
    case "PROGRAM_MANAGES":
      return "PROGRAM_LED";
    default:
      return "UNKNOWN";
  }
}

/**
 * Independent flags from the legacy-normalized DISC_022 selections plus
 * DISC_034's subject interests -- deliberately NOT mutually exclusive
 * (Section 10): a student can have both a credit-recovery need
 * elsewhere in the profile and one or more advancement interests here
 * at the same time.
 */
function deriveAdvancementOpportunities(
  advancementInterests: string[],
  subjectAdvancementInterests: string[],
): AdvancementOpportunityFlags {
  const has = (value: string) => advancementInterests.includes(value);
  return {
    // Phase 3F: DISC_022 no longer carries subject-specific signal
    // (ADVANCED_MATH/ADVANCED_SCIENCE/ADVANCED_ELA are retired from
    // new-entry use and alias to CHALLENGING_COURSEWORK) -- DISC_034
    // (subject_advancement_interests) is now the sole subject-area
    // source, per docs/pathways/DISCOVERY_UX_SIMPLIFICATION_PHASE3F.md.
    subject_challenge: subjectAdvancementInterests.some((v) => v !== "NONE" && v !== "UNKNOWN"),
    advanced_coursework:
      has("HONORS") || has("AP") || has("HONORS_AP") || has("CHALLENGING_COURSEWORK") || has("ENRICHMENT"),
    early_high_school_coursework: has("HIGH_SCHOOL_EARLY"),
    college_level_learning: has("COLLEGE_LEVEL_COURSES"),
    research_projects: has("RESEARCH"),
    // Phase 3F: the combined CAREER_CTE_CREDENTIALS card (HIGH_SCHOOL
    // tier) sets both flags true, mirroring rule ADV_015's dual
    // OP08+OP09 activation for one broad selection.
    career_cte: has("CAREER_CTE") || has("CAREER_CTE_CREDENTIALS"),
    work_based_learning: has("WORK_BASED_LEARNING"),
    industry_credentials: has("INDUSTRY_CREDENTIALS") || has("CAREER_CTE_CREDENTIALS"),
    entrepreneurship: has("ENTREPRENEURSHIP"),
    accelerated_graduation: has("EARLY_GRADUATION"),
  };
}
