import type { ComparisonGuideSection } from "@/lib/report/types";
import styles from "./ComparisonGuide.module.css";

/**
 * R05 -- Comparison Guide (section 21/44, elevated Phase 5.2 section
 * 12/13). The existing `guide.title` (report-content.json-sourced)
 * becomes a small eyebrow/context label; the new universal heading
 * and supporting copy below are UI-layer text only -- report-content.json
 * is untouched. Questions/explanations themselves are always exactly
 * from the DTO.
 */
export function ComparisonGuide({ guide, headingId }: { guide: ComparisonGuideSection; headingId: string }) {
  if (guide.questions.length === 0) return null;
  return (
    <div className={styles.panel}>
      <span className={styles.eyebrow}>{guide.title}</span>
      <h2 id={headingId} className={styles.title}>
        Questions That Matter Before You Choose
      </h2>
      <p className={styles.subcopy}>These are the questions worth answering before you choose a direction or program.</p>
      <ol className={styles.list}>
        {guide.questions.map((q, index) => (
          <li key={q.id} className={styles.item}>
            <span className={styles.marker} aria-hidden="true">
              {index + 1}
            </span>
            <div className={styles.itemBody}>
              <p className={styles.question}>{q.question}</p>
              <p className={styles.explanation}>{q.explanation}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
