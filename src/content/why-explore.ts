/**
 * Section 3 (Phase 2B) -- "Why Families Explore a Different Path."
 * Value statements only: sentiment and framing, never a measurable or
 * verifiable claim (no staffing level, credential, or outcome
 * statistic), consistent with the rest of the site's honesty rules.
 */
export interface WhyExploreReason {
  id: "meets-child" | "more-room" | "personalized" | "no-tradeoff" | "real-guidance" | "prepared";
  icon: "support" | "schedule" | "compass" | "academic" | "discover" | "explore";
  text: string;
}

export const WHY_EXPLORE_REASONS: WhyExploreReason[] = [
  { id: "meets-child", icon: "support", text: "It meets your child right where they are." },
  { id: "more-room", icon: "schedule", text: "More room for the things they love." },
  {
    id: "personalized",
    icon: "compass",
    text: "A path built around your student, not a one-size-fits-all program.",
  },
  { id: "no-tradeoff", icon: "academic", text: "Flexibility that doesn't mean giving up rigor." },
  { id: "real-guidance", icon: "discover", text: "Guidance from people who take the time to listen." },
  { id: "prepared", icon: "explore", text: "Room to prepare for whatever comes next." },
];
