import Link from "next/link";
import type { ConversionSection, ReportAction } from "@/lib/report/types";
import styles from "./ConversionBand.module.css";

/** R07 -- Conversion (section 27/46). Strongest marketing treatment; still accurate, no fabricated urgency/testimonials. */
export function ConversionBandFull({ conversion, action, headingId }: { conversion: ConversionSection; action: ReportAction; headingId: string }) {
  return (
    <div className={styles.full}>
      <h2 id={headingId} className={styles.headline}>
        {conversion.headline}
      </h2>
      <p className={styles.body}>{conversion.body}</p>
      <div className={styles.values}>
        {conversion.valueConcepts.map((concept) => (
          <div key={concept.title}>
            <p className={styles.valueTitle}>{concept.title}</p>
            <p className={styles.valueBody}>{concept.body}</p>
          </div>
        ))}
      </div>
      <Link href={action.href} className={styles.cta}>
        {action.label}
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
      </Link>
    </div>
  );
}
