import type { ReactNode } from "react";
import { Container } from "./Container";
import styles from "./Section.module.css";

export type SectionTone = "default" | "alt" | "inverse" | "accent-tint";

// See Button.tsx for why these non-null assertions are safe.
const toneClass: Record<SectionTone, string> = {
  default: styles.default!,
  alt: styles.alt!,
  inverse: styles.inverse!,
  "accent-tint": styles.accentTint!,
};

/**
 * A full-width page band with a consistent vertical rhythm and one of
 * a small set of approved background tones -- the building block
 * every homepage/audience-page section is made from, so spacing and
 * color stay consistent without each page reinventing it.
 */
export function Section({
  children,
  tone = "default",
  id,
  ariaLabelledBy,
  narrow = false,
}: {
  children: ReactNode;
  tone?: SectionTone;
  id?: string;
  ariaLabelledBy?: string;
  narrow?: boolean;
}) {
  return (
    <section
      id={id}
      className={`${styles.section} ${toneClass[tone]}`}
      aria-labelledby={ariaLabelledBy}
    >
      <Container>
        <div style={narrow ? { maxWidth: "var(--max-prose-width)" } : undefined}>{children}</div>
      </Container>
    </section>
  );
}
