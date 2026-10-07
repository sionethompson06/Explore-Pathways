"use client";

import { useActionState } from "react";
import { submitConsultationContactAction } from "../../../app/discover/consultation/actions";
import { initialConsultationContactActionState } from "@/lib/consultation/action-state";
import { ConsultationContactFields } from "./ConsultationContactFields";
import buttonStyles from "@/components/marketing/Button.module.css";
import styles from "./ConsultationContactForm.module.css";

/**
 * The Phase 6A pre-auth contact form (section 20). Required fields
 * only: Parent/Guardian Name, Email, Mobile Phone, Preferred Call
 * Format -- never re-asks student name/grade/Discovery answers/goals.
 * `useActionState` keeps this a real, progressively-enhanced
 * `<form action>` (works even before hydration) while still surfacing
 * field-level errors and preserving entered values on a validation
 * failure (section 64).
 */
export function ConsultationContactForm() {
  const [state, formAction, isPending] = useActionState(
    submitConsultationContactAction,
    initialConsultationContactActionState,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      <ConsultationContactFields values={state.values} errors={state.errors} />
      <button
        type="submit"
        className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.submit}`}
        disabled={isPending}
      >
        {isPending ? "Submitting…" : "Continue to Scheduling"}
      </button>
    </form>
  );
}
