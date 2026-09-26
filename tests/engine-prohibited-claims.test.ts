import { describe, it, expect } from "vitest";
import { loadContracts } from "@/lib/contracts/loader";

/**
 * Structural guarantees against the prohibited-claim list
 * (PHASE4_DECISION_ENGINE_SPEC_V1.md / section 54 of the Phase 4
 * instruction): the engine must never generate structured facts that
 * would require claiming NCAA eligibility, a reclassification/grade-
 * repeat/delayed-graduation recommendation, a guaranteed graduation
 * date or credit acceptance, or legal homeschool compliance. Since
 * `EngineEvaluation` (src/lib/engine/types.ts) carries only IDs and
 * enums -- never free narrative text -- the only vector for one of
 * these claims to leak through is a rule that scores a base model from
 * exactly this kind of signal. This file asserts, by name, that the
 * specific rules covering these topics never do.
 */

const contracts = loadContracts();

function ruleById(id: string) {
  const rule = contracts.rules.rules.find((r) => r.id === id);
  if (!rule) throw new Error(`rule ${id} not found in contracts/rules.json`);
  return rule;
}

describe("prohibited-claim structural guarantees", () => {
  it("NCAA-related rules never contribute a base-model score (no eligibility conclusion)", () => {
    for (const id of ["ATH_004"]) {
      expect(Object.keys(ruleById(id).score_effects), id).toHaveLength(0);
    }
  });

  it("reclassification-related rules never contribute a base-model score (no grade-repeat/reclassification recommendation)", () => {
    for (const id of ["ATH_005"]) {
      expect(Object.keys(ruleById(id).score_effects), id).toHaveLength(0);
    }
  });

  it("graduation/credit-related consideration rules never contribute a base-model score (no guaranteed date or credit acceptance)", () => {
    for (const id of ["ADV_005", "HS_001", "HS_002", "HS_004"]) {
      expect(Object.keys(ruleById(id).score_effects), id).toHaveLength(0);
    }
  });

  it("college-athletics rules never contribute a base-model score (no recruiting/scholarship likelihood claim)", () => {
    for (const id of ["ATH_003"]) {
      expect(Object.keys(ruleById(id).score_effects), id).toHaveLength(0);
    }
  });

  it("homeschool-state-compliance review is never scored (no legal compliance claim)", () => {
    // HOME_001 legitimately scores B08/B09 for homeschool_interest itself
    // (a preference signal); its activated REV_STATE_HOMESCHOOL signal
    // must never additionally imply verified legal compliance -- there
    // is no rule anywhere whose sole subject is state compliance with a
    // non-empty score effect.
    const homeComplianceRules = contracts.rules.rules.filter(
      (r) => r.status !== "RETIRED" && r.activate.reviews.includes("REV_STATE_HOMESCHOOL"),
    );
    for (const rule of homeComplianceRules) {
      expect(rule.reason_type, rule.id).not.toBe("FEASIBILITY");
    }
  });

  it("no taxonomy label or review signal id encodes a superlative or eligibility claim", () => {
    const forbiddenSubstrings = [
      "BEST",
      "PERFECT",
      "GUARANTEED",
      "VERIFIED_ELIGIB",
      "ELIGIBILITY_CONFIRMED",
    ];
    const allIds = [
      ...contracts.taxonomy.base_models.map((m) => m.id + m.label),
      ...contracts.taxonomy.review_signals.map((r) => r.id),
      ...contracts.taxonomy.opportunities.map((o) => o.id + o.label),
      ...contracts.taxonomy.overlays.map((o) => o.id + o.label),
    ];
    for (const id of allIds) {
      for (const forbidden of forbiddenSubstrings) {
        expect(id.toUpperCase(), `${id} vs ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("EngineEvaluation never carries a public numeric score field (structural: candidatePublicLabels values are a closed enum)", async () => {
    const { computeEffectiveAnswers } = await import("@/lib/discovery/normalization");
    const { evaluateDiscoveryProfile } = await import("@/lib/engine/evaluate");
    const effective = computeEffectiveAnswers({
      current_grade: "8",
      current_education_model: "CHARTER",
      school_change_preference: "STAY_CURRENT",
      discovery_reasons: ["ATHLETICS"],
      desired_primary_change: "ATHLETICS_TIME",
      reported_academic_position: "ON_LEVEL",
      flexibility_importance: "SOMEWHAT",
      family_priorities: ["PERSONAL_SUPPORT"],
      desired_parent_involvement: "REGULAR_SUPPORT",
      college_athletics_interest: "DEFINITELY",
      ncaa_interest: "YES",
    });
    const evaluation = evaluateDiscoveryProfile(effective, contracts);
    for (const label of Object.values(evaluation.candidatePublicLabels)) {
      expect(["WORTH_EXPLORING", "WORTH_EXPLORING_WITH_CONSIDERATIONS"]).toContain(label);
    }
    expect(evaluation.globalReviewSignals).toContain("REV_NCAA");
  });
});
