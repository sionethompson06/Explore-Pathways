/**
 * The six "family goal" entry points on the homepage (Phase 2 prompt
 * section 4.B). Each carries a small, Phase-2-only "interest" id that
 * /discover may read from its URL to show a preselected, editable
 * starting point -- it is a marketing-level concept, distinct from
 * (and never written into) the real canonical question-bank/taxonomy
 * IDs in contracts/, which belong to the not-yet-built Phase 3/4
 * questionnaire and engine. Selecting a goal never creates a student
 * record, never submits data anywhere, and never finalizes a
 * questionnaire answer -- it only changes what /discover displays.
 */
export type GoalInterest =
  | "athletics"
  | "flexible_schedule"
  | "homeschool_support"
  | "academic_challenge"
  | "different_environment"
  | "unsure";

export interface FamilyGoal {
  interest: GoalInterest;
  label: string;
  description: string;
}

export const FAMILY_GOALS: FamilyGoal[] = [
  {
    interest: "athletics",
    label: "More time for athletics",
    description: "Fit serious training, travel or competition around schoolwork.",
  },
  {
    interest: "flexible_schedule",
    label: "A more flexible school schedule",
    description: "Rework the day around family needs, work, or how your student learns best.",
  },
  {
    interest: "homeschool_support",
    label: "Homeschool support",
    description: "Structure, curriculum or community to support a homeschool arrangement.",
  },
  {
    interest: "academic_challenge",
    label: "More academic challenge and opportunity",
    description: "Advanced coursework, independent study, or a faster pace where it fits.",
  },
  {
    interest: "different_environment",
    label: "A different learning environment",
    description: "Explore an arrangement that looks different from the current one.",
  },
  {
    interest: "unsure",
    label: "Help understanding the options",
    description: "Not sure yet what would help most -- that's a fine place to start.",
  },
];

export const GOAL_INTERESTS = FAMILY_GOALS.map((goal) => goal.interest);

export function isGoalInterest(value: string): value is GoalInterest {
  return (GOAL_INTERESTS as string[]).includes(value);
}

export function getGoalByInterest(interest: string): FamilyGoal | undefined {
  return FAMILY_GOALS.find((goal) => goal.interest === interest);
}
