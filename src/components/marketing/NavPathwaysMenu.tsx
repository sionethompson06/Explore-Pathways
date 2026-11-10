"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AUDIENCE_LINKS, EDUCATION_PATHWAYS_LABEL } from "@/content/nav-links";
import styles from "./NavPathwaysMenu.module.css";

/**
 * Desktop "Education Pathways" disclosure: a button that reveals the
 * four audience-page links. Deliberately a disclosure (button + a
 * list of real Links), not an ARIA menu/menuitem widget -- the WAI-ARIA
 * Authoring Practices recommend against menu semantics for site
 * navigation, since menuitem requires full arrow-key roving-tabindex
 * behavior that plain links don't need.
 */
export function NavPathwaysMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <li className={styles.wrapper} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {EDUCATION_PATHWAYS_LABEL}
        <span className={styles.chevron} data-open={open} aria-hidden="true" />
      </button>

      {open ? (
        <ul id={panelId} className={styles.panel}>
          {AUDIENCE_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={styles.panelLink} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
