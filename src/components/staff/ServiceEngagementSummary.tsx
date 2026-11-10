import type { ServiceEngagementDTO, ServiceEngagementStatus } from "@/server/service-engagement";
import { formatCentsAsDollars } from "@/server/service-engagement";
import { formatStaffDateTime, statusLabel } from "./format";
import styles from "./staff-page.module.css";

/** Section 23's example wording ("Status: Active Consultancy") -- a friendlier phrase than the bare enum word, used only for display. */
const ENGAGEMENT_STATUS_LABELS: Record<ServiceEngagementStatus, string> = {
  PENDING_DECISION: "Pending Decision",
  TERMS_PENDING: "Terms Pending",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active Consultancy",
  DECLINED: "Declined",
  CLOSED: "Closed",
};

function paymentSummaryLine(engagement: ServiceEngagementDTO): string | null {
  const amount = (cents: number | null) => `$${formatCentsAsDollars(cents)}`;
  switch (engagement.paymentStructure) {
    case "ONE_TIME":
      return `One-time payment of ${amount(engagement.agreedTotalAmountCents)}`;
    case "MONTHLY":
      return `${amount(engagement.paymentAmountCents)} monthly`;
    case "INSTALLMENTS":
      return `${engagement.installmentCount ?? "?"} installments of ${amount(engagement.paymentAmountCents)}`;
    case "CUSTOM":
      return engagement.termsNote ? `Custom -- ${engagement.termsNote}` : "Custom terms";
    case "WAIVED":
      return "Waived -- no payment due";
    case "PENDING":
      return "Pending -- terms not yet finalized";
    default:
      return null;
  }
}

/**
 * Phase 6F (section 23) -- a concise summary, shown once a family
 * decision has been recorded and the engagement is no longer open for
 * editing (ACTIVE, DECLINED, or CLOSED), or on the admin read-only
 * route for any recorded decision. Avoids unnecessary detail on the
 * main case screen -- only the facts section 23's example calls for.
 */
export function ServiceEngagementSummary({ engagement }: { engagement: ServiceEngagementDTO }) {
  const paymentSummary = paymentSummaryLine(engagement);

  return (
    <div className={styles.engagementSummary} data-testid="engagement-summary">
      <h3 className={styles.sectionTitle}>Engagement</h3>
      <dl>
        <dt>Status</dt>
        <dd>
          <span className={styles.badge} data-status={engagement.status}>
            {ENGAGEMENT_STATUS_LABELS[engagement.status]}
          </span>
        </dd>

        <dt>Family decision</dt>
        <dd>{statusLabel(engagement.familyDecision)}</dd>

        {engagement.serviceArrangement ? (
          <>
            <dt>Service</dt>
            <dd>
              {statusLabel(engagement.serviceArrangement)}
              {engagement.serviceArrangementDescription ? ` -- ${engagement.serviceArrangementDescription}` : ""}
            </dd>
          </>
        ) : null}

        {paymentSummary ? (
          <>
            <dt>Payment</dt>
            <dd>{paymentSummary}</dd>
          </>
        ) : null}

        {engagement.followUpDate || engagement.followUpNote ? (
          <>
            <dt>Follow-up</dt>
            <dd>
              {engagement.followUpDate ? formatStaffDateTime(engagement.followUpDate) : null}
              {engagement.followUpNote ? ` -- ${engagement.followUpNote}` : ""}
            </dd>
          </>
        ) : null}

        {engagement.notProceedingReason ? (
          <>
            <dt>Reason</dt>
            <dd>{engagement.notProceedingReason}</dd>
          </>
        ) : null}

        {engagement.confirmedAt ? (
          <>
            <dt>Confirmed</dt>
            <dd>{formatStaffDateTime(engagement.confirmedAt)}</dd>
          </>
        ) : null}

        {engagement.confirmedByEmail ? (
          <>
            <dt>Confirmed by</dt>
            <dd>{engagement.confirmedByEmail}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
