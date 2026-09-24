import type { CandidateModelId, ContentStatus, EngineEvaluation, PublicFitLabel } from "@/lib/engine/types";

/**
 * Phase 5 report domain types (docs/pathways/PHASE5_DISCOVERY_REPORT_SPEC_V1.md).
 *
 * Phase 4 (src/lib/engine) decides; this module explains, presents
 * and converts. Nothing here recomputes a score, reorders a
 * candidate, or invents a recommendation Phase 4 did not already
 * qualify/display -- see assemble.ts's doc comment for the exact
 * boundary.
 */

export type ReportArchetype =
  | "CURRENT_PLUS_GROWTH"
  | "FLEXIBLE_WITH_STRUCTURE"
  | "HIGH_DEMAND_SCHEDULE"
  | "ADVISOR_FIRST_PLACEMENT_REVIEW"
  | "RECOVERY_PLUS_ADVANCEMENT"
  | "FIT_THEN_FEASIBILITY"
  | "LIMITED_EXPLORATION"
  | "GENERIC_PERSONALIZED";

export type ConsultationState = "LIVE_VERIFIED" | "REQUEST_ONLY" | "UNCONFIGURED";

/** Only presentation-safe profile context ever reaches report assembly -- never staff notes, raw parent_context, or arbitrary Other text. */
export interface ReportAssemblyProfileContext {
  profileRevisionId: string;
  studentDisplayName?: string | undefined;
  currentGrade?: string | undefined;
  currentEducationModel?: string | undefined;
  selectedFamilyPriorities: string[];
  primaryDiscoveryReason?: string | undefined;
  desiredPrimaryChange?: string | undefined;
  costPreference?: string | undefined;
  gradeBand: string;
}

export interface ReportAssemblyOperational {
  consultationState: ConsultationState;
  saveAvailable: boolean;
}

export interface ReportAssemblyInput {
  profile: ReportAssemblyProfileContext;
  engine: EngineEvaluation;
  operational: ReportAssemblyOperational;
}

// ---------------------------------------------------------------------------
// Provenance -- internal only, never rendered, never sent to the client as
// visible text (section 53).
// ---------------------------------------------------------------------------

export interface ContentProvenance {
  contentId: string;
  evidenceIds?: string[];
  ruleIds?: string[];
  reviewSignalIds?: string[];
  profileContextIds?: string[];
}

// ---------------------------------------------------------------------------
// R01 -- Discovery Snapshot
// ---------------------------------------------------------------------------

export interface PriorityChip {
  id: string;
  label: string;
  kind: "EDUCATIONAL" | "FEASIBILITY";
}

export interface SnapshotSection {
  eyebrow: string;
  reportTitle: string;
  headline: string;
  summary: string;
  chips: PriorityChip[];
  scopeStatement: string;
  statusBadge?: string | undefined;
  provenance: ContentProvenance;
}

// ---------------------------------------------------------------------------
// R02 -- What We Heard
// ---------------------------------------------------------------------------

export interface InsightSection {
  kicker: string;
  headline: string;
  body: string;
  provenance: ContentProvenance;
}

// ---------------------------------------------------------------------------
// R03 -- Directions Worth Exploring
// ---------------------------------------------------------------------------

export interface DirectionCard {
  baseModelId: CandidateModelId;
  title: string;
  publicFitLabel: PublicFitLabel;
  publicFitLabelText: string;
  description: string;
  whyThisSurfaced: string[];
  whatToLookFor: string[];
  consideration?: string | undefined;
  provenance: ContentProvenance;
}

export interface DirectionsSection {
  /** Populated only for the zero-card special states (ADVISOR_FIRST / LIMITED_INFORMATION). */
  emptyStateHeading?: string | undefined;
  emptyStateBody?: string | undefined;
  cards: DirectionCard[];
}

// ---------------------------------------------------------------------------
// R04 -- Support & Opportunity Map
// ---------------------------------------------------------------------------

export interface SupportOpportunityTile {
  id: string;
  title: string;
  description: string;
  provenance: ContentProvenance;
}

export interface SupportOpportunitySubsection {
  heading: string;
  primary: SupportOpportunityTile[];
  alsoWorthDiscussing?: SupportOpportunityTile | undefined;
}

export interface SupportOpportunityMapSection {
  /** Omitted entirely (both undefined) when no valid content exists (section 17). */
  support?: SupportOpportunitySubsection | undefined;
  opportunities?: SupportOpportunitySubsection | undefined;
  /** Special-state content (ADVISOR_FIRST "What needs to be reviewed" / LIMITED_INFORMATION "Areas to clarify"). */
  specialHeading?: string | undefined;
  specialTiles?: SupportOpportunityTile[] | undefined;
}

// ---------------------------------------------------------------------------
// R05 -- Comparison Guide
// ---------------------------------------------------------------------------

export interface ComparisonQuestion {
  id: string;
  question: string;
  explanation: string;
  provenance: ContentProvenance;
}

export interface ComparisonGuideSection {
  title: string;
  questions: ComparisonQuestion[];
}

// ---------------------------------------------------------------------------
// R06 -- Preliminary Pathway
// ---------------------------------------------------------------------------

export interface PathwayStage {
  id: string;
  label: string;
  /** Stages sharing the same parallelGroup render side-by-side (P12/GR12 requires this). */
  parallelGroup?: string | undefined;
}

export interface PathwaySection {
  title: string;
  intro?: string | undefined;
  stages: PathwayStage[];
  subordinateStatement: string;
}

// ---------------------------------------------------------------------------
// R07 -- Conversion
// ---------------------------------------------------------------------------

export interface ValueConcept {
  title: string;
  body: string;
}

export interface ConversionSection {
  headline: string;
  body: string;
  valueConcepts: ValueConcept[];
  ctaIntentLabel: string;
}

// ---------------------------------------------------------------------------
// Actions (operationally-safe CTA resolution -- section 29)
// ---------------------------------------------------------------------------

export interface ReportAction {
  label: string;
  href: string;
  operationallySafe: true;
}

export interface ReportActions {
  primary: ReportAction;
  secondary?: ReportAction | undefined;
  editAnswers: ReportAction;
  save?: ReportAction | undefined;
}

// ---------------------------------------------------------------------------
// Provenance envelope + the public DTO itself
// ---------------------------------------------------------------------------

export interface ReportProvenance {
  reportTemplateVersion: string;
  reportContentVersion: string;
  engineVersions: {
    questionBankVersion: string;
    rulesVersion: string;
    taxonomyVersion: string;
    scoringPolicyVersion: string;
  };
}

export interface DiscoveryReportSections {
  snapshot: SnapshotSection;
  insight: InsightSection;
  directions: DirectionsSection;
  supportOpportunityMap: SupportOpportunityMapSection;
  comparisonGuide: ComparisonGuideSection;
  preliminaryPathway: PathwaySection;
  conversion: ConversionSection;
}

/**
 * The public report DTO (section 7). Never contains internalSortScore,
 * raw contribution numbers, sales priority, raw parent context, staff
 * notes, auth tokens, API keys, or raw prompts -- see
 * tests/report-invariants.test.ts RPT-M05/RPT-M09.
 */
export interface DiscoveryReportDTO {
  reportId: string;
  profileRevisionId: string;
  scopeLabel: "INITIAL_EXPLORATION_NOT_PLACEMENT";
  contentStatus: ContentStatus;
  reportArchetype: ReportArchetype;
  studentLabel: string;

  sections: DiscoveryReportSections;
  actions: ReportActions;
  provenance: ReportProvenance;

  createdAt: string;
}
