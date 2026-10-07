import type { InsightSection, ReportArchetype } from "./types";
import { provenance } from "./provenance";

/** R02 -- What We Heard (section 13): one archetype-level insight, never a raw-answer dump or a score. */
export function buildInsightSection(
  archetype: ReportArchetype,
  archetypeContent: Record<string, unknown>,
  evidenceIds: string[],
): InsightSection {
  return {
    kicker: archetypeContent["r02_kicker"] as string,
    headline: archetypeContent["r02_headline"] as string,
    body: archetypeContent["r02_body"] as string,
    provenance: provenance(`INSIGHT__${archetype}`, { evidenceIds }),
  };
}
