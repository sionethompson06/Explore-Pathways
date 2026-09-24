import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import { computeActiveFlow } from "@/lib/discovery/branching";
import { loadContracts } from "@/lib/contracts/loader";
import { fixturePaths } from "@/lib/contracts/loader";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import type { RawAnswers } from "@/lib/discovery/types";

/**
 * Golden acceptance tests for the 15 owner-calibrated personas
 * (fixtures/golden-profiles.json, PHASE4_DECISION_ENGINE_SPEC_V1.md
 * sections 36-52). These are acceptance criteria, not implementation
 * notes: a failure here must be fixed by generalizing the engine/rules,
 * never by relaxing an expected array (section 52).
 */

interface GoldenPersona {
  id: string;
  label: string;
  raw: RawAnswers;
  expectedDerived?: Record<string, unknown>;
  expectedDerivedFlags?: Record<string, boolean>;
  expectedQualifying: string[];
  expectedDisplayed: string[];
  requiredSignalIds?: string[];
  requiredScopedSignalIds?: Record<string, string[]>;
  forbiddenCandidateIds?: string[];
  forbiddenQualifying?: string[];
  contentStatus: "PERSONALIZED" | "LIMITED_INFORMATION" | "ADVISOR_FIRST";
}

const fixture = JSON.parse(readFileSync(fixturePaths.goldenProfiles, "utf-8")) as {
  version: string;
  personas: GoldenPersona[];
};

const contracts = loadContracts();

describe("Golden Profiles V2 fixture", () => {
  it("is the owner-calibrated v2 fixture with exactly 15 personas", () => {
    expect(fixture.version).toBe("2.0.0-owner-calibrated");
    expect(fixture.personas).toHaveLength(15);
    expect(fixture.personas.map((p) => p.id)).toEqual([
      "P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08",
      "P09", "P10", "P11", "P12", "P13", "P14", "P15",
    ]);
  });
});

for (const persona of fixture.personas) {
  describe(`Golden profile ${persona.id} (${persona.label})`, () => {
    const result = validateCompletedProfile(persona.raw);

    it("profile validates", () => {
      expect(result.ok, JSON.stringify(!result.ok ? result.errors : [])).toBe(true);
    });

    if (!result.ok || !result.effective) {
      return;
    }

    const effective = result.effective;
    const { activeFields } = computeActiveFlow(persona.raw);
    const activeFieldSet = new Set(activeFields);
    const evaluation = evaluateDiscoveryProfile(effective, contracts);

    it("hidden answers do not participate (every effective answer key is currently active or a resolved single-reason primary)", () => {
      for (const field of Object.keys(effective.answers)) {
        const isResolvedPrimaryReason = field === "primary_discovery_reason";
        expect(
          activeFieldSet.has(field) || field.endsWith("_other_text") || isResolvedPrimaryReason,
        ).toBe(true);
      }
    });

    it("expected key derived facts match", () => {
      for (const [key, value] of Object.entries(persona.expectedDerived ?? {})) {
        expect(
          (effective.derived as unknown as Record<string, unknown>)[key],
          `derived.${key}`,
        ).toEqual(value);
      }
      for (const [path, value] of Object.entries(persona.expectedDerivedFlags ?? {})) {
        const [objectKey, flagKey] = path.split(".");
        const obj = (effective.derived as unknown as Record<string, Record<string, unknown>>)[
          objectKey!
        ];
        expect(obj?.[flagKey!], path).toBe(value);
      }
    });

    it("exact expected qualifying candidates match", () => {
      expect([...evaluation.qualifyingCandidateIds].sort()).toEqual(
        [...persona.expectedQualifying].sort(),
      );
    });

    it("exact expected displayed candidates and order match", () => {
      expect(evaluation.displayedCandidateIds).toEqual(persona.expectedDisplayed);
    });

    it("required signals are present", () => {
      const allActivated = new Set<string>([
        ...evaluation.activatedOverlayIds,
        ...evaluation.activatedSupportIds,
        ...evaluation.activatedOpportunityIds,
        ...evaluation.globalReviewSignals,
        ...Object.values(evaluation.scopedReviewSignals).flat(),
      ]);
      for (const id of persona.requiredSignalIds ?? []) {
        expect(allActivated.has(id), `expected ${id} to be activated for ${persona.id}`).toBe(
          true,
        );
      }
      for (const [modelId, ids] of Object.entries(persona.requiredScopedSignalIds ?? {})) {
        for (const id of ids) {
          expect(
            evaluation.scopedReviewSignals[modelId] ?? [],
            `expected ${id} scoped to ${modelId} for ${persona.id}`,
          ).toContain(id);
        }
      }
    });

    it("forbidden candidates are absent", () => {
      for (const id of persona.forbiddenCandidateIds ?? []) {
        expect(evaluation.qualifyingCandidateIds, `${id} qualifying`).not.toContain(id);
        expect(evaluation.displayedCandidateIds, `${id} displayed`).not.toContain(id);
      }
      for (const id of persona.forbiddenQualifying ?? []) {
        expect(evaluation.qualifyingCandidateIds, `${id} qualifying`).not.toContain(id);
      }
    });

    it("content status matches", () => {
      expect(evaluation.contentStatus).toBe(persona.contentStatus);
    });

    it("B10 is absent from the candidate universe entirely", () => {
      expect(evaluation.candidates.map((c) => c.modelId as string)).not.toContain("B10");
      expect(evaluation.qualifyingCandidateIds as string[]).not.toContain("B10");
      expect(evaluation.displayedCandidateIds as string[]).not.toContain("B10");
    });

    it("no public numeric score is exposed", () => {
      for (const label of Object.values(evaluation.candidatePublicLabels)) {
        expect(["WORTH_EXPLORING", "WORTH_EXPLORING_WITH_CONSIDERATIONS"]).toContain(label);
      }
    });
  });
}
