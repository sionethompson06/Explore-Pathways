import type { EffectiveAnswers } from "@/lib/discovery/types";
import type { ScoringPolicy, Taxonomy } from "@/lib/contracts/schemas";
import type {
  CandidateModelId,
  DisplayGateEvaluation,
  GroupContributionProvenance,
  RawContribution,
  ScoringGroup,
} from "./types";

/**
 * Candidate universe, B01's engine-native continuity logic, the
 * two-tier display gate, and model-family diversity/deduplication
 * (PHASE4_DECISION_ENGINE_SPEC_V1.md sections 5, 11, 12, 30).
 *
 * B01's continuity contribution is deliberately NOT a contracts/rules.json
 * rule: its OPEN_TO_CHANGE eligibility test ("no direct model-change
 * signal already selected") is a negative/"not contains" condition, and
 * the closed rule-condition operator set (eq/in/contains_any -- section
 * 31) cannot express that as a single JSON rule. This function is
 * general -- keyed only on current_education_model, school_change_preference
 * and supplemental_need -- and never on a persona or profile identity.
 * Its output flows through the exact same group-aggregation pipeline
 * (scoring.ts) as an ordinary rule contribution.
 */

const DIRECT_MODEL_CHANGE_SIGNALS = ["ONLINE", "HOMESCHOOL", "BETTER_FIT_ENVIRONMENT", "SCHEDULE_FLEXIBILITY"];

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/** The full base-model universe this engine ever considers: B01-B09, discovery_enabled and not architecturally excluded. B10 is never included, regardless of any future taxonomy edit. */
export function getCandidateUniverse(taxonomy: Taxonomy): CandidateModelId[] {
  return taxonomy.base_models
    .filter((m) => m.id !== "B10" && m.discovery_enabled && m.reachability_status !== "EXCLUDED")
    .map((m) => m.id as CandidateModelId)
    .sort();
}

export interface B01ContinuityResult {
  excluded: boolean;
  exclusionReason?: string;
  contributions: RawContribution[];
  stayCurrentExceptionEligible: boolean;
}

export function evaluateB01Continuity(effective: EffectiveAnswers): B01ContinuityResult {
  const currentModel = effective.answers["current_education_model"];
  const changePreference = effective.answers["school_change_preference"];
  const supplementalNeed = effective.derived.supplemental_need;
  const discoveryReasons = asStringArray(effective.answers["discovery_reasons"]);

  if (currentModel === "NOT_ENROLLED") {
    return {
      excluded: true,
      exclusionReason:
        "current_education_model = NOT_ENROLLED: B01 (current arrangement with support) presumes a current arrangement to build on, so it is objectively excluded.",
      contributions: [],
      stayCurrentExceptionEligible: false,
    };
  }

  const hasRealCurrentModel =
    typeof currentModel === "string" && currentModel !== "UNKNOWN" && currentModel.length > 0;

  const contributions: RawContribution[] = [];
  let stayCurrentExceptionEligible = false;

  if (hasRealCurrentModel && changePreference === "STAY_CURRENT") {
    contributions.push({
      source: "ENGINE_B01_CONTINUITY",
      ruleId: "ENGINE_B01_STAY_CURRENT",
      modelId: "B01",
      group: "continuity" satisfies ScoringGroup,
      effect: 4,
    });
    stayCurrentExceptionEligible = true;
  } else if (hasRealCurrentModel && changePreference === "OPEN_TO_CHANGE") {
    const hasDirectModelChangeSignal = discoveryReasons.some((reason) =>
      DIRECT_MODEL_CHANGE_SIGNALS.includes(reason),
    );
    if (!hasDirectModelChangeSignal) {
      contributions.push({
        source: "ENGINE_B01_CONTINUITY",
        ruleId: "ENGINE_B01_OPEN_TO_CHANGE",
        modelId: "B01",
        group: "continuity" satisfies ScoringGroup,
        effect: 1,
      });
    }
  }
  // SEEKING_CHANGE (or any other value): no positive B01 continuity contribution.

  const eligibleForSupplemental =
    hasRealCurrentModel &&
    (changePreference === "STAY_CURRENT" ||
      (changePreference === "OPEN_TO_CHANGE" &&
        !discoveryReasons.some((reason) => DIRECT_MODEL_CHANGE_SIGNALS.includes(reason))));

  if (eligibleForSupplemental && supplementalNeed === true) {
    contributions.push({
      source: "ENGINE_B01_CONTINUITY",
      ruleId: "ENGINE_B01_SUPPLEMENTAL",
      modelId: "B01",
      group: "academic" satisfies ScoringGroup,
      effect: 3,
    });
  }

  return { excluded: false, contributions, stayCurrentExceptionEligible };
}

/**
 * The two-tier display gate (section 11), plus B01's single narrow,
 * general exception (section 12). Baseline score alone never qualifies.
 */
export function evaluateDisplayGate(
  modelId: CandidateModelId,
  internalScore: number,
  positiveGroups: ScoringGroup[],
  linkedGroups: ReadonlySet<ScoringGroup>,
  b01StayCurrentExceptionEligible: boolean,
): DisplayGateEvaluation {
  const reasons: string[] = [];
  const scoreAboveBaseline = internalScore > 50;
  if (!scoreAboveBaseline) reasons.push("internal score does not exceed baseline (50)");

  if (modelId === "B01" && b01StayCurrentExceptionEligible && scoreAboveBaseline) {
    return { qualifies: true, reasons: [], usedB01StayCurrentException: true };
  }

  const hasTwoPositiveGroups = positiveGroups.length >= 2;
  if (!hasTwoPositiveGroups) {
    reasons.push(
      `only ${positiveGroups.length} distinct scoring group(s) have a positive contribution (need at least 2)`,
    );
  }

  const hasLinkedPositiveGroup = positiveGroups.some((group) => linkedGroups.has(group));
  if (!hasLinkedPositiveGroup) {
    reasons.push(
      "no positive group links to the primary Discovery reason or a selected family priority",
    );
  }

  const qualifies = scoreAboveBaseline && hasTwoPositiveGroups && hasLinkedPositiveGroup;
  return { qualifies, reasons: qualifies ? [] : reasons, usedB01StayCurrentException: false };
}

/**
 * The Directional Evidence Gate (Phase 4.1, DEC-N7): a general
 * qualification requirement applied AFTER the normal display gate, for
 * B02-B09 only -- B01 keeps its own explicit STAY_CURRENT exception
 * (section 12) and is never governed by this gate.
 *
 * Two broad, generic need dimensions (e.g. "wants schedule flexibility"
 * + "wants some support structure") can each independently satisfy the
 * normal gate's "2 distinct positive groups, at least one linked"
 * requirement without ever actually pointing at THIS candidate
 * specifically -- schedule_flexibility_need and support_structure_need
 * are family-level needs that legitimately move several different
 * candidates' scores at once. This gate asks a narrower question: does
 * this SPECIFIC candidate have real, targeted evidence, or only a share
 * of generic need?
 *
 * A candidate satisfies the gate when EITHER:
 *   A. STRONG DIRECT MODEL EVIDENCE -- at least one scoring group in
 *      delivery/family_role/continuity has a raw (pre-multiplier,
 *      pre-clamp) positive contribution of at least 2 for this
 *      candidate. These three groups are the ones whose evidence is
 *      inherently model-specific (a stated delivery preference, a
 *      family-management preference, an explicit stay/change
 *      statement) rather than a generic cross-cutting need.
 *   B. BROAD INDEPENDENT EVIDENCE -- at least three distinct scoring
 *      groups have a final (post-multiplier, post-clamp) positive
 *      contribution for this candidate, i.e. the family's answers
 *      point at this candidate from enough independent angles that
 *      breadth itself is the evidence.
 *
 * Reads only the group-contribution provenance the engine already
 * computed (scoring.ts's rawPositive per group, and the already-derived
 * positiveGroups list) -- never final public labels, never a persona or
 * profile identity.
 */
export function evaluateDirectionalEvidenceGate(
  modelId: CandidateModelId,
  groupContributions: readonly GroupContributionProvenance[],
  positiveGroups: readonly ScoringGroup[],
): { qualifies: boolean; reason?: string } {
  if (modelId === "B01") {
    return { qualifies: true };
  }

  const STRONG_EVIDENCE_GROUPS: readonly ScoringGroup[] = ["delivery", "family_role", "continuity"];
  const hasStrongDirectModelEvidence = groupContributions.some(
    (g) => STRONG_EVIDENCE_GROUPS.includes(g.group) && g.rawPositive >= 2,
  );
  const hasBroadIndependentEvidence = positiveGroups.length >= 3;

  if (hasStrongDirectModelEvidence || hasBroadIndependentEvidence) {
    return { qualifies: true };
  }

  return {
    qualifies: false,
    reason:
      "directional evidence gate: no strong direct model evidence (a delivery/family_role/continuity raw contribution of at least 2) and fewer than 3 independent positive scoring groups",
  };
}

/** The union of scoring groups that the family's primary Discovery reason or any selected family priority maps to. desired_primary_change never satisfies this link on its own (section 10/11). */
export function computeLinkedGroups(
  effective: EffectiveAnswers,
  policy: ScoringPolicy,
): Set<ScoringGroup> {
  const linked = new Set<ScoringGroup>();
  const primaryReason = effective.answers["primary_discovery_reason"];
  if (typeof primaryReason === "string") {
    for (const group of policy.primary_reason_groups[primaryReason] ?? []) {
      linked.add(group as ScoringGroup);
    }
  }
  const familyPriorities = asStringArray(effective.answers["family_priorities"]);
  for (const priority of familyPriorities) {
    for (const group of policy.family_priority_groups[priority] ?? []) {
      linked.add(group as ScoringGroup);
    }
  }
  return linked;
}

const MODEL_FAMILIES: Record<CandidateModelId, string> = {
  B01: "CURRENT",
  B02: "IN_PERSON",
  B03: "VIRTUAL",
  B04: "FLEXIBLE_SCHOOL",
  B05: "IN_PERSON",
  B06: "VIRTUAL",
  B07: "HYBRID",
  B08: "HOMESCHOOL",
  B09: "HOMESCHOOL",
};

/**
 * Model-family diversity/deduplication (section 30): a ceiling of
 * `max_displayed_cards`, never a quota. Sorts qualifying candidates by
 * internal score descending, ties broken by ascending stable base-model
 * ID (never by cost, never by delivery-format preference). Prefers the
 * highest-scoring candidate from a different family next; a second
 * same-family candidate is allowed only when both independently qualify
 * AND that family is listed in `same_family_multi_display_families`.
 */
export function selectDisplayedCandidates(
  qualifyingCandidateIds: readonly CandidateModelId[],
  internalScoreByModel: Readonly<Record<CandidateModelId, number>>,
  policy: ScoringPolicy,
): CandidateModelId[] {
  const sorted = [...qualifyingCandidateIds].sort((a, b) => {
    const scoreDiff = internalScoreByModel[b] - internalScoreByModel[a];
    if (scoreDiff !== 0) return scoreDiff;
    return a.localeCompare(b);
  });

  const displayed: CandidateModelId[] = [];
  const displayedFamilies: string[] = [];

  for (const candidate of sorted) {
    if (displayed.length >= policy.max_displayed_cards) break;
    const family = MODEL_FAMILIES[candidate];
    if (!displayedFamilies.includes(family)) {
      displayed.push(candidate);
      displayedFamilies.push(family);
      continue;
    }
    if (policy.diversity.same_family_multi_display_families.includes(family)) {
      displayed.push(candidate);
      displayedFamilies.push(family);
    }
  }

  return displayed;
}
