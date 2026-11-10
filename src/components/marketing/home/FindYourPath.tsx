import Link from "next/link";
import { ButtonLink } from "../Button";
import { IconBadge } from "../IconBadge";
import { PlanIcon, CompassIcon, QuestionIcon, AdvanceIcon } from "../icons";
import { FIND_YOUR_PATH_BENEFITS, POPULAR_REASONS, type FindYourPathBenefit } from "@/content/find-your-path";
import { DISCOVER_HREF } from "@/content/nav-links";
import styles from "./FindYourPath.module.css";

const ICONS: Record<FindYourPathBenefit["icon"], (props: { className?: string }) => React.ReactElement> = {
  plan: PlanIcon,
  compass: CompassIcon,
  question: QuestionIcon,
  advance: AdvanceIcon,
};

/**
 * Section (Phase 2E, Asset Pack 2 P2-01 direction): "Find Your Path
 * in Minutes." A real interactive component -- the benefit cards and
 * reason chips replace the flattened P2-01 reference image as the
 * primary interface, per the Phase 2E design decision. Every reason
 * chip and benefit card is a real, focusable element (Link or plain
 * text), never a hover-only affordance.
 */
export function FindYourPath() {
  return (
    <div className={styles.split}>
      <div className={styles.content}>
        <span className={styles.eyebrow}>Discover What&apos;s Possible</span>
        <h2 id="find-your-path-heading">Find Your Path in Minutes.</h2>
        <p>
          Answer a few simple questions and begin exploring education possibilities that
          may fit your student&apos;s goals, schedule and learning needs.
        </p>
        <ButtonLink href={DISCOVER_HREF} variant="primary" className={styles.ctaButton!}>
          Take the Pathway Assessment <span className={styles.ctaArrow} aria-hidden="true">&rarr;</span>
        </ButtonLink>
      </div>

      <div className={styles.benefits}>
        <ul className={styles.benefitList}>
          {FIND_YOUR_PATH_BENEFITS.map((benefit) => {
            const BenefitIcon = ICONS[benefit.icon];
            return (
              <li key={benefit.id} className={styles.benefitCard}>
                <IconBadge tone="navy">
                  <BenefitIcon />
                </IconBadge>
                <p className={styles.benefitTitle}>{benefit.title}</p>
                <p className={styles.benefitDescription}>{benefit.description}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.reasons}>
        <p className={styles.reasonsLabel}>Popular reasons families come to Pathways</p>
        <ul className={styles.chipList}>
          {POPULAR_REASONS.map((reason) => (
            <li key={reason.label}>
              <Link
                href={reason.interest ? `/discover?interest=${reason.interest}` : DISCOVER_HREF}
                className={styles.chip}
              >
                {reason.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
