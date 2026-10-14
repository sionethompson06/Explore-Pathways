import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import { loadContracts, fixturePaths } from "@/lib/contracts/loader";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { evaluateDirectionalEvidenceGate } from "@/lib/engine/candidates";
import type { GroupContributionProvenance, ScoringGroup } from "@/lib/engine/types";
import type { RawAnswers } from "@/lib/discovery/types";

/**
 * Phase 4.1 regression tests for the Directional Evidence Gate and the
 * FLEX_002 public/private virtual correction (DEC-N7 resolution,
 * PHASE4_DECISION_ENGINE_SPEC_V1.md section 11a).
 */

const contracts = loadContracts();

function group(
  name: ScoringGroup,
  rawPositive: number,
  finalContribution: number,
): GroupContributionProvenance {
  return {
    group: name,
    positiveRuleIds: rawPositive > 0 ? ["SYNTHETIC_RULE"] : [],
    negativeRuleIds: [],
    rawPositive,
    rawNegative: 0,
    multiplier: 1,
    multiplierSource: "default",
    finalContribution,
  };
}

describe("A. two generic groups alone do not qualify a model without strong direct model evidence", () => {
  it("rejects a candidate with only schedule + academic positive groups (neither delivery/family_role/continuity, neither >= 2 raw)", () => {
    const groupContributions = [group("schedule", 2, 2), group("academic", 2, 2)];
    const positiveGroups: ScoringGroup[] = ["schedule", "academic"];
    const result = evaluateDirectionalEvidenceGate("B07", groupContributions, positiveGroups);
    expect(result.qualifies).toBe(false);
    expect(result.reason).toMatch(/directional evidence gate/);
  });

  it("rejects a candidate with only schedule + support_structure positive groups (P04's B07 shape)", () => {
    const groupContributions = [group("schedule", 2, 3), group("support_structure", 2, 3)];
    const positiveGroups: ScoringGroup[] = ["schedule", "support_structure"];
    const result = evaluateDirectionalEvidenceGate("B07", groupContributions, positiveGroups);
    expect(result.qualifies).toBe(false);
  });

  it("rejects a candidate with only schedule + a WEAK (+1) delivery contribution (P14's B04 shape)", () => {
    const groupContributions = [group("schedule", 3, 5.25), group("delivery", 1, 1.5)];
    const positiveGroups: ScoringGroup[] = ["schedule", "delivery"];
    const result = evaluateDirectionalEvidenceGate("B04", groupContributions, positiveGroups);
    expect(result.qualifies).toBe(false);
  });

  it("accepts a candidate with only 2 groups when one of them is a STRONG (>=2) delivery/family_role/continuity contribution", () => {
    const groupContributions = [group("schedule", 2, 2), group("delivery", 2, 3.5)];
    const positiveGroups: ScoringGroup[] = ["schedule", "delivery"];
    const result = evaluateDirectionalEvidenceGate("B03", groupContributions, positiveGroups);
    expect(result.qualifies).toBe(true);
  });
});

describe("B. three independent positive groups can qualify a candidate even when its direct delivery evidence is only weak", () => {
  it("accepts a candidate with 3 positive groups (schedule + weak delivery + support_structure), P02/P06's B04 shape", () => {
    const groupContributions = [
      group("schedule", 3, 4.5),
      group("delivery", 1, 1.75),
      group("support_structure", 1, 1),
    ];
    const positiveGroups: ScoringGroup[] = ["schedule", "delivery", "support_structure"];
    const result = evaluateDirectionalEvidenceGate("B04", groupContributions, positiveGroups);
    expect(result.qualifies).toBe(true);
  });

  it("rejects the same weak-delivery candidate when only 2 of those 3 groups are positive", () => {
    const groupContributions = [group("schedule", 3, 4.5), group("delivery", 1, 1.75)];
    const positiveGroups: ScoringGroup[] = ["schedule", "delivery"];
    const result = evaluateDirectionalEvidenceGate("B04", groupContributions, positiveGroups);
    expect(result.qualifies).toBe(false);
  });
});

describe("C. B03 and B06 receive identical FLEX_002 educational contribution", () => {
  it("FLEX_002's score_effects score B03 and B06 identically", () => {
    const flex002 = contracts.rules.rules.find((r) => r.id === "FLEX_002");
    expect(flex002).toBeDefined();
    expect(flex002!.score_effects.B03).toBe(flex002!.score_effects.B06);
  });

  it("P14 (unavailable_academic_times contains VARIES): B03 and B06 end with identical internal scores", () => {
    const fixture = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
      personas: { id: string; raw: RawAnswers }[];
    };
    const p14 = fixture.personas.find((p) => p.id === "P14")!;
    const result = validateCompletedProfile(p14.raw);
    expect(result.ok).toBe(true);
    const evaluation = evaluateDiscoveryProfile(result.effective!, contracts);
    expect(evaluation.internalSortScoreByModel.B03).toBe(evaluation.internalSortScoreByModel.B06);
    // Stable-ID tie-break must then choose B03 as the virtual-family representative.
    expect(evaluation.displayedCandidateIds).toContain("B03");
    expect(evaluation.displayedCandidateIds).not.toContain("B06");
  });
});

describe("D. changing public/private cost preference cannot alter educational scoring", () => {
  it("P14 with every cost_preference value produces identical B03/B06/B07 scores, qualifying and displayed candidates", () => {
    const fixture = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
      personas: { id: string; raw: RawAnswers }[];
    };
    const p14 = fixture.personas.find((p) => p.id === "P14")!;
    const costValues = ["PREFER_TUITION_FREE", "OPEN_AFFORDABLE_PAID", "OPEN_PRIVATE_TUITION", "DEPENDS_ON_VALUE"];

    const evaluations = costValues.map((cost_preference) => {
      const raw = { ...p14.raw, cost_preference };
      const result = validateCompletedProfile(raw);
      expect(result.ok, cost_preference).toBe(true);
      return evaluateDiscoveryProfile(result.effective!, contracts);
    });

    const [first, ...rest] = evaluations;
    for (const evaluation of rest) {
      expect(evaluation.internalSortScoreByModel).toEqual(first!.internalSortScoreByModel);
      expect(evaluation.qualifyingCandidateIds).toEqual(first!.qualifyingCandidateIds);
      expect(evaluation.displayedCandidateIds).toEqual(first!.displayedCandidateIds);
    }
  });
});

describe("E. the directional-evidence gate is derived from contributions/rules, never persona IDs", () => {
  it("the same evidence shape produces the same verdict regardless of which candidate model ID it is attached to (B01 aside, which keeps its own documented exception)", () => {
    const twoGenericGroups = [group("schedule", 2, 2), group("support_structure", 2, 2)];
    const positiveGroups: ScoringGroup[] = ["schedule", "support_structure"];

    for (const modelId of ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09"] as const) {
      const result = evaluateDirectionalEvidenceGate(modelId, twoGenericGroups, positiveGroups);
      expect(result.qualifies, modelId).toBe(false);
    }
  });

  it("B01 is exempt from the gate regardless of evidence shape (its own documented, general exception)", () => {
    const noEvidence: GroupContributionProvenance[] = [];
    const result = evaluateDirectionalEvidenceGate("B01", noEvidence, []);
    expect(result.qualifies).toBe(true);
  });

  it("the gate function signature takes no persona/profile-identity parameter -- only model ID and contribution provenance", () => {
    expect(evaluateDirectionalEvidenceGate.length).toBe(3);
  });
});
