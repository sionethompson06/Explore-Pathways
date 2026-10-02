"use client";

import { useState } from "react";
import { JOURNEY_STEPS } from "@/content/how-it-works";
import { DiscoverIcon, ExploreIcon, PlanIcon, ImplementIcon, SupportIcon } from "../icons";
import styles from "./InteractivePathwayProcess.module.css";

const ICONS = {
  discover: DiscoverIcon,
  explore: ExploreIcon,
  plan: PlanIcon,
  implement: ImplementIcon,
  support: SupportIcon,
} as const;

/**
 * Section (Phase 2E): "A Clear Path From Possibility to Progress" --
 * a real interactive 5-step timeline, not the flattened Asset Pack 2
 * P2-03 reference image. One shared `selectedIndex` drives both the
 * desktop connected-steps row (with a single detail panel below it)
 * and the mobile vertical timeline (where each step's detail expands
 * directly beneath itself) -- both markups always render; only CSS
 * decides which is visible at a given width, so there is no
 * viewport-dependent conditional rendering to desync during
 * hydration.
 */
export function InteractivePathwayProcess() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedStep = JOURNEY_STEPS[selectedIndex]!;

  return (
    <div className={styles.wrap}>
      <ol className={styles.steps}>
        {JOURNEY_STEPS.map((step, index) => {
          const StepIcon = ICONS[step.id];
          const selected = index === selectedIndex;
          return (
            <li key={step.id} className={styles.stepItem}>
              <button
                type="button"
                className={styles.stepButton}
                aria-expanded={selected}
                aria-controls={`process-detail-${step.id}`}
                data-selected={selected}
                onClick={() => setSelectedIndex(index)}
              >
                <span className={styles.marker} data-selected={selected}>
                  <StepIcon />
                  <span className={styles.number} aria-hidden="true">
                    {index + 1}
                  </span>
                </span>
                <span className={styles.title}>{step.title}</span>
              </button>

              {/* Mobile: each step's detail expands directly beneath itself. */}
              <div
                id={`process-detail-${step.id}-mobile`}
                className={styles.mobileDetailWrap}
                data-open={selected}
              >
                <div className={styles.mobileDetailInner}>
                  <p className={styles.description}>{step.description}</p>
                  <p className={styles.detail}>{step.detail}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Desktop: one shared panel below the connected-steps row. */}
      <div
        id={`process-detail-${selectedStep.id}`}
        className={styles.desktopPanel}
        aria-live="polite"
      >
        <p className={styles.description}>{selectedStep.description}</p>
        <p className={styles.detail}>{selectedStep.detail}</p>
      </div>
    </div>
  );
}
