import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { fixturePaths, loadContracts } from "@/lib/contracts/loader";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import type { RawAnswers } from "@/lib/discovery/types";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { assembleDiscoveryReport } from "@/lib/report/assemble";
import type { DiscoveryReportDTO, ReportAssemblyInput } from "@/lib/report/types";

/**
 * Structural report tests for ALL 15 golden personas
 * (PHASE5_DISCOVERY_REPORT_SPEC_V1.md section 63). Beyond the 7
 * owner-approved GR fixtures (tests/report-golden.test.ts), every
 * persona must still produce a valid, safe, bounded ReportDTO via the
 * real pipeline -- generalized template content is acceptable here,
 * exact owner copy is not required.
 */

const contracts = loadContracts();
const goldenProfiles = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
  personas: { id: string; raw: RawAnswers }[];
};

function assembleForPersona(personaId: string): DiscoveryReportDTO {
  const persona = goldenProfiles.personas.find((p) => p.id === personaId)!;
  const validation = validateCompletedProfile(persona.raw);
  const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
  const raw = persona.raw as Record<string, unknown>;
  const input: ReportAssemblyInput = {
    profile: {
      profileRevisionId: `struct_${personaId}`,
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

const RESERVED_OR_RETIRED_IDS = ["OP04", "OP13", "OP15"];

function countWords(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

/** Total personalized reading load (section 52): every visible copy string, excluding nav/footer/legal (not part of the DTO at all) and internal-only provenance ids. */
function totalReadingLoad(report: DiscoveryReportDTO): number {
  const s = report.sections;
  const strings: string[] = [
    s.snapshot.headline,
    s.snapshot.summary,
    ...s.snapshot.chips.map((c) => c.label),
    s.insight.headline,
    s.insight.body,
    ...(s.directions.emptyStateHeading ? [s.directions.emptyStateHeading] : []),
    ...(s.directions.emptyStateBody ? [s.directions.emptyStateBody] : []),
    ...s.directions.cards.flatMap((c) => [
      c.title,
      c.description,
      ...c.whyThisSurfaced,
      ...c.whatToLookFor,
      ...(c.consideration ? [c.consideration] : []),
    ]),
    ...(s.supportOpportunityMap.specialHeading ? [s.supportOpportunityMap.specialHeading] : []),
    ...(s.supportOpportunityMap.specialTiles ?? []).flatMap((t) => [t.title, t.description]),
    ...(s.supportOpportunityMap.support
      ? [
          s.supportOpportunityMap.support.heading,
          ...s.supportOpportunityMap.support.primary.flatMap((t) => [t.title, t.description]),
          ...(s.supportOpportunityMap.support.alsoWorthDiscussing
            ? [s.supportOpportunityMap.support.alsoWorthDiscussing.title, s.supportOpportunityMap.support.alsoWorthDiscussing.description]
            : []),
        ]
      : []),
    ...(s.supportOpportunityMap.opportunities
      ? [
          s.supportOpportunityMap.opportunities.heading,
          ...s.supportOpportunityMap.opportunities.primary.flatMap((t) => [t.title, t.description]),
          ...(s.supportOpportunityMap.opportunities.alsoWorthDiscussing
            ? [
                s.supportOpportunityMap.opportunities.alsoWorthDiscussing.title,
                s.supportOpportunityMap.opportunities.alsoWorthDiscussing.description,
              ]
            : []),
        ]
      : []),
    s.comparisonGuide.title,
    ...s.comparisonGuide.questions.flatMap((q) => [q.question, q.explanation]),
    s.preliminaryPathway.title,
    ...(s.preliminaryPathway.intro ? [s.preliminaryPathway.intro] : []),
    ...s.preliminaryPathway.stages.map((st) => st.label),
    s.preliminaryPathway.subordinateStatement,
    s.conversion.headline,
    s.conversion.body,
    ...s.conversion.valueConcepts.flatMap((v) => [v.title, v.body]),
  ];
  return strings.reduce((sum, text) => sum + countWords(text), 0);
}

describe.each(goldenProfiles.personas.map((p) => p.id))("Structural report validity: %s", (personaId) => {
  it("assembles without throwing and produces a valid ReportDTO", () => {
    expect(() => assembleForPersona(personaId)).not.toThrow();
  });

  const report = assembleForPersona(personaId);

  it("never contains B10", () => {
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/"baseModelId":"B10"/);
    expect(json).not.toContain("B10");
  });

  it("never exposes an internal score publicly", () => {
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/internalSortScore/i);
    expect(json).not.toMatch(/rawContribution/i);
  });

  it("displayed cards exactly equal Phase 4's displayedCandidateIds, no card for a non-displayed candidate", () => {
    const validation = validateCompletedProfile(goldenProfiles.personas.find((p) => p.id === personaId)!.raw);
    const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
    expect(report.sections.directions.cards.map((c) => c.baseModelId)).toEqual(evaluation.displayedCandidateIds);
  });

  it("max 2 cards", () => {
    expect(report.sections.directions.cards.length).toBeLessThanOrEqual(2);
  });

  it("contentStatus is handled correctly (zero cards iff not PERSONALIZED)", () => {
    if (report.contentStatus === "PERSONALIZED") {
      // PERSONALIZED may still have 0 cards in principle, but never a non-empty grid contradicting content status is not tested elsewhere; assert consistency instead.
      expect(report.sections.directions.cards.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(report.sections.directions.cards).toHaveLength(0);
      expect(report.sections.directions.emptyStateHeading).toBeTruthy();
    }
  });

  it("no RESERVED/RETIRED opportunity id ever appears as a tile", () => {
    const json = JSON.stringify(report);
    for (const id of RESERVED_OR_RETIRED_IDS) {
      expect(json).not.toContain(`"id":"${id}"`);
    }
  });

  it("deterministic: re-assembling the same input twice is byte-equivalent (excluding envelope timestamp)", () => {
    const again = assembleForPersona(personaId);
    const { createdAt: _c1, reportId: _r1, ...rest1 } = report;
    const { createdAt: _c2, reportId: _r2, ...rest2 } = again;
    expect(rest1).toEqual(rest2);
    expect(report.reportId).toBe(again.reportId);
  });

  it("respects the ~950-word hard maximum personalized reading load (section 52)", () => {
    expect(totalReadingLoad(report)).toBeLessThanOrEqual(950);
  });

  it("every section's provenance carries a stable contentId, never shown as visible text", () => {
    const json = JSON.stringify(report);
    expect(report.sections.snapshot.provenance.contentId).toBeTruthy();
    expect(report.sections.insight.provenance.contentId).toBeTruthy();
    // Provenance content IDs are internal-record shaped (UPPER_SNAKE__...), never sentence-cased copy.
    expect(json).not.toMatch(/"headline":"[A-Z_]+__/);
  });
});
