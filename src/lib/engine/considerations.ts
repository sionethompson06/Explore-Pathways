import type { ScoringPolicy } from "@/lib/contracts/schemas";
import type { RuleActivation } from "./rules";
import type { CandidateModelId, ContentStatus, PublicFitLabel, ScoringGroup } from "./types";

/**
 * Review-signal attachment (candidate-scoped vs global) and the public
 * fit label / content status derivations
 * (PHASE4_DECISION_ENGINE_SPEC_V1.md sections 27-29).
 *
 * REV_STATE_AVAILABILITY is attached engine-natively here, not by a
 * single contracts/rules.json rule: it applies to any QUALIFYING
 * candidate whose base model ID falls in scoring-policy.json's
 * material_review_mapping.REV_STATE_AVAILABILITY scope, regardless of
 * the specific reason that candidate qualified (see scoring-policy.json's
 * `state_availability_policy` field for the full rationale).
 */

export interface ReviewSignalResult {
  globalReviewSignals: string[];
  scopedReviewSignals: Record<string, string[]>;
}

export function computeReviewSignals(
  activations: readonly RuleActivation[],
  candidateUniverse: readonly CandidateModelId[],
  qualifyingCandidateIds: readonly CandidateModelId[],
  policy: ScoringPolicy,
): ReviewSignalResult {
  const globalSet = new Set<string>();
  const scopedByModel = new Map<CandidateModelId, Set<string>>();
  for (const modelId of candidateUniverse) {
    scopedByModel.set(modelId, new Set());
  }

  for (const activation of activations) {
    for (const reviewId of activation.reviews) {
      if (activation.reviewModelScope === undefined) {
        globalSet.add(reviewId);
        continue;
      }
      for (const modelId of activation.reviewModelScope) {
        scopedByModel.get(modelId)?.add(reviewId);
      }
    }
  }

  const stateAvailabilityScope = policy.material_review_mapping["REV_STATE_AVAILABILITY"] ?? [];
  for (const modelId of qualifyingCandidateIds) {
    if (stateAvailabilityScope.includes(modelId)) {
      scopedByModel.get(modelId)?.add("REV_STATE_AVAILABILITY");
    }
  }

  const scopedReviewSignals: Record<string, string[]> = {};
  for (const [modelId, reviews] of scopedByModel.entries()) {
    scopedReviewSignals[modelId] = [...reviews].sort();
  }

  return {
    globalReviewSignals: [...globalSet].sort(),
    scopedReviewSignals,
  };
}

/**
 * Public fit label (section 28): WORTH_EXPLORING when a displayed
 * candidate clears the gate with no material candidate-specific review
 * signal attached; WORTH_EXPLORING_WITH_CONSIDERATIONS when at least
 * one is attached. MORE_INFORMATION_HELPFUL is a no-card concept and is
 * never attached to an actual displayed candidate here.
 */
export function computePublicFitLabel(scopedReviewSignalsForModel: readonly string[]): PublicFitLabel {
  return scopedReviewSignalsForModel.length > 0
    ? "WORTH_EXPLORING_WITH_CONSIDERATIONS"
    : "WORTH_EXPLORING";
}

export interface ContentStatusInput {
  displayedCandidateIds: readonly CandidateModelId[];
  positiveGroupsByModel: Readonly<Record<CandidateModelId, ScoringGroup[]>>;
  reclassificationInterest: unknown;
  gradeBand: unknown;
}

/**
 * Content status (section 29). PERSONALIZED whenever at least one
 * meaningful pathway direction is displayed. Otherwise ADVISOR_FIRST
 * when no candidate has any independent positive scoring evidence at
 * all AND the primary issue is one that needs individualized review
 * before any model matching can be responsible (a reclassification
 * question answered YES/POSSIBLY, or an undetermined grade/placement
 * context) -- both named explicitly in the spec, general rather than
 * persona-keyed. Otherwise LIMITED_INFORMATION.
 */
export function computeContentStatus(input: ContentStatusInput): ContentStatus {
  if (input.displayedCandidateIds.length > 0) return "PERSONALIZED";

  const noIndependentEvidenceAnywhere = Object.values(input.positiveGroupsByModel).every(
    (groups) => groups.length === 0,
  );

  const reclassificationFlagged =
    input.reclassificationInterest === "YES" || input.reclassificationInterest === "POSSIBLY";
  const undeterminedGrade = input.gradeBand === "UNDETERMINED";

  if (noIndependentEvidenceAnywhere && (reclassificationFlagged || undeterminedGrade)) {
    return "ADVISOR_FIRST";
  }

  return "LIMITED_INFORMATION";
}
