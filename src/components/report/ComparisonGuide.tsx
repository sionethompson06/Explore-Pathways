import type { ComparisonGuideSection } from "@/lib/report/types";
import styles from "./ComparisonGuide.module.css";

/** R05 -- Comparison Guide (section 21/44): "the expert questions that matter before choosing." */
export function ComparisonGuide({ guide, headingId }: { guide: ComparisonGuideSection; headingId: string }) {
  if (guide.questions.length === 0) return null;
  return (
    <div className={styles.panel}>
      <h2 id={headingId} className={styles.title}>
        {guide.title}
      </h2>
      <ul className={styles.list}>
        {guide.questions.map((q, index) => (
          <li key={q.id} className={styles.item}>
            <span className={styles.icon} aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <p className={styles.question}>{q.question}</p>
              <p className={styles.explanation}>{q.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
