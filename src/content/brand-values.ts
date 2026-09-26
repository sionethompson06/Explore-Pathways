/**
 * Section 7 (Phase 2B image-integration; copy revised Phase 2F) --
 * brand values band. Each value pairs a short heading with one
 * supporting line. Values/mission statements only, never a
 * measurable staffing, experience, or outcome claim (see
 * docs/pathways/DECISION_LOG.md on avoiding unverifiable claims like
 * "Nationwide Support").
 */
export interface BrandValue {
  id: "families-first" | "more-possibilities" | "education-experience" | "student-centered";
  icon: "support" | "compass" | "discover" | "academic";
  label: string;
  description: string;
}

export const BRAND_VALUES: BrandValue[] = [
  {
    id: "families-first",
    icon: "support",
    label: "Families First",
    description: "We start with what matters to your student and family.",
  },
  {
    id: "more-possibilities",
    icon: "compass",
    label: "More Possibilities",
    description: "Explore multiple educational directions — not one preset answer.",
  },
  {
    id: "education-experience",
    icon: "discover",
    label: "Education Experience",
    description: "Planning informed by education, student goals and verified options.",
  },
  {
    id: "student-centered",
    icon: "academic",
    label: "Student-Centered",
    description: "The pathway can evolve as your student grows.",
  },
];
