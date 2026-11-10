import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPrincipal } from "@/server/staff-principal";
import { db } from "@/db/client";
import { listAssignedCasesForAdvisor } from "@/server/staff-queue";
import { formatStaffDateTime, statusLabel } from "@/components/staff/format";
import styles from "@/components/staff/staff-page.module.css";

export const metadata: Metadata = {
  title: "My Cases",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Phase 6C advisor queue (sections 10, 20). ONLY cases this advisor
 * currently holds an active assignment for -- never another advisor's
 * case, never an unassigned case. Ordered: upcoming booked
 * consultations first (soonest first), then follow-up/needs-
 * information, then everything else -- see
 * src/server/staff-queue.ts's sortAdvisorQueue.
 */
export default async function AdvisorCasesPage() {
  const principal = await requireStaffPrincipal(["ADVISOR", "ADMIN"]);
  const result = await listAssignedCasesForAdvisor(db, principal.userId);
  const cases = result.ok ? result.cases : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>My Cases</h1>
      <p className={styles.subheading}>
        {cases.length === 0
          ? "No cases are currently assigned to you."
          : `${cases.length} case${cases.length === 1 ? "" : "s"} assigned to you, upcoming calls first.`}
      </p>

      {cases.length === 0 ? (
        <p className={styles.emptyState} role="status">
          Nothing assigned yet. Check back after an administrator assigns you a case.
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>Cases assigned to you</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Grade</th>
                <th scope="col">Case status</th>
                <th scope="col">Booking</th>
                <th scope="col">Format</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.pathwaysCaseId}>
                  <td>{c.studentDisplayName}</td>
                  <td>{c.gradeBand ?? "—"}</td>
                  <td>
                    <span className={styles.badge} data-status={c.caseStatus}>
                      {statusLabel(c.caseStatus)}
                    </span>
                  </td>
                  <td>{formatStaffDateTime(c.bookingScheduledAt)}</td>
                  <td>{c.preferredCallFormat ?? "—"}</td>
                  <td>
                    <Link href={`/advisor/cases/${c.pathwaysCaseId}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
