import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPrincipal } from "@/server/staff-principal";
import { db } from "@/db/client";
import { getCaseDetailForStaff } from "@/server/staff-queue";
import { CaseDetailView } from "@/components/staff/CaseDetailView";
import styles from "@/components/staff/staff-page.module.css";

export const metadata: Metadata = {
  title: "Case Detail",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Phase 6C advisor limited case detail (sections 10-12). Read-only --
 * no assignment control, no advisor notes. getCaseDetailForStaff
 * re-checks assertAdvisorCanAccessPathwaysCase fresh on every request
 * (role AND active assignment to THIS exact case): an advisor who
 * knows another case's UUID, or who was just reassigned away from
 * this one, receives the same honest 404 a nonexistent case would.
 */
export default async function AdvisorCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const principal = await requireStaffPrincipal(["ADVISOR", "ADMIN"]);
  const { caseId } = await params;

  const detailResult = await getCaseDetailForStaff(db, principal.userId, caseId);
  if (!detailResult.ok) notFound();
  const { detail } = detailResult;

  return (
    <div className={styles.page}>
      <Link href="/advisor/cases" className={styles.backLink}>
        ← Back to my cases
      </Link>
      <h1 className={styles.heading}>{detail.studentDisplayName}</h1>
      <p className={styles.subheading}>Case detail for your upcoming planning call.</p>

      <CaseDetailView detail={detail} />
    </div>
  );
}
