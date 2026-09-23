import { Section } from "./Section";
import { PhotoSlot } from "./PhotoSlot";
import styles from "./PageHero.module.css";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  tagline,
  headingId,
  photoSrc,
  photoAlt,
}: {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  /** A short, punchy approved phrase shown above the subtitle -- see docs/pathways/IMAGE_ASSET_MANIFEST.md. */
  tagline?: string | undefined;
  headingId: string;
  /** When set, renders a photo band above the text instead of the plain text-only hero. */
  photoSrc?: string | null | undefined;
  photoAlt?: string | undefined;
}) {
  return (
    <Section tone="default" ariaLabelledBy={headingId}>
      {photoSrc ? (
        <div className={styles.photo}>
          <PhotoSlot photoSrc={photoSrc} alt={photoAlt ?? ""} priority sizes="100vw" fallback={null} />
        </div>
      ) : null}
      <div className={styles.hero}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1 id={headingId} className={styles.title}>
          {title}
        </h1>
        {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </Section>
  );
}
