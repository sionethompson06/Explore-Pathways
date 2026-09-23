import { REPORT_PREVIEW } from "@/content/report-preview";
import { Badge } from "../Badge";
import { IconBadge } from "../IconBadge";
import { PlanIcon, CompassIcon, DiscoverIcon, QuestionIcon } from "../icons";
import styles from "./ReportPreviewCard.module.css";

/**
 * A fictional, labeled preview of what a Discovery Report will help a
 * family see -- not the real Phase 5 report generator or its output
 * schema. See src/content/report-preview.ts for the disclosure this
 * content must satisfy (no grade, mastery percentage, school match,
 * eligibility claim, GPA, NCAA approval, or completed plan).
 */
export function ReportPreviewCard() {
  return (
    <div className={styles.wrap}>
      <div className={styles.badgeRow}>
        <Badge>Illustrative example — not a student assessment or placement decision</Badge>
      </div>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Discovery Report preview</p>
        <h3 className={styles.heading}>{REPORT_PREVIEW.studentLabel}</h3>

        <div className={styles.block}>
          <div className={styles.blockLabel}>
            <IconBadge tone="navy">
              <PlanIcon />
            </IconBadge>
            <p>What Matters to Your Family</p>
          </div>
          <ul className={styles.chipList}>
            {REPORT_PREVIEW.priorities.map((priority) => (
              <li key={priority} className={styles.chip}>
                {priority}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.block}>
          <div className={styles.blockLabel}>
            <IconBadge tone="navy">
              <CompassIcon />
            </IconBadge>
            <p>Directions Worth Exploring</p>
          </div>
          <ul>
            {REPORT_PREVIEW.directions.map((direction) => (
              <li key={direction}>{direction}</li>
            ))}
          </ul>
        </div>

        <div className={styles.block}>
          <div className={styles.blockLabel}>
            <IconBadge tone="navy">
              <DiscoverIcon />
            </IconBadge>
            <p>Possibilities to Consider</p>
          </div>
          <ul>
            {REPORT_PREVIEW.possibilities.map((possibility) => (
              <li key={possibility}>{possibility}</li>
            ))}
          </ul>
        </div>

        <div className={styles.block}>
          <div className={styles.blockLabel}>
            <IconBadge tone="navy">
              <QuestionIcon />
            </IconBadge>
            <p>Questions to Explore</p>
          </div>
          <ul>
            {REPORT_PREVIEW.planningQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
