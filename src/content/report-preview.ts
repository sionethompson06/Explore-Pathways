/**
 * Fictional, illustrative-only content for the homepage's "The
 * Discovery Report" preview (Phase 2 prompt section 4.E). This is a
 * marketing illustration, not the Phase 5 report generator or real
 * report-contract.json output -- it deliberately does not include a
 * grade, mastery percentage, school match, eligibility determination,
 * or completed academic plan. Every value here is a placeholder
 * family, never a real one.
 */
export const REPORT_PREVIEW = {
  studentLabel: "Illustrative Student",
  priorities: ["Flexible schedule", "More independence", "Room for athletics"],
  directions: [
    "A schedule model that separates required live sessions from independent work time.",
    "An arrangement where course pacing can flex around a competition season.",
  ],
  opportunity: "Independent-study options for a subject your student wants to go deeper in.",
  planningQuestions: [
    "How much live instruction time does your family actually want each week?",
    "Who would be the primary adult support during independent work blocks?",
  ],
} as const;
