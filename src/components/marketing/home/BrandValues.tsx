import { BRAND_VALUES, type BrandValue } from "@/content/brand-values";
import { IconBadge } from "../IconBadge";
import { SupportIcon, CompassIcon, DiscoverIcon, AcademicIcon } from "../icons";
import styles from "./BrandValues.module.css";

const ICONS: Record<BrandValue["icon"], (props: { className?: string }) => React.ReactElement> = {
  support: SupportIcon,
  compass: CompassIcon,
  discover: DiscoverIcon,
  academic: AcademicIcon,
};

/** Section 7 (Phase 2B image-integration): brand values band. */
export function BrandValues() {
  return (
    <ul className={styles.grid}>
      {BRAND_VALUES.map((value) => {
        const ValueIcon = ICONS[value.icon];
        return (
          <li key={value.id} className={styles.item}>
            <IconBadge tone="inverse">
              <ValueIcon />
            </IconBadge>
            <p className={styles.label}>{value.label}</p>
          </li>
        );
      })}
    </ul>
  );
}
