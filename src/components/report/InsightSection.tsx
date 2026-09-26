import type { ContentStatus } from "@/lib/engine/types";
import type { InsightSection as InsightSectionData } from "@/lib/report/types";
import styles from "./InsightSection.module.css";

/**
 * R02 -- What We Heard (section 13, elevated Phase 5.2 sections
 * 25-26). Exact copy is unchanged -- the eyebrow, accent rule and
 * whitespace only frame it as Pathways' interpretation, never a
 * literal quote. LIMITED_INFORMATION gets a softer, lighter
 * "clarity-building" treatment rather than a stronger advisory one --
 * honest limited information is preferable to fabricated
 * personalization (section 26).
 */
export function InsightSection({
  insight,
  contentStatus,
}: {
  insight: InsightSectionData;
  contentStatus: ContentStatus;
}) {
  const isLimited = contentStatus === "LIMITED_INFORMATION";
  return (
    <div className={`${styles.wrap} ${isLimited ? styles.limited : ""}`}>
      <span className={styles.accentRule} aria-hidden="true" />
      <span className={styles.kicker}>{insight.kicker}</span>
      <h2 className={styles.headline}>{insight.headline}</h2>
      <p className={styles.body}>{insight.body}</p>
    </div>
  );
}
