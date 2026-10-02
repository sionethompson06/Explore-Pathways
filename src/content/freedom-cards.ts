import type { GoalInterest } from "./goals";

export interface FreedomCard {
  id: "train-more" | "get-ahead" | "learn-anywhere" | "take-back-time";
  title: string;
  description: string;
  href: string;
  interest: GoalInterest;
  gradient: "green" | "blue" | "navy-green" | "navy-blue";
}

/**
 * Section 2 (Phase 2B) -- "What Could Your Student Do With More
 * Freedom?" Each card still carries an allowlisted interest through
 * to an audience page or /discover, preserving the functional
 * requirement from the original Phase 2 authorization that these
 * entry points route to Discovery, never collect data or create a
 * record themselves.
 */
export const FREEDOM_CARDS: FreedomCard[] = [
  {
    id: "train-more",
    title: "Train More",
    description:
      "Create more room for training, travel and competition without losing sight of academics.",
    href: "/pathways/athletes",
    interest: "athletics",
    gradient: "green",
  },
  {
    id: "get-ahead",
    title: "Get Ahead",
    description:
      "Explore advanced coursework, acceleration and college-level opportunities when your student is ready.",
    href: "/pathways/academic-opportunities",
    interest: "academic_challenge",
    gradient: "blue",
  },
  {
    id: "learn-anywhere",
    title: "Learn Anywhere",
    description:
      "Build flexibility around travel, family schedules, performing arts, competition or other priorities.",
    href: "/pathways/flexible-learning",
    interest: "different_environment",
    gradient: "navy-green",
  },
  {
    id: "take-back-time",
    title: "Take Back Their Time",
    description:
      "Build a more intentional schedule around academics, interests, family and goals.",
    href: "/discover?interest=flexible_schedule",
    interest: "flexible_schedule",
    gradient: "navy-blue",
  },
];
