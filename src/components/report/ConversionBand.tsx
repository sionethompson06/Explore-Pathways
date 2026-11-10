import Link from "next/link";
import type { ContentStatus } from "@/lib/engine/types";
import type { ConversionSection, ReportAction } from "@/lib/report/types";
import styles from "./ConversionBand.module.css";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8h9.5M8.5 3.5L13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function accentClass(contentStatus: ContentStatus): string {
  switch (contentStatus) {
    case "ADVISOR_FIRST":
      return styles.accentAdvisor ?? "";
    case "LIMITED_INFORMATION":
      return styles.accentLimited ?? "";
    case "PERSONALIZED":
    default:
      return styles.accentPersonalized ?? "";
  }
}

/**
 * R07 -- Conversion (section 27/46, polished Phase 5.2 sections
 * 18-20). `action` (label + href) is always passed through unchanged
 * from `report.actions.primary` -- CTA-resolution safety
 * (src/lib/report/cta.ts) is untouched by any styling here. The
 * `contentStatus` prop only selects a presentational accent variant
 * (green/blue/softer); it never changes headline, body, value
 * concepts, or the action itself, and never makes a status look like
 * an error.
 */
export function ConversionBandFull({
  conversion,
  action,
  headingId,
  contentStatus,
}: {
  conversion: ConversionSection;
  action: ReportAction;
  headingId: string;
  contentStatus: ContentStatus;
}) {
  return (
    <div className={`${styles.full} ${accentClass(contentStatus)}`}>
      <h2 id={headingId} className={styles.headline}>
        {conversion.headline}
      </h2>
      <p className={styles.body}>{conversion.body}</p>
      <div className={styles.values}>
        {conversion.valueConcepts.map((concept) => (
          <div key={concept.title} className={styles.valueCard}>
            <p className={styles.valueTitle}>{concept.title}</p>
            <p className={styles.valueBody}>{concept.body}</p>
          </div>
        ))}
      </div>
      <Link href={action.href} className={styles.cta}>
        {action.label}
        <ArrowIcon />
      </Link>
    </div>
  );
}

/** The inline conversion band placed immediately after R03 (section 30) -- operationally-safe CTA, appears only after the family has already seen a real personalized direction. */
export function InlineConversionBand({
  headline,
  body,
  action,
}: {
  headline: string;
  body: string;
  action: ReportAction;
}) {
  return (
    <div className={styles.inline}>
      <div>
        <p className={styles.inlineHeadline}>{headline}</p>
        <p className={styles.inlineBody}>{body}</p>
      </div>
      <Link href={action.href} className={styles.inlineCta}>
        {action.label}
        <ArrowIcon />
      </Link>
    </div>
  );
}
