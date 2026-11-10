import { ButtonLink } from "../Button";
import { PhotoSlot } from "../PhotoSlot";
import { MARKETING_PHOTOS } from "@/content/marketing-photos";
import styles from "./HumanSupport.module.css";

/**
 * Section 6 (Phase 2B image-integration): a split editorial panel
 * pairing the approved advisor/parent image with an informational
 * (not booking) CTA -- the scheduler integration is UNCONFIGURED (see
 * docs/pathways/INTEGRATION_REGISTER.md), so this links to the real,
 * already-built /how-it-works page rather than a live consultation
 * flow. Neither person in the photo is identified as an actual
 * Pathways employee, advisor, or parent.
 */
export function HumanSupport() {
  return (
    <div className={styles.split}>
      <div className={styles.photo}>
        <PhotoSlot
          photoSrc={MARKETING_PHOTOS.advisorFamily.path}
          alt={MARKETING_PHOTOS.advisorFamily.alt}
          sizes="(max-width: 900px) 100vw, 50vw"
          fallback={<div className={styles.photoFallback} aria-hidden="true" />}
        />
      </div>
      <div className={styles.content}>
        <h2 id="human-support-heading">You Don&apos;t Have to Figure This Out Alone.</h2>
        <p>
          Education options can be complicated. Pathways is designed to help families
          understand the possibilities, ask the right questions and build a clearer way
          forward.
        </p>
        <ButtonLink href="/how-it-works" variant="secondary">
          See How It Works
        </ButtonLink>
      </div>
    </div>
  );
}
