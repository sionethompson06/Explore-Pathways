import type { ReactNode } from "react";
import { Container } from "@/components/marketing/Container";
import type { DiscoveryReportDTO } from "@/lib/report/types";
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
 * The full Phase 5 report page body. Renders a ReportDTO exactly as
 * assembled -- no educational-outcome logic lives here (section 35).
 * Used identically by the production route and the DB-free demo
 * route (section 39/66).
 */
export function ReportView({
  report,
  isDemoRoute = false,
  editAnswersOverride,
}: {
  report: DiscoveryReportDTO;
  isDemoRoute?: boolean;
  /** Production only: the real reopen-for-editing server action, so an already-completed session's draft is explicitly reloaded before editing (see app/discover/report/page.tsx). The demo route never passes this -- it has no session to reopen. */
  editAnswersOverride?: ReactNode;
}) {
  const hasSupportOpportunity =
    Boolean(report.sections.supportOpportunityMap.support) ||
    Boolean(report.sections.supportOpportunityMap.opportunities) ||
    Boolean(report.sections.supportOpportunityMap.specialHeading);

  return (
    <div className={styles.page}>
      <Container>
        {isDemoRoute ? <span className={styles.demoLabel}>Synthetic report demo</span> : null}
        <div className={styles.topActions}>
          {editAnswersOverride ?? (
            <a href={report.actions.editAnswers.href} className={styles.editLink}>
              {report.actions.editAnswers.label}
            </a>
          )}
        </div>
        <div className={styles.stack}>
          <ReportHero snapshot={report.sections.snapshot} />

          <InsightSection insight={report.sections.insight} />

          <div id={AFTER_DIRECTIONS_ANCHOR}>
            <DirectionGrid directions={report.sections.directions} headingId="r03-heading" />
          </div>

          <InlineConversionBand
            headline="Want help comparing the actual options?"
            body="Pathways can help turn these directions into a complete plan."
            action={report.actions.primary}
          />

          {hasSupportOpportunity ? (
            <SupportOpportunityMap map={report.sections.supportOpportunityMap} headingId="r04-heading" />
          ) : null}

          <ComparisonGuide guide={report.sections.comparisonGuide} headingId="r05-heading" />

          <PathwayRoadmap pathway={report.sections.preliminaryPathway} headingId="r06-heading" />

          <ConversionBandFull conversion={report.sections.conversion} action={report.actions.primary} headingId="r07-heading" />
        </div>
      </Container>

      <MobileReportCta afterElementId={AFTER_DIRECTIONS_ANCHOR} label={report.actions.primary.label} href={report.actions.primary.href} />
    </div>
  );
}
