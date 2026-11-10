import styles from "./Logo.module.css";

/** A simple text wordmark -- no logo image asset exists or is claimed to exist yet (see docs/pathways/MEDIA_SOURCE_REGISTER.md). */
export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={inverse ? `${styles.logo} ${styles.inverse}` : styles.logo}>
      Pathways
      <span className={styles.mark} aria-hidden="true" />
    </span>
  );
}
