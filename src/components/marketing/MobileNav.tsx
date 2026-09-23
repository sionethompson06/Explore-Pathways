"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  PRIMARY_NAV_LINKS,
  AUDIENCE_LINKS,
  DISCOVER_HREF,
  NAV_CTA_LABEL,
  EDUCATION_PATHWAYS_LABEL,
} from "@/content/nav-links";
import styles from "./MobileNav.module.css";

const [howItWorksLink, forPartnersLink] = PRIMARY_NAV_LINKS;

/**
 * The small-screen navigation toggle. Closed by default; its panel
 * is only mounted (not merely hidden) while open, so assistive
 * technology never encounters focusable links it can't see. Escape
 * closes it; navigating via a link closes it too. The four pathway
 * destinations are exposed directly in this panel (not behind a
 * second, nested disclosure) under a labeled "Education Pathways"
 * group so they stay reachable in a single tap.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.toggleIcon} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.toggleLabel}>{open ? "Close menu" : "Menu"}</span>
      </button>

      {open ? (
        <div id={panelId} className={styles.panel}>
          <nav aria-label="Primary">
            <ul className={styles.panelList}>
              <li>
                <Link
                  href={howItWorksLink.href}
                  onClick={() => setOpen(false)}
                  className={styles.panelLink}
                >
                  {howItWorksLink.label}
                </Link>
              </li>
            </ul>

            <p className={styles.panelGroupLabel}>{EDUCATION_PATHWAYS_LABEL}</p>
            <ul className={styles.panelList}>
              {AUDIENCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={styles.panelSubLink}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className={styles.panelList}>
              <li>
                <Link
                  href={forPartnersLink.href}
                  onClick={() => setOpen(false)}
                  className={styles.panelLink}
                >
                  {forPartnersLink.label}
                </Link>
              </li>
            </ul>
          </nav>
          <Link href={DISCOVER_HREF} className={styles.panelCta} onClick={() => setOpen(false)}>
            {NAV_CTA_LABEL}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
