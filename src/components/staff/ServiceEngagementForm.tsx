import type { ServiceEngagementDTO } from "@/server/service-engagement";
import { formatCentsAsDollars } from "@/server/service-engagement";
import styles from "./staff-page.module.css";

/**
 * Phase 6F -- the "Continue With Pathways" section (sections 14, 22,
 * 32). One plain `<form>` (no client JavaScript); progressive
 * disclosure of the consulting-arrangement/payment-arrangement fields
 * is done entirely via CSS `:has()` in staff-page.module.css, matching
 * every other staff workspace form's "no client JS" convention. Only
 * rendered while the engagement is still editable -- once ACTIVE,
 * DECLINED, or CLOSED, the page renders ServiceEngagementSummary
 * instead (see app/advisor/.../blueprint/page.tsx).
 */
export function ServiceEngagementForm({
  pathwaysCaseId,
  engagement,
  action,
}: {
  pathwaysCaseId: string;
  engagement: ServiceEngagementDTO | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const decision = engagement?.familyDecision;

  return (
    <form action={action} className={styles.engagementForm}>
      <input type="hidden" name="pathwaysCaseId" value={pathwaysCaseId} />
      <input type="hidden" name="expectedVersion" value={engagement?.version ?? 0} />

      <fieldset className={styles.radioGroup}>
        <legend>Family Decision</legend>
        <label className={styles.radioOption}>
          <input
            type="radio"
            id="familyDecision-continue"
            name="familyDecision"
            value="CONTINUE_WITH_PATHWAYS"
            defaultChecked={decision === "CONTINUE_WITH_PATHWAYS"}
            required
          />
          Continue with Pathways
        </label>
        <label className={styles.radioOption}>
          <input
            type="radio"
            id="familyDecision-blueprint-only"
            name="familyDecision"
            value="BLUEPRINT_ONLY"
            defaultChecked={decision === "BLUEPRINT_ONLY"}
          />
          Blueprint only
        </label>
        <label className={styles.radioOption}>
          <input
            type="radio"
            id="familyDecision-followup"
            name="familyDecision"
            value="FOLLOW_UP_NEEDED"
            defaultChecked={decision === "FOLLOW_UP_NEEDED"}
          />
          Follow-up needed
        </label>
        <label className={styles.radioOption}>
          <input
            type="radio"
            id="familyDecision-not-proceeding"
            name="familyDecision"
            value="NOT_PROCEEDING"
            defaultChecked={decision === "NOT_PROCEEDING"}
          />
          Not proceeding
        </label>
      </fieldset>

      <div className={`${styles.conditionalSection} ${styles.showForContinue}`}>
        <h3 className={styles.sectionTitle}>Consulting Arrangement</h3>
        <fieldset className={styles.radioGroup}>
          <legend>Consulting arrangement</legend>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="serviceArrangement-ongoing"
              name="serviceArrangement"
              value="ONGOING_PATHWAYS_CONSULTING"
              defaultChecked={engagement?.serviceArrangement === "ONGOING_PATHWAYS_CONSULTING"}
            />
            Ongoing Pathways Consulting
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="serviceArrangement-custom"
              name="serviceArrangement"
              value="CUSTOM_ENGAGEMENT"
              defaultChecked={engagement?.serviceArrangement === "CUSTOM_ENGAGEMENT"}
            />
            Custom Engagement
          </label>
        </fieldset>
        <div className={`${styles.conditionalSection} ${styles.showForCustomArrangement}`}>
          <label htmlFor="serviceArrangementDescription">Arrangement description (optional)</label>
          <textarea
            id="serviceArrangementDescription"
            name="serviceArrangementDescription"
            rows={2}
            className={styles.textarea}
            defaultValue={engagement?.serviceArrangementDescription ?? ""}
          />
        </div>

        <h3 className={styles.sectionTitle}>Payment Arrangement</h3>
        <fieldset className={styles.radioGroup}>
          <legend>Payment structure</legend>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="paymentStructure-one-time"
              name="paymentStructure"
              value="ONE_TIME"
              defaultChecked={engagement?.paymentStructure === "ONE_TIME"}
            />
            One-time
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="paymentStructure-monthly"
              name="paymentStructure"
              value="MONTHLY"
              defaultChecked={engagement?.paymentStructure === "MONTHLY"}
            />
            Monthly
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="paymentStructure-installments"
              name="paymentStructure"
              value="INSTALLMENTS"
              defaultChecked={engagement?.paymentStructure === "INSTALLMENTS"}
            />
            Installments
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="paymentStructure-custom"
              name="paymentStructure"
              value="CUSTOM"
              defaultChecked={engagement?.paymentStructure === "CUSTOM"}
            />
            Custom
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="paymentStructure-waived"
              name="paymentStructure"
              value="WAIVED"
              defaultChecked={engagement?.paymentStructure === "WAIVED"}
            />
            Waived
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              id="paymentStructure-pending"
              name="paymentStructure"
              value="PENDING"
              defaultChecked={engagement?.paymentStructure === "PENDING"}
            />
            Pending
          </label>
        </fieldset>

        <div className={`${styles.conditionalSection} ${styles.showForOneTime}`}>
          <div className={styles.moneyFieldGroup}>
            <div className={styles.moneyField}>
              <label htmlFor="oneTimeAmount">Total agreed amount (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                id="oneTimeAmount"
                name="oneTimeAmount"
                placeholder="1500.00"
                defaultValue={
                  engagement?.paymentStructure === "ONE_TIME" ? formatCentsAsDollars(engagement.agreedTotalAmountCents) : ""
                }
              />
            </div>
          </div>
        </div>

        <div className={`${styles.conditionalSection} ${styles.showForMonthly}`}>
          <div className={styles.moneyFieldGroup}>
            <div className={styles.moneyField}>
              <label htmlFor="monthlyAmount">Monthly payment amount (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                id="monthlyAmount"
                name="monthlyAmount"
                placeholder="300.00"
                defaultValue={
                  engagement?.paymentStructure === "MONTHLY" ? formatCentsAsDollars(engagement.paymentAmountCents) : ""
                }
              />
            </div>
          </div>
        </div>

        <div className={`${styles.conditionalSection} ${styles.showForInstallments}`}>
          <div className={styles.moneyFieldGroup}>
            <div className={styles.moneyField}>
              <label htmlFor="installmentAmount">Installment amount (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                id="installmentAmount"
                name="installmentAmount"
                placeholder="500.00"
                defaultValue={
                  engagement?.paymentStructure === "INSTALLMENTS" ? formatCentsAsDollars(engagement.paymentAmountCents) : ""
                }
              />
            </div>
            <div className={styles.moneyField}>
              <label htmlFor="installmentCount">Number of installments</label>
              <input
                type="number"
                min={1}
                step={1}
                id="installmentCount"
                name="installmentCount"
                defaultValue={engagement?.paymentStructure === "INSTALLMENTS" ? engagement.installmentCount ?? "" : ""}
              />
            </div>
          </div>
        </div>

        <div className={`${styles.conditionalSection} ${styles.showForCustomPayment}`}>
          <p className={styles.provenanceNote}>Describe the agreed custom terms in the note below.</p>
        </div>

        <label htmlFor="termsNote">Terms note (optional)</label>
        <textarea
          id="termsNote"
          name="termsNote"
          rows={2}
          className={styles.textarea}
          placeholder="Any agreed terms worth recording."
          defaultValue={engagement?.termsNote ?? ""}
        />

        <label htmlFor="paymentMethodNote">Payment method note (optional)</label>
        <input
          type="text"
          id="paymentMethodNote"
          name="paymentMethodNote"
          className={styles.itemTextInput}
          placeholder="e.g. check, ACH, family's preferred method"
          defaultValue={engagement?.paymentMethodNote ?? ""}
        />

        <label htmlFor="firstPaymentDate">First payment date (optional)</label>
        <input
          type="date"
          id="firstPaymentDate"
          name="firstPaymentDate"
          defaultValue={engagement?.firstPaymentDate ? engagement.firstPaymentDate.slice(0, 10) : ""}
        />

        <label className={styles.checkboxOption}>
          <input type="checkbox" name="paymentHandledExternally" defaultChecked={engagement?.paymentHandledExternally ?? false} />
          Payment already handled externally
        </label>
      </div>

      <div className={`${styles.conditionalSection} ${styles.showForFollowUp}`}>
        <h3 className={styles.sectionTitle}>Follow-Up</h3>
        <label htmlFor="followUpNote">Follow-up note (optional)</label>
        <textarea
          id="followUpNote"
          name="followUpNote"
          rows={2}
          className={styles.textarea}
          defaultValue={engagement?.followUpNote ?? ""}
        />
        <label htmlFor="followUpDate">Follow-up date (optional)</label>
        <input type="date" id="followUpDate" name="followUpDate" defaultValue={engagement?.followUpDate ? engagement.followUpDate.slice(0, 10) : ""} />
      </div>

      <div className={`${styles.conditionalSection} ${styles.showForNotProceeding}`}>
        <h3 className={styles.sectionTitle}>Not Proceeding</h3>
        <label htmlFor="notProceedingReason">Reason (optional)</label>
        <textarea
          id="notProceedingReason"
          name="notProceedingReason"
          rows={2}
          className={styles.textarea}
          defaultValue={engagement?.notProceedingReason ?? ""}
        />
      </div>

      <div className={styles.saveControls}>
        <button type="submit" className={styles.assignButton}>
          Confirm Engagement
        </button>
      </div>
    </form>
  );
}
