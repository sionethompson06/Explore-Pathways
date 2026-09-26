import type { DirectionCard as DirectionCardData } from "@/lib/report/types";
import styles from "./DirectionCard.module.css";

/** Decorative-only direction motif -- never renders card.baseModelId (section 6/28). */
function DirectionMotif() {
  return (
    <span className={styles.motif} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        <path
          d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M6.5 6.5l1.8 1.8M15.7 15.7l1.8 1.8M6.5 17.5l1.8-1.8M15.7 8.3l1.8-1.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
      </svg>
    </span>
  );
}

/** Evidence-zone icon (section 5): a confirming check mark, distinct from the action zone's checklist. */
function EvidenceIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" fill="var(--color-accent-tint)" />
      <path d="M6 10.5l2.4 2.4L14.5 7" stroke="var(--color-accent-strong)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Action-zone icon (section 5): a checklist glyph, distinct from the evidence zone's confirming check. */
function ActionIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="17" height="17" rx="4" fill="#eaf1fa" />
      <path d="M5.5 7h9M5.5 10h9M5.5 13h6" stroke="var(--color-emphasis)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * One direction card (R03, sections 14/16/42, redesigned Phase 5.2
 * sections 5-8). Equal visual weight with every sibling card -- no
 * rank number, no "Top Match" badge, no first-card emphasis. Card
 * order is exactly Phase 4's displayedCandidateIds order and is never
 * re-sorted here. "Why this surfaced" (evidence) and "What to look
 * for" (action) are separate semantic regions with distinct heading
 * treatment and background tint -- never sharing typography (section
 * 5/37).
 */
export function DirectionCard({ card }: { card: DirectionCardData }) {
  const isConsideration = card.publicFitLabel === "WORTH_EXPLORING_WITH_CONSIDERATIONS";
  return (
    <li className={styles.card}>
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <DirectionMotif />
          <h3 className={styles.title}>{card.title}</h3>
        </div>
        <span className={`${styles.badge} ${isConsideration ? styles.badgeWithConsiderations : styles.badgeWorthExploring}`}>
          {card.publicFitLabelText}
        </span>
      </div>
      <p className={styles.description}>{card.description}</p>

      {card.whyThisSurfaced.length > 0 ? (
        <div className={styles.evidenceZone}>
          <p className={styles.evidenceHeading}>
            <EvidenceIcon />
            Why This Surfaced
          </p>
          <ul className={styles.evidenceList}>
            {card.whyThisSurfaced.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.whatToLookFor.length > 0 ? (
        <div className={styles.actionZone}>
          <p className={styles.actionHeading}>
            <ActionIcon />
            What To Look For
          </p>
          <ul className={styles.actionList}>
            {card.whatToLookFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.consideration ? <p className={styles.consideration}>{card.consideration}</p> : null}
    </li>
  );
}
