import type { DirectionCard as DirectionCardData } from "@/lib/report/types";
import styles from "./DirectionCard.module.css";

/**
 * One direction card (R03, sections 14/16/42). Equal visual weight
 * with every sibling card -- section 15's "no visual winner": no
 * rank number, no "Top Match" badge, no first-card emphasis. Card
 * order is exactly Phase 4's displayedCandidateIds order and is
 * never re-sorted here.
 */
export function DirectionCard({ card }: { card: DirectionCardData }) {
  const isConsideration = card.publicFitLabel === "WORTH_EXPLORING_WITH_CONSIDERATIONS";
  return (
    <li className={styles.card}>
      <div className={styles.headRow}>
        <div>
          <span className={styles.motif} aria-hidden="true">
            {card.baseModelId}
          </span>
          <h3 className={styles.title}>{card.title}</h3>
        </div>
        <span className={`${styles.badge} ${isConsideration ? styles.badgeWithConsiderations : styles.badgeWorthExploring}`}>
          {card.publicFitLabelText}
        </span>
      </div>
      <p className={styles.description}>{card.description}</p>
      {card.whyThisSurfaced.length > 0 ? (
        <>
          <p className={styles.subheading}>Why this surfaced</p>
          <ul className={styles.list}>
            {card.whyThisSurfaced.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      ) : null}
      {card.whatToLookFor.length > 0 ? (
        <>
          <p className={styles.subheading}>What to look for</p>
          <ul className={styles.list}>
            {card.whatToLookFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      {card.consideration ? <p className={styles.consideration}>{card.consideration}</p> : null}
    </li>
  );
}
