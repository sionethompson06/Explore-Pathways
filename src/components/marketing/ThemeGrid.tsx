import type { ReactElement } from "react";
import { Card } from "./Card";
import { IconBadge } from "./IconBadge";
import {
  AthleticsIcon,
  ScheduleIcon,
  HomeschoolIcon,
  AcademicIcon,
  CompassIcon,
  QuestionIcon,
  DiscoverIcon,
  ExploreIcon,
  PlanIcon,
  ImplementIcon,
  SupportIcon,
  AdvanceIcon,
  CheckIcon,
} from "./icons";
import styles from "./ThemeGrid.module.css";

export type ThemeIconKey =
  | "athletics"
  | "schedule"
  | "homeschool"
  | "academic"
  | "compass"
  | "question"
  | "discover"
  | "explore"
  | "plan"
  | "implement"
  | "support"
  | "advance"
  | "check";

const ICONS: Record<ThemeIconKey, (props: { className?: string }) => ReactElement> = {
  athletics: AthleticsIcon,
  schedule: ScheduleIcon,
  homeschool: HomeschoolIcon,
  academic: AcademicIcon,
  compass: CompassIcon,
  question: QuestionIcon,
  discover: DiscoverIcon,
  explore: ExploreIcon,
  plan: PlanIcon,
  implement: ImplementIcon,
  support: SupportIcon,
  advance: AdvanceIcon,
  check: CheckIcon,
};

export interface ThemeGridItem {
  icon: ThemeIconKey;
  title: string;
  body: string;
}

/**
 * A responsive grid of icon + title + body cards, reusing the shared
 * Card/IconBadge design system. Used for the audience pages' theme
 * sections and the For Partners three-role model (Phase 2F) -- these
 * are informational, non-interactive cards, so no hover/click state
 * is implemented (nothing here navigates or toggles).
 */
export function ThemeGrid({ items }: { items: ThemeGridItem[] }) {
  return (
    <ul className={styles.grid}>
      {items.map((item) => {
        const ItemIcon = ICONS[item.icon];
        return (
          <Card as="li" className={styles.item} key={item.title}>
            <IconBadge>
              <ItemIcon />
            </IconBadge>
            <h3 className={styles.title}>{item.title}</h3>
            <p className={styles.body}>{item.body}</p>
          </Card>
        );
      })}
    </ul>
  );
}
