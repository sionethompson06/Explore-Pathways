import type { EffectiveAnswers } from "@/lib/discovery/types";
import type { ScoringPolicy } from "@/lib/contracts/schemas";
import { SCORING_GROUPS } from "./types";
import type {
  CandidateModelId,
  GroupContributionProvenance,
  RawContribution,
  ScoringGroup,
} from "./types";

/**
 * Group aggregation and evidence multipliers
 * (PHASE4_DECISION_ENGINE_SPEC_V1.md sections 8-10, 32). Reads every
 * numeric policy parameter from contracts/scoring-policy.json's
 * structured fields -- no business-policy number is hardcoded here.
 */

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

interface MultiplierResolution {
  multiplier: number;
  source: "primary_reason" | "family_priority" | "desired_change" | "default";
}

/**
 * Resolves the ONE multiplier that applies to a scoring group, using
 * only the single largest applicable multiplier -- primary Discovery
 * reason (1.75) > any selected family priority mapped to that group
 * (1.50, unranked) > desired_primary_change mapped to that group (1.15)
 * > default (1.00). Never stacks multipliers.
 */
export function resolveGroupMultiplier(
  effective: EffectiveAnswers,
  policy: ScoringPolicy,
  group: ScoringGroup,
): MultiplierResolution {
  const primaryReason = effective.answers["primary_discovery_reason"];
  if (
    typeof primaryReason === "string" &&
    (policy.primary_reason_groups[primaryReason] ?? []).includes(group)
  ) {
    return { multiplier: policy.multipliers.primary_reason, source: "primary_reason" };
  }

  const familyPriorities = asStringArray(effective.answers["family_priorities"]);
  const hasFamilyPriorityLink = familyPriorities.some((priority) =>
    (policy.family_priority_groups[priority] ?? []).includes(group),
  );
  if (hasFamilyPriorityLink) {
    return { multiplier: policy.multipliers.family_priority, source: "family_priority" };
  }

  const desiredChange = effective.answers["desired_primary_change"];
  if (
    typeof desiredChange === "string" &&
    (policy.desired_change_groups[desiredChange] ?? []).includes(group)
  ) {
    return { multiplier: policy.multipliers.desired_change, source: "desired_change" };
  }

  return { multiplier: policy.multipliers.default, source: "default" };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Aggregates one candidate's raw contributions into a final,
 * order-independent internal score plus full per-group provenance
 * (section 35). For each group: keep the single largest positive raw
 * effect and the single most negative raw effect, sum them, apply ONE
 * group multiplier, then clamp to the policy's group bounds. The total
 * internal score is the policy baseline plus the sum of every group's
 * clamped contribution, clamped to the policy's score bounds.
 */
export function aggregateCandidateScore(
  effective: EffectiveAnswers,
  policy: ScoringPolicy,
  modelId: CandidateModelId,
  contributions: readonly RawContribution[],
): { internalScore: number; groupContributions: GroupContributionProvenance[] } {
  const forModel = contributions.filter((c) => c.modelId === modelId);
  const groupContributions: GroupContributionProvenance[] = [];
  let total = policy.baseline;

  for (const group of SCORING_GROUPS) {
    const inGroup = forModel.filter((c) => c.group === group);
    const positives = inGroup.filter((c) => c.effect > 0);
    const negatives = inGroup.filter((c) => c.effect < 0);

    const rawPositive = positives.length > 0 ? Math.max(...positives.map((c) => c.effect)) : 0;
    const rawNegative = negatives.length > 0 ? Math.min(...negatives.map((c) => c.effect)) : 0;

    const positiveRuleIds = positives
      .filter((c) => c.effect === rawPositive)
      .map((c) => c.ruleId)
      .sort();
    const negativeRuleIds = negatives
      .filter((c) => c.effect === rawNegative)
      .map((c) => c.ruleId)
      .sort();

    const { multiplier, source } = resolveGroupMultiplier(effective, policy, group);
    const finalContribution = clamp(
      (rawPositive + rawNegative) * multiplier,
      policy.group_bounds.min,
      policy.group_bounds.max,
    );

    groupContributions.push({
      group,
      positiveRuleIds,
      negativeRuleIds,
      rawPositive,
      rawNegative,
      multiplier,
      multiplierSource: source,
      finalContribution,
    });

    total += finalContribution;
  }

  return {
    internalScore: clamp(total, policy.score_bounds.min, policy.score_bounds.max),
    groupContributions: groupContributions.sort((a, b) => a.group.localeCompare(b.group)),
  };
}
