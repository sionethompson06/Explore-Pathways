import "server-only";
import type { LoadedContracts } from "@/lib/contracts/loader";
import { canonicalStringify, sha256Hex } from "@/lib/engine/hash";
import { selectReportArchetype } from "./archetypes";
import { buildSnapshotSection } from "./snapshot";
import { buildInsightSection } from "./insights";
import { buildDirectionsSection } from "./directions";
import { buildSupportOpportunityMapSection } from "./support-map";
import { buildComparisonGuideSection } from "./comparisons";
import { buildPathwaySection } from "./pathway";
import { buildActions, buildConversionSection } from "./cta";
import type { DiscoveryReportDTO, ReportAssemblyInput } from "./types";

export const REPORT_TEMPLATE_VERSION = "1.0.0-phase5-report";

/**
 * Phase 5 report assembly (PHASE5_DISCOVERY_REPORT_SPEC_V1.md section
 * 4/34). PHASE 4 DECIDES; PHASE 5 EXPLAINS, PRESENTS, AND CONVERTS --
 * this function reads `input.engine` (an already-final
 * EngineEvaluation) and NEVER rescores a candidate, reranks or
 * replaces a displayed candidate, shows a candidate Phase 4 did not
 * display, creates a third recommendation, turns cost into
 * educational fit, or overrides `contentStatus`. Every educational
 * fact this module touches
 * (displayedCandidateIds, qualifyingCandidateIds, candidatePublicLabels,
 * positiveGroupsByModel, the activated overlay/support/opportunity ids,
 * global and scoped review signals, contentStatus) is read, never
 * recomputed, from
 * `input.engine`. Pure and deterministic: the same
 * (ReportAssemblyInput, contracts, createdAt) always produces the
 * same DiscoveryReportDTO (RPT-M07/RPT-M08).
 */
export function assembleDiscoveryReport(
  input: ReportAssemblyInput,
  contracts: LoadedContracts,
  createdAt: string,
): DiscoveryReportDTO {
  const { profile, engine, operational } = input;
  const { reportContent, taxonomy } = contracts;

  const archetype = selectReportArchetype(engine, profile.costPreference, taxonomy);
  const archetypeContent = reportContent.archetypes[archetype] as Record<string, unknown>;

  const displayedCandidates = engine.displayedCandidateIds
    .map((id) => engine.candidates.find((c) => c.modelId === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const evidenceIds = [
    ...Object.entries(engine.derivedFacts)
      .filter(([, value]) => typeof value === "string" || typeof value === "boolean")
      .map(([key, value]) => `${key}:${String(value)}`),
  ];

  const sections = {
    snapshot: buildSnapshotSection(archetype, archetypeContent, profile, reportContent),
    insight: buildInsightSection(archetype, archetypeContent, evidenceIds),
    directions: buildDirectionsSection(archetype, archetypeContent, displayedCandidates, reportContent),
    supportOpportunityMap: buildSupportOpportunityMapSection(archetype, archetypeContent, engine, reportContent),
    comparisonGuide: buildComparisonGuideSection(archetype, archetypeContent, profile, reportContent),
    preliminaryPathway: buildPathwaySection(archetype, archetypeContent, reportContent),
    conversion: buildConversionSection(archetype, archetypeContent, reportContent),
  };

  const actions = buildActions(
    operational.consultationState,
    operational.saveAvailable,
    sections.conversion.ctaIntentLabel,
    reportContent,
  );

  const reportId = `rpt_${sha256Hex(
    canonicalStringify({
      profileRevisionId: profile.profileRevisionId,
      effectiveProfileHash: engine.effectiveProfileHash,
      reportContentVersion: reportContent.version,
    }),
  ).slice(0, 32)}`;

  return {
    reportId,
    profileRevisionId: profile.profileRevisionId,
    scopeLabel: "INITIAL_EXPLORATION_NOT_PLACEMENT",
    contentStatus: engine.contentStatus,
    reportArchetype: archetype,
    studentLabel: profile.studentDisplayName ?? "Your Student",
    sections,
    actions,
    provenance: {
      reportTemplateVersion: REPORT_TEMPLATE_VERSION,
      reportContentVersion: reportContent.version,
      engineVersions: {
        questionBankVersion: engine.questionBankVersion,
        rulesVersion: engine.rulesVersion,
        taxonomyVersion: engine.taxonomyVersion,
        scoringPolicyVersion: engine.scoringPolicyVersion,
      },
    },
    createdAt,
  };
}
