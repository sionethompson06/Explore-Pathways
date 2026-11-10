import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { NavPathwaysMenu } from "./NavPathwaysMenu";
import { ButtonLink } from "./Button";
import { PRIMARY_NAV_LINKS, DISCOVER_HREF, NAV_CTA_LABEL } from "@/content/nav-links";
import styles from "./Header.module.css";

// PRIMARY_NAV_LINKS is declared in nav-links.ts as [How It Works, For
// Partners], in that order -- the Education Pathways dropdown renders
// between them, so this destructure keeps a single source of truth
// for the two hrefs/labels rather than duplicating them here.
const [howItWorksLink, forPartnersLink] = PRIMARY_NAV_LINKS;

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
              <li>
                <Link href={howItWorksLink.href} className={styles.link}>
                  {howItWorksLink.label}
                </Link>
              </li>
              <NavPathwaysMenu />
              <li>
                <Link href={forPartnersLink.href} className={styles.link}>
                  {forPartnersLink.label}
                </Link>
              </li>
            </ul>
          </nav>

          <div className={styles.desktopCta}>
            <ButtonLink href={DISCOVER_HREF} variant="primary">
              {NAV_CTA_LABEL}
            </ButtonLink>
          </div>

          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
