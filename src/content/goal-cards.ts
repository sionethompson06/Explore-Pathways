import type { GoalInterest } from "./goals";

/**
 * The 8 homepage "What Are You Hoping to Make Possible?" cards
 * (Phase 2E). Each links to /discover -- either with an allowlisted
 * `interest` query param when a real GoalInterest already exists for
 * it, or plainly to /discover with no param when it doesn't. No card
 * invents a new Discovery engine answer value, prepopulates an
 * unsupported answer, or implies a selection was saved; see
 * src/content/goals.ts for the canonical, tested interest list this
 * reuses (unchanged) rather than duplicates.
 */
export interface GoalCard {
  id: string;
  title: string;
  description: string;
  icon: "athletics" | "academic" | "schedule" | "homeschool" | "compass" | "support" | "discover" | "advance";
  /** Set only when a real, existing GoalInterest applies -- never invented for this card. */
  interest?: GoalInterest;
}

export const GOAL_CARDS: GoalCard[] = [
  {
    id: "athletics",
    title: "More Time for Athletics",
    description: "Train, compete, and pursue your passion.",
    icon: "athletics",
    interest: "athletics",
  },
  {
    id: "academic",
    title: "Get Ahead Academically",
    description: "Explore advanced coursework and new opportunities.",
    icon: "academic",
    interest: "academic_challenge",
  },
  {
    id: "schedule",
    title: "Flexible Scheduling",
    description: "Learn on your schedule, where life happens.",
    icon: "schedule",
    interest: "flexible_schedule",
  },
  {
    id: "homeschool",
    title: "Homeschool Support",
    description: "Guidance and resources to help you homeschool with confidence.",
    icon: "homeschool",
    interest: "homeschool_support",
  },
  {
    id: "travel",
    title: "Travel-Friendly Learning",
    description: "Keep learning wherever life takes you.",
    icon: "compass",
    interest: "different_environment",
  },
  {
    id: "credit-recovery",
    title: "Credit Recovery",
    description: "Get back on track and move forward.",
    icon: "support",
  },
  {
    id: "reclassification",
    title: "Reclassification Guidance",
    description: "Find the right questions to ask about your unique learning journey.",
    icon: "discover",
  },
  {
    id: "college-planning",
    title: "College Planning",
    description: "Prepare for what's next with personalized support.",
    icon: "advance",
  },
];
