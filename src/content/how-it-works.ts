/**
 * The five-step Pathways process (Phase 2E, Asset Pack 2 P2-03
 * direction -- "A Clear Path From Possibility to Progress"). Each
 * step's short `description` is the approved Phase 2C/2E copy; its
 * `detail` is the fuller, more careful explanation shown when a step
 * is selected -- this is where the honesty caveats live (staffing,
 * availability, and the Student Success Blueprint being a separate
 * paid engagement, not something included automatically). No price,
 * staffing level, availability, or turnaround time is invented here.
 */
export interface JourneyStep {
  id: "discover" | "explore" | "plan" | "implement" | "support";
  title: string;
  description: string;
  detail: string;
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "discover",
    title: "Discover",
    description: "Tell us about your student and what your family wants to make possible.",
    detail:
      "Answer a short set of questions about your student's priorities. This produces a preliminary Discovery Report -- a starting point, not a finished plan.",
  },
  {
    id: "explore",
    title: "Explore",
    description: "Understand educational directions and possibilities worth exploring.",
    detail:
      "Review the directions and possibilities your report surfaces, and the questions worth asking next.",
  },
  {
    id: "plan",
    title: "Plan",
    description: "Build a personalized Student Success Blueprint when deeper planning is appropriate.",
    detail:
      "Where an advisor conversation is available, it helps turn general directions into a concrete plan for your family. The full Student Success Blueprint is a deeper, separately scoped engagement for families who want a fully built-out plan -- it's a paid engagement, not something included automatically.",
  },
  {
    id: "implement",
    title: "Implement",
    description: "Put the selected school, courses and supports into motion.",
    detail:
      "Once a plan is in place, this step is about putting the selected school, courses and supports into motion for your student.",
  },
  {
    id: "support",
    title: "Support",
    description: "Continue adjusting the pathway as your student's needs and goals evolve.",
    detail:
      "Ongoing support is offered only where it is actually staffed and available for your family's grade level and location -- education pathways are expected to change over time, not be chosen once.",
  },
];
