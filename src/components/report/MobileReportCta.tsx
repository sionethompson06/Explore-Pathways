"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./MobileReportCta.module.css";

/**
 * Mobile-only sticky CTA (section 31): never visible at the top of
 * the report, only appears once the family has scrolled past the
 * named anchor (placed right after R03's directions). A small client
 * component; report decision/content assembly stays entirely
 * server-side (this component only reads scroll position).
 */
export function MobileReportCta({ afterElementId, label, href }: { afterElementId: string; label: string; href: string }) {
  const [visible, setVisible] = useState(false);
  const observedRef = useRef(false);

  useEffect(() => {
    const target = document.getElementById(afterElementId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // Visible once the anchor has scrolled above the viewport (family has passed R03).
        setVisible(entry.boundingClientRect.top < 0);
        observedRef.current = true;
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [afterElementId]);

  return (
    <div className={styles.sticky} data-visible={visible} aria-hidden={!visible}>
      <a href={href} className={styles.link} tabIndex={visible ? 0 : -1}>
        {label}
      </a>
    </div>
  );
}
