import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPrincipal } from "@/server/staff-principal";
import { db } from "@/db/client";
import {
  listOperationalCasesForAdmin,
  listActiveStaffForAssignment,
  type PathwaysCaseStatus,
  type AdminCaseQueueFilters,
} from "@/server/staff-queue";
import { formatStaffDateTime, statusLabel } from "@/components/staff/format";
import styles from "@/components/staff/staff-page.module.css";

export const metadata: Metadata = {
  title: "Pathways Cases",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const CASE_STATUSES: readonly PathwaysCaseStatus[] = [
  "NEW",
  "CONTACT_RECEIVED",
  "BOOKED",
  "COMPLETED",
  "NEEDS_INFORMATION",
  "FOLLOW_UP",
  "NOT_CURRENT_SERVICE_FIT",
  "CLOSED",
];

function isPathwaysCaseStatus(value: string | undefined): value is PathwaysCaseStatus {
  return CASE_STATUSES.includes(value as PathwaysCaseStatus);
}

/**
 * Phase 6C admin operational case queue (sections 5-6). ADMIN role is
 * the full authorization boundary here -- see
 * src/server/staff-queue.ts's listOperationalCasesForAdmin doc comment
 * for why that is deliberately NOT also gated on a per-case
 * assignment. Filtering happens server-side, from validated query
 * params only (never an arbitrary client-constructed query).
 */
export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    assignment?: string;
    caseStatus?: string;
    advisor?: string;
    booked?: string;
  }>;
}) {
  const principal = await requireStaffPrincipal(["ADMIN"]);
  const resolved = await searchParams;

  const filters: AdminCaseQueueFilters = {};
  if (resolved.assignment === "ASSIGNED" || resolved.assignment === "UNASSIGNED") {
    filters.assignment = resolved.assignment;
  }
  if (isPathwaysCaseStatus(resolved.caseStatus)) {
    filters.caseStatus = resolved.caseStatus;
  }
  if (resolved.advisor) {
    filters.advisorUserId = resolved.advisor;
  }
  if (resolved.booked === "true") {
    filters.booked = true;
  } else if (resolved.booked === "false") {
    filters.booked = false;
  }

  const [queueResult, staffResult] = await Promise.all([
    listOperationalCasesForAdmin(db, principal.userId, filters),
    listActiveStaffForAssignment(db, principal.userId),
  ]);

  const cases = queueResult.ok ? queueResult.cases : [];
  const advisors = staffResult.ok ? staffResult.staff : [];
  const hasActiveFilter = Boolean(
    resolved.assignment || resolved.caseStatus || resolved.advisor || resolved.booked,
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Pathways Cases</h1>
      <p className={styles.subheading}>
        {cases.length} case{cases.length === 1 ? "" : "s"} in the operational workflow. What requires
        staff attention, and who owns it.
      </p>

      <form className={styles.filters} method="get" aria-label="Filter cases">
        <div className={styles.filterField}>
          <label htmlFor="assignment">Assignment</label>
          <select id="assignment" name="assignment" defaultValue={resolved.assignment ?? ""}>
            <option value="">All</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="caseStatus">Case status</label>
          <select id="caseStatus" name="caseStatus" defaultValue={resolved.caseStatus ?? ""}>
            <option value="">All</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="advisor">Advisor</label>
          <select id="advisor" name="advisor" defaultValue={resolved.advisor ?? ""}>
            <option value="">All</option>
            {advisors.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="booked">Booking</label>
          <select id="booked" name="booked" defaultValue={resolved.booked ?? ""}>
            <option value="">All</option>
            <option value="true">Booked</option>
            <option value="false">Not booked</option>
          </select>
        </div>
        <button type="submit" className={styles.applyButton}>
          Apply filters
        </button>
        {hasActiveFilter ? (
          <Link href="/admin/cases" className={styles.clearLink}>
            Clear filters
          </Link>
        ) : null}
      </form>

      {cases.length === 0 ? (
        <p className={styles.emptyState} role="status">
          No cases match these filters.
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>Pathways operational case queue</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Grade</th>
                <th scope="col">Case status</th>
                <th scope="col">Consultation</th>
                <th scope="col">Booking</th>
                <th scope="col">Format</th>
                <th scope="col">Advisor</th>
                <th scope="col">Entered</th>
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
                  <td>{statusLabel(c.consultationStatus)}</td>
                  <td>{formatStaffDateTime(c.bookingScheduledAt)}</td>
                  <td>{c.preferredCallFormat ?? "—"}</td>
                  <td>
                    {c.currentAdvisor ? (
                      c.currentAdvisor.name
                    ) : (
                      <span className={styles.unassigned}>Unassigned</span>
                    )}
                  </td>
                  <td>{formatStaffDateTime(c.enteredWorkflowAt)}</td>
                  <td>
                    <Link href={`/admin/cases/${c.pathwaysCaseId}`}>View</Link>
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
