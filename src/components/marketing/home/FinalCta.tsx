import { ButtonLink } from "../Button";
import { Container } from "../Container";
import { HandwrittenAccent } from "../HandwrittenAccent";
import { PhotoSlot } from "../PhotoSlot";
import { MARKETING_PHOTOS } from "@/content/marketing-photos";
import { DISCOVER_HREF, PRIMARY_CTA_LABEL } from "@/content/nav-links";
import styles from "./FinalCta.module.css";

/** Section 8 (Phase 2B image-integration): the closing scenic CTA. */
export function FinalCta() {
  return (
    <section className={styles.cta} aria-labelledby="final-cta-heading">
      <div className={styles.art}>
        <PhotoSlot
          photoSrc={MARKETING_PHOTOS.finalMountainScenery.path}
          alt={MARKETING_PHOTOS.finalMountainScenery.alt}
          sizes="100vw"
          fallback={<div className={styles.artFallback} aria-hidden="true" />}
        />
      </div>
      <div className={styles.overlay} />

      <div className={styles.handwritten}>
        <HandwrittenAccent>Different Paths. Brighter Futures.</HandwrittenAccent>
      </div>

      <Container>
        <div className={styles.content}>
          <h2 id="final-cta-heading" className={styles.headline}>
            Your Child&apos;s Education. Their Possibilities.
          </h2>
          <p className={styles.supporting}>
            Explore what&apos;s possible with an education pathway built around your student.
          </p>
          <div className={styles.ctaRow}>
            <ButtonLink href={DISCOVER_HREF} variant="primary">
              {PRIMARY_CTA_LABEL}
            </ButtonLink>
            <ButtonLink href="/how-it-works" variant="inverse">
              See How Pathways Works
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
