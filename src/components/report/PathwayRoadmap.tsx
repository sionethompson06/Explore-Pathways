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

/** R06 -- Preliminary Pathway (section 25/45). Desktop grid where practical, vertical stepper on mobile; parallel branches render inside one accessible step. */
export function PathwayRoadmap({ pathway, headingId }: { pathway: PathwaySection; headingId: string }) {
  const steps = groupStages(pathway.stages);
  return (
    <div className={styles.wrap}>
      <h2 id={headingId} className={styles.title}>
        {pathway.title}
      </h2>
      {pathway.intro ? <p className={styles.intro}>{pathway.intro}</p> : null}
      <ol className={styles.stages}>
        {steps.map((step) =>
          step.stages.length > 1 ? (
            <li key={step.key} className={styles.stage}>
              <div className={styles.parallelGroup}>
                {step.stages.map((stage) => (
                  <span key={stage.id} className={styles.parallelBranch}>
                    {stage.label}
                  </span>
                ))}
              </div>
            </li>
          ) : (
            <li key={step.key} className={styles.stage}>
              <span className={styles.label}>{step.stages[0]!.label}</span>
            </li>
          ),
        )}
      </ol>
      <p className={styles.subordinate}>{pathway.subordinateStatement}</p>
    </div>
  );
}
