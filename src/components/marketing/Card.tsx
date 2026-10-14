import type { ReactNode } from "react";
import styles from "./Card.module.css";

export function Card({
  children,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  as?: "div" | "li";
  className?: string | undefined;
}) {
  return <Tag className={className ? `${styles.card} ${className}` : styles.card}>{children}</Tag>;
}
