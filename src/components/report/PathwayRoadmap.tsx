import type { PathwaySection, PathwayStage } from "@/lib/report/types";
import styles from "./PathwayRoadmap.module.css";

type Step = { key: string; stages: PathwayStage[] };

/** Groups consecutive stages sharing a parallelGroup into one accessible step (section 25/45: parallel branches, still semantic/reading order). */
function groupStages(stages: PathwayStage[]): Step[] {
  const steps: Step[] = [];
  for (const stage of stages) {
    const last = steps[steps.length - 1];
    if (stage.parallelGroup && last && last.stages[0]?.parallelGroup === stage.parallelGroup) {
      last.stages.push(stage);
    } else {
      steps.push({ key: stage.id, stages: [stage] });
    }
  }
  return steps;
}

/** Decorative fork glyph marking a step that splits into parallel priorities. */
function ForkIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 2v4M8 6c0 2-3 2-3 4.5M8 6c0 2 3 2 3 4.5M5 10.5v3M11 10.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * R06 -- Preliminary Pathway (section 25/45, redesigned Phase 5.2
 * sections 14-17, layout split in Phase 5.2b). One semantic renderer,
 * two presentational variants chosen purely from the assembled data
 * shape (whether any grouped step shares a parallelGroup) -- never
 * from a persona, archetype, or fixture id:
 *
 * - Purely SEQUENTIAL pathways (no parallel group) render a compact
 *   horizontal progression at desktop (>=900px) and the vertical
 *   spine-connected stepper on mobile/tablet.
 * - Pathways containing a PARALLEL group keep the richer vertical
 *   split/rejoin treatment at every viewport (P12/GR12): the step
 *   visibly SPLITS into side-by-side priority tracks and then
 *   REJOINS the single line for the next stage, so the concept reads
 *   without needing the subordinate paragraph.
 *
 * Accessible reading order stays a single <ol>, one <li> per parallel
 * group, with an explicit group label (section 15) -- never two
 * separate lists, never a canvas diagram.
 */
export function PathwayRoadmap({ pathway, headingId }: { pathway: PathwaySection; headingId: string }) {
  const steps = groupStages(pathway.stages);
  // Layout depends only on the assembled data shape -- never a persona,
  // archetype, or fixture id (section 3 of the Phase 5.2b instruction).
  const hasParallelPathway = steps.some((step) => step.stages.length > 1);
  return (
    <div className={styles.wrap}>
      <h2 id={headingId} className={styles.title}>
        {pathway.title}
      </h2>
      {pathway.intro ? <p className={styles.intro}>{pathway.intro}</p> : null}
      <ol className={`${styles.stages} ${hasParallelPathway ? styles.parallelPathway : styles.sequentialPathway}`}>
        {steps.map((step) =>
          step.stages.length > 1 ? (
            <li key={step.key} className={`${styles.stage} ${styles.stageParallel}`}>
              <span className={styles.node} aria-hidden="true" />
              <div className={styles.parallelBracket}>
                <div role="group" aria-label="Parallel pathway priorities" className={styles.parallelGroup}>
                  <span className={styles.parallelLabel}>
                    <ForkIcon />
                    Parallel pathway priorities
                  </span>
                  <div className={styles.parallelBranches}>
                    {step.stages.map((stage) => (
                      <span key={stage.id} className={styles.parallelBranch}>
                        {stage.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          ) : (
            <li key={step.key} className={styles.stage}>
              <span className={styles.node} aria-hidden="true" />
              <span className={styles.label}>{step.stages[0]!.label}</span>
            </li>
          ),
        )}
      </ol>
      <p className={styles.subordinate}>{pathway.subordinateStatement}</p>
    </div>
  );
}
