/**
 * Section 7 (Phase 2B image-integration) -- brand values band.
 * Values/mission statements only, never a measurable staffing,
 * experience, or outcome claim (see docs/pathways/DECISION_LOG.md on
 * avoiding unverifiable claims like "Nationwide Support").
 */
export interface BrandValue {
  id: "families-first" | "more-options" | "real-people" | "student-centered";
  icon: "support" | "compass" | "discover" | "academic";
  label: string;
}

export const BRAND_VALUES: BrandValue[] = [
  { id: "families-first", icon: "support", label: "Families First" },
  { id: "more-options", icon: "compass", label: "More Options, Not One School" },
  { id: "real-people", icon: "discover", label: "Real People, Not Just Software" },
  { id: "student-centered", icon: "academic", label: "Student-Centered Planning" },
];
