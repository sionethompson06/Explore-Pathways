import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "inverse";

// Non-null assertions below are safe: these CSS module class names are
// defined in the co-located Button.module.css this file always
// imports; TypeScript only sees them as possibly-undefined because
// tsconfig's noUncheckedIndexedAccess treats every CSS-module lookup
// as an index-signature access.
const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary!,
  secondary: styles.secondary!,
  inverse: styles.inverse!,
};

/**
 * Every call-to-action on the marketing site goes through this
 * component so link styling and focus behavior stay consistent. It
 * is always an <a>/Link -- never a form submit -- since nothing in
 * Phase 2 collects or persists data.
 */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string | undefined;
}) {
  const classes = [styles.button, variantClass[variant], className].filter(Boolean).join(" ");
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
