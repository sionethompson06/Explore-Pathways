import type { GoalInterest } from "./goals";

/**
 * Section (Phase 2E, Asset Pack 2 P2-01 direction) -- "Find Your Path
 * in Minutes." Each reason is a real link: to /discover with an
 * allowlisted `interest` param when a real GoalInterest applies, or
 * plainly to /discover when it doesn't -- never a new invented answer
 * value, never a persisted "selection." See src/content/goals.ts for
 * the canonical, tested interest list this reuses.
 */
export interface PopularReason {
  label: string;
  interest?: GoalInterest;
}

export const POPULAR_REASONS: PopularReason[] = [
  { label: "More time for athletics", interest: "athletics" },
  { label: "Traditional school isn't working", interest: "different_environment" },
  { label: "Considering homeschool", interest: "homeschool_support" },
  { label: "Travel or unique family lifestyle", interest: "flexible_schedule" },
  { label: "Get ahead academically", interest: "academic_challenge" },
  { label: "Credit recovery" },
  { label: "Reclassification guidance" },
  { label: "College and career planning" },
];

export interface FindYourPathBenefit {
  id: "personalized" | "directions" | "questions" | "next-step";
  icon: "plan" | "compass" | "question" | "advance";
  title: string;
  description: string;
}

export const FIND_YOUR_PATH_BENEFITS: FindYourPathBenefit[] = [
  {
    id: "personalized",
    icon: "plan",
    title: "Personalized Results",
    description: "Tailored to your student's goals and interests.",
  },
  {
    id: "directions",
    icon: "compass",
    title: "Education Directions Worth Exploring",
    description: "Discover options you may not have considered.",
  },
  {
    id: "questions",
    icon: "question",
    title: "Questions and Insights",
    description: "Surface the right questions before your next step.",
  },
  {
    id: "next-step",
    icon: "advance",
    title: "A Clearer Next Step",
    description: "Move forward with confidence, at your own pace.",
  },
];
