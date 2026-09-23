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
    SCHEDULE_FLEXIBILITY: "More flexibility in our schedule",
    HOMESCHOOL: "Explore homeschooling",
    ONLINE: "Explore online learning",
    ACADEMIC_ACCELERATION: "Move at a faster academic pace",
    ADVANCED_COURSES: "Access more advanced courses",
    COLLEGE_ADVANCEMENT: "Get a head start on college",
    CREDIT_RECOVERY: "Get back on track toward graduation",
    GRADE_PLANNING: "Explore grade placement options",
    TRAVEL: "Support frequent family travel",
    ARTS: "Support serious arts training or performance",
    CURRENT_SCHOOL_CONCERN: "A concern with the current school",
    PERSONALIZED_LEARNING: "A more personalized approach to learning",
    ENVIRONMENT_CONCERN: "A concern with the learning environment",
    /** Phase 3E canonical replacement for CURRENT_SCHOOL_CONCERN/DIFFERENT_ENVIRONMENT/ENVIRONMENT_CONCERN -- see contracts/legacy-aliases.json. */
    BETTER_FIT_ENVIRONMENT: "Find a learning environment that feels like a better fit",
    SMALLER_ENVIRONMENT: "A smaller, more personal environment",
    FAMILY_INVOLVEMENT: "More family involvement in learning",
    OTHER: "Something else",
    EXPLORING: "Just exploring options for now",
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
    ATTENDANCE: "Attendance",
    MISSING_CREDITS: "Missing credits",
    COMMUNICATION: "Communication",
    CONFIDENCE: "Confidence",
    NONE: "None of these",
  },
  learning_support_pattern: {
    INDEPENDENT: "Thrives working independently",
    OCCASIONAL_CHECK_INS: "Does well with occasional check-ins",
    REGULAR_GUIDANCE: "Benefits from regular guidance",
    CLOSE_ADULT_SUPPORT: "Does best with close adult support",
    INDEPENDENT_WORK_DIFFICULT: "Independent work is a growth area right now",
  },
  preferred_learning_environment: {
    SELF_PACED: "Self-paced",
    LIVE_TEACHER: "Live teacher-led",
    HANDS_ON: "Hands-on",
    SMALL_GROUP: "Small group",
    ONE_TO_ONE: "One-to-one",
  },
  flexibility_importance: {
    NOT_IMPORTANT: "Not important -- our schedule already works well",
    SOMEWHAT: "Somewhat important",
    VERY_IMPORTANT: "Very important",
    ESSENTIAL: "Essential for our family",
  },
  flexibility_reasons: {
    ATHLETIC_TRAINING: "Athletic training",
    ATHLETIC_TRAVEL: "Athletic travel",
    FAMILY_TRAVEL: "Family travel",
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
    ENRICHMENT: "Enrichment beyond the standard curriculum",
    HONORS: "Honors-level courses",
    AP: "Advanced Placement (AP) courses",
    ADVANCED_MATH: "Advanced math",
    ADVANCED_SCIENCE: "Advanced science",
    ADVANCED_ELA: "Advanced English/Language Arts",
    CHALLENGING_COURSEWORK: "More challenging coursework",
    HIGH_SCHOOL_EARLY: "Starting high school courses early",
    /** Phase 3E canonical merge of DUAL_ENROLLMENT/COLLEGE_COURSES -- see contracts/legacy-aliases.json. */
    COLLEGE_LEVEL_COURSES: "College-level or dual-enrollment courses",
    DUAL_ENROLLMENT: "Dual enrollment",
    COLLEGE_COURSES: "College-level courses",
    EARLY_GRADUATION: "Early graduation",
    RESEARCH: "Independent research projects",
    CAREER_CTE: "Career and technical education (CTE)",
    WORK_BASED_LEARNING: "Work-based learning or internships",
    INDUSTRY_CREDENTIALS: "Industry certifications or credentials",
    ENTREPRENEURSHIP: "Entrepreneurship opportunities",
    NONE_CURRENTLY: "None of these right now",
  },
  credit_recovery_need: {
    POSSIBLY: "Possibly",
  },
  family_priorities: {
    ACADEMIC_QUALITY: "Academic quality",
    PERSONAL_SUPPORT: "Personal support",
    COLLEGE_PREPARATION: "College preparation",
    ATHLETIC_FLEXIBILITY: "Athletic flexibility",
    SELF_PACED: "Self-paced learning",
    LIVE_TEACHER: "Live teacher instruction",
    LOCATION_FLEXIBILITY: "Location flexibility",
    ACADEMIC_ADVANCEMENT: "Academic advancement",
    SMALL_ENVIRONMENT: "A smaller environment",
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
 * wording/label swap in the registry; everything else uses the
 * registry's single parent_wording regardless of grade band.
 */
export function getQuestionWording(field: string, gradeBand: GradeBand): string {
  const question = getQuestionByField(field);
  if (!question) return "";
  if (field === "learning_support_pattern" && gradeBand === "ELEMENTARY") {
    return "When learning at home, how much adult help is useful?";
  }
  return question.parent_wording;
}

export function getOptionLabelForQuestion(
  field: string,
  value: string,
  gradeBand: GradeBand,
): string {
  if (field === "learning_support_pattern" && gradeBand === "ELEMENTARY" && value === "INDEPENDENT") {
    return "Works well independently for short periods";
  }
  return getOptionLabel(field, value);
}
