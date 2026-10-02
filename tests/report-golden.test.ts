import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { fixturePaths, loadContracts } from "@/lib/contracts/loader";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import type { RawAnswers } from "@/lib/discovery/types";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { assembleDiscoveryReport } from "@/lib/report/assemble";
import type { ReportAssemblyInput } from "@/lib/report/types";

/**
 * Golden Report acceptance tests (PHASE5_DISCOVERY_REPORT_SPEC_V1.md
 * sections 54-62). Runs the REAL pipeline end to end -- golden-profile
 * raw answers -> effective answers -> Phase 4 engine ->
 * assembleDiscoveryReport -- never a hand-fed fake EngineEvaluation.
 * fixtures/golden-reports.json is the expectation source.
 */

const contracts = loadContracts();
const goldenReports = JSON.parse(readFileSync("fixtures/golden-reports.json", "utf-8")) as {
  fixtures: {
    id: string;
    personaId: string;
    expectedArchetype: string;
    expectedContentStatus: string;
    expectedDisplayedCandidateIds: string[];
    exact: {
      r01Headline: string;
      r02Headline: string;
      cardTitles: string[];
      r03EmptyHeading: string | null;
      r06StageLabels: string[];
      r06ParallelGroupLabels?: string[];
      r07Headline: string;
      ctaIntentLabel: string;
    };
    mustNotContainCandidateId?: string;
  }[];
};
const goldenProfiles = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
  personas: { id: string; raw: RawAnswers }[];
};

function assembleForPersona(personaId: string) {
  const persona = goldenProfiles.personas.find((p) => p.id === personaId);
  if (!persona) throw new Error(`No golden profile persona ${personaId}`);
  const validation = validateCompletedProfile(persona.raw);
  expect(validation.ok, personaId).toBe(true);
  const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
  const raw = persona.raw as Record<string, unknown>;
  const input: ReportAssemblyInput = {
    profile: {
      profileRevisionId: `golden_${personaId}`,
      studentDisplayName: typeof raw["student_display_name"] === "string" ? raw["student_display_name"] : undefined,
      currentGrade: typeof raw["current_grade"] === "string" ? raw["current_grade"] : undefined,
      currentEducationModel:
        typeof raw["current_education_model"] === "string" ? raw["current_education_model"] : undefined,
      selectedFamilyPriorities: Array.isArray(raw["family_priorities"]) ? (raw["family_priorities"] as string[]) : [],
      primaryDiscoveryReason:
        typeof raw["primary_discovery_reason"] === "string" ? raw["primary_discovery_reason"] : undefined,
      desiredPrimaryChange: typeof raw["desired_primary_change"] === "string" ? raw["desired_primary_change"] : undefined,
      costPreference: typeof raw["cost_preference"] === "string" ? raw["cost_preference"] : undefined,
      gradeBand: evaluation.derivedFacts.grade_band,
    },
    engine: evaluation,
    operational: { consultationState: "UNCONFIGURED", saveAvailable: false },
  };
  return assembleDiscoveryReport(input, contracts, "2026-01-01T00:00:00.000Z");
}

describe.each(goldenReports.fixtures)("Golden Report $id (persona $personaId)", (fixture) => {
  const report = assembleForPersona(fixture.personaId);

  it("archetype matches exactly", () => {
    expect(report.reportArchetype).toBe(fixture.expectedArchetype);
  });

  it("contentStatus matches exactly", () => {
    expect(report.contentStatus).toBe(fixture.expectedContentStatus);
  });

  it("displayed candidate IDs and order match Phase 4's displayedCandidateIds exactly", () => {
    expect(report.sections.directions.cards.map((c) => c.baseModelId)).toEqual(fixture.expectedDisplayedCandidateIds);
  });

  it("R01 headline matches exactly", () => {
    expect(report.sections.snapshot.headline).toBe(fixture.exact.r01Headline);
  });

  it("R02 headline matches exactly", () => {
    expect(report.sections.insight.headline).toBe(fixture.exact.r02Headline);
  });

  it("model card titles match exactly, in order", () => {
    expect(report.sections.directions.cards.map((c) => c.title)).toEqual(fixture.exact.cardTitles);
  });

  it("zero-card special heading matches exactly", () => {
    expect(report.sections.directions.emptyStateHeading ?? null).toBe(fixture.exact.r03EmptyHeading);
  });

  it("Phase 4 public fit label is never overridden", () => {
    for (const card of report.sections.directions.cards) {
      expect(["WORTH_EXPLORING", "WORTH_EXPLORING_WITH_CONSIDERATIONS"]).toContain(card.publicFitLabel);
    }
  });

  it("R06 stage labels/order match exactly", () => {
    expect(report.sections.preliminaryPathway.stages.map((s) => s.label)).toEqual(fixture.exact.r06StageLabels);
  });

  if (fixture.exact.r06ParallelGroupLabels) {
    it("R06 includes the required parallel branch (P12/GR12)", () => {
      const parallelStages = report.sections.preliminaryPathway.stages.filter((s) => s.parallelGroup);
      expect(parallelStages.length).toBeGreaterThanOrEqual(2);
      const groups = new Set(parallelStages.map((s) => s.parallelGroup));
      expect(groups.size).toBe(1);
      expect(parallelStages.map((s) => s.label)).toEqual(fixture.exact.r06ParallelGroupLabels);
    });
  }

  it("R07 headline matches exactly", () => {
    expect(report.sections.conversion.headline).toBe(fixture.exact.r07Headline);
  });

  it("CTA intent label matches exactly", () => {
    expect(report.sections.conversion.ctaIntentLabel).toBe(fixture.exact.ctaIntentLabel);
  });

  if (fixture.mustNotContainCandidateId) {
    it(`never surfaces ${fixture.mustNotContainCandidateId} as a public direction (Phase 4 deduplicated it)`, () => {
      expect(report.sections.directions.cards.map((c) => c.baseModelId)).not.toContain(
        fixture.mustNotContainCandidateId,
      );
      expect(JSON.stringify(report)).not.toContain(`"baseModelId":"${fixture.mustNotContainCandidateId}"`);
    });
  }

  it("no public score/percentage anywhere in the assembled report", () => {
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/internalSortScore/i);
    expect(json).not.toMatch(/%\s*match/i);
  });
});

describe("GR01 (P01) full body-content spot checks (owner-approved copy)", () => {
  const report = assembleForPersona("P01");

  it("R01 summary matches the owner-approved copy", () => {
    expect(report.sections.snapshot.summary).toBe(
      "Your answers suggest that a school change may not be the most important next step right now. Your student appears ready for more challenge, while your family also values support, structure, and the parts of the current arrangement that are already working. The opportunity may be to expand what is possible without unnecessarily disrupting a solid foundation.",
    );
  });

  it("priority chips are Academic Advancement, Personal Support, Structure & Accountability", () => {
    expect(report.sections.snapshot.chips.map((c) => c.label)).toEqual([
      "Academic Advancement",
      "Personal Support",
      "Structure & Accountability",
    ]);
  });

  it("R03 card description/why/what-to-look-for match the owner-approved copy", () => {
    const card = report.sections.directions.cards[0]!;
    expect(card.description).toBe(
      "Keeping the current school arrangement while adding targeted opportunities may give your student more challenge without creating an unnecessary transition.",
    );
    expect(card.whyThisSurfaced).toEqual([
      "Your family would prefer to improve what you already have",
      "Academic advancement is important",
      "Your student is reported to be ahead academically",
    ]);
    expect(card.whatToLookFor).toEqual([
      "Advanced learning in areas of strength",
      "Enrichment beyond the standard curriculum",
      "Additional academic challenge without unnecessary acceleration elsewhere",
    ]);
  });

  it("R04 possibilities include OP01/O02/OP18, no unsupported support tile", () => {
    expect(report.sections.supportOpportunityMap.support).toBeUndefined();
    const ids = report.sections.supportOpportunityMap.opportunities!.primary.map((t) => t.id);
    expect(ids.sort()).toEqual(["O02", "OP01", "OP18"].sort());
  });

  it("R07 body matches the owner-approved copy", () => {
    expect(report.sections.conversion.body).toBe(
      "Pathways can help your family look beyond the standard school day, identify meaningful advancement opportunities, and build a coordinated plan around what your student is ready for next.",
    );
  });
});

describe("GR14 (P14) forbidden-claim and B06-exclusion spot checks", () => {
  const report = assembleForPersona("P14");

  it("feasibility chip is visually distinct (kind FEASIBILITY) and separate from educational chips", () => {
    const feasibility = report.sections.snapshot.chips.filter((c) => c.kind === "FEASIBILITY");
    expect(feasibility).toHaveLength(1);
    expect(feasibility[0]!.label).toBe("Tuition-Free Preferred");
    const educational = report.sections.snapshot.chips.filter((c) => c.kind === "EDUCATIONAL");
    expect(educational.length).toBeGreaterThan(0);
  });

  it("never claims the program 'is free', only 'potentially aligning'", () => {
    const json = JSON.stringify(report).toLowerCase();
    expect(json).not.toMatch(/\bis free\b/);
    expect(json).not.toMatch(/will be tuition-free/);
  });

  it("includes the PROFILE_CONTEXT cost comparison question", () => {
    const costQuestion = report.sections.comparisonGuide.questions.find(
      (q) => q.provenance.profileContextIds?.includes("cost_preference:PREFER_TUITION_FREE"),
    );
    expect(costQuestion).toBeDefined();
    expect(costQuestion!.question).toBe("What practical cost differences matter most to your family?");
  });
});
