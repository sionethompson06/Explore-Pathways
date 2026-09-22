import Link from "next/link";
import { FAMILY_GOALS, type GoalInterest } from "@/content/goals";
import { Card } from "../Card";
import {
  AthleticsIcon,
  ScheduleIcon,
  HomeschoolIcon,
  AcademicIcon,
  CompassIcon,
  QuestionIcon,
} from "../icons";
import styles from "./GoalGrid.module.css";

const ICONS: Record<GoalInterest, (props: { className?: string }) => React.ReactElement> = {
  athletics: AthleticsIcon,
  flexible_schedule: ScheduleIcon,
  homeschool_support: HomeschoolIcon,
  academic_challenge: AcademicIcon,
  different_environment: CompassIcon,
  unsure: QuestionIcon,
};

/**
 * The six clickable "family goal" cards. Each links to /discover with
 * an allowlisted `interest` query param -- clicking one only changes
 * what that entry page displays; it never submits data anywhere or
 * creates a record (see app/discover/page.tsx).
 */
export function GoalGrid() {
  return (
    <ul className={styles.grid}>
      {FAMILY_GOALS.map((goal) => {
        const GoalIcon = ICONS[goal.interest];
        return (
          <Card as="li" key={goal.interest} className={styles.cardItem}>
            <Link href={`/discover?interest=${goal.interest}`} className={styles.link}>
              <span className={styles.iconWrap}>
                <GoalIcon />
              </span>
              <span className={styles.label}>{goal.label}</span>
              <span className={styles.description}>{goal.description}</span>
            </Link>
          </Card>
        );
      })}
    </ul>
  );
}
