import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import { loadContracts, fixturePaths } from "@/lib/contracts/loader";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import type { RawAnswers } from "@/lib/discovery/types";
import type { LoadedContracts } from "@/lib/contracts/loader";

/**
 * Metamorphic / invariant tests M01-M11
 * (PHASE4_DECISION_ENGINE_SPEC_V1.md section 53). Each holds every input
 * constant except the one dimension under test, and asserts the
 * educational decision body is unaffected by it (or, for the contrast
 * tests M09-M11, that two genuinely different inputs do NOT collapse to
 * the same reasoning).
 */

interface GoldenPersona {
  id: string;
  raw: RawAnswers;
}

const fixture = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
  personas: GoldenPersona[];
};

function personaRaw(id: string): RawAnswers {
  const persona = fixture.personas.find((p) => p.id === id);
  if (!persona) throw new Error(`fixture persona ${id} not found`);
  return structuredClone(persona.raw);
}

function evaluate(raw: RawAnswers, contracts: LoadedContracts) {
  const result = validateCompletedProfile(raw);
  if (!result.ok || !result.effective) {
    throw new Error(`profile failed to validate: ${JSON.stringify(result.errors)}`);
  }
  return evaluateDiscoveryProfile(result.effective, contracts);
}

const contracts = loadContracts();

describe("M01 cost invariance", () => {
  it("changing only cost_preference leaves educational scoring/qualifying/ordering/displayed identical", () => {
    const original = personaRaw("P14");
    const changed = { ...original, cost_preference: "DEPENDS_ON_VALUE" };

    const evalOriginal = evaluate(original, contracts);
    const evalChanged = evaluate(changed, contracts);

    expect(evalChanged.internalSortScoreByModel).toEqual(evalOriginal.internalSortScoreByModel);
    expect(evalChanged.qualifyingCandidateIds).toEqual(evalOriginal.qualifyingCandidateIds);
    expect(evalChanged.displayedCandidateIds).toEqual(evalOriginal.displayedCandidateIds);
    expect(evalChanged.candidatePublicLabels).toEqual(evalOriginal.candidatePublicLabels);

    // Only the cost-feasibility review may differ.
    expect(evalOriginal.scopedReviewSignals["B06"]).toContain("REV_COST_ALIGNMENT");
    expect(evalChanged.scopedReviewSignals["B06"]).not.toContain("REV_COST_ALIGNMENT");
  });
});

describe("M02 athletic prestige invariance", () => {
  it("changing only athletic_level leaves scores/qualifying/displayed identical", () => {
    const original = personaRaw("P06");
    const changed = { ...original, athletic_level: "SCHOOL" };
    expect(original.athletic_level).toBe("NATIONAL");

    const evalOriginal = evaluate(original, contracts);
    const evalChanged = evaluate(changed, contracts);

    expect(evalChanged.internalSortScoreByModel).toEqual(evalOriginal.internalSortScoreByModel);
    expect(evalChanged.qualifyingCandidateIds).toEqual(evalOriginal.qualifyingCandidateIds);
    expect(evalChanged.displayedCandidateIds).toEqual(evalOriginal.displayedCandidateIds);
  });
});

describe("M03 other-text invariance", () => {
  it("changing only *_other_text leaves the structured decision body identical", () => {
    const base = personaRaw("P01");
    const withOtherA: RawAnswers = {
      ...base,
      discovery_reasons: ["ACADEMIC_ACCELERATION", "OTHER"],
      primary_discovery_reason: "ACADEMIC_ACCELERATION",
      discovery_reasons_other_text: "We want more field trips",
    };
    const withOtherB: RawAnswers = {
      ...base,
      discovery_reasons: ["ACADEMIC_ACCELERATION", "OTHER"],
      primary_discovery_reason: "ACADEMIC_ACCELERATION",
      discovery_reasons_other_text: "Something completely different",
    };

    const evalA = evaluate(withOtherA, contracts);
    const evalB = evaluate(withOtherB, contracts);

    expect(evalB.decisionInputHash).toBe(evalA.decisionInputHash);
    expect(evalB.qualifyingCandidateIds).toEqual(evalA.qualifyingCandidateIds);
    expect(evalB.displayedCandidateIds).toEqual(evalA.displayedCandidateIds);
    expect(evalB.internalSortScoreByModel).toEqual(evalA.internalSortScoreByModel);
    expect(evalB.contributions).toEqual(evalA.contributions);

    // The full-profile hash MAY legitimately differ since it hashes the
    // free-text sidecar too.
    expect(evalB.effectiveProfileHash).not.toBe(evalA.effectiveProfileHash);
  });
});

describe("M04 timeline invariance", () => {
  it("changing only desired_start_timeline leaves scoring/qualifying/ordering identical", () => {
    const original = personaRaw("P02");
    const changed = { ...original, desired_start_timeline: "ASAP" };
    expect(original.desired_start_timeline).not.toBe("ASAP");

    const evalOriginal = evaluate(original, contracts);
    const evalChanged = evaluate(changed, contracts);

    expect(evalChanged.internalSortScoreByModel).toEqual(evalOriginal.internalSortScoreByModel);
    expect(evalChanged.qualifyingCandidateIds).toEqual(evalOriginal.qualifyingCandidateIds);
    expect(evalChanged.displayedCandidateIds).toEqual(evalOriginal.displayedCandidateIds);
  });
});

describe("M05 hidden-answer invariance", () => {
  it("a stale answer behind an inactive branch does not affect the decision", () => {
    const clean = personaRaw("P07");
    expect(clean.flexibility_importance).toBe("NOT_IMPORTANT");

    // flexibility_reasons (DISC_014) is only active when
    // flexibility_importance is SOMEWHAT or higher -- injecting a value
    // here simulates a family who once rated flexibility higher, then
    // changed their answer back down, leaving a stale raw value behind.
    const withStaleAnswer: RawAnswers = {
      ...clean,
      flexibility_reasons: ["FAMILY_TRAVEL", "APPOINTMENTS"],
    };

    const evalClean = evaluate(clean, contracts);
    const evalStale = evaluate(withStaleAnswer, contracts);

    expect(evalStale.derivedFacts).toEqual(evalClean.derivedFacts);
    expect(evalStale.qualifyingCandidateIds).toEqual(evalClean.qualifyingCandidateIds);
    expect(evalStale.displayedCandidateIds).toEqual(evalClean.displayedCandidateIds);
    expect(evalStale.internalSortScoreByModel).toEqual(evalClean.internalSortScoreByModel);
    expect(evalStale.decisionInputHash).toBe(evalClean.decisionInputHash);
  });
});

describe("M06 UNKNOWN != NO", () => {
  it("an explicit NO and an UNKNOWN ncaa_interest produce different triggered rules and review signals", () => {
    const base = personaRaw("P08");

    const withUnknown: RawAnswers = { ...base, ncaa_interest: "UNKNOWN" };
    const withNo: RawAnswers = { ...base, ncaa_interest: "NO" };

    const evalUnknown = evaluate(withUnknown, contracts);
    const evalNo = evaluate(withNo, contracts);

    // ATH_004 fires for ncaa_interest in [YES, MAYBE, UNKNOWN] -- an
    // explicit NO must not be silently treated the same as UNKNOWN.
    expect(evalUnknown.triggeredRuleIds).toContain("ATH_004");
    expect(evalNo.triggeredRuleIds).not.toContain("ATH_004");
    expect(evalUnknown.globalReviewSignals).toContain("REV_NCAA");
    expect(evalNo.globalReviewSignals).not.toContain("REV_NCAA");
  });
});

describe("M07 rule-order invariance", () => {
  it("reversed and shuffled rule array order produce an identical decision", () => {
    const raw = personaRaw("P03");
    const result = validateCompletedProfile(raw);
    if (!result.ok || !result.effective) throw new Error("invalid fixture profile");

    const canonical = evaluateDiscoveryProfile(result.effective, contracts);

    const reversedContracts: LoadedContracts = {
      ...contracts,
      rules: { ...contracts.rules, rules: [...contracts.rules.rules].reverse() },
    };
    const evalReversed = evaluateDiscoveryProfile(result.effective, reversedContracts);

    const shuffled = [...contracts.rules.rules];
    // Deterministic "shuffle": reverse odd/even interleave, not random,
    // so this test itself stays deterministic across runs.
    const shuffledOrder = [
      ...shuffled.filter((_, i) => i % 2 === 0).reverse(),
      ...shuffled.filter((_, i) => i % 2 === 1),
    ];
    const shuffledContracts: LoadedContracts = {
      ...contracts,
      rules: { ...contracts.rules, rules: shuffledOrder },
    };
    const evalShuffled = evaluateDiscoveryProfile(result.effective, shuffledContracts);

    expect(evalReversed.internalSortScoreByModel).toEqual(canonical.internalSortScoreByModel);
    expect(evalReversed.qualifyingCandidateIds).toEqual(canonical.qualifyingCandidateIds);
    expect(evalReversed.displayedCandidateIds).toEqual(canonical.displayedCandidateIds);
    expect(evalReversed.triggeredRuleIds).toEqual(canonical.triggeredRuleIds);

    expect(evalShuffled.internalSortScoreByModel).toEqual(canonical.internalSortScoreByModel);
    expect(evalShuffled.qualifyingCandidateIds).toEqual(canonical.qualifyingCandidateIds);
    expect(evalShuffled.displayedCandidateIds).toEqual(canonical.displayedCandidateIds);
    expect(evalShuffled.triggeredRuleIds).toEqual(canonical.triggeredRuleIds);
  });
});

describe("M08 determinism", () => {
  it("the same effective input and contract versions produce a byte-equivalent evaluation body", () => {
    const raw = personaRaw("P10");
    const result = validateCompletedProfile(raw);
    if (!result.ok || !result.effective) throw new Error("invalid fixture profile");

    const first = evaluateDiscoveryProfile(result.effective, contracts);
    const second = evaluateDiscoveryProfile(result.effective, contracts);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("M09 athlete-conflict contrast (P06 vs P07)", () => {
  it("real schedule demand supports flexible-model qualification; bare athlete identity does not", () => {
    const p06 = evaluate(personaRaw("P06"), contracts);
    const p07 = evaluate(personaRaw("P07"), contracts);

    expect(p06.qualifyingCandidateIds).toEqual(expect.arrayContaining(["B03", "B04", "B06"]));
    for (const flexible of ["B03", "B04", "B06", "B07", "B08", "B09"]) {
      expect(p07.qualifyingCandidateIds).not.toContain(flexible);
    }
    expect(p07.qualifyingCandidateIds).toEqual(["B01"]);
  });
});

describe("M10 homeschool-capacity contrast (P04 vs P05)", () => {
  it("the same broad homeschool interest produces different outcomes based on actual support capacity", () => {
    const p04 = evaluate(personaRaw("P04"), contracts);
    const p05 = evaluate(personaRaw("P05"), contracts);

    expect(p04.derivedFacts.homeschool_interest).toBe(true);
    expect(p05.derivedFacts.homeschool_interest).toBe(true);

    expect(p04.qualifyingCandidateIds).toEqual(expect.arrayContaining(["B08", "B09"]));
    expect(p05.qualifyingCandidateIds).not.toContain("B08");
    expect(p05.qualifyingCandidateIds).not.toContain("B09");
  });
});

describe("M11 online-structure contrast (P02 vs P03)", () => {
  it("self-paced-independent and teacher-supported-high-structure online do not collapse to the same reasoning", () => {
    const p02 = evaluate(personaRaw("P02"), contracts);
    const p03 = evaluate(personaRaw("P03"), contracts);

    expect(p02.derivedFacts.support_structure_need).toBe("LOW");
    expect(p03.derivedFacts.support_structure_need).toBe("HIGH");
    expect(p02.qualifyingCandidateIds).not.toEqual(p03.qualifyingCandidateIds);
    expect(p02.displayedCandidateIds).not.toEqual(p03.displayedCandidateIds);
  });
});
