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
import { formatStaffDateTime, statusLabel } from "@/components/staff/format";
import styles from "@/components/staff/staff-page.module.css";

export const metadata: Metadata = {
  title: "Student Success Blueprint",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Phase 6E -- the admin's read-only Student Success Blueprint view.
 * No write path anywhere on this route; ADMIN retains operational
 * visibility only (same convention as PlanningCallSummary for the
 * Planning Call, section 17 of PHASE6D_PLANNING_CALL_WORKSPACE.md,
 * carried forward unchanged for the Blueprint).
 */
export default async function AdminBlueprintPage({ params }: { params: Promise<{ caseId: string }> }) {
  const principal = await requireStaffPrincipal(["ADMIN"]);
  const { caseId } = await params;

  const detailResult = await getCaseDetailForStaff(db, principal.userId, caseId);
  if (!detailResult.ok) notFound();
  const { detail } = detailResult;

  const current = await getCurrentBlueprintRevision(db, caseId);
  const revisions = current ? await listBlueprintRevisions(db, caseId) : [];

  return (
    <div className={styles.page}>
      <Link href={`/admin/cases/${caseId}`} className={styles.backLink}>
        ← Back to case
      </Link>
      <h1 className={styles.heading}>{detail.studentDisplayName}</h1>
      <p className={styles.subheading}>Student Success Blueprint (read-only).</p>

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
        </>
      )}
    </div>
  );
}
