import type { ReactNode } from "react";
import { Container } from "@/components/marketing/Container";
import type { ContentStatus } from "@/lib/engine/types";
import type { DiscoveryReportDTO, ReportAction } from "@/lib/report/types";
import { ReportUtilityHeader } from "./ReportUtilityHeader";
import { ReportHero } from "./ReportHero";
import { InsightSection } from "./InsightSection";
import { DirectionGrid } from "./DirectionGrid";
import { SupportOpportunityMap } from "./SupportOpportunityMap";
import { ComparisonGuide } from "./ComparisonGuide";
import { PathwayRoadmap } from "./PathwayRoadmap";
import { ConversionBandFull, InlineConversionBand } from "./ConversionBand";
import { MobileReportCta } from "./MobileReportCta";
import styles from "./ReportView.module.css";

const AFTER_DIRECTIONS_ANCHOR = "r03-directions-end";

/**
 * Inline conversion band copy varies by contentStatus (section 21).
 * Presentation-layer only -- report-content.json is untouched, and
 * every variant renders the same `report.actions.primary`, so CTA
 * resolution/safety never changes.
 */
function inlineConversionCopy(contentStatus: ContentStatus): { headline: string; body: string } {
  switch (contentStatus) {
    case "ADVISOR_FIRST":
      return {
        headline: "Want help reviewing this decision carefully?",
        body: "Pathways can help organize the questions, information, and next steps before you choose a direction.",
      };
    case "LIMITED_INFORMATION":
      return {
        headline: "Want help getting clearer?",
        body: "Pathways can help turn these open questions into a clearer set of options and next steps.",
      };
    case "PERSONALIZED":
    default:
      return {
        headline: "Want help comparing the actual options?",
        body: "Pathways can help turn these directions into a complete plan.",
      };
  }
}

/**
 * The full Phase 5 report page body. Renders a ReportDTO exactly as
 * assembled -- no educational-outcome logic lives here (section 35).
 * Used identically by the production route and the DB-free demo
 * route (section 39/66).
 */
export function ReportView({
  report,
  demoLabel,
  editAnswersOverride,
  secondaryTopAction,
  primaryActionOverride,
}: {
  report: DiscoveryReportDTO;
  /** Presentation-only subordinate notice (section 16/11 of the Phase 5.1 spec) -- never changes report content. Omitted entirely in production. */
  demoLabel?: string;
  /** Production only: the real reopen-for-editing server action, so an already-completed session's draft is explicitly reloaded before editing (see app/discover/report/page.tsx). The demo routes never pass this -- neither has a database session to reopen. */
  editAnswersOverride?: ReactNode;
  /** Interactive demo only: a "Start Demo Again" control rendered alongside the edit action. */
  secondaryTopAction?: ReactNode;
  /**
   * Phase 6A.3 (sections 5-7): a presentation-only substitute for
   * `report.actions.primary`, used consistently everywhere the primary
   * CTA renders. `report.actions` itself is never mutated -- the
   * canonical assembled DTO (and therefore its real operational
   * consultation state) is completely unaffected. The interactive
   * Discovery demo is the only caller that ever passes this, so it can
   * continue into the separate DB-free `/discover/consultation/demo`
   * flow even though the demo report's own `operational.consultationState`
   * honestly stays `UNCONFIGURED`. Production and the Golden Report
   * fixture demo never pass this, so they are byte-identical to before.
   */
  primaryActionOverride?: ReportAction;
}) {
  const hasSupportOpportunity =
    Boolean(report.sections.supportOpportunityMap.support) ||
    Boolean(report.sections.supportOpportunityMap.opportunities) ||
    Boolean(report.sections.supportOpportunityMap.specialHeading);
  const inlineCopy = inlineConversionCopy(report.contentStatus);
  const primaryAction = primaryActionOverride ?? report.actions.primary;

  return (
    <div className={styles.page}>
      <Container>
        <ReportUtilityHeader
          demoLabel={demoLabel}
          editAnswers={report.actions.editAnswers}
          editAnswersOverride={editAnswersOverride}
          secondaryTopAction={secondaryTopAction}
        />
        <div className={styles.stack}>
          <ReportHero snapshot={report.sections.snapshot} />

          <InsightSection insight={report.sections.insight} contentStatus={report.contentStatus} />

          <div id={AFTER_DIRECTIONS_ANCHOR}>
            <DirectionGrid
              directions={report.sections.directions}
              headingId="r03-heading"
              contentStatus={report.contentStatus}
            />
          </div>

          <InlineConversionBand headline={inlineCopy.headline} body={inlineCopy.body} action={primaryAction} />

          {hasSupportOpportunity ? (
            <SupportOpportunityMap
              map={report.sections.supportOpportunityMap}
              headingId="r04-heading"
              contentStatus={report.contentStatus}
            />
          ) : null}

          <ComparisonGuide guide={report.sections.comparisonGuide} headingId="r05-heading" />

          <PathwayRoadmap pathway={report.sections.preliminaryPathway} headingId="r06-heading" />

          <ConversionBandFull
            conversion={report.sections.conversion}
            action={primaryAction}
            headingId="r07-heading"
            contentStatus={report.contentStatus}
          />
        </div>
      </Container>

      <MobileReportCta afterElementId={AFTER_DIRECTIONS_ANCHOR} label={primaryAction.label} href={primaryAction.href} />
    </div>
  );
}
