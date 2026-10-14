import "server-only";
import { getQuestionByField } from "./registry";
import type { GradeBand } from "./types";

/**
 * Parent-facing presentation only. Never changes a stored canonical
 * value (Phase 3 instruction §31) -- every function here maps a
 * canonical enum token to display text; nothing here is read back
 * into an answer.
 */

const STATE_LABELS: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
  US_TERRITORY: "A U.S. territory",
  OUTSIDE_US: "Outside the United States",
  UNKNOWN: "I'm not sure",
};

export const US_STATE_CODES: readonly string[] = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WV", "WI", "WY",
  "DC",
];

export const LOCATION_STATE_VALUES: readonly string[] = [
  ...US_STATE_CODES,
  "US_TERRITORY",
  "OUTSIDE_US",
  "UNKNOWN",
];

function getStateLabel(code: string): string {
  return STATE_LABELS[code] ?? humanizeToken(code);
}

/** Generic fallback: "TRADITIONAL_PUBLIC" -> "Traditional public". Applied whenever no explicit override exists below. */
function humanizeToken(value: string): string {
  const words = value.toLowerCase().split("_");
  return words
    .map((word, index) => (index === 0 ? capitalize(word) : word))
    .join(" ");
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1);
}

/**
 * Hand-authored overrides, keyed by question-bank `field`, for the
 * values a generic humanize pass would render awkwardly or where a
 * meaningfully friendlier phrasing exists. Every value not listed
 * here still gets a friendly (never raw-enum) label via
 * `humanizeToken`. This is deliberately not an exhaustive
 * value-by-value rewrite of all ~250 enum values -- only the ones
 * worth diverging from the generic pass.
 */
const OVERRIDES: Record<string, Record<string, string>> = {
  current_grade: {
    K: "Kindergarten",
    "1": "1st grade",
    "2": "2nd grade",
    "3": "3rd grade",
    "4": "4th grade",
    "5": "5th grade",
    "6": "6th grade",
    "7": "7th grade",
    "8": "8th grade",
    "9": "9th grade",
    "10": "10th grade",
    "11": "11th grade",
    "12": "12th grade",
    OTHER: "Something else",
    UNKNOWN: "Not sure yet",
  },
  current_education_model: {
    TRADITIONAL_PUBLIC: "Traditional public school",
    NOT_ENROLLED: "Not currently enrolled",
  },
  discovery_reasons: {
    SCHEDULE_FLEXIBILITY: "More schedule flexibility",
    ATHLETICS: "More time for athletics",
    HOMESCHOOL: "Homeschool or home-based learning",
    ONLINE: "Online learning",
    /** Phase 3F.1: surviving umbrella for ADVANCED_COURSES/COLLEGE_ADVANCEMENT -- see contracts/legacy-aliases.json. */
    ACADEMIC_ACCELERATION: "More academic challenge or advancement",
    ADVANCED_COURSES: "Access more advanced courses",
    COLLEGE_ADVANCEMENT: "Get a head start on college",
    /** Phase 3F.1: surviving umbrella for CREDIT_RECOVERY -- see contracts/legacy-aliases.json. */
    ACADEMIC_SUPPORT: "More academic support or help getting back on track",
    CREDIT_RECOVERY: "Get back on track toward graduation",
    GRADE_PLANNING: "Grade placement or reclassification",
    TRAVEL: "Support frequent family travel",
    ARTS: "Support serious arts training or performance",
    CURRENT_SCHOOL_CONCERN: "A concern with the current school",
    PERSONALIZED_LEARNING: "More personalized learning",
    ENVIRONMENT_CONCERN: "A concern with the learning environment",
    /** Phase 3E canonical replacement for CURRENT_SCHOOL_CONCERN/DIFFERENT_ENVIRONMENT/ENVIRONMENT_CONCERN; Phase 3F.1 additionally folds in SMALLER_ENVIRONMENT -- see contracts/legacy-aliases.json. */
    BETTER_FIT_ENVIRONMENT: "A learning environment that feels like a better fit",
    SMALLER_ENVIRONMENT: "A smaller, more personal environment",
    FAMILY_INVOLVEMENT: "More family involvement in learning",
    OTHER: "Something else",
    EXPLORING: "We're exploring what's possible",
  },
  desired_primary_change: {
    TIME_CONTROL: "More control over our time",
    CHALLENGE: "More academic challenge",
    SUPPORT: "More academic support",
    ATHLETICS_TIME: "More time for athletics",
    LOCATION_FLEXIBILITY: "More flexibility in location",
    COLLEGE_COURSES: "Access to college-level courses",
    DIFFERENT_ENVIRONMENT: "A different learning environment",
    BACK_ON_TRACK: "Help getting back on track",
    PERSONALIZATION: "A more personalized approach",
    OUTSIDE_OPPORTUNITIES: "Room for outside opportunities",
    UNKNOWN: "I'm not sure yet",
  },
  reported_academic_position: {
    AHEAD: "Ahead in most areas",
    ON_LEVEL: "Right on level",
    MIXED: "A mix of strengths and areas to grow",
    STRUGGLING: "Finding some things challenging right now",
    SIGNIFICANT_CONCERNS: "Facing some significant challenges",
  },
  reported_support_needs: {
    ROUTINES: "Building routines",
    ORGANIZATION: "Staying organized",
    TIME_MANAGEMENT: "Managing time",
    ENGAGEMENT: "Staying engaged",
    TASK_COMPLETION: "Finishing tasks",
    ATTENDANCE: "Attendance/consistency",
    MISSING_CREDITS: "Credits or graduation",
    COMMUNICATION: "Communication",
    CONFIDENCE: "Confidence",
    /** Phase 3F new canonical value, consolidating ROUTINES/ORGANIZATION/TIME_MANAGEMENT/TASK_COMPLETION/STUDY_SKILLS -- see contracts/legacy-aliases.json. */
    ORGANIZATION_STUDY_HABITS: "Organization and study habits",
    /** Phase 3F new canonical value, consolidating ENGAGEMENT/CONFIDENCE -- see contracts/legacy-aliases.json. */
    ENGAGEMENT_CONFIDENCE: "Engagement and confidence",
    NONE: "No additional support",
  },
  learning_support_pattern: {
    INDEPENDENT: "Independently",
    OCCASIONAL_CHECK_INS: "With occasional check-ins",
    REGULAR_GUIDANCE: "With regular guidance",
    CLOSE_ADULT_SUPPORT: "With frequent support",
    INDEPENDENT_WORK_DIFFICULT: "Independent work is a growth area right now",
  },
  preferred_learning_environment: {
    SELF_PACED: "Self-paced",
    LIVE_TEACHER: "Live teacher-led",
    BLEND: "A mix of independent and live learning",
    HANDS_ON: "Hands-on/project-based",
    SMALL_GROUP: "Small group",
    ONE_TO_ONE: "One-to-one",
    MOVEMENT: "Movement/active learning",
  },
  flexibility_importance: {
    NOT_IMPORTANT: "Not important -- our schedule already works well",
    SOMEWHAT: "Somewhat important",
    VERY_IMPORTANT: "Very important",
    ESSENTIAL: "Essential for our family",
  },
  flexibility_reasons: {
    /** Phase 3F: new-entry umbrella for athletics/training/competition -- COMPETITION and ATHLETIC_TRAVEL retired from new-entry use and aliased to it. */
    ATHLETIC_TRAINING: "Athletics, training, or competition",
    ATHLETIC_TRAVEL: "Athletic travel",
    FAMILY_TRAVEL: "Family travel",
    ARTS: "Arts or performance",
    /** Phase 3F: new-entry umbrella for work/entrepreneurship -- BUSINESS retired from new-entry use and aliased to it. */
    WORK: "Work or entrepreneurship",
    COLLEGE_COURSES: "College-level courses",
    PACE: "Learning at their own pace",
    FAMILY_RESPONSIBILITIES: "Family responsibilities",
    FAMILY_TIME: "Family time",
    OTHER: "Something else",
  },
  preferred_academic_time: {
    THROUGHOUT_DAY: "Spread throughout the day",
    NO_PREFERENCE: "No particular preference",
  },
  athletic_level: {
    CLUB_TRAVEL: "Club or travel team",
    ACADEMY: "Academy program",
  },
  weekly_athletic_commitment: {
    UNDER_5: "Under 5 hours",
    HOURS_5_10: "5-10 hours",
    HOURS_11_15: "11-15 hours",
    HOURS_16_20: "16-20 hours",
    HOURS_21_PLUS: "21+ hours",
  },
  athletic_travel_frequency: {
    FEW_YEAR: "A few times a year",
    SEVERAL_MONTH: "Several times a month",
  },
  college_athletics_interest: {
    TOO_EARLY: "Too early to say",
  },
  advancement_interests: {
    ENRICHMENT: "More enrichment",
    HONORS: "Honors-level courses",
    AP: "Advanced Placement (AP) courses",
    ADVANCED_MATH: "Advanced math",
    ADVANCED_SCIENCE: "Advanced science",
    ADVANCED_ELA: "Advanced English/Language Arts",
    CHALLENGING_COURSEWORK: "More challenging coursework",
    HIGH_SCHOOL_EARLY: "High-school coursework early",
    /** Phase 3E canonical merge of DUAL_ENROLLMENT/COLLEGE_COURSES -- see contracts/legacy-aliases.json. */
    COLLEGE_LEVEL_COURSES: "College-level or dual-enrollment courses",
    DUAL_ENROLLMENT: "Dual enrollment",
    COLLEGE_COURSES: "College-level courses",
    EARLY_GRADUATION: "Earlier graduation",
    RESEARCH: "Research/independent projects",
    CAREER_CTE: "Career and technical education (CTE)",
    WORK_BASED_LEARNING: "Work-based learning or internships",
    INDUSTRY_CREDENTIALS: "Industry certifications or credentials",
    ENTREPRENEURSHIP: "Entrepreneurship opportunities",
    /** Phase 3F new canonical value: one card activating both OP02 (Honors) and OP03 (AP) via ADV_014 -- legacy HONORS-only/AP-only answers are NOT aliased to it (see contracts/legacy-aliases.json note). */
    HONORS_AP: "Honors/AP",
    /** Phase 3F new canonical value (HIGH_SCHOOL tier only): one card activating both OP08 (Career/CTE) and OP09 (industry credentials) via ADV_015. */
    CAREER_CTE_CREDENTIALS: "Career/CTE or industry credentials",
    NONE_CURRENTLY: "None of these right now",
  },
  credit_recovery_need: {
    POSSIBLY: "Possibly",
  },
  family_priorities: {
    ACADEMIC_QUALITY: "Academic quality",
    PERSONAL_SUPPORT: "Personal support",
    COLLEGE_PREPARATION: "College/career preparation",
    ATHLETIC_FLEXIBILITY: "Athletic flexibility",
    SELF_PACED: "Self-paced learning",
    LIVE_TEACHER: "Live teacher instruction",
    SOCIAL: "In-person/social learning",
    LOCATION_FLEXIBILITY: "Location flexibility",
    ACADEMIC_ADVANCEMENT: "Academic advancement",
    SMALL_ENVIRONMENT: "Smaller/personal learning environment",
    /** Phase 3E new canonical value, replacing ACADEMIC_QUALITY for new entries -- not semantically equivalent, so no alias between them. */
    STRUCTURE_ACCOUNTABILITY: "Structure and accountability",
  },
  desired_parent_involvement: {
    VERY_INVOLVED: "Very involved",
    REGULAR_SUPPORT: "Regular support",
    CHECK_INS: "Occasional check-ins",
    PROGRAM_MANAGES: "Program manages day-to-day learning",
  },
  cost_preference: {
    PREFER_TUITION_FREE: "Prefer tuition-free options",
    OPEN_AFFORDABLE_PAID: "Open to affordable paid options",
    OPEN_PRIVATE_TUITION: "Open to private tuition",
    DEPENDS_ON_VALUE: "Depends on the value",
  },
  desired_start_timeline: {
    ASAP: "As soon as possible",
    WITHIN_30_DAYS: "Within 30 days",
    NEXT_SEMESTER: "Next semester",
    NEXT_SCHOOL_YEAR: "Next school year",
    EXPLORING: "Just exploring for now",
  },
  foundational_learning_priorities: {
    COMPREHENSION: "Reading comprehension",
    PROBLEM_SOLVING: "Problem solving",
    LEARNING_ROUTINES: "Learning routines",
    NONE: "None of these",
  },
  daytime_support_person: {
    PARENT_GUARDIAN: "A parent or guardian",
    FAMILY_MEMBER: "Another family member",
    TUTOR_COACH: "A tutor or coach",
    CHILDCARE_PROVIDER: "A childcare provider",
    LEARNING_PROGRAM: "A learning program",
    VARIES: "It varies",
    NOT_ARRANGED: "Not arranged yet",
  },
  daytime_support_availability: {
    MOST_LEARNING_DAYS: "Most learning days",
    PART_OF_DAY: "Part of the day",
    OCCASIONAL: "Occasionally",
    NOT_ARRANGED: "Not arranged yet",
  },
  desired_delivery: {
    ONLINE_SELF_PACED: "Online — self-paced",
    ONLINE_TEACHER_SUPPORTED: "Online — teacher supported",
    HYBRID: "A mix of online and in-person (hybrid)",
    IN_PERSON: "In person",
    HOMESCHOOL: "Homeschool",
    /** Phase 3E new canonical value -- distinct from UNKNOWN; must never default to any model or receive an automatic bonus. */
    OPEN_TO_RECOMMENDATIONS: "Open to your recommendations",
  },
  subject_advancement_interests: {
    ELA: "English/Language Arts",
    SOCIAL_STUDIES_HUMANITIES: "Social studies or humanities",
    NONE: "None right now",
  },
};

const DEFAULT_UNKNOWN_LABEL = "I'm not sure";

/**
 * The friendly label for one enum value of one question field. Prefers
 * (1) the registry's own `display_labels` when the question defines
 * them (e.g. DISC_020A), (2) a hand-authored override above, then (3)
 * the generic humanize fallback -- in that order, so a canonical
 * source always wins over this file's own guesses.
 */
export function getOptionLabel(field: string, value: string): string {
  if (field === "residence") return getStateLabel(value);

  const question = getQuestionByField(field);
  if (question?.display_labels && value in question.display_labels) {
    return question.display_labels[value]!;
  }
  if (value === "UNKNOWN") return DEFAULT_UNKNOWN_LABEL;
  const override = OVERRIDES[field]?.[value];
  if (override) return override;
  return humanizeToken(value);
}

/**
 * DISC_011's own registry note: "K-4 wording: When learning at home,
 * how much adult help is useful? INDEPENDENT label becomes works for
 * short periods." This is the one documented grade-conditional
 * *wording* swap in the registry; everything else uses the registry's
 * single parent_wording regardless of grade band. (See
 * getOptionLabelForQuestion below for grade-conditional *option label*
 * swaps, which Phase 3F adds more of.)
 */
export function getQuestionWording(field: string, gradeBand: GradeBand): string {
  const question = getQuestionByField(field);
  if (!question) return "";
  if (field === "learning_support_pattern" && gradeBand === "ELEMENTARY") {
    return "When learning at home, how much adult help is useful?";
  }
  return question.parent_wording;
}

/**
 * Phase 3F grade-conditional option labels for `advancement_interests`
 * (DISC_022): the same canonical value can read differently depending
 * on grade band, since one value now sometimes stands in for a
 * different concept at a younger tier (see contracts/CHANGELOG.md
 * "Phase 3F"). Never changes which value is stored -- presentation
 * only, exactly like the DISC_011 case above.
 */
const ADVANCEMENT_INTERESTS_GRADE_LABELS: Partial<Record<GradeBand, Record<string, string>>> = {
  ELEMENTARY: {
    CHALLENGING_COURSEWORK: "More challenging learning",
  },
  MIDDLE: {
    COLLEGE_LEVEL_COURSES: "Future college-level opportunities",
    CAREER_CTE: "Career/technical exploration",
  },
};

export function getOptionLabelForQuestion(
  field: string,
  value: string,
  gradeBand: GradeBand,
): string {
  if (field === "learning_support_pattern" && gradeBand === "ELEMENTARY" && value === "INDEPENDENT") {
    return "Works well independently for short periods";
  }
  if (field === "advancement_interests") {
    const override = ADVANCEMENT_INTERESTS_GRADE_LABELS[gradeBand]?.[value];
    if (override) return override;
  }
  return getOptionLabel(field, value);
}
