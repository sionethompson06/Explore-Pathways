import type { ContentStatus } from "@/lib/engine/types";
import type { DirectionsSection } from "@/lib/report/types";
import { DirectionCard } from "./DirectionCard";
import cardStyles from "./DirectionCard.module.css";
import styles from "./DirectionGrid.module.css";

/** ADVISOR_FIRST zero-state icon: a deliberate "under review" glyph -- confident restraint, never an error. */
function AdvisorReviewIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 3l7 3v5c0 4.5-2.9 7.9-7 9-4.1-1.1-7-4.5-7-9V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12l2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** LIMITED_INFORMATION zero-state icon: a compass -- still orienting, not broken. */
function StillExploringIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14.5 9.5l-1.6 4.4-4.4 1.6 1.6-4.4 4.4-1.6z" fill="currentColor" />
    </svg>
  );
}

/**
 * R03 -- Directions Worth Exploring (section 14/15, redesigned Phase
 * 5.2 sections 7/11). The section heading is now VISIBLE for
 * personalized reports (previously visually-hidden). Zero-card
 * special states (ADVISOR_FIRST / LIMITED_INFORMATION) get two
 * distinct presentational variants of the SAME DTO content -- never
 * an empty grid (RPT-M06).
 */
export function DirectionGrid({
  directions,
  headingId,
  contentStatus,
}: {
  directions: DirectionsSection;
  headingId: string;
  contentStatus: ContentStatus;
}) {
  if (directions.cards.length === 0) {
    const isAdvisorFirst = contentStatus === "ADVISOR_FIRST";
    return (
      <div>
        {directions.emptyStateHeading ? (
          <div className={`${styles.emptyWrap} ${isAdvisorFirst ? styles.emptyAdvisor : styles.emptyLimited}`}>
            <span className={styles.emptyIcon}>{isAdvisorFirst ? <AdvisorReviewIcon /> : <StillExploringIcon />}</span>
            <div>
              <h2 id={headingId} className={styles.emptyHeading}>
                {directions.emptyStateHeading}
              </h2>
              {directions.emptyStateBody ? <p className={styles.emptyBody}>{directions.emptyStateBody}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h2 id={headingId} className={styles.heading}>
        Directions Worth Exploring
      </h2>
      <ul className={cardStyles.grid} style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {directions.cards.map((card) => (
          <DirectionCard key={card.baseModelId} card={card} />
        ))}
      </ul>
    </div>
  );
}
