import type { ReportContent } from "@/lib/contracts/schemas";
import type { EngineEvaluation } from "@/lib/engine/types";
import type { ReportArchetype, SupportOpportunityMapSection, SupportOpportunitySubsection, SupportOpportunityTile } from "./types";
import { provenance } from "./provenance";

/**
 * Tiers a set of activated ids into (primary <= 3, alsoWorthDiscussing
 * <= 1) using ONLY presentation ordering (sections 19/20): ids the
 * archetype names as central come first (Tier 1); everything else
 * follows in a stable declared order (Tier 2/3, collapsed -- nothing
 * here changes which ids are active, only how already-active ids are
 * arranged). A trailing "also worth discussing" tile appears only
 * when exactly one non-central id remains after the 3 primary slots
 * are filled -- with 2+ leftover ids there is no single principled
 * choice, so the section stays at 3 rather than guessing (section 17:
 * "do not create an enormous tile wall").
 */
function tierIds(
  activeIds: readonly string[],
  centralIds: readonly string[],
): { primary: string[]; alsoWorthDiscussing: string | undefined } {
  const central = centralIds.filter((id) => activeIds.includes(id));
  const remaining = activeIds.filter((id) => !central.includes(id));
  const primary = [...central, ...remaining].slice(0, 3);
  const leftover = [...central, ...remaining].slice(3);
  return { primary, alsoWorthDiscussing: leftover.length === 1 ? leftover[0] : undefined };
}

function toTile(id: string, content: { title: string; description: string } | undefined): SupportOpportunityTile | undefined {
  if (!content) return undefined;
  return { id, title: content.title, description: content.description, provenance: provenance(`TILE__${id}`, { evidenceIds: [id] }) };
}

function buildSubsection(
  heading: string,
  activeIds: readonly string[],
  centralIds: readonly string[],
  tileContent: Record<string, { title: string; description: string }>,
): SupportOpportunitySubsection | undefined {
  if (activeIds.length === 0) return undefined;
  const { primary, alsoWorthDiscussing } = tierIds(activeIds, centralIds);
  const primaryTiles = primary.map((id) => toTile(id, tileContent[id])).filter((t): t is SupportOpportunityTile => Boolean(t));
  if (primaryTiles.length === 0) return undefined;
  const alsoTile = alsoWorthDiscussing ? toTile(alsoWorthDiscussing, tileContent[alsoWorthDiscussing]) : undefined;
  return { heading, primary: primaryTiles, alsoWorthDiscussing: alsoTile };
}

/** R04 -- Support & Opportunity Map (sections 17-20). */
export function buildSupportOpportunityMapSection(
  archetype: ReportArchetype,
  archetypeContent: Record<string, unknown>,
  evaluation: EngineEvaluation,
  reportContent: ReportContent,
): SupportOpportunityMapSection {
  const specialHeading = archetypeContent["r04_special_heading"] as string | undefined;
  if (specialHeading) {
    const specialTiles = (archetypeContent["r04_special_tiles"] as { id: string; title: string; description: string }[] | undefined)?.map(
      (t) => ({ id: t.id, title: t.title, description: t.description, provenance: provenance(`SPECIAL_TILE__${t.id}`) }),
    );
    return { specialHeading, specialTiles };
  }

  const centralSupportIds = (archetypeContent["central_support_ids"] as string[] | undefined) ?? [];
  const centralPossibilityIds = (archetypeContent["central_possibility_ids"] as string[] | undefined) ?? [];

  const support = buildSubsection(
    "Support that may matter",
    evaluation.activatedSupportIds,
    centralSupportIds,
    reportContent.support_tiles,
  );

  const possibilityIds = [...evaluation.activatedOverlayIds, ...evaluation.activatedOpportunityIds];
  const possibilityContent: Record<string, { title: string; description: string }> = {
    ...reportContent.overlay_tiles,
    ...reportContent.opportunity_tiles,
  };
  const opportunities = buildSubsection(
    "Possibilities worth exploring",
    possibilityIds,
    centralPossibilityIds,
    possibilityContent,
  );

  return { support, opportunities };
}
