import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildDemoDiscoveryReport } from "../app/discover/demo/actions";
import { fixturePaths, loadContracts } from "@/lib/contracts/loader";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import type { RawAnswers } from "@/lib/discovery/types";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { assembleDiscoveryReport } from "@/lib/report/assemble";
import { buildReportProfileContext } from "@/lib/report/profile-context";
import type { DiscoveryReportDTO } from "@/lib/report/types";

/**
 * Phase 5.1 -- end-to-end interactive Discovery demo integration
 * (PHASE5_1_END_TO_END_DEMO_INTEGRATION.md sections 27/28). These are
 * pipeline tests: they call the REAL `buildDemoDiscoveryReport` server
 * action (never a mocked EngineEvaluation) against known raw Golden
 * Profiles, proving the interactive demo's report-generation path is
 * the exact same canonical Phase 4 engine + Phase 5 assembler
 * production uses.
 */

const contracts = loadContracts();
const goldenProfiles = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
  personas: { id: string; raw: RawAnswers }[];
};

function personaRaw(id: string): RawAnswers {
  return goldenProfiles.personas.find((p) => p.id === id)!.raw;
}

describe.each(["P01", "P03", "P09", "P12", "P15"])(
  "buildDemoDiscoveryReport pipeline: %s (real validation -> real Phase 4 -> real Phase 5)",
  (personaId) => {
    it("produces a report whose contentStatus/archetype/displayed cards match the real Phase 4 evaluation", async () => {
      const raw = personaRaw(personaId);
      const validation = validateCompletedProfile(raw);
      expect(validation.ok).toBe(true);
      const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);

      const result = await buildDemoDiscoveryReport(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.report.contentStatus).toBe(evaluation.contentStatus);
      expect(result.report.sections.directions.cards.map((c) => c.baseModelId)).toEqual(
        evaluation.displayedCandidateIds,
      );
      expect(result.report.sections.directions.cards.length).toBeLessThanOrEqual(2);
    });

    it("never surfaces a non-displayed (merely qualifying) candidate", async () => {
      const raw = personaRaw(personaId);
      const validation = validateCompletedProfile(raw);
      const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
      const result = await buildDemoDiscoveryReport(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const nonDisplayedQualifying = evaluation.qualifyingCandidateIds.filter(
        (id) => !evaluation.displayedCandidateIds.includes(id),
      );
      const json = JSON.stringify(result.report);
      for (const id of nonDisplayedQualifying) {
        expect(json).not.toMatch(new RegExp(`"baseModelId":"${id}"`));
      }
    });

    it("never contains a public score/percentage", async () => {
      const result = await buildDemoDiscoveryReport(personaRaw(personaId));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const json = JSON.stringify(result.report);
      expect(json).not.toMatch(/internalSortScore/i);
      expect(json).not.toMatch(/\d+%\s*match/i);
    });

    it("is deterministic: the same raw answers always produce the same reportId/profileRevisionId", async () => {
      const raw = personaRaw(personaId);
      const first = await buildDemoDiscoveryReport(raw);
      const second = await buildDemoDiscoveryReport(raw);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.report.reportId).toBe(second.report.reportId);
      expect(first.report.profileRevisionId).toBe(second.report.profileRevisionId);
      expect(first.report.profileRevisionId).toMatch(/^demo_interactive_/);
    });
  },
);

it("buildDemoDiscoveryReport returns field errors (never a report) for an incomplete profile", async () => {
  const result = await buildDemoDiscoveryReport({});
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.length).toBeGreaterThan(0);
});

/** Section 28: demo/prebuilt fixture parity -- the interactive builder and the golden-fixture pipeline must produce substantively identical DTOs. */
function assembleViaGoldenPipeline(personaId: string, profileRevisionId: string): DiscoveryReportDTO {
  const raw = personaRaw(personaId);
  const validation = validateCompletedProfile(raw);
  const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
  const profile = buildReportProfileContext({
    rawAnswers: raw as Record<string, unknown>,
    profileRevisionId,
    gradeBand: evaluation.derivedFacts.grade_band,
  });
  return assembleDiscoveryReport(
    { profile, engine: evaluation, operational: { consultationState: "UNCONFIGURED", saveAvailable: false } },
    contracts,
    "2026-01-01T00:00:00.000Z",
  );
}

describe.each([
  ["GR01", "P01"],
  ["GR03", "P03"],
  ["GR12", "P12"],
  ["GR15", "P15"],
])("Demo/Golden-fixture parity: %s (persona %s)", (_fixtureId, personaId) => {
  it("the interactive demo builder's substantive ReportDTO matches the golden-fixture pipeline's", async () => {
    const interactive = await buildDemoDiscoveryReport(personaRaw(personaId));
    expect(interactive.ok).toBe(true);
    if (!interactive.ok) return;

    const golden = assembleViaGoldenPipeline(personaId, interactive.report.profileRevisionId);

    // Envelope/demo metadata is allowed to differ (section 28); everything else must match exactly.
    const { profileRevisionId: _p1, reportId: _r1, createdAt: _c1, ...interactiveSubstance } = interactive.report;
    const { profileRevisionId: _p2, reportId: _r2, createdAt: _c2, ...goldenSubstance } = golden;
    expect(interactiveSubstance).toEqual(goldenSubstance);
  });
});
