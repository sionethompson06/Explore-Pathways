/**
 * The six-step service journey (Phase 2 prompt section 4.D). Every
 * step distinguishes what is actually available today (a preliminary,
 * template-based Discovery Report) from what depends on staffing,
 * scheduling, or a separately scoped engagement -- no price,
 * staffing level, availability, or turnaround time is invented here.
 */
export interface JourneyStep {
  id: "discover" | "explore" | "plan" | "implement" | "support" | "advance";
  title: string;
  description: string;
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "discover",
    title: "Discover",
    description:
      "Answer a short set of questions about your student's priorities. This produces a preliminary Discovery Report -- a starting point, not a finished plan.",
  },
  {
    id: "explore",
    title: "Explore",
    description:
      "Review the directions and possibilities your report surfaces, and the questions worth asking next.",
  },
  {
    id: "plan",
    title: "Plan",
    description:
      "Where an advisor conversation is available, it helps turn general directions into a concrete plan for your family.",
  },
  {
    id: "implement",
    title: "Implement",
    description:
      "A deeper, separately scoped Student Success Blueprint is available for families who want a fully built-out plan -- this is a paid engagement, not something included automatically.",
  },
  {
    id: "support",
    title: "Support",
    description:
      "Ongoing support is offered only where it is actually staffed and available for your family's grade level and location.",
  },
  {
    id: "advance",
    title: "Advance",
    description:
      "Revisit and adjust the plan as your student grows -- education pathways are expected to change over time, not be chosen once.",
  },
];
