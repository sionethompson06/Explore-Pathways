import type {
  SupportOpportunityMapSection as SupportOpportunityMapData,
  SupportOpportunitySubsection,
  SupportOpportunityTile as SupportOpportunityTileData,
} from "@/lib/report/types";
import type { ContentStatus } from "@/lib/engine/types";
import styles from "./SupportOpportunityMap.module.css";

/** SUPPORT tile icon: two linked circles -- people/support around the student. */
function SupportIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="3.2" stroke="var(--color-accent-strong)" strokeWidth="1.5" />
      <circle cx="13.5" cy="12.5" r="3.2" stroke="var(--color-accent-strong)" strokeWidth="1.5" />
    </svg>
  );
}

/** OPPORTUNITY tile icon: an upward arrow -- something to grow into. */
function OpportunityIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 15l5-6 3 3 4-6" stroke="var(--color-emphasis)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 6h3.5v3.5" stroke="var(--color-emphasis)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tile({ tile, kind }: { tile: SupportOpportunityTileData; kind: "support" | "opportunity" }) {
  return (
    <li className={`${styles.tile} ${kind === "support" ? styles.tileSupport : styles.tileOpportunity}`}>
      <span className={styles.tileIcon} aria-hidden="true">
        {kind === "support" ? <SupportIcon /> : <OpportunityIcon />}
      </span>
      <div>
        <p className={styles.tileTitle}>{tile.title}</p>
        <p className={styles.tileBody}>{tile.description}</p>
      </div>
    </li>
  );
}

function Subsection({ subsection, kind }: { subsection: SupportOpportunitySubsection; kind: "support" | "opportunity" }) {
  return (
    <div className={styles.subsection}>
      <h3 className={styles.subheading}>{subsection.heading}</h3>
      <ul className={styles.grid}>
        {subsection.primary.map((tile) => (
          <Tile key={tile.id} tile={tile} kind={kind} />
        ))}
      </ul>
      {subsection.alsoWorthDiscussing ? (
        <div className={styles.alsoWorth}>
          <span className={styles.alsoWorthLabel}>Also worth discussing</span>
          <p className={styles.tileTitle}>{subsection.alsoWorthDiscussing.title}</p>
          <p className={styles.tileBody}>{subsection.alsoWorthDiscussing.description}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * R04 -- Support & Opportunity Map (sections 17-20, redesigned Phase
 * 5.2 section 9). Deliberately softer/smaller than R03's direction
 * cards -- this reads as "the ecosystem around a direction", not a
 * second tier of recommendations. Omitted by the caller entirely when
 * there is no valid content at all.
 */
export function SupportOpportunityMap({
  map,
  headingId,
  contentStatus,
}: {
  map: SupportOpportunityMapData;
  headingId: string;
  contentStatus: ContentStatus;
}) {
  if (map.specialHeading) {
    const isAdvisorFirst = contentStatus === "ADVISOR_FIRST";
    return (
      <div className={`${styles.specialWrap} ${isAdvisorFirst ? styles.specialAdvisor : styles.specialLimited}`}>
        <h2 id={headingId} className={styles.specialHeading}>
          {map.specialHeading}
        </h2>
        <ul className={styles.grid}>
          {(map.specialTiles ?? []).map((tile) => (
            <li key={tile.id} className={`${styles.tile} ${styles.tileNeutral}`}>
              <p className={styles.tileTitle}>{tile.title}</p>
              <p className={styles.tileBody}>{tile.description}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <span className={styles.eyebrow}>The ecosystem around this direction</span>
      <h2 id={headingId} className={styles.heading}>
        Support &amp; Opportunity Map
      </h2>
      {map.support ? <Subsection subsection={map.support} kind="support" /> : null}
      {map.opportunities ? <Subsection subsection={map.opportunities} kind="opportunity" /> : null}
    </div>
  );
}
