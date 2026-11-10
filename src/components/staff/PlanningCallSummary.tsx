import type { PlanningCallRecordDTO } from "@/server/planning-call";
import { formatStaffDateTime, statusLabel } from "./format";
import styles from "./staff-page.module.css";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className={styles.detailField}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ListField({ label, values }: { label: string; values: readonly string[] }) {
  if (values.length === 0) return null;
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{label}</h3>
      <ul>
        {values.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Phase 6D read-only planning-call renderer (section 17: admin
 * operational review; also used for an advisor's own COMPLETED
 * record, which this phase no longer allows further structured edits
 * to). Never renders an editable control -- an ADMIN viewer has no
 * write path to this content anywhere in this phase.
 */
export function PlanningCallSummary({ record }: { record: PlanningCallRecordDTO | null }) {
  if (!record) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Planning Call</h2>
        <p className={styles.emptyState} role="status">
          No planning call record exists yet for this case.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="planning-call-summary-heading">
      <h2 id="planning-call-summary-heading" className={styles.sectionTitle}>
        Planning Call
      </h2>
      <dl className={styles.detailGrid}>
        <div className={styles.detailField}>
          <dt>Status</dt>
          <dd>
            <span className={styles.badge} data-status={record.status}>
              {statusLabel(record.status)}
            </span>
          </dd>
        </div>
        <Field label="Attendance" value={record.attendance ? statusLabel(record.attendance) : null} />
        <Field label="Outcome" value={record.outcome ? statusLabel(record.outcome) : null} />
        <Field label="Service fit" value={record.serviceFit ? statusLabel(record.serviceFit) : null} />
        <div className={styles.detailField}>
          <dt>Last updated</dt>
          <dd>{formatStaffDateTime(record.updatedAt)}</dd>
        </div>
        {record.completedAt ? (
          <div className={styles.detailField}>
            <dt>Completed</dt>
            <dd>{formatStaffDateTime(record.completedAt)}</dd>
          </div>
        ) : null}
      </dl>

      <Field label="A. Family's Main Goal" value={record.familyMainGoal} />
      <Field label="B. Current Educational Situation" value={record.currentEducationalSituation} />
      <Field label="C. Student Strengths & Interests" value={record.studentStrengths} />
      <Field label="D. Learning Needs & Support" value={record.learningNeedsSupport} />
      <Field label="E. Schedule / Lifestyle Requirements" value={record.scheduleLifestyleRequirements} />
      <Field label="F. Academic Planning" value={record.academicPlanningNotes} />
      <ListField label="G. Pathways Discussed" values={record.pathwaysDiscussed} />
      <ListField label="H. Open Questions" values={record.priorityQuestions} />
      <ListField label="Verified Information" values={record.verifiedFacts} />
      <ListField label="Needs Verification" values={record.verificationNeeded} />
      <Field label="I. Advisor Assessment (advisor professional judgment)" value={record.advisorAssessment} />
      <Field label="J. Recommended Next Step" value={record.recommendedNextAction} />
    </section>
  );
}
