import "server-only";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  pathwaysCase,
  studentPathwayRecord,
  profileRevision,
  reportSnapshot,
  consultationRequest,
  consultationContact,
  booking,
  advisorAssignment,
  staffRole,
  user,
  type pathwaysCaseStatusEnum,
  type consultationStatusEnum,
} from "@/db/schema";
import { getStaffRole, assertAdvisorCanAccessPathwaysCase, AuthorizationError, CASE_ACCESS_ROLES } from "./access-control";
import type { DiscoveryReportDTO } from "@/lib/report/types";

/**
 * Phase 6C -- the staff-facing queue and limited-case-detail read
 * layer (docs/pathways PHASE6C_ADVISOR_ASSIGNMENT_QUEUE.md). Every
 * DTO here is deliberately narrow: no internal recommendation score,
 * no raw Discovery answers, no full ReportSnapshot body in the list
 * views, no marketing/priority scoring of any kind. The ONE place the
 * full (already family-safe) ReportSnapshot.publicContent appears is
 * the single-case detail view, which is exactly what the family
 * themselves already saw -- never a second, richer internal copy.
 */

export type PathwaysCaseStatus = (typeof pathwaysCaseStatusEnum.enumValues)[number];
type ConsultationStatus = (typeof consultationStatusEnum.enumValues)[number];

const STUDENT_DISPLAY_FALLBACK = "Student";

export interface StaffCaseRow {
  pathwaysCaseId: string;
  studentDisplayName: string;
  gradeBand: string | null;
  caseStatus: PathwaysCaseStatus;
  consultationStatus: ConsultationStatus;
  bookingScheduledAt: string | null;
  preferredCallFormat: "VIDEO" | "PHONE" | null;
  currentAdvisor: { userId: string; name: string } | null;
  enteredWorkflowAt: string;
}

/** The single shared join, scoped by nothing -- callers (admin queue, advisor queue) apply their own authorization and row filtering on top. Never exported for direct use outside this module. */
async function listAllCaseRows(db: Database): Promise<(StaffCaseRow & { advisorUserId: string | null })[]> {
  const rows = await db
    .select({
      pathwaysCaseId: pathwaysCase.id,
      displayName: studentPathwayRecord.displayName,
      gradeBand: profileRevision.gradeBand,
      caseStatus: pathwaysCase.status,
      consultationStatus: consultationRequest.status,
      bookingScheduledAt: booking.scheduledAt,
      bookingCancelledAt: booking.cancelledAt,
      preferredCallFormat: consultationContact.preferredCallFormat,
      advisorUserId: advisorAssignment.advisorUserId,
      advisorName: user.name,
      advisorEmail: user.email,
      enteredWorkflowAt: pathwaysCase.createdAt,
    })
    .from(pathwaysCase)
    .innerJoin(studentPathwayRecord, eq(pathwaysCase.studentPathwayRecordId, studentPathwayRecord.id))
    .innerJoin(profileRevision, eq(pathwaysCase.profileRevisionId, profileRevision.id))
    .innerJoin(consultationRequest, eq(pathwaysCase.consultationRequestId, consultationRequest.id))
    .leftJoin(consultationContact, eq(consultationContact.consultationRequestId, consultationRequest.id))
    .leftJoin(booking, eq(pathwaysCase.bookingId, booking.id))
    .leftJoin(
      advisorAssignment,
      and(eq(advisorAssignment.pathwaysCaseId, pathwaysCase.id), isNull(advisorAssignment.unassignedAt)),
    )
    .leftJoin(user, eq(advisorAssignment.advisorUserId, user.id))
    .orderBy(desc(pathwaysCase.createdAt));

  return rows.map((row) => ({
    pathwaysCaseId: row.pathwaysCaseId,
    studentDisplayName: row.displayName ?? STUDENT_DISPLAY_FALLBACK,
    gradeBand: row.gradeBand,
    caseStatus: row.caseStatus,
    consultationStatus: row.consultationStatus,
    bookingScheduledAt:
      row.bookingScheduledAt && !row.bookingCancelledAt ? row.bookingScheduledAt.toISOString() : null,
    preferredCallFormat: row.preferredCallFormat,
    currentAdvisor: row.advisorUserId
      ? { userId: row.advisorUserId, name: row.advisorName || row.advisorEmail || "Advisor" }
      : null,
    enteredWorkflowAt: row.enteredWorkflowAt.toISOString(),
    advisorUserId: row.advisorUserId,
  }));
}

export interface AdminCaseQueueFilters {
  assignment?: "ASSIGNED" | "UNASSIGNED";
  caseStatus?: PathwaysCaseStatus;
  advisorUserId?: string;
  booked?: boolean;
}

/** Pure, exported for direct unit testing of the filter logic without a database. */
export function applyAdminQueueFilters(
  rows: readonly (StaffCaseRow & { advisorUserId: string | null })[],
  filters: AdminCaseQueueFilters,
): (StaffCaseRow & { advisorUserId: string | null })[] {
  return rows.filter((row) => {
    if (filters.assignment === "ASSIGNED" && !row.advisorUserId) return false;
    if (filters.assignment === "UNASSIGNED" && row.advisorUserId) return false;
    if (filters.caseStatus && row.caseStatus !== filters.caseStatus) return false;
    if (filters.advisorUserId && row.advisorUserId !== filters.advisorUserId) return false;
    if (filters.booked === true && !row.bookingScheduledAt) return false;
    if (filters.booked === false && row.bookingScheduledAt) return false;
    return true;
  });
}

export type ListOperationalCasesResult =
  | { ok: true; cases: StaffCaseRow[] }
  | { ok: false; reason: "NOT_ADMIN" };

/**
 * Section 5/12: ADMIN role is the full authorization boundary for this
 * queue -- deliberately NOT also requiring a per-case assignment (that
 * stricter rule governs ADVISOR access everywhere else, unchanged).
 * An admin's job is to see and operate on cases nobody has assigned
 * yet, which is structurally impossible under the assignment-required
 * rule. See docs/pathways/PHASE6C_ADVISOR_ASSIGNMENT_QUEUE.md for the
 * full reasoning behind this deliberate, narrow widening.
 */
export async function listOperationalCasesForAdmin(
  db: Database,
  adminUserId: string,
  filters: AdminCaseQueueFilters = {},
): Promise<ListOperationalCasesResult> {
  const role = await getStaffRole(db, adminUserId);
  if (role !== "ADMIN") return { ok: false, reason: "NOT_ADMIN" };

  const rows = await listAllCaseRows(db);
  const filtered = applyAdminQueueFilters(rows, filters);
  return { ok: true, cases: filtered.map(({ advisorUserId: _advisorUserId, ...rest }) => rest) };
}

export type ListAdvisorQueueResult =
  | { ok: true; cases: StaffCaseRow[] }
  | { ok: false; reason: "NOT_AUTHORIZED" };

/** Priority order (section 20): upcoming booked first (soonest first), then follow-up/needs-information, then everything else. */
function advisorQueueSortKey(row: StaffCaseRow): number {
  if (row.bookingScheduledAt) return 0;
  if (row.caseStatus === "FOLLOW_UP" || row.caseStatus === "NEEDS_INFORMATION") return 1;
  return 2;
}

/** Exported for direct unit testing of the ordering rule without a database. */
export function sortAdvisorQueue(rows: readonly StaffCaseRow[]): StaffCaseRow[] {
  return [...rows].sort((a, b) => {
    const keyDiff = advisorQueueSortKey(a) - advisorQueueSortKey(b);
    if (keyDiff !== 0) return keyDiff;
    if (a.bookingScheduledAt && b.bookingScheduledAt) {
      return a.bookingScheduledAt.localeCompare(b.bookingScheduledAt);
    }
    return b.enteredWorkflowAt.localeCompare(a.enteredWorkflowAt);
  });
}

/**
 * Section 10/12: ONLY cases this advisor currently holds an active
 * assignment for -- builds on the exact same
 * `advisorAssignment.pathwaysCaseId` join already used by
 * listActivePathwaysCasesForAdvisor (access-control.ts); an advisor
 * sees nothing by simply holding a staff role.
 */
export async function listAssignedCasesForAdvisor(
  db: Database,
  advisorUserId: string,
): Promise<ListAdvisorQueueResult> {
  const role = await getStaffRole(db, advisorUserId);
  if (!role || !CASE_ACCESS_ROLES.includes(role)) return { ok: false, reason: "NOT_AUTHORIZED" };

  const rows = await listAllCaseRows(db);
  const assigned = rows.filter((row) => row.advisorUserId === advisorUserId);
  return { ok: true, cases: sortAdvisorQueue(assigned.map(({ advisorUserId: _a, ...rest }) => rest)) };
}

export interface StaffCaseDetail extends StaffCaseRow {
  /** The exact ReportSnapshot the family saw -- already the public, family-safe DTO (report-contract.json's forbidden_in_public allowlist), never a richer internal copy. */
  report: DiscoveryReportDTO;
}

export type GetCaseDetailResult =
  | { ok: true; detail: StaffCaseDetail }
  | { ok: false; reason: "NOT_AUTHORIZED" | "NOT_FOUND" };

/**
 * Section 11: the small, read-only case detail. ADMIN is authorized
 * for any case (role-only, same rule as the admin queue above);
 * ADVISOR requires the existing, unchanged
 * assertAdvisorCanAccessPathwaysCase (role AND active assignment to
 * THIS exact case) -- an advisor who knows another case's UUID still
 * receives denial, and a reassigned-away advisor loses access
 * immediately since that function re-checks the assignment fresh on
 * every call, never from a cached/session-held claim.
 */
export async function getCaseDetailForStaff(
  db: Database,
  staffUserId: string,
  pathwaysCaseId: string,
): Promise<GetCaseDetailResult> {
  const role = await getStaffRole(db, staffUserId);
  if (!role || !CASE_ACCESS_ROLES.includes(role)) return { ok: false, reason: "NOT_AUTHORIZED" };

  if (role !== "ADMIN") {
    try {
      await assertAdvisorCanAccessPathwaysCase(db, staffUserId, pathwaysCaseId);
    } catch (err) {
      if (err instanceof AuthorizationError) return { ok: false, reason: "NOT_AUTHORIZED" };
      throw err;
    }
  }

  const rows = await listAllCaseRows(db);
  const row = rows.find((r) => r.pathwaysCaseId === pathwaysCaseId);
  if (!row) return { ok: false, reason: "NOT_FOUND" };

  const [caseRow] = await db
    .select({ reportSnapshotId: pathwaysCase.reportSnapshotId })
    .from(pathwaysCase)
    .where(eq(pathwaysCase.id, pathwaysCaseId))
    .limit(1);
  const [snapshot] = caseRow
    ? await db
        .select({ publicContent: reportSnapshot.publicContent })
        .from(reportSnapshot)
        .where(eq(reportSnapshot.id, caseRow.reportSnapshotId))
        .limit(1)
    : [];
  if (!snapshot) return { ok: false, reason: "NOT_FOUND" };

  const { advisorUserId: _advisorUserId, ...safeRow } = row;
  return {
    ok: true,
    detail: { ...safeRow, report: snapshot.publicContent as DiscoveryReportDTO },
  };
}

export interface ActiveStaffMember {
  userId: string;
  name: string;
  email: string;
  role: "ADVISOR" | "ADMIN";
}

/** For the admin assignment control's advisor picker -- every currently-active, authorized staff member eligible to be assigned. Role-gated the same way as the queue above (ADMIN only). Includes `email` since Better Auth's magic-link sign-in leaves `name` blank until a staff member sets one -- the picker must stay able to distinguish two otherwise-nameless advisors. */
export async function listActiveStaffForAssignment(
  db: Database,
  adminUserId: string,
): Promise<{ ok: true; staff: ActiveStaffMember[] } | { ok: false; reason: "NOT_ADMIN" }> {
  const role = await getStaffRole(db, adminUserId);
  if (role !== "ADMIN") return { ok: false, reason: "NOT_ADMIN" };

  const rows = await db
    .select({ userId: staffRole.userId, role: staffRole.role, name: user.name, email: user.email })
    .from(staffRole)
    .innerJoin(user, eq(staffRole.userId, user.id))
    .where(isNull(staffRole.revokedAt));

  return { ok: true, staff: rows };
}
