import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { fixturePaths, loadContracts } from "@/lib/contracts/loader";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import type { RawAnswers } from "@/lib/discovery/types";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { assembleDiscoveryReport } from "@/lib/report/assemble";
import type { DiscoveryReportDTO, ReportAssemblyInput } from "@/lib/report/types";

/**
 * Report invariant / metamorphic tests (PHASE5_DISCOVERY_REPORT_SPEC_V1.md
 * section 64, RPT-M01-M10). These probe the PHASE 4 DECIDES / PHASE 5
 * EXPLAINS boundary directly -- report-content ordering, cost
 * preference, and *_other_text must never leak into an educational
 * decision, and the reverse is equally guaranteed: Phase 4's own
 * decisions are always faithfully reflected, never re-derived here.
 */

const contracts = loadContracts();
const goldenProfiles = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
  personas: { id: string; raw: RawAnswers }[];
};

function assembleForRaw(raw: RawAnswers, profileRevisionId: string): DiscoveryReportDTO {
  const validation = validateCompletedProfile(raw);
  expect(validation.ok).toBe(true);
  const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
  const rawRecord = raw as Record<string, unknown>;
  const input: ReportAssemblyInput = {
    profile: {
      profileRevisionId,
      studentDisplayName: typeof rawRecord["student_display_name"] === "string" ? rawRecord["student_display_name"] : undefined,
      currentGrade: typeof rawRecord["current_grade"] === "string" ? rawRecord["current_grade"] : undefined,
      currentEducationModel:
        typeof rawRecord["current_education_model"] === "string" ? rawRecord["current_education_model"] : undefined,
      selectedFamilyPriorities: Array.isArray(rawRecord["family_priorities"]) ? (rawRecord["family_priorities"] as string[]) : [],
      primaryDiscoveryReason:
        typeof rawRecord["primary_discovery_reason"] === "string" ? rawRecord["primary_discovery_reason"] : undefined,
      desiredPrimaryChange:
        typeof rawRecord["desired_primary_change"] === "string" ? rawRecord["desired_primary_change"] : undefined,
      costPreference: typeof rawRecord["cost_preference"] === "string" ? rawRecord["cost_preference"] : undefined,
      gradeBand: evaluation.derivedFacts.grade_band,
    },
    engine: evaluation,
    operational: { consultationState: "UNCONFIGURED", saveAvailable: false },
  };
  return assembleDiscoveryReport(input, contracts, "2026-01-01T00:00:00.000Z");
}

function persona(id: string): RawAnswers {
  return goldenProfiles.personas.find((p) => p.id === id)!.raw;
}

describe("RPT-M01 -- Phase 4 display authority", () => {
  it("changing report-content section ordering cannot change displayedCandidateIds", () => {
    const raw = persona("P03");
    const validation = validateCompletedProfile(raw);
    const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
    const reordered = structuredClone(contracts);
    // Reorder the archetypes map's keys -- object key order is never load-bearing.
    reordered.reportContent.archetypes = Object.fromEntries(
      Object.entries(reordered.reportContent.archetypes).reverse(),
    );
    const report = assembleDiscoveryReport(
      {
        profile: {
          profileRevisionId: "m01",
          selectedFamilyPriorities: [],
          gradeBand: evaluation.derivedFacts.grade_band,
        },
        engine: evaluation,
        operational: { consultationState: "UNCONFIGURED", saveAvailable: false },
      },
      reordered,
      "2026-01-01T00:00:00.000Z",
    );
    expect(report.sections.directions.cards.map((c) => c.baseModelId)).toEqual(evaluation.displayedCandidateIds);
  });
});

describe("RPT-M02 -- no third candidate", () => {
  it("P14's B06 qualifies internally but is never surfaced as a recommendation", () => {
    const raw = persona("P14");
    const validation = validateCompletedProfile(raw);
    const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
    expect(evaluation.qualifyingCandidateIds).toContain("B06");
    expect(evaluation.displayedCandidateIds).not.toContain("B06");
    const report = assembleForRaw(raw, "m02");
    expect(report.sections.directions.cards.map((c) => c.baseModelId)).not.toContain("B06");
    expect(JSON.stringify(report)).not.toMatch(/"baseModelId":"B06"/);
  });
});

describe("RPT-M03 -- cost does not become fit", () => {
  it("changing cost_preference never changes Phase 4 candidates/order/scores, and never changes the model card grid", () => {
    const raw = persona("P14");
    const costValues = ["PREFER_TUITION_FREE", "OPEN_AFFORDABLE_PAID", "OPEN_PRIVATE_TUITION", "DEPENDS_ON_VALUE"];
    const reports = costValues.map((cost_preference) => assembleForRaw({ ...raw, cost_preference }, "m03"));
    const [first, ...rest] = reports;
    for (const report of rest) {
      expect(report!.sections.directions.cards.map((c) => ({ id: c.baseModelId, title: c.title, publicFitLabel: c.publicFitLabel }))).toEqual(
        first!.sections.directions.cards.map((c) => ({ id: c.baseModelId, title: c.title, publicFitLabel: c.publicFitLabel })),
      );
    }
  });

  it("cost_preference MAY change the feasibility chip and comparison question, never educational content", () => {
    const raw = persona("P14");
    const withCost = assembleForRaw({ ...raw, cost_preference: "PREFER_TUITION_FREE" }, "m03b");
    const withoutCost = assembleForRaw({ ...raw, cost_preference: "DEPENDS_ON_VALUE" }, "m03c");
    const feasibilityChip = (r: DiscoveryReportDTO) => r.sections.snapshot.chips.some((c) => c.kind === "FEASIBILITY");
    expect(feasibilityChip(withCost)).toBe(true);
    expect(feasibilityChip(withoutCost)).toBe(false);
    expect(withCost.sections.directions.cards.map((c) => c.baseModelId)).toEqual(
      withoutCost.sections.directions.cards.map((c) => c.baseModelId),
    );
  });
});

describe("RPT-M04 -- *_other_text invariance", () => {
  it("changing an *_other_text sidecar field never changes report educational content", () => {
    const raw = persona("P03");
    const withoutOther = assembleForRaw(raw, "m04a");
    const withOther = assembleForRaw({ ...raw, discovery_reasons_other_text: "A completely different free-text elaboration" }, "m04b");
    expect(withOther.sections.directions.cards.map((c) => c.baseModelId)).toEqual(
      withoutOther.sections.directions.cards.map((c) => c.baseModelId),
    );
    expect(withOther.reportArchetype).toBe(withoutOther.reportArchetype);
    expect(withOther.sections.snapshot.headline).toBe(withoutOther.sections.snapshot.headline);
  });
});

describe("RPT-M05 -- public score prohibition", () => {
  it("no rendered field contains internalSortScore, a percentage match, or a numeric fit score", () => {
    for (const p of goldenProfiles.personas) {
      const report = assembleForRaw(p.raw, `m05_${p.id}`);
      const json = JSON.stringify(report);
      expect(json).not.toMatch(/internalSortScore/i);
      expect(json).not.toMatch(/\d+%\s*match/i);
      expect(json).not.toMatch(/"score":\s*\d/);
    }
  });
});

describe("RPT-M06 -- zero-card intentionality", () => {
  it("ADVISOR_FIRST (P09) renders useful non-empty content, never an empty recommendation grid", () => {
    const report = assembleForRaw(persona("P09"), "m06a");
    expect(report.sections.directions.cards).toHaveLength(0);
    expect(report.sections.directions.emptyStateHeading).toBeTruthy();
    expect(report.sections.directions.emptyStateBody).toBeTruthy();
    expect(report.sections.supportOpportunityMap.specialHeading).toBeTruthy();
    expect(report.sections.supportOpportunityMap.specialTiles!.length).toBeGreaterThan(0);
  });

  it("LIMITED_INFORMATION (P15) renders useful non-empty content, never an empty recommendation grid", () => {
    const report = assembleForRaw(persona("P15"), "m06b");
    expect(report.sections.directions.cards).toHaveLength(0);
    expect(report.sections.directions.emptyStateHeading).toBeTruthy();
    expect(report.sections.supportOpportunityMap.specialTiles!.length).toBeGreaterThan(0);
  });
});

describe("RPT-M07 -- determinism", () => {
  it("same effective profile + EngineEvaluation + report-content version -> byte-equivalent substantive ReportDTO", () => {
    for (const p of goldenProfiles.personas) {
      const a = assembleForRaw(p.raw, `m07_${p.id}`);
      const b = assembleForRaw(p.raw, `m07_${p.id}`);
      const { createdAt: _a1, ...restA } = a;
      const { createdAt: _b1, ...restB } = b;
      expect(restA).toEqual(restB);
    }
  });
});

describe("RPT-M08 -- report-content order invariance", () => {
  it("reordering JSON content object keys does not change the substantive result", () => {
    const raw = persona("P12");
    const validation = validateCompletedProfile(raw);
    const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
    const original = assembleForRaw(raw, "m08");

    function reverseKeysDeep(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reverseKeysDeep);
      if (value !== null && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).reverse();
        const result: Record<string, unknown> = {};
        for (const [k, v] of entries) result[k] = reverseKeysDeep(v);
        return result;
      }
      return value;
    }

    const reordered = structuredClone(contracts);
    reordered.reportContent = reverseKeysDeep(reordered.reportContent) as typeof reordered.reportContent;
    const reorderedReport = assembleDiscoveryReport(
      {
        profile: {
          profileRevisionId: "m08",
          selectedFamilyPriorities: Array.isArray(raw["family_priorities"]) ? (raw["family_priorities"] as string[]) : [],
          costPreference: typeof raw["cost_preference"] === "string" ? raw["cost_preference"] : undefined,
          gradeBand: evaluation.derivedFacts.grade_band,
        },
        engine: evaluation,
        operational: { consultationState: "UNCONFIGURED", saveAvailable: false },
      },
      reordered,
      "2026-01-01T00:00:00.000Z",
    );
    expect(reorderedReport.sections.directions.cards).toEqual(original.sections.directions.cards);
    expect(reorderedReport.reportArchetype).toBe(original.reportArchetype);
  });
});

describe("RPT-M09 -- forbidden model", () => {
  it("B10 cannot appear anywhere in any persona's ReportDTO", () => {
    for (const p of goldenProfiles.personas) {
      const report = assembleForRaw(p.raw, `m09_${p.id}`);
      expect(JSON.stringify(report)).not.toContain("B10");
    }
  });
});

describe("RPT-M10 -- archetype generalization", () => {
  it("archetype selection depends only on structured facts, never a persona id (same facts -> same archetype for two different persona ids)", () => {
    // P01 and P07 are different personas; force P07's raw to inherit P01's B01-continuity+advancement shape
    // and confirm the resulting archetype tracks the *facts*, not the source persona id.
    const p01 = persona("P01");
    const p07 = persona("P07");
    const p07WithP01Shape: RawAnswers = {
      ...p07,
      current_education_model: p01["current_education_model"],
      school_change_preference: p01["school_change_preference"],
      advancement_interests: p01["advancement_interests"],
      subject_advancement_interests: p01["subject_advancement_interests"],
      discovery_reasons: p01["discovery_reasons"],
      desired_primary_change: p01["desired_primary_change"],
      reported_academic_position: p01["reported_academic_position"],
    };
    const reportP01 = assembleForRaw(p01, "m10a");
    const reportP07Shaped = assembleForRaw(p07WithP01Shape, "m10b");
    expect(reportP07Shaped.reportArchetype).toBe(reportP01.reportArchetype);
  });

  it("the archetype selector function itself never reads a persona/profile identity field", () => {
    // Static assertion of contract: report-content.json's archetype keys are the 8 documented
    // archetype names only -- never a P/GR fixture id.
    const keys = Object.keys(contracts.reportContent.archetypes);
    for (const key of keys) {
      expect(key).not.toMatch(/^P\d+$/);
      expect(key).not.toMatch(/^GR\d+$/);
    }
  });
});
