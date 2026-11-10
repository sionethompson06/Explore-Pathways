import type { ReactNode } from "react";
import { Logo } from "@/components/marketing/Logo";
import type { ReportAction } from "@/lib/report/types";
import styles from "./ReportUtilityHeader.module.css";

/**
 * Report utility header (Phase 5.2 section 22): identity + wayfinding
 * row above the report body -- replaces the previous bare
 * demoLabel/topActions strip. Presentational only; carries no
 * decision logic and never changes the CTA an action resolves to.
 */
export function ReportUtilityHeader({
  demoLabel,
  editAnswers,
  editAnswersOverride,
  secondaryTopAction,
}: {
  demoLabel?: string | undefined;
  editAnswers: ReportAction;
  editAnswersOverride?: ReactNode;
  secondaryTopAction?: ReactNode;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.identity}>
        <Logo />
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.docLabel}>Discovery Report</span>
        {demoLabel ? <span className={styles.demoLabel}>{demoLabel}</span> : null}
      </div>
      <div className={styles.actions}>
        {editAnswersOverride ?? (
          <a href={editAnswers.href} className={styles.editLink}>
            {editAnswers.label}
          </a>
        )}
        {secondaryTopAction}
      </div>
    </div>
  );
}
