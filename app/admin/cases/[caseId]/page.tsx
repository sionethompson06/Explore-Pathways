import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPrincipal } from "@/server/staff-principal";
import { db } from "@/db/client";
import { getCaseDetailForStaff, listActiveStaffForAssignment } from "@/server/staff-queue";
import { CaseDetailView } from "@/components/staff/CaseDetailView";
import styles from "@/components/staff/staff-page.module.css";
import { assignAdvisorAction, unassignAdvisorAction } from "./actions";

export const metadata: Metadata = {
  title: "Case Detail",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: "You are not authorized to perform this action.",
  NO_ADVISOR_SELECTED: "Choose an advisor before assigning.",
  CASE_NOT_FOUND: "That case no longer exists.",
  NOT_ADMIN: "You are not authorized to perform this action.",
  TARGET_NOT_AUTHORIZED_ADVISOR: "That user is not an active, authorized advisor.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  ASSIGNED: "Advisor assigned.",
  REASSIGNED: "Case reassigned.",
  NOOP_ALREADY_ASSIGNED: "This advisor is already assigned to this case.",
  UNASSIGNED: "Case returned to the unassigned queue.",
  ALREADY_UNASSIGNED: "This case had no active advisor.",
};

/** Phase 6C admin limited case detail + assignment control (sections 7-9, 11). */
export default async function AdminCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const principal = await requireStaffPrincipal(["ADMIN"]);
  const { caseId } = await params;
  const resolvedSearchParams = await searchParams;

  const [detailResult, staffResult] = await Promise.all([
    getCaseDetailForStaff(db, principal.userId, caseId),
    listActiveStaffForAssignment(db, principal.userId),
  ]);

  if (!detailResult.ok) notFound();
  const { detail } = detailResult;
  const advisors = staffResult.ok ? staffResult.staff : [];

  const errorMessage = resolvedSearchParams.error ? ERROR_MESSAGES[resolvedSearchParams.error] : undefined;
  const successMessage = resolvedSearchParams.success
    ? SUCCESS_MESSAGES[resolvedSearchParams.success]
    : undefined;

  return (
    <div className={styles.page}>
      <Link href="/admin/cases" className={styles.backLink}>
        ← Back to all cases
      </Link>
      <h1 className={styles.heading}>{detail.studentDisplayName}</h1>
      <p className={styles.subheading}>Limited case detail for assignment and preparation.</p>

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

      <CaseDetailView
        detail={detail}
        assignmentControl={
          <section className={styles.section} aria-labelledby="assignment-heading">
            <h2 id="assignment-heading" className={styles.sectionTitle}>
              Advisor Assignment
            </h2>
            <form action={assignAdvisorAction} className={styles.assignForm}>
              <input type="hidden" name="pathwaysCaseId" value={detail.pathwaysCaseId} />
              <div className={styles.filterField}>
                <label htmlFor="advisorUserId">
                  {detail.currentAdvisor ? "Reassign to" : "Assign to"}
                </label>
                <select id="advisorUserId" name="advisorUserId" required defaultValue="">
                  <option value="" disabled>
                    Choose an advisor…
                  </option>
                  {advisors.map((a) => (
                    <option key={a.userId} value={a.userId}>
                      {a.name || a.email} ({a.role})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className={styles.assignButton}>
                {detail.currentAdvisor ? "Reassign" : "Assign"}
              </button>
            </form>
            {detail.currentAdvisor ? (
              <form action={unassignAdvisorAction}>
                <input type="hidden" name="pathwaysCaseId" value={detail.pathwaysCaseId} />
                <button type="submit" className={styles.unassignButton}>
                  Unassign (return to unassigned queue)
                </button>
              </form>
            ) : null}
          </section>
        }
      />
    </div>
  );
}
