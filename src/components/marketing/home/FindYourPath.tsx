import { ButtonLink } from "../Button";
import { InfographicImage } from "../InfographicImage";
import { CheckIcon } from "../icons";
import { MARKETING_INFOGRAPHICS } from "@/content/marketing-infographics";
import { POPULAR_REASONS } from "@/content/find-your-path";
import { DISCOVER_HREF } from "@/content/nav-links";
import styles from "./FindYourPath.module.css";

/**
 * Section (Phase 2C, Asset Pack 2 P2-01): "Find Your Path in
 * Minutes." The infographic is a decorative supporting visual;
 * the heading, copy, CTA and reasons list below are real semantic
 * HTML, per the Phase 2C accessibility requirement.
 */
export function FindYourPath() {
  return (
    <div className={styles.split}>
      <div className={styles.content}>
        <h2 id="find-your-path-heading">Find Your Path in Minutes.</h2>
        <p>
          Answer a few simple questions and begin exploring education possibilities that
          may fit your student&apos;s goals, schedule and learning needs.
        </p>
        <ButtonLink href={DISCOVER_HREF} variant="primary">
          Take the Pathway Assessment
        </ButtonLink>

        <p className={styles.reasonsLabel}>Popular reasons families come to Pathways</p>
        <ul className={styles.reasonsList}>
          {POPULAR_REASONS.map((reason) => (
            <li key={reason}>
              <CheckIcon className={styles.checkIcon!} />
              {reason}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.art}>
        <InfographicImage
          src={MARKETING_INFOGRAPHICS.findYourPath.path}
          width={1672}
          height={941}
        />
      </div>
    </div>
  );
}
