/**
 * Section (Phase 2E) -- "Why Families Explore a Different Path."
 * Family-voice statements, each with an optional expandable detail.
 * Statements describe a situation, never a guaranteed outcome; detail
 * text is careful not to promise certification, eligibility, or a
 * specific result (see e.g. "reclassification" and "credit recovery"
 * below, which explicitly say Pathways surfaces questions/directions,
 * not a certified determination).
 */
export interface WhyExploreReason {
  id: string;
  icon: "schedule" | "academic" | "compass" | "homeschool" | "support" | "discover" | "explore" | "advance";
  statement: string;
  detail: string;
}

export const WHY_EXPLORE_REASONS: WhyExploreReason[] = [
  {
    id: "practice",
    icon: "schedule",
    statement: "Practice starts before school ends.",
    detail:
      "For students with early practice, competition or travel schedules, a flexible day can protect both training time and academic progress.",
  },
  {
    id: "challenge",
    icon: "academic",
    statement: "My child is ready for more academic challenge.",
    detail:
      "Some students are ready for advanced coursework, independent study, or a faster pace before their current environment can offer it.",
  },
  {
    id: "travel",
    icon: "compass",
    statement: "We travel too much for a traditional schedule.",
    detail:
      "Frequent travel for competition, family circumstances, or other reasons often calls for a schedule that isn't tied to a single classroom.",
  },
  {
    id: "homeschool",
    icon: "homeschool",
    statement: "I'm considering homeschool but don't know where to start.",
    detail:
      "Homeschooling well takes more than a curriculum box -- a workable structure and support plan make the difference.",
  },
  {
    id: "credit-recovery",
    icon: "support",
    statement: "My student needs academic support or credit recovery.",
    detail:
      "Some students need a path to catch up on credits or get additional academic support -- Pathways helps identify what that could look like, it does not guarantee credit or placement.",
  },
  {
    id: "reclassification",
    icon: "discover",
    statement: "We're exploring academic and athletic reclassification.",
    detail:
      "Reclassification is a real, complex decision for many student-athlete families -- Pathways helps surface the right questions to ask, it does not certify eligibility or the outcome.",
  },
  {
    id: "different-environment",
    icon: "explore",
    statement: "My child isn't thriving in the current environment.",
    detail: "Sometimes the right next step is a different model entirely, not just a different school.",
  },
  {
    id: "college",
    icon: "advance",
    statement: "We want to explore college coursework earlier.",
    detail:
      "For students ready to go further, early college coursework can be one direction worth exploring alongside their current studies.",
  },
];
