import "server-only";
import type { ReportAssemblyProfileContext } from "./types";

/**
 * Extracts the presentation-safe profile portion of
 * ReportAssemblyInput from a raw Discovery answer snapshot
 * (PHASE5_1_END_TO_END_DEMO_INTEGRATION.md section 3). Shared by the
 * production report route, the golden-fixture report demo route, and
 * the interactive Discovery demo's report server action -- exactly
 * one place decides which raw-answer fields are presentation-safe,
 * rather than three copies drifting apart.
 *
 * Pure extraction/mapping only: no validation, no engine call, no
 * educational-decision logic. `rawAnswers` may be a completed
 * profile's raw answers OR a validated EffectiveAnswers' answers --
 * both shapes carry the same field names this function reads.
 */
export function buildReportProfileContext(input: {
  rawAnswers: Record<string, unknown>;
  profileRevisionId: string;
  gradeBand: string;
}): ReportAssemblyProfileContext {
  const raw = input.rawAnswers;
  return {
    profileRevisionId: input.profileRevisionId,
    studentDisplayName: typeof raw["student_display_name"] === "string" ? raw["student_display_name"] : undefined,
    currentGrade: typeof raw["current_grade"] === "string" ? raw["current_grade"] : undefined,
    currentEducationModel:
      typeof raw["current_education_model"] === "string" ? raw["current_education_model"] : undefined,
    selectedFamilyPriorities: Array.isArray(raw["family_priorities"]) ? (raw["family_priorities"] as string[]) : [],
    primaryDiscoveryReason:
      typeof raw["primary_discovery_reason"] === "string" ? raw["primary_discovery_reason"] : undefined,
    desiredPrimaryChange:
      typeof raw["desired_primary_change"] === "string" ? raw["desired_primary_change"] : undefined,
    costPreference: typeof raw["cost_preference"] === "string" ? raw["cost_preference"] : undefined,
    gradeBand: input.gradeBand,
  };
}
