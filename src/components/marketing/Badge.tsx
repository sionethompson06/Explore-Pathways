import type { ReactNode } from "react";
import styles from "./Badge.module.css";

/** A small labeled tag -- used for "Illustrative example" and similar disclosures that must stay visually prominent, never fine print. */
export function Badge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}
