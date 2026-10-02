import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";
import {
  PRIMARY_NAV_LINKS,
  AUDIENCE_LINKS,
  FOOTER_LEGAL_LINKS,
} from "@/content/nav-links";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <Logo inverse />
            <p className={styles.tagline}>
              An education pathways ecosystem that starts with your student, not with one
              school.
            </p>
          </div>

          <nav aria-label="Explore pathways">
            <h2 className={styles.heading}>Explore</h2>
            <ul className={styles.list}>
              {AUDIENCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className={styles.heading}>Pathways</h2>
            <ul className={styles.list}>
              {PRIMARY_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
              {FOOTER_LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className={styles.bottom}>
          <p className={styles.disclosure}>
            Pathways is an education exploration service. It does not operate a school in
            this release and does not guarantee admission, eligibility, credit transfer or
            outcomes. This is a development preview and is not yet open for public use.
          </p>
          <p className={styles.copy}>© {new Date().getFullYear()} Pathways.</p>
        </div>
      </Container>
    </footer>
  );
}
