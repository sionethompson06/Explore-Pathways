import styles from "./Faq.module.css";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Native <details>/<summary> accordion: keyboard-operable and
 * screen-reader-friendly without any client-side JavaScript, and
 * naturally supports "open" state on print/reduced-motion contexts.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <details key={item.question} className={styles.item}>
          <summary className={styles.question}>{item.question}</summary>
          <p className={styles.answer}>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
