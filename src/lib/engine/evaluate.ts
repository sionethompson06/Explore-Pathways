import "server-only";
import type { EffectiveAnswers } from "@/lib/discovery/types";
import type { LoadedContracts } from "@/lib/contracts";
import { evaluateTriggeredRules } from "./rules";
import {
  computeLinkedGroups,
  evaluateB01Continuity,
  evaluateDisplayGate,
  getCandidateUniverse,
  selectDisplayedCandidates,
} from "./candidates";
import { aggregateCandidateScore } from "./scoring";
import { computeContentStatus, computePublicFitLabel, computeReviewSignals } from "./considerations";
import { hashDecisionInput, hashEffectiveProfile } from "./hash";
import type {
  CandidateEvaluation,
  CandidateModelId,
  EngineEvaluation,
  EngineRun,
  EngineRunMetadata,
  RawContribution,
  ScoringGroup,
} from "./types";

/**
 * The Phase 4 deterministic decision-engine entry point
 * (PHASE4_DECISION_ENGINE_SPEC_V1.md section 34). Pure function: same
 * effective profile + same contract versions always produces a
 * byte-equivalent EngineEvaluation (M08). No database read/write here --
 * Phase 4 requires no live database to evaluate a profile
 * (persistence, if ever added, is `createEngineRun`'s caller's concern,
 * not this function's).
 */
export function evaluateDiscoveryProfile(
  effective: EffectiveAnswers,
  contracts: LoadedContracts,
): EngineEvaluation {
  const { rules, taxonomy, scoringPolicy, questionBank, contentLibrary } = contracts;

  const candidateUniverse = getCandidateUniverse(taxonomy);

  const { triggeredRuleIds, contributions: ruleContributions, activations } =
    evaluateTriggeredRules(effective, rules);

  const b01 = evaluateB01Continuity(effective);
  const allContributions: RawContribution[] = [...ruleContributions, ...b01.contributions];

  const linkedGroups = computeLinkedGroups(effective, scoringPolicy);

  const positiveGroupsByModel = {} as Record<CandidateModelId, ScoringGroup[]>;
  const internalSortScoreByModel = {} as Record<CandidateModelId, number>;
  const displayGateReasons = {} as Record<CandidateModelId, string[]>;
  const excludedCandidates: { modelId: CandidateModelId; reason: string }[] = [];
  const candidates: CandidateEvaluation[] = [];

  for (const modelId of candidateUniverse) {
    if (modelId === "B01" && b01.excluded) {
      positiveGroupsByModel[modelId] = [];
      internalSortScoreByModel[modelId] = scoringPolicy.baseline;
      displayGateReasons[modelId] = [b01.exclusionReason ?? "excluded"];
      excludedCandidates.push({ modelId, reason: b01.exclusionReason ?? "excluded" });
      candidates.push({
        modelId,
        excluded: true,
        ...(b01.exclusionReason !== undefined ? { exclusionReason: b01.exclusionReason } : {}),
        internalScore: scoringPolicy.baseline,
        groupContributions: [],
        positiveGroups: [],
        displayGate: { qualifies: false, reasons: [], usedB01StayCurrentException: false },
        qualifies: false,
        displayed: false,
        scopedReviewSignalIds: [],
      });
      continue;
    }

    const { internalScore, groupContributions } = aggregateCandidateScore(
      effective,
      scoringPolicy,
      modelId,
      allContributions,
    );
    const positiveGroups = groupContributions
      .filter((g) => g.finalContribution > 0)
      .map((g) => g.group);
    const displayGate = evaluateDisplayGate(
      modelId,
      internalScore,
      positiveGroups,
      linkedGroups,
      modelId === "B01" && b01.stayCurrentExceptionEligible,
    );

    positiveGroupsByModel[modelId] = positiveGroups;
    internalSortScoreByModel[modelId] = internalScore;
    displayGateReasons[modelId] = displayGate.reasons;

    candidates.push({
      modelId,
      excluded: false,
      internalScore,
      groupContributions,
      positiveGroups,
      displayGate,
      qualifies: displayGate.qualifies,
      displayed: false,
      scopedReviewSignalIds: [],
    });
  }

  const qualifyingCandidateIds = candidates
    .filter((c) => c.qualifies)
    .map((c) => c.modelId)
    .sort();

  const displayedCandidateIds = selectDisplayedCandidates(
    qualifyingCandidateIds,
    internalSortScoreByModel,
    scoringPolicy,
  );
  const displayedSet = new Set(displayedCandidateIds);

  const { globalReviewSignals, scopedReviewSignals } = computeReviewSignals(
    activations,
    candidateUniverse,
    qualifyingCandidateIds,
    scoringPolicy,
  );

  const candidatePublicLabels: Record<string, "WORTH_EXPLORING" | "WORTH_EXPLORING_WITH_CONSIDERATIONS"> = {};
  for (const candidate of candidates) {
    candidate.displayed = displayedSet.has(candidate.modelId);
    candidate.scopedReviewSignalIds = scopedReviewSignals[candidate.modelId] ?? [];
    if (candidate.displayed) {
      candidate.publicFitLabel = computePublicFitLabel(candidate.scopedReviewSignalIds);
      candidatePublicLabels[candidate.modelId] = candidate.publicFitLabel;
    }
  }

  const activatedOverlayIds = [...new Set(activations.flatMap((a) => a.overlays))].sort();
  const activatedSupportIds = [...new Set(activations.flatMap((a) => a.supports))].sort();
  const activatedOpportunityIds = [...new Set(activations.flatMap((a) => a.opportunities))].sort();

  const contentStatus = computeContentStatus({
    displayedCandidateIds,
    positiveGroupsByModel,
    reclassificationInterest: effective.answers["reclassification_interest"],
    gradeBand: effective.derived.grade_band,
  });

  return {
    effectiveProfileHash: hashEffectiveProfile(effective),
    decisionInputHash: hashDecisionInput(effective),
    derivedFacts: effective.derived,
    triggeredRuleIds,
    contributions: [...allContributions].sort(
      (a, b) => a.modelId.localeCompare(b.modelId) || a.group.localeCompare(b.group) || a.ruleId.localeCompare(b.ruleId),
    ),
    candidates: candidates.sort((a, b) => a.modelId.localeCompare(b.modelId)),
    positiveGroupsByModel,
    internalSortScoreByModel,
    excludedCandidates,
    displayGateReasons,
    qualifyingCandidateIds,
    displayedCandidateIds,
    candidatePublicLabels,
    activatedOverlayIds,
    activatedSupportIds,
    activatedOpportunityIds,
    globalReviewSignals,
    scopedReviewSignals,
    contentStatus,
    questionBankVersion: questionBank.version,
    rulesVersion: rules.version,
    taxonomyVersion: taxonomy.version,
    scoringPolicyVersion: scoringPolicy.version,
    contentVersion: contentLibrary.version,
  };
}

/**
 * Wraps a deterministic EngineEvaluation in a persistence-ready envelope.
 * Clock and run/profile-revision IDs are injected by the caller so tests
 * stay fully deterministic (section 34) -- this function itself never
 * calls Date.now() or generates a random ID. Phase 4 does not persist
 * EngineRun to any database; a future phase's storage adapter would call
 * this and then write the result, without this function changing.
 */
export function createEngineRun(evaluation: EngineEvaluation, metadata: EngineRunMetadata): EngineRun {
  return {
    id: metadata.id,
    profileRevisionId: metadata.profileRevisionId,
    createdAt: metadata.createdAt,
    evaluation,
  };
}
