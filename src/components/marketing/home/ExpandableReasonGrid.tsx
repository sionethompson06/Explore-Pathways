"use client";

import { useState } from "react";
import { WHY_EXPLORE_REASONS, type WhyExploreReason } from "@/content/why-explore";
import { IconBadge } from "../IconBadge";
import {
  ScheduleIcon,
  AcademicIcon,
  CompassIcon,
  HomeschoolIcon,
  SupportIcon,
  DiscoverIcon,
  ExploreIcon,
  AdvanceIcon,
} from "../icons";
import styles from "./ExpandableReasonGrid.module.css";

const ICONS: Record<WhyExploreReason["icon"], (props: { className?: string }) => React.ReactElement> = {
  schedule: ScheduleIcon,
  academic: AcademicIcon,
  compass: CompassIcon,
  homeschool: HomeschoolIcon,
  support: SupportIcon,
  discover: DiscoverIcon,
  explore: ExploreIcon,
  advance: AdvanceIcon,
};

/**
 * Section (Phase 2E): "Why Families Explore a Different Path" as
 * interactive, expandable reason tiles -- a real client component,
 * not the flattened Asset Pack 2 P2-04 reference image. Each tile is
 * a single <button> (never a link, since it doesn't navigate) that
 * toggles its own detail panel; no nested interactive elements.
 */
export function ExpandableReasonGrid() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className={styles.grid}>
      {WHY_EXPLORE_REASONS.map((reason) => {
        const ReasonIcon = ICONS[reason.icon];
        const isOpen = openId === reason.id;
        const panelId = `reason-detail-${reason.id}`;
        return (
          <li key={reason.id} className={styles.item}>
            <button
              type="button"
              className={styles.tile}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : reason.id)}
            >
              <IconBadge tone="tint">
                <ReasonIcon />
              </IconBadge>
              <span className={styles.statement}>{reason.statement}</span>
              <span className={styles.toggleIcon} aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div id={panelId} className={styles.detailWrap} data-open={isOpen}>
              <div className={styles.detailInner}>
                <p className={styles.detail}>{reason.detail}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
