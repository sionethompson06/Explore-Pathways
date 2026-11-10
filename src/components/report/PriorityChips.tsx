import type { PriorityChip } from "@/lib/report/types";
import styles from "./PriorityChips.module.css";

/**
 * R01 priority chips (section 12). Educational and feasibility chips
 * are never visually interchangeable -- a feasibility chip (cost
 * preference) must never look like educational-fit evidence.
 */
export function PriorityChips({ chips }: { chips: PriorityChip[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className={styles.list}>
      {chips.map((chip) => (
        <li
          key={chip.id}
          className={`${styles.chip} ${chip.kind === "FEASIBILITY" ? styles.feasibility : styles.educational}`}
        >
          {chip.label}
        </li>
      ))}
    </ul>
  );
}
