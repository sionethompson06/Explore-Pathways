import type { Taxonomy } from "@/lib/contracts/schemas";
import type { EngineEvaluation } from "@/lib/engine/types";
import type { ReportArchetype } from "./types";

/**
 * Report-archetype selection (PHASE5_DISCOVERY_REPORT_SPEC_V1.md
 * section 9). Every input here is a structured Phase 4 fact
 * (contentStatus, derivedFacts, activated ids, displayed candidate
 * ids) -- never a persona/profile identity. The precedence order
 * below is the literal, deterministic order the spec requires: the
 * first matching rule wins.
 */

const RECOVERY_TRIGGER_OVERLAYS = new Set(["O02", "O03"]);
const RECOVERY_TRIGGER_OPPORTUNITIES = new Set(["OP01", "OP02", "OP03", "OP05"]);
const FLEXIBLE_REMOTE_FAMILIES = new Set(["VIRTUAL", "HYBRID", "FLEXIBLE_SCHOOL", "HOMESCHOOL"]);

export function selectReportArchetype(
  evaluation: EngineEvaluation,
  profileCostPreference: string | undefined,
  taxonomy: Taxonomy,
): ReportArchetype {
  const { contentStatus, derivedFacts, activatedOverlayIds, activatedOpportunityIds, displayedCandidateIds } =
    evaluation;

  // 1. ADVISOR_FIRST_PLACEMENT_REVIEW
  if (contentStatus === "ADVISOR_FIRST") return "ADVISOR_FIRST_PLACEMENT_REVIEW";

  // 2. LIMITED_EXPLORATION
  if (contentStatus === "LIMITED_INFORMATION") return "LIMITED_EXPLORATION";

  const familyOf = (modelId: string): string | undefined =>
    taxonomy.base_models.find((m) => m.id === modelId)?.family;

  // 3. RECOVERY_PLUS_ADVANCEMENT
  const recoveryActive = activatedOverlayIds.includes("O04");
  const advancementSignalActive =
    activatedOverlayIds.some((id) => RECOVERY_TRIGGER_OVERLAYS.has(id)) ||
    activatedOpportunityIds.some((id) => RECOVERY_TRIGGER_OPPORTUNITIES.has(id));
  if (recoveryActive && advancementSignalActive) return "RECOVERY_PLUS_ADVANCEMENT";

  // 4. HIGH_DEMAND_SCHEDULE
  const highDemandSchedule =
    (derivedFacts.athletic_schedule_demand === "SUBSTANTIAL" ||
      derivedFacts.athletic_schedule_demand === "HIGHLY_CONSTRAINED") &&
    (derivedFacts.schedule_flexibility_need === "HIGH" || derivedFacts.schedule_flexibility_need === "VERY_HIGH");
  if (highDemandSchedule) return "HIGH_DEMAND_SCHEDULE";

  // 5. FIT_THEN_FEASIBILITY
  const hasFlexibleRemoteDisplayed = displayedCandidateIds.some((id) => {
    const family = familyOf(id);
    return family !== undefined && FLEXIBLE_REMOTE_FAMILIES.has(family);
  });
  if (profileCostPreference === "PREFER_TUITION_FREE" && hasFlexibleRemoteDisplayed) {
    return "FIT_THEN_FEASIBILITY";
  }

  // 6. FLEXIBLE_WITH_STRUCTURE
  const hasHybridOrVirtualDisplayed = displayedCandidateIds.some((id) => {
    const family = familyOf(id);
    return family === "HYBRID" || family === "VIRTUAL";
  });
  const highSupportAndSchedule =
    derivedFacts.support_structure_need === "HIGH" &&
    (derivedFacts.schedule_flexibility_need === "HIGH" || derivedFacts.schedule_flexibility_need === "VERY_HIGH");
  if (highSupportAndSchedule && hasHybridOrVirtualDisplayed) return "FLEXIBLE_WITH_STRUCTURE";

  // 7. CURRENT_PLUS_GROWTH
  const advancementMateriallyActive =
    activatedOverlayIds.includes("O02") || Object.values(derivedFacts.advancement_opportunities).some(Boolean);
  if (displayedCandidateIds.includes("B01") && advancementMateriallyActive) return "CURRENT_PLUS_GROWTH";

  // 8. GENERIC_PERSONALIZED fallback
  return "GENERIC_PERSONALIZED";
}
