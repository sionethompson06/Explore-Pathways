import { ReportPreviewCard } from "./ReportPreviewCard";
import styles from "./DiscoveryShowcase.module.css";

/**
 * Section (Phase 2C, Asset Pack 2 P2-02 direction): "See Your
 * Student's Possibilities More Clearly." The supplied P2-02 graphic
 * paired a fabricated student photo and first-person quote in a
 * profile-card layout that reads as a testimonial -- this project has
 * consistently declined to use that pattern anywhere (see
 * docs/pathways/MEDIA_SOURCE_REGISTER.md "Asset Pack 2" for the full
 * explanation). This component keeps the existing accessible
 * ReportPreviewCard as the actual Discovery Report visual, elevated
 * into a two-column "product showcase" composition that echoes
 * P2-02's premium layout weight without its fabricated elements.
 */
export function DiscoveryShowcase() {
  return (
    <div className={styles.split}>
      <div className={styles.content}>
        <h2 id="report-heading">See Your Student&apos;s Possibilities More Clearly.</h2>
        <p>
          A personalized Discovery Report helps your family see education options, next
          steps and directions worth exploring -- based on your student&apos;s goals,
          interests and lifestyle.
        </p>
        <ul className={styles.points}>
          <li>Personalized directions, not a one-size-fits-all list.</li>
          <li>Priorities, possibilities and planning questions in one place.</li>
          <li>Always labeled as illustrative -- never a real assessment or placement.</li>
        </ul>
      </div>
      <div className={styles.card}>
        <ReportPreviewCard />
      </div>
    </div>
  );
}
