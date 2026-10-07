import type { ReactNode } from "react";
import styles from "./IconBadge.module.css";

export type IconBadgeTone = "tint" | "navy" | "inverse";

const toneClass: Record<IconBadgeTone, string> = {
  tint: styles.tint!,
  navy: styles.navy!,
  inverse: styles.inverse!,
};

/** The round icon container reused across pathway indicators, freedom cards, and process steps. */
export function IconBadge({
  children,
  tone = "tint",
}: {
  children: ReactNode;
  tone?: IconBadgeTone;
}) {
  return <span className={`${styles.badge} ${toneClass[tone]}`}>{children}</span>;
}
