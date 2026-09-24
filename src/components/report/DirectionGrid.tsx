import type { DirectionsSection } from "@/lib/report/types";
import { Card } from "@/components/marketing/Card";
import { DirectionCard } from "./DirectionCard";
import styles from "./DirectionCard.module.css";

/** R03 -- Directions Worth Exploring (section 14/15). Zero-card special states (ADVISOR_FIRST / LIMITED_INFORMATION) render useful content, never an empty grid (RPT-M06). */
export function DirectionGrid({ directions, headingId }: { directions: DirectionsSection; headingId: string }) {
  if (directions.cards.length === 0) {
    return (
      <div>
        {directions.emptyStateHeading ? (
          <h2 id={headingId} style={{ marginTop: 0 }}>
            {directions.emptyStateHeading}
          </h2>
        ) : null}
        {directions.emptyStateBody ? (
          <Card>
            <p style={{ margin: 0 }}>{directions.emptyStateBody}</p>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h2 id={headingId} className="visually-hidden">
        Directions Worth Exploring
      </h2>
      <ul className={styles.grid} style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {directions.cards.map((card) => (
          <DirectionCard key={card.baseModelId} card={card} />
        ))}
      </ul>
    </div>
  );
}
