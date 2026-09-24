import type { ReportContent } from "@/lib/contracts/schemas";
import type { PathwaySection, PathwayStage, ReportArchetype } from "./types";

type RawStage = string | { id: string; label: string; parallelGroup?: string };

function normalizeStage(stage: RawStage, index: number): PathwayStage {
  if (typeof stage === "string") {
    return { id: `STAGE_${index}`, label: stage };
  }
  return { id: stage.id, label: stage.label, parallelGroup: stage.parallelGroup };
}

/** R06 -- Preliminary Pathway (section 25). Supports parallel branches (P12/GR12) via a shared parallelGroup id. */
export function buildPathwaySection(
  archetype: ReportArchetype,
  archetypeContent: Record<string, unknown>,
  reportContent: ReportContent,
): PathwaySection {
  const rawStages = (archetypeContent["r06_stages"] as RawStage[] | undefined) ?? [];
  return {
    title: (archetypeContent["r06_title"] as string | undefined) ?? "WHAT YOUR PATHWAY COULD LOOK LIKE",
    intro: reportContent.pathway_intro_generic,
    stages: rawStages.map(normalizeStage),
    subordinateStatement: reportContent.subordinate_statement,
  };
}
