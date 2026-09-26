import Link from "next/link";
import { FREEDOM_CARDS, type FreedomCard as FreedomCardData } from "@/content/freedom-cards";
import { MARKETING_PHOTOS, type MarketingPhotoKey } from "@/content/marketing-photos";
import { IconBadge } from "../IconBadge";
import { PhotoSlot } from "../PhotoSlot";
import { AthleticsIcon, AcademicIcon, CompassIcon, ScheduleIcon } from "../icons";
import styles from "./FreedomCards.module.css";

const ICONS: Record<FreedomCardData["id"], (props: { className?: string }) => React.ReactElement> = {
  "train-more": AthleticsIcon,
  "get-ahead": AcademicIcon,
  "learn-anywhere": CompassIcon,
  "take-back-time": ScheduleIcon,
};

/** Maps each card to its required photography slot -- see docs/pathways/IMAGE_ASSET_MANIFEST.md. */
const PHOTO_KEY: Record<FreedomCardData["id"], MarketingPhotoKey> = {
  "train-more": "athleteBasketball",
  "get-ahead": "academicStudentLaptop",
  "learn-anywhere": "flexibleTravelStudent",
  "take-back-time": "studentLifestyle",
};

/** Per-manifest crop guidance: keeps each asset's off-center subject framed under `object-fit: cover`. */
const PHOTO_POSITION: Record<FreedomCardData["id"], string> = {
  "train-more": "60% 30%",
  "get-ahead": "center 35%",
  "learn-anywhere": "center 30%",
  "take-back-time": "center 25%",
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
        const photo = MARKETING_PHOTOS[PHOTO_KEY[card.id]];
        return (
          <li key={card.id} className={styles.card}>
            <div className={`${styles.imageArea} ${gradientClass[card.gradient]}`}>
              <PhotoSlot
                photoSrc={photo.path}
                alt={photo.alt}
                sizes="(max-width: 560px) 100vw, (max-width: 1000px) 50vw, 25vw"
                objectPosition={PHOTO_POSITION[card.id]}
                fallback={<CardIcon className={styles.imageIcon!} />}
              />
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
