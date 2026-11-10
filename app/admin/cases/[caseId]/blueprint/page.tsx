import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPrincipal } from "@/server/staff-principal";
import { db } from "@/db/client";
import { getCaseDetailForStaff } from "@/server/staff-queue";
import {
  getCurrentBlueprintRevision,
  listBlueprintRevisions,
  listBlueprintBaseModelOptions,
  listBlueprintOverlayOptions,
  listBlueprintSupportOptions,
  listBlueprintOpportunityOptions,
} from "@/server/blueprint";
import { BlueprintPreview } from "@/components/staff/BlueprintPreview";
import { ServiceEngagementForm } from "@/components/staff/ServiceEngagementForm";
import { ServiceEngagementSummary } from "@/components/staff/ServiceEngagementSummary";
import { getServiceEngagement } from "@/server/service-engagement";
import { formatStaffDateTime, statusLabel } from "@/components/staff/format";
import styles from "@/components/staff/staff-page.module.css";
import { confirmServiceEngagementActionAdmin } from "./engagement-actions";

export const metadata: Metadata = {
  title: "Student Success Blueprint",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: "You are not authorized to perform this action.",
  CASE_NOT_FOUND: "That case no longer exists.",
  VERSION_CONFLICT: "Someone else saved more recent changes. Reload the page to see them before saving again.",
  INVALID_CONTENT: "The submitted content did not pass validation.",
  FAMILY_DECISION_REQUIRED: "Choose what the family decided.",
  BLUEPRINT_NOT_READY: "The Blueprint must be Ready for Client before an engagement can be recorded.",
  ARRANGEMENT_REQUIRED: "Choose a consulting arrangement.",
  PAYMENT_STRUCTURE_REQUIRED: "Choose a payment structure.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  ENGAGEMENT_CONFIRMED: "Engagement confirmed.",
};

/**
 * Phase 6E -- the admin's read-only Student Success Blueprint view.
 * No write path for the Blueprint itself; ADMIN retains operational
 * visibility only there (same convention as PlanningCallSummary,
 * section 17 of PHASE6D_PLANNING_CALL_WORKSPACE.md, carried forward
 * unchanged).
 *
 * Phase 6F (section 15) adds this route's first genuine write path:
 * an actively-assigned ADMIN may record/update the Service Engagement
 * once the Blueprint is READY_FOR_CLIENT, via the same
 * recordFamilyDecision domain function (and the same
 * assertAdvisorCanAccessPathwaysCase authorization boundary) the
 * advisor route uses -- never a different or weaker check.
 */
export default async function AdminBlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ error?: string; success?: string; issues?: string }>;
}) {
  const principal = await requireStaffPrincipal(["ADMIN"]);
  const { caseId } = await params;
  const resolvedSearchParams = await searchParams;

  const detailResult = await getCaseDetailForStaff(db, principal.userId, caseId);
  if (!detailResult.ok) notFound();
  const { detail } = detailResult;

  const current = await getCurrentBlueprintRevision(db, caseId);
  const revisions = current ? await listBlueprintRevisions(db, caseId) : [];
  const engagement = current?.status === "READY_FOR_CLIENT" ? await getServiceEngagement(db, caseId) : null;

  const errorMessage = resolvedSearchParams.error ? ERROR_MESSAGES[resolvedSearchParams.error] : undefined;
  const successMessage = resolvedSearchParams.success ? SUCCESS_MESSAGES[resolvedSearchParams.success] : undefined;

  return (
    <div className={styles.page}>
      <Link href={`/admin/cases/${caseId}`} className={styles.backLink}>
        ← Back to case
      </Link>
      <h1 className={styles.heading}>{detail.studentDisplayName}</h1>
      <p className={styles.subheading}>Student Success Blueprint (read-only).</p>

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

      {!current ? (
        <p className={styles.emptyState} role="status">
          No Blueprint has been started for this case yet.
        </p>
      ) : (
        <>
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
          <BlueprintPreview
            revision={current}
            baseModelOptions={listBlueprintBaseModelOptions()}
            overlayOptions={listBlueprintOverlayOptions()}
            supportOptions={listBlueprintSupportOptions()}
            opportunityOptions={listBlueprintOpportunityOptions()}
          />
          {current.status === "READY_FOR_CLIENT" ? (
            <section className={styles.section} aria-labelledby="engagement-heading">
              <h2 id="engagement-heading" className={styles.sectionTitle}>
                Continue With Pathways
              </h2>
              {engagement && (engagement.status === "ACTIVE" || engagement.status === "DECLINED" || engagement.status === "CLOSED") ? (
                <ServiceEngagementSummary engagement={engagement} />
              ) : (
                <ServiceEngagementForm pathwaysCaseId={caseId} engagement={engagement} action={confirmServiceEngagementActionAdmin} />
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
