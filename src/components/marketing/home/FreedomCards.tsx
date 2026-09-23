import Link from "next/link";
import { FREEDOM_CARDS, type FreedomCard as FreedomCardData } from "@/content/freedom-cards";
import { IconBadge } from "../IconBadge";
import { AthleticsIcon, AcademicIcon, CompassIcon, ScheduleIcon } from "../icons";
import styles from "./FreedomCards.module.css";

const ICONS: Record<FreedomCardData["id"], (props: { className?: string }) => React.ReactElement> = {
  "train-more": AthleticsIcon,
  "get-ahead": AcademicIcon,
  "learn-anywhere": CompassIcon,
  "take-back-time": ScheduleIcon,
};

const gradientClass: Record<FreedomCardData["gradient"], string> = {
  green: styles.gradientGreen!,
  blue: styles.gradientBlue!,
  "navy-green": styles.gradientNavyGreen!,
  "navy-blue": styles.gradientNavyBlue!,
};

export function FreedomCards() {
  return (
    <ul className={styles.grid}>
      {FREEDOM_CARDS.map((card) => {
        const CardIcon = ICONS[card.id];
        return (
          <li key={card.id} className={styles.card}>
            <div className={`${styles.imageArea} ${gradientClass[card.gradient]}`}>
              <CardIcon className={styles.imageIcon!} />
            </div>
            <div className={styles.badgeRow}>
              <IconBadge tone="navy">
                <CardIcon />
              </IconBadge>
            </div>
            <div className={styles.body}>
              <h3 className={styles.title}>{card.title}</h3>
              <p className={styles.description}>{card.description}</p>
              <Link href={card.href} className={styles.link}>
                Learn more <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
