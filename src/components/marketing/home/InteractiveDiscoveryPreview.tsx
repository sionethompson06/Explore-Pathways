"use client";

import { useRef, useState } from "react";
import { REPORT_PREVIEW } from "@/content/report-preview";
import { Badge } from "../Badge";
import { IconBadge } from "../IconBadge";
import { PlanIcon, CompassIcon, DiscoverIcon, QuestionIcon } from "../icons";
import styles from "./InteractiveDiscoveryPreview.module.css";

const CATEGORIES = [
  { id: "matters", label: "What Matters to Your Family", icon: PlanIcon, items: REPORT_PREVIEW.priorities },
  { id: "directions", label: "Directions Worth Exploring", icon: CompassIcon, items: REPORT_PREVIEW.directions },
  { id: "possibilities", label: "Possibilities to Consider", icon: DiscoverIcon, items: REPORT_PREVIEW.possibilities },
  { id: "questions", label: "Questions to Explore", icon: QuestionIcon, items: REPORT_PREVIEW.planningQuestions },
] as const;

/**
 * Section (Phase 2E): "See Your Student's Possibilities More
 * Clearly." -- a real interactive tabbed report preview, not the
 * flattened Asset Pack 2 P2-02 reference image (which also fabricated
 * a student photo/quote this project has consistently declined to
 * use). Implements the WAI-ARIA tabs pattern with automatic
 * activation and roving tabindex, so it works identically -- not just
 * visually -- at every viewport width.
 */
export function InteractiveDiscoveryPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function activate(index: number) {
    const wrapped = (index + CATEGORIES.length) % CATEGORIES.length;
    setActiveIndex(wrapped);
    tabRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        activate(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        activate(index - 1);
        break;
      case "Home":
        event.preventDefault();
        activate(0);
        break;
      case "End":
        event.preventDefault();
        activate(CATEGORIES.length - 1);
        break;
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.badgeRow}>
        <Badge>Illustrative example — not a student assessment or placement decision</Badge>
      </div>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Discovery Report preview</p>
        <h3 className={styles.heading}>{REPORT_PREVIEW.studentLabel}</h3>

        <div role="tablist" aria-label="Discovery Report categories" className={styles.tabList}>
          {CATEGORIES.map((category, index) => {
            const CategoryIcon = category.icon;
            const selected = index === activeIndex;
            return (
              <button
                key={category.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`discovery-tab-${category.id}`}
                aria-selected={selected}
                aria-controls={`discovery-panel-${category.id}`}
                tabIndex={selected ? 0 : -1}
                className={styles.tab}
                data-selected={selected}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <IconBadge tone={selected ? "navy" : "tint"}>
                  <CategoryIcon />
                </IconBadge>
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>

        {CATEGORIES.map((category, index) => (
          <div
            key={category.id}
            role="tabpanel"
            id={`discovery-panel-${category.id}`}
            aria-labelledby={`discovery-tab-${category.id}`}
            hidden={index !== activeIndex}
            tabIndex={0}
            className={styles.panel}
          >
            <ul className={styles.itemList}>
              {category.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
