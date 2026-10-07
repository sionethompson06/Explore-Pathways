import { ButtonLink } from "../Button";
import { Container } from "../Container";
import { HandwrittenAccent } from "../HandwrittenAccent";
import { PhotoSlot } from "../PhotoSlot";
import { HeroArt } from "./HeroArt";
import { PathwayIndicators } from "./PathwayIndicators";
import { DISCOVER_HREF, PRIMARY_CTA_LABEL, SECONDARY_CTA_LABEL } from "@/content/nav-links";
import { MARKETING_PHOTOS } from "@/content/marketing-photos";
import styles from "./Hero.module.css";

/**
 * Section 1 (Phase 2B): a full-bleed scenic hero with the page's
 * text content overlaid on top, replacing Phase 2's two-column
 * text-plus-small-illustration layout. The background renders real
 * photography once `MARKETING_PHOTOS.heroStudentMountain.path` is
 * supplied (see docs/pathways/IMAGE_ASSET_MANIFEST.md); until then it
 * falls back to the illustrated HeroArt panorama -- see HeroArt.tsx
 * for why that fallback is illustrated rather than photographic.
 */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.art}>
        <PhotoSlot
          photoSrc={MARKETING_PHOTOS.heroStudentMountain.path}
          alt={MARKETING_PHOTOS.heroStudentMountain.alt}
          priority
          sizes="100vw"
          objectPosition="78% 30%"
          fallback={<HeroArt />}
        />
      </div>
      <div className={styles.overlay} />

      <div className={styles.handwrittenTop}>
        <HandwrittenAccent>More Freedom. More Opportunity.</HandwrittenAccent>
      </div>

      <Container>
        <div className={styles.content}>
          <span className={styles.eyebrow}>Flexible Education. Brighter Futures.</span>
          <h1 id="hero-heading" className={styles.headline}>
            School Should Fit
            <br />
            Your Child&apos;s Life.
            <br />
            <span className={styles.emphasis}>Not Limit It.</span>
          </h1>
          <p className={styles.supporting}>
            Explore flexible education pathways built around your child&apos;s learning,
            goals and life—from athletics and travel to homeschool support, academic
            advancement and more.
          </p>
          <div className={styles.ctaRow}>
            <ButtonLink href={DISCOVER_HREF} variant="primary">
              {PRIMARY_CTA_LABEL}
            </ButtonLink>
            <ButtonLink href="/how-it-works" variant="inverse">
              {SECONDARY_CTA_LABEL}
            </ButtonLink>
          </div>
          <p className={styles.gradeLabel}>Personalized Education Pathways · K–12</p>

          <div className={styles.indicators}>
            <PathwayIndicators />
          </div>
        </div>
      </Container>

      <div className={styles.handwrittenBottom}>
        <HandwrittenAccent>Different Paths. Brighter Futures.</HandwrittenAccent>
      </div>
    </section>
  );
}
