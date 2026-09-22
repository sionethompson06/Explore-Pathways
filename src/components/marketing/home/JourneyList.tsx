import { JOURNEY_STEPS } from "@/content/how-it-works";
import {
  DiscoverIcon,
  ExploreIcon,
  PlanIcon,
  ImplementIcon,
  SupportIcon,
  AdvanceIcon,
} from "../icons";
import styles from "./JourneyList.module.css";

const ICONS = {
  discover: DiscoverIcon,
  explore: ExploreIcon,
  plan: PlanIcon,
  implement: ImplementIcon,
  support: SupportIcon,
  advance: AdvanceIcon,
} as const;

export function JourneyList() {
  return (
    <ol className={styles.list}>
      {JOURNEY_STEPS.map((step, index) => {
        const StepIcon = ICONS[step.id];
        return (
          <li key={step.id} className={styles.item}>
            <div className={styles.marker}>
              <StepIcon />
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
            </div>
            <div>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.description}>{step.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
