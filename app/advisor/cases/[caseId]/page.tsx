import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPrincipal } from "@/server/staff-principal";
import { db } from "@/db/client";
import { getCaseDetailForStaff } from "@/server/staff-queue";
import { getPrimaryPlanningCallRecord, listPathwayOptions, isBlueprintReady } from "@/server/planning-call";
import { CaseDetailView } from "@/components/staff/CaseDetailView";
import { PlanningCallForm } from "@/components/staff/PlanningCallForm";
import { PlanningCallSummary } from "@/components/staff/PlanningCallSummary";
import styles from "@/components/staff/staff-page.module.css";
import { savePlanningCallDraftAction, completePlanningCallAction } from "./actions";

export const metadata: Metadata = {
  title: "Planning Call Workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: "You are not authorized to perform this action.",
  CASE_NOT_FOUND: "That case no longer exists.",
  ALREADY_COMPLETED: "This planning call has already been completed and can no longer be edited.",
  VERSION_CONFLICT: "Someone else saved more recent changes. Reload the page to see them before saving again.",
  ATTENDANCE_REQUIRED: "Choose a consultation attendance value before completing the planning call.",
  OUTCOME_REQUIRED: "Choose a recommended next operational step before completing the planning call.",
  OUTCOME_NOT_ALLOWED_FOR_ATTENDANCE:
    '"Continue to Blueprint" can only be chosen when attendance is "Attended."',
  INVALID_CASE_TRANSITION: "This case's current status does not allow that outcome.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  DRAFT_SAVED: "Draft saved.",
  COMPLETED: "Planning call completed.",
};

/**
 * Phase 6D Planning Call Workspace (sections 7-8, 21-22). The
 * advisor's actual working environment: pre-call Discovery context
 * (the EXACT family-facing ReportSnapshot -- never regenerated), the
 * structured planning-call record, and the attendance/outcome
 * completion controls. ADMIN retains read-only operational access
 * (section 17); only the currently-assigned ADVISOR gets the editable
 * form, and only while the record is not yet COMPLETED (section 10 --
 * completion locks further structured edits in this phase).
 */
export default async function AdvisorCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const principal = await requireStaffPrincipal(["ADVISOR", "ADMIN"]);
  const { caseId } = await params;
  const resolvedSearchParams = await searchParams;

  const detailResult = await getCaseDetailForStaff(db, principal.userId, caseId);
  if (!detailResult.ok) notFound();
  const { detail } = detailResult;
  const record = await getPrimaryPlanningCallRecord(db, caseId);
  const pathwayOptions = listPathwayOptions();

  const errorMessage = resolvedSearchParams.error ? ERROR_MESSAGES[resolvedSearchParams.error] : undefined;
  const successMessage = resolvedSearchParams.success ? SUCCESS_MESSAGES[resolvedSearchParams.success] : undefined;

  const canEdit = principal.role === "ADVISOR" && record?.status !== "COMPLETED";
  const report = detail.report;

  return (
    <div className={styles.page}>
      <Link href="/advisor/cases" className={styles.backLink}>
        ← Back to my cases
      </Link>
      <h1 className={styles.heading}>{detail.studentDisplayName}</h1>
      <p className={styles.subheading}>Planning Call Workspace.</p>

      {errorMessage ? (
        <p role="alert" className={styles.formStatus} data-tone="error">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p role="status" className={styles.formStatus} data-tone="success">
          {successMessage}
        </p>
      ) : null}

      <CaseDetailView detail={detail} />

      {report.sections.directions.cards.length > 0 || report.sections.comparisonGuide.questions.length > 0 ? (
        <section className={styles.section} aria-labelledby="advisor-prep-heading">
          <h2 id="advisor-prep-heading" className={styles.sectionTitle}>
            Advisor Preparation
          </h2>
          {report.sections.directions.cards.length > 0 ? (
            <>
              <h3 className={styles.sectionTitle}>Preliminary Pathway Directions</h3>
              <ul>
                {report.sections.directions.cards.map((card) => (
                  <li key={card.baseModelId}>
                    <strong>{card.title}</strong> -- {card.description}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {report.sections.comparisonGuide.questions.length > 0 ? (
            <>
              <h3 className={styles.sectionTitle}>Suggested Areas to Clarify</h3>
              <ul>
                {report.sections.comparisonGuide.questions.map((q) => (
                  <li key={q.id}>{q.question}</li>
                ))}
              </ul>
            </>
          ) : null}
          <p className={styles.provenanceNote}>
            Pathways-generated preliminary Discovery guidance -- not a professional assessment of the student.
          </p>
        </section>
      ) : null}

      {canEdit ? (
        <PlanningCallForm
          pathwaysCaseId={caseId}
          record={record}
          pathwayOptions={pathwayOptions}
          saveDraftAction={savePlanningCallDraftAction}
          completeAction={completePlanningCallAction}
        />
      ) : (
        <PlanningCallSummary record={record} />
      )}

      {isBlueprintReady(record) ? (
        <section className={styles.section} aria-labelledby="blueprint-entry-heading">
          <h2 id="blueprint-entry-heading" className={styles.sectionTitle}>
            Student Success Blueprint
          </h2>
          <p className={styles.provenanceNote}>This case is eligible for a Student Success Blueprint.</p>
          <Link href={`/advisor/cases/${caseId}/blueprint`} className={styles.secondaryButton}>
            Open Student Success Blueprint
          </Link>
        </section>
      ) : null}
    </div>
  );
}
