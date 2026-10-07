import type { ReactNode } from "react";
import type { StaffCaseDetail } from "@/server/staff-queue";
import { formatStaffDateTime, statusLabel } from "./format";
import styles from "./staff-page.module.css";

/**
 * Phase 6C shared limited case detail (section 11), used by both
 * /admin/cases/[caseId] and /advisor/cases/[caseId] -- each route's
 * own page.tsx performs its own distinct authorization check before
 * ever rendering this component; it never performs authorization
 * itself. The ReportSnapshot content shown here is EXACTLY what the
 * family already saw (publicContent, the same report-contract.json
 * public DTO) -- never a richer internal copy, and every section is
 * explicitly labeled by provenance (parent-reported vs.
 * Pathways-generated guidance) so a reader never mistakes the
 * Discovery algorithm's output for a professional assessment.
 */
export function CaseDetailView({
  detail,
  assignmentControl,
}: {
  detail: StaffCaseDetail;
  assignmentControl?: ReactNode;
}) {
  return (
    <>
      <dl className={styles.detailGrid}>
        <div className={styles.detailField}>
          <dt>Student</dt>
          <dd>{detail.studentDisplayName}</dd>
        </div>
        <div className={styles.detailField}>
          <dt>Grade band</dt>
          <dd>{detail.gradeBand ?? "—"}</dd>
        </div>
        <div className={styles.detailField}>
          <dt>Case status</dt>
          <dd>
            <span className={styles.badge} data-status={detail.caseStatus}>
              {statusLabel(detail.caseStatus)}
            </span>
          </dd>
        </div>
        <div className={styles.detailField}>
          <dt>Consultation status</dt>
          <dd>{statusLabel(detail.consultationStatus)}</dd>
        </div>
        <div className={styles.detailField}>
          <dt>Booking</dt>
          <dd>{formatStaffDateTime(detail.bookingScheduledAt)}</dd>
        </div>
        <div className={styles.detailField}>
          <dt>Preferred format</dt>
          <dd>{detail.preferredCallFormat ?? "—"}</dd>
        </div>
        <div className={styles.detailField}>
          <dt>Current advisor</dt>
          <dd>
            {detail.currentAdvisor ? (
              detail.currentAdvisor.name
            ) : (
              <span className={styles.unassigned}>Unassigned</span>
            )}
          </dd>
        </div>
        <div className={styles.detailField}>
          <dt>Entered workflow</dt>
          <dd>{formatStaffDateTime(detail.enteredWorkflowAt)}</dd>
        </div>
      </dl>

      {assignmentControl}

      <section className={styles.section} aria-labelledby="discovery-heading">
        <h2 id="discovery-heading" className={styles.sectionTitle}>
          What We Heard
        </h2>
        <p>{detail.report.sections.insight.body}</p>
        <p className={styles.provenanceNote}>Parent-reported information, captured during Discovery.</p>
      </section>

      <section className={styles.section} aria-labelledby="priorities-heading">
        <h2 id="priorities-heading" className={styles.sectionTitle}>
          Selected Priorities
        </h2>
        {detail.report.sections.snapshot.chips.length > 0 ? (
          <ul className={styles.chipList}>
            {detail.report.sections.snapshot.chips.map((chip) => (
              <li key={chip.id} className={styles.chip}>
                {chip.label}
              </li>
            ))}
          </ul>
        ) : (
          <p>No priorities were specifically flagged.</p>
        )}
        <p className={styles.provenanceNote}>Parent-reported information.</p>
      </section>

      <section className={styles.section} aria-labelledby="guidance-heading">
        <h2 id="guidance-heading" className={styles.sectionTitle}>
          {detail.report.sections.snapshot.headline}
        </h2>
        <p>{detail.report.sections.snapshot.summary}</p>
        <p className={styles.provenanceNote}>
          Pathways-generated preliminary Discovery guidance -- not a professional assessment of the
          student.
        </p>
      </section>
    </>
  );
}
