import type { EffectiveAnswers } from "@/lib/discovery/types";
import type { Rule, RulesFile } from "@/lib/contracts/schemas";
import { evaluateAllConditions } from "./conditions";
import type { CandidateModelId, RawContribution, ScoringGroup } from "./types";

/** RETIRED rules are kept in contracts/rules.json for explainability only -- they are never evaluated (PHASE4_DECISION_ENGINE_SPEC_V1.md section 31). */
export function isEvaluableRule(rule: Rule): boolean {
  return rule.status !== "RETIRED";
}

export function getEvaluableRules(rulesFile: RulesFile): Rule[] {
  return rulesFile.rules.filter(isEvaluableRule);
}

export interface RuleActivation {
  ruleId: string;
  overlays: string[];
  supports: string[];
  opportunities: string[];
  /** Review signal ids this rule activates, paired with the candidate scope it was declared with (undefined = global, never candidate-scoped). */
  reviews: string[];
  reviewModelScope: CandidateModelId[] | undefined;
}

export interface TriggeredRulesResult {
  triggeredRuleIds: string[];
  contributions: RawContribution[];
  activations: RuleActivation[];
}

function isCandidateModelId(id: string): id is CandidateModelId {
  return /^B0[1-9]$/.test(id);
}

/**
 * Evaluates every evaluable rule against the effective profile and
 * returns triggered rule ids, their raw (unaggregated, unmultiplied)
 * score contributions, and their activation records. This function
 * itself never aggregates by group, never applies a multiplier, and
 * never orders candidates -- see scoring.ts and candidates.ts. Iterating
 * the rules array in file order here is purely a traversal detail;
 * nothing downstream depends on that order (PHASE4_DECISION_ENGINE_SPEC_V1.md
 * section 31's order-independence requirement is satisfied by
 * scoring.ts's aggregation, not by this function).
 */
export function evaluateTriggeredRules(
  effective: EffectiveAnswers,
  rulesFile: RulesFile,
): TriggeredRulesResult {
  const triggeredRuleIds: string[] = [];
  const contributions: RawContribution[] = [];
  const activations: RuleActivation[] = [];

  for (const rule of getEvaluableRules(rulesFile)) {
    if (!evaluateAllConditions(effective, rulesFile.normalized_fact_fields, rule.when.all)) {
      continue;
    }

    triggeredRuleIds.push(rule.id);

    for (const [modelId, effect] of Object.entries(rule.score_effects)) {
      if (!isCandidateModelId(modelId)) continue; // B10 is never a valid score target (contract validation enforces this at the JSON level too).
      contributions.push({
        source: "RULE",
        ruleId: rule.id,
        modelId,
        group: rule.group as ScoringGroup,
        effect,
      });
    }

    activations.push({
      ruleId: rule.id,
      overlays: rule.activate.overlays,
      supports: rule.activate.supports,
      opportunities: rule.activate.opportunities,
      reviews: rule.activate.reviews,
      reviewModelScope: rule.review_model_scope?.filter(isCandidateModelId) as
        | CandidateModelId[]
        | undefined,
    });
  }

  return {
    triggeredRuleIds: triggeredRuleIds.sort(),
    contributions,
    activations,
  };
}
