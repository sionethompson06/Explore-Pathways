import type { EffectiveAnswers } from "@/lib/discovery/types";

/**
 * Phase 4 deterministic decision-engine types
 * (docs/pathways/PHASE4_DECISION_ENGINE_SPEC_V1.md sections 4/31/34/35).
 *
 * This module is pure, deterministic business logic: no browser API, no
 * database, no dynamic eval, no AI. It reads an already-computed
 * `EffectiveAnswers` (src/lib/discovery/normalization.ts) plus the
 * loaded/validated contracts and produces an immutable, versioned
 * `EngineEvaluation` -- never a final parent-facing report, never a
 * provider match, never a public score.
 */

export const SCORING_GROUPS = [
  "schedule",
  "delivery",
  "family_role",
  "support_structure",
  "social",
  "academic",
  "cost",
  "continuity",
  "future",
  "context",
] as const;

export type ScoringGroup = (typeof SCORING_GROUPS)[number];

/** The only base models this engine ever considers -- B10 is never in this universe (see candidates.ts). */
export type CandidateModelId =
  | "B01"
  | "B02"
  | "B03"
  | "B04"
  | "B05"
  | "B06"
  | "B07"
  | "B08"
  | "B09";

export type PublicFitLabel = "WORTH_EXPLORING" | "WORTH_EXPLORING_WITH_CONSIDERATIONS";

export type ContentStatus = "PERSONALIZED" | "LIMITED_INFORMATION" | "ADVISOR_FIRST";

/**
 * One raw, unclamped, unmultiplied score effect contributed by either a
 * triggered JSON rule or the engine-native B01 continuity function
 * (candidates.ts) -- section 35's "which rule(s) contributed" provenance
 * unit. `source` distinguishes an ordinary rules.json rule from the
 * engine-native continuity contributions that cannot be expressed as a
 * single JSON rule condition (see candidates.ts's doc comment).
 */
export interface RawContribution {
  source: "RULE" | "ENGINE_B01_CONTINUITY";
  ruleId: string;
  modelId: CandidateModelId;
  group: ScoringGroup;
  effect: number;
}

/** Full section-35 provenance for one candidate+group's final aggregated contribution. */
export interface GroupContributionProvenance {
  group: ScoringGroup;
  positiveRuleIds: string[];
  negativeRuleIds: string[];
  rawPositive: number;
  rawNegative: number;
  multiplier: number;
  multiplierSource: "primary_reason" | "family_priority" | "desired_change" | "default";
  finalContribution: number;
}

export interface DisplayGateEvaluation {
  qualifies: boolean;
  reasons: string[];
  usedB01StayCurrentException: boolean;
}

export interface CandidateEvaluation {
  modelId: CandidateModelId;
  excluded: boolean;
  exclusionReason?: string;
  internalScore: number;
  groupContributions: GroupContributionProvenance[];
  positiveGroups: ScoringGroup[];
  displayGate: DisplayGateEvaluation;
  qualifies: boolean;
  displayed: boolean;
  publicFitLabel?: PublicFitLabel;
  /** Review signals attached specifically to this candidate (candidate-scoped, material considerations). */
  scopedReviewSignalIds: string[];
}

/**
 * The pure, deterministic evaluation body (section 34). Two profiles with
 * identical EffectiveAnswers and identical contract versions must always
 * produce a byte-equivalent EngineEvaluation (M08). Never persisted
 * directly -- see EngineRun.
 */
export interface EngineEvaluation {
  effectiveProfileHash: string;
  decisionInputHash: string;

  derivedFacts: EffectiveAnswers["derived"];

  triggeredRuleIds: string[];
  contributions: RawContribution[];

  candidates: CandidateEvaluation[];

  positiveGroupsByModel: Record<CandidateModelId, ScoringGroup[]>;
  internalSortScoreByModel: Record<CandidateModelId, number>;

  excludedCandidates: { modelId: CandidateModelId; reason: string }[];
  displayGateReasons: Record<CandidateModelId, string[]>;

  qualifyingCandidateIds: CandidateModelId[];
  displayedCandidateIds: CandidateModelId[];
  candidatePublicLabels: Record<string, PublicFitLabel>;

  activatedOverlayIds: string[];
  activatedSupportIds: string[];
  activatedOpportunityIds: string[];

  /** Review signals with no review_model_scope on their activating rule -- never candidate-scoped, never downgrade a specific card. */
  globalReviewSignals: string[];
  /** Candidate-scoped review signals, keyed by model id, sorted deterministically. */
  scopedReviewSignals: Record<string, string[]>;

  contentStatus: ContentStatus;

  questionBankVersion: string;
  rulesVersion: string;
  taxonomyVersion: string;
  scoringPolicyVersion: string;
  contentVersion: string;
}

/** Injectable so tests remain deterministic (section 34) -- production code supplies a real clock/id generator, tests supply fixed values. */
export interface EngineRunMetadata {
  id: string;
  profileRevisionId: string;
  createdAt: string;
}

/** The persistence-ready envelope. Never written to a database in Phase 4 -- see evaluate.ts's doc comment. */
export interface EngineRun {
  id: string;
  profileRevisionId: string;
  createdAt: string;
  evaluation: EngineEvaluation;
}
