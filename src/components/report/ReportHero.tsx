import type { SnapshotSection } from "@/lib/report/types";
import { PriorityChips } from "./PriorityChips";
import styles from "./ReportHero.module.css";

/**
 * R01 -- Your Discovery Snapshot (section 11/41). A subtle abstract
 * gradient/motif, never a stock photo of a random child -- the report
 * should feel personalized and premium, not like an ad.
 */
export function ReportHero({ snapshot }: { snapshot: SnapshotSection }) {
  return (
    <div className={styles.hero}>
      <svg className={styles.motif} viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path
          d="M0 220 C 150 260, 250 120, 400 150 S 650 260, 800 90"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
        <circle cx="400" cy="150" r="5" fill="rgba(255,255,255,0.6)" />
        <circle cx="800" cy="90" r="6" fill="rgba(255,255,255,0.8)" />
      </svg>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>{snapshot.eyebrow}</span>
        <p className={styles.title}>{snapshot.reportTitle}</p>
        {snapshot.statusBadge ? <span className={styles.badge}>{snapshot.statusBadge}</span> : null}
        <h1 className={styles.headline}>{snapshot.headline}</h1>
        <p className={styles.summary}>{snapshot.summary}</p>
        <PriorityChips chips={snapshot.chips} />
        <p className={styles.scope}>{snapshot.scopeStatement}</p>
      </div>
    </div>
  );
}
