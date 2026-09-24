import type { InsightSection as InsightSectionData } from "@/lib/report/types";
import styles from "./InsightSection.module.css";

/** R02 -- What We Heard (section 13). One insight, no score, no raw-answer dump. */
export function InsightSection({ insight }: { insight: InsightSectionData }) {
  return (
    <div className={styles.wrap}>
      <span className={styles.kicker}>{insight.kicker}</span>
      <h2 className={styles.headline}>{insight.headline}</h2>
      <p className={styles.body}>{insight.body}</p>
    </div>
  );
}
