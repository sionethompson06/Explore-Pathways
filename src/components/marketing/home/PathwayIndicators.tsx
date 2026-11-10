import Link from "next/link";
import { IconBadge } from "../IconBadge";
import { AthleticsIcon, ScheduleIcon, HomeschoolIcon, AcademicIcon } from "../icons";
import styles from "./PathwayIndicators.module.css";

const INDICATORS = [
  { href: "/pathways/athletes", label: "Student Athletes", Icon: AthleticsIcon },
  { href: "/pathways/flexible-learning", label: "Flexible Learning", Icon: ScheduleIcon },
  { href: "/pathways/homeschool", label: "Homeschool Support", Icon: HomeschoolIcon },
  { href: "/pathways/academic-opportunities", label: "College Advancement", Icon: AcademicIcon },
] as const;

/** The four-item pathway indicator row at the base of the hero. */
export function PathwayIndicators() {
  return (
    <ul className={styles.list}>
      {INDICATORS.map(({ href, label, Icon }) => (
        <li key={href}>
          <Link href={href} className={styles.item}>
            <IconBadge tone="inverse">
              <Icon />
            </IconBadge>
            <span>{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
