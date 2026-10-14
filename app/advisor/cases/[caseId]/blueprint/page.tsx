import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPrincipal } from "@/server/staff-principal";
import { db } from "@/db/client";
import { getCaseDetailForStaff } from "@/server/staff-queue";
import { getPrimaryPlanningCallRecord, isBlueprintReady } from "@/server/planning-call";
import {
  getCurrentBlueprintRevision,
  listBlueprintRevisions,
  listBlueprintBaseModelOptions,
  listBlueprintOverlayOptions,
  listBlueprintSupportOptions,
  listBlueprintOpportunityOptions,
} from "@/server/blueprint";
import { BlueprintForm } from "@/components/staff/BlueprintForm";
import { BlueprintPreview } from "@/components/staff/BlueprintPreview";
import { formatStaffDateTime, statusLabel } from "@/components/staff/format";
import styles from "@/components/staff/staff-page.module.css";
import {
  createOrOpenBlueprintAction,
  saveBlueprintDraftAction,
  moveBlueprintToInternalReviewAction,
  markBlueprintReadyForClientAction,
  createNewBlueprintRevisionAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Student Success Blueprint",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: "You are not authorized to perform this action.",
  CASE_NOT_FOUND: "That case no longer exists.",
  NOT_ELIGIBLE: "This case is not yet eligible for a Student Success Blueprint.",
  REVISION_NOT_FOUND: "That Blueprint revision no longer exists.",
  NOT_EDITABLE: "This revision is no longer editable.",
  VERSION_CONFLICT: "Someone else saved more recent changes. Reload the page to see them before saving again.",
  INVALID_CONTENT: "The submitted content did not pass validation.",
  INVALID_TRANSITION: "This revision's current status does not allow that action.",
  INCOMPLETE: "This Blueprint is not yet complete enough to mark ready for client.",
  BLUEPRINT_NOT_FOUND: "No Blueprint exists yet for this case.",
  CURRENT_NOT_READY: "The current revision must be Ready for Client before starting a new revision.",
  REASON_REQUIRED: "Choose a reason for the new revision.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  DRAFT_SAVED: "Draft saved.",
  MOVED_TO_REVIEW: "Moved to internal review.",
  READY_FOR_CLIENT: "Marked ready for client.",
  NEW_REVISION_CREATED: "New revision created.",
};

/**
 * Phase 6E -- the advisor's Student Success Blueprint authoring
 * workspace. Only reachable once the case's primary Planning Call is
 * eligible (`isBlueprintReady`), re-checked fresh on every load, never
 * cached. Mirrors Phase 6D's workspace conventions exactly: plain
 * `<form>` server actions, redirect-based status communication, ADMIN
 * read-only (read-only everywhere in this phase -- see
 * app/admin/cases/[caseId]/blueprint/page.tsx).
 */
export default async function AdvisorBlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ error?: string; success?: string; issues?: string }>;
}) {
  const principal = await requireStaffPrincipal(["ADVISOR", "ADMIN"]);
  const { caseId } = await params;
  const resolvedSearchParams = await searchParams;

  const detailResult = await getCaseDetailForStaff(db, principal.userId, caseId);
  if (!detailResult.ok) notFound();
  const { detail } = detailResult;

  const planningCallRecord = await getPrimaryPlanningCallRecord(db, caseId);
  const eligible = isBlueprintReady(planningCallRecord);
  const current = await getCurrentBlueprintRevision(db, caseId);
  const revisions = current ? await listBlueprintRevisions(db, caseId) : [];

  const errorMessage = resolvedSearchParams.error ? ERROR_MESSAGES[resolvedSearchParams.error] : undefined;
  const successMessage = resolvedSearchParams.success ? SUCCESS_MESSAGES[resolvedSearchParams.success] : undefined;

  const baseModelOptions = listBlueprintBaseModelOptions();
  const overlayOptions = listBlueprintOverlayOptions();
  const supportOptions = listBlueprintSupportOptions();
  const opportunityOptions = listBlueprintOpportunityOptions();

  const canAuthor = principal.role === "ADVISOR";
  const canEditCurrent = canAuthor && current !== null && (current.status === "DRAFT" || current.status === "INTERNAL_REVIEW");
  const canStartNewRevision = canAuthor && current !== null && current.status === "READY_FOR_CLIENT";

  return (
    <div className={styles.page}>
      <Link href={`/advisor/cases/${caseId}`} className={styles.backLink}>
        ← Back to case
      </Link>
      <h1 className={styles.heading}>{detail.studentDisplayName}</h1>
      <p className={styles.subheading}>Student Success Blueprint.</p>

      {errorMessage ? (
        <div role="alert" className={styles.formStatus} data-tone="error">
          <p>{errorMessage}</p>
          {resolvedSearchParams.issues ? (
            <ul>
              {resolvedSearchParams.issues.split("; ").map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {successMessage ? (
        <p role="status" className={styles.formStatus} data-tone="success">
          {successMessage}
        </p>
      ) : null}

      {!eligible && !current ? (
        <p className={styles.emptyState} role="status">
          This case is not yet eligible for a Student Success Blueprint. A Blueprint can only be started from a
          completed Planning Call with attendance &quot;Attended&quot; and outcome &quot;Continue to Blueprint.&quot;
        </p>
      ) : null}

      {eligible && !current && canAuthor ? (
        <form action={createOrOpenBlueprintAction}>
          <input type="hidden" name="pathwaysCaseId" value={caseId} />
          <button type="submit" className={styles.assignButton}>
            Start Student Success Blueprint
          </button>
        </form>
      ) : null}

      {revisions.length > 1 ? (
        <section className={styles.section} aria-labelledby="revision-history-heading">
          <h2 id="revision-history-heading" className={styles.sectionTitle}>
            Revision History
          </h2>
          <ul className={styles.revisionList}>
            {revisions.map((r) => (
              <li key={r.id}>
                Revision {r.revisionNumber} --{" "}
                <span className={styles.badge} data-status={r.status}>
                  {statusLabel(r.status)}
                </span>{" "}
                -- last updated {formatStaffDateTime(r.updatedAt)}
                {r.revisionReason ? ` -- reason: ${statusLabel(r.revisionReason)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {current ? (
        canEditCurrent ? (
          <BlueprintForm
            pathwaysCaseId={caseId}
            revisionId={current.id}
            content={current.content}
            expectedVersion={current.version}
            baseModelOptions={baseModelOptions}
            overlayOptions={overlayOptions}
            supportOptions={supportOptions}
            opportunityOptions={opportunityOptions}
            saveDraftAction={saveBlueprintDraftAction}
            moveToReviewAction={moveBlueprintToInternalReviewAction}
            markReadyAction={markBlueprintReadyForClientAction}
          />
        ) : (
          <>
            <BlueprintPreview
              revision={current}
              baseModelOptions={baseModelOptions}
              overlayOptions={overlayOptions}
              supportOptions={supportOptions}
              opportunityOptions={opportunityOptions}
            />
            {canStartNewRevision ? (
              <section className={styles.section} aria-labelledby="new-revision-heading">
                <h2 id="new-revision-heading" className={styles.sectionTitle}>
                  Start a New Revision
                </h2>
                <form action={createNewBlueprintRevisionAction} className={styles.assignForm}>
                  <input type="hidden" name="pathwaysCaseId" value={caseId} />
                  <div className={styles.filterField}>
                    <label htmlFor="revisionReason">Reason</label>
                    <select id="revisionReason" name="revisionReason" defaultValue="">
                      <option value="" disabled>
                        Choose a reason
                      </option>
                      <option value="FAMILY_UPDATE">Family update</option>
                      <option value="NEW_VERIFICATION">New verification</option>
                      <option value="EDUCATIONAL_PLAN_CHANGE">Educational plan change</option>
                      <option value="CORRECTION">Correction</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className={styles.filterField}>
                    <label htmlFor="revisionReasonOther">Details (if &quot;Other&quot;)</label>
                    <input type="text" id="revisionReasonOther" name="revisionReasonOther" className={styles.itemTextInput} />
                  </div>
                  <button type="submit" className={styles.assignButton}>
                    Create New Revision
                  </button>
                </form>
              </section>
            ) : null}
          </>
        )
      ) : !eligible ? null : !canAuthor ? (
        <p className={styles.emptyState} role="status">
          No Blueprint has been started for this case yet.
        </p>
      ) : null}
    </div>
  );
}
