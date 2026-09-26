import Link from "next/link";
import { GOAL_CARDS, type GoalCard } from "@/content/goal-cards";
import { Card } from "../Card";
import {
  AthleticsIcon,
  AcademicIcon,
  ScheduleIcon,
  HomeschoolIcon,
  CompassIcon,
  SupportIcon,
  DiscoverIcon,
  AdvanceIcon,
} from "../icons";
import styles from "./GoalGrid.module.css";

const ICONS: Record<GoalCard["icon"], (props: { className?: string }) => React.ReactElement> = {
  athletics: AthleticsIcon,
  academic: AcademicIcon,
  schedule: ScheduleIcon,
  homeschool: HomeschoolIcon,
  compass: CompassIcon,
  support: SupportIcon,
  discover: DiscoverIcon,
  advance: AdvanceIcon,
};

/**
 * The 8 clickable "What Are You Hoping to Make Possible?" cards
 * (Phase 2E, visual direction from Asset Pack 2 P2-04 -- a real
 * interactive component, not the flattened reference image). Each is
 * a single Link covering the whole card -- no nested interactive
 * elements -- so hover/focus styling on the card itself is enough,
 * and it needs no client-side state.
 */
export function GoalGrid() {
  return (
    <ul className={styles.grid}>
      {GOAL_CARDS.map((goal) => {
        const GoalIcon = ICONS[goal.icon];
        const href = goal.interest ? `/discover?interest=${goal.interest}` : "/discover";
        return (
          <Card as="li" key={goal.id} className={styles.cardItem}>
            <Link href={href} className={styles.link}>
              <span className={styles.iconWrap}>
                <GoalIcon />
              </span>
              <span className={styles.label}>{goal.title}</span>
              <span className={styles.description}>{goal.description}</span>
              <span className={styles.arrowRow} aria-hidden="true">
                Learn more <span className={styles.arrow}>&rarr;</span>
              </span>
            </Link>
          </Card>
        );
      })}
    </ul>
  );
}
