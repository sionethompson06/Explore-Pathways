import { Section } from "./Section";
import styles from "./PageHero.module.css";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  headingId,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  headingId: string;
}) {
  return (
    <Section tone="default" ariaLabelledBy={headingId}>
      <div className={styles.hero}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1 id={headingId} className={styles.title}>
          {title}
        </h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </Section>
  );
}
