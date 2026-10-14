import "server-only";

export { assembleDiscoveryReport, REPORT_TEMPLATE_VERSION } from "./assemble";
export { buildReportProfileContext } from "./profile-context";
export { selectReportArchetype } from "./archetypes";
export { buildSnapshotSection } from "./snapshot";
export { buildInsightSection } from "./insights";
export { buildDirectionsSection } from "./directions";
export { buildSupportOpportunityMapSection } from "./support-map";
export { buildComparisonGuideSection } from "./comparisons";
export { buildPathwaySection } from "./pathway";
export { buildActions, buildConversionSection, resolvePrimaryAction } from "./cta";
export { provenance } from "./provenance";

export type {
  ReportArchetype,
  ConsultationState,
  ReportAssemblyInput,
  ReportAssemblyProfileContext,
  ReportAssemblyOperational,
  DiscoveryReportDTO,
  DiscoveryReportSections,
  SnapshotSection,
  PriorityChip,
  InsightSection,
  DirectionsSection,
  DirectionCard,
  SupportOpportunityMapSection,
  SupportOpportunitySubsection,
  SupportOpportunityTile,
  ComparisonGuideSection,
  ComparisonQuestion,
  PathwaySection,
  PathwayStage,
  ConversionSection,
  ValueConcept,
  ReportAction,
  ReportActions,
  ReportProvenance,
  ContentProvenance,
} from "./types";
