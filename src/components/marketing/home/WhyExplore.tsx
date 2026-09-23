import { WHY_EXPLORE_REASONS, type WhyExploreReason } from "@/content/why-explore";
import { IconBadge } from "../IconBadge";
import { SupportIcon, ScheduleIcon, CompassIcon, AcademicIcon, DiscoverIcon, ExploreIcon } from "../icons";
import styles from "./WhyExplore.module.css";

const ICONS: Record<WhyExploreReason["icon"], (props: { className?: string }) => React.ReactElement> = {
  support: SupportIcon,
  schedule: ScheduleIcon,
  compass: CompassIcon,
  academic: AcademicIcon,
  discover: DiscoverIcon,
  explore: ExploreIcon,
};

/** Section 3 (Phase 2B): "Why Families Explore a Different Path." */
export function WhyExplore() {
  return (
    <ul className={styles.grid}>
      {WHY_EXPLORE_REASONS.map((reason) => {
        const ReasonIcon = ICONS[reason.icon];
        return (
          <li key={reason.id} className={styles.item}>
            <IconBadge tone="tint">
              <ReasonIcon />
            </IconBadge>
            <p className={styles.text}>{reason.text}</p>
          </li>
        );
      })}
    </ul>
  );
}
