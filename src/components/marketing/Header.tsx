import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { ButtonLink } from "./Button";
import { PRIMARY_NAV_LINKS, DISCOVER_HREF, PRIMARY_CTA_LABEL } from "@/content/nav-links";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <Container>
        <div className={styles.bar}>
          <Link href="/" className={styles.logoLink} aria-label="Pathways home">
            <Logo />
          </Link>

          <nav aria-label="Primary" className={styles.desktopNav}>
            <ul className={styles.list}>
              {PRIMARY_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.desktopCta}>
            <ButtonLink href={DISCOVER_HREF} variant="primary">
              {PRIMARY_CTA_LABEL}
            </ButtonLink>
          </div>

          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
