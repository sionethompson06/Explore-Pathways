import type {
  SupportOpportunityMapSection as SupportOpportunityMapData,
  SupportOpportunitySubsection,
} from "@/lib/report/types";
import styles from "./SupportOpportunityMap.module.css";

function Subsection({ subsection }: { subsection: SupportOpportunitySubsection }) {
  return (
    <div className={styles.subsection}>
      <h3 className={styles.subheading}>{subsection.heading}</h3>
      <ul className={styles.grid}>
        {subsection.primary.map((tile) => (
          <li key={tile.id} className={styles.tile}>
            <p className={styles.tileTitle}>{tile.title}</p>
            <p className={styles.tileBody}>{tile.description}</p>
          </li>
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

/** R04 -- Support & Opportunity Map (sections 17-20). Omitted by the caller entirely when there is no valid content at all. */
export function SupportOpportunityMap({ map, headingId }: { map: SupportOpportunityMapData; headingId: string }) {
  if (map.specialHeading) {
    return (
      <div>
        <h2 id={headingId} style={{ marginTop: 0 }}>
          {map.specialHeading}
        </h2>
        <ul className={styles.grid}>
          {(map.specialTiles ?? []).map((tile) => (
            <li key={tile.id} className={styles.tile}>
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
      <h2 id={headingId} style={{ marginTop: 0 }}>
        Support &amp; Opportunity Map
      </h2>
      {map.support ? <Subsection subsection={map.support} /> : null}
      {map.opportunities ? <Subsection subsection={map.opportunities} /> : null}
    </div>
  );
}
