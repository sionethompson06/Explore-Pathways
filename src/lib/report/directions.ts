import type { ReportContent } from "@/lib/contracts/schemas";
import type { CandidateEvaluation, PublicFitLabel } from "@/lib/engine/types";
import type { DirectionCard, DirectionsSection, ReportArchetype } from "./types";
import { provenance } from "./provenance";

const PUBLIC_FIT_LABEL_TEXT: Record<PublicFitLabel, string> = {
  WORTH_EXPLORING: "Worth Exploring",
  WORTH_EXPLORING_WITH_CONSIDERATIONS: "Worth Exploring — With Things to Check",
};

function resolveCandidateCard(
  reportContent: ReportContent,
  modelId: string,
  archetype: ReportArchetype,
): { title: string; description: string; why: string[]; whatToLookFor: string[] } {
  const archetypeKey = `${modelId}__${archetype}`;
  const genericKey = `${modelId}__GENERIC`;
  return (
    reportContent.candidate_cards[archetypeKey] ??
    reportContent.candidate_cards[genericKey] ?? {
      title: modelId,
      description: "This is an education model worth investigating in light of the priorities you shared.",
      why: [],
      whatToLookFor: [],
    }
  );
}

/**
 * R03 -- Directions Worth Exploring (section 14). R03 uses ONLY
 * engine.displayedCandidateIds, in the order Phase 4 already
 * produced, and never re-ranks or adds a third card -- see
 * assemble.ts's doc comment for the full boundary statement.
 */
export function buildDirectionsSection(
  archetype: ReportArchetype,
  archetypeContent: Record<string, unknown>,
  displayedCandidates: CandidateEvaluation[],
  reportContent: ReportContent,
): DirectionsSection {
  if (displayedCandidates.length === 0) {
    return {
      emptyStateHeading: archetypeContent["r03_empty_heading"] as string | undefined,
      emptyStateBody: archetypeContent["r03_empty_body"] as string | undefined,
      cards: [],
    };
  }

  const cards: DirectionCard[] = displayedCandidates.slice(0, 2).map((candidate) => {
    const content = resolveCandidateCard(reportContent, candidate.modelId, archetype);
    const scopedReviewIds = candidate.scopedReviewSignalIds;
    const considerationEntries = scopedReviewIds
      .map((id) => ({ id, entry: reportContent.review_questions[id] }))
      .filter((x): x is { id: string; entry: NonNullable<typeof x.entry> } => Boolean(x.entry))
      .sort((a, b) => a.entry.priority - b.entry.priority);
    const consideration = considerationEntries[0]?.entry.explanation;

    return {
      baseModelId: candidate.modelId,
      title: content.title,
      publicFitLabel: candidate.publicFitLabel!,
      publicFitLabelText: PUBLIC_FIT_LABEL_TEXT[candidate.publicFitLabel!],
      description: content.description,
      whyThisSurfaced: content.why,
      whatToLookFor: content.whatToLookFor,
      consideration,
      provenance: provenance(`DIRECTION__${candidate.modelId}__${archetype}`, {
        evidenceIds: candidate.positiveGroups,
        reviewSignalIds: scopedReviewIds,
      }),
    };
  });

  return { cards };
}
