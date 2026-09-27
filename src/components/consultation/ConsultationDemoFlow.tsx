"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/marketing/Card";
import { ConsultationContactFields } from "./ConsultationContactFields";
import { parseConsultationContactForm } from "@/lib/consultation/validation";
import { DEFAULT_CALL_FORMAT, PLANNING_CALL_DURATION_MINUTES } from "@/lib/consultation/constants";
import type { ConsultationContactActionState } from "@/lib/consultation/action-state";
import buttonStyles from "@/components/marketing/Button.module.css";
import formStyles from "./ConsultationContactForm.module.css";
import styles from "./ConsultationDemoFlow.module.css";

const INITIAL_VALUES: ConsultationContactActionState["values"] = {
  guardianName: "",
  email: "",
  mobilePhone: "",
  preferredCallFormat: DEFAULT_CALL_FORMAT,
};

/**
 * `/discover/consultation/demo`'s entire interactive surface (section
 * 46-47): reuses the exact same presentational fields, validation
 * schema, and 45-minute constant as the real flow, but is entirely
 * client-side React state -- no `fetch`, no server action, no
 * cookie/localStorage/sessionStorage, no database. Validation failure
 * and success are both simulated locally; "Choose My Time" never
 * navigates anywhere (never a real Google scheduler), it only reveals
 * an inline demo notice.
 */
export function ConsultationDemoFlow() {
  const [step, setStep] = useState<"form" | "schedule">("form");
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<ConsultationContactActionState["errors"]>({});
  const [showDemoNotice, setShowDemoNotice] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextValues: ConsultationContactActionState["values"] = {
      guardianName: String(formData.get("guardianName") ?? ""),
      email: String(formData.get("email") ?? ""),
      mobilePhone: String(formData.get("mobilePhone") ?? ""),
      preferredCallFormat: String(formData.get("preferredCallFormat") ?? DEFAULT_CALL_FORMAT),
    };
    setValues(nextValues);

    const parsed = parseConsultationContactForm(formData);
    if (!parsed.ok) {
      const nextErrors: ConsultationContactActionState["errors"] = {};
      for (const e of parsed.errors) nextErrors[e.field] = e.message;
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setStep("schedule");
  }

  return (
    <div>
      <p className={styles.demoBadge} role="status">
        DEMO PREVIEW
      </p>

      {step === "form" ? (
        <>
          <h1 className={styles.headline}>Let&apos;s Build the Next Step Together</h1>
          <p className={styles.body}>
            Tell us how to reach you, and you&apos;ll be able to choose a time for a free{" "}
            {PLANNING_CALL_DURATION_MINUTES}-minute planning call with Pathways.
          </p>
          <p className={styles.demoNote}>
            This is a demo preview -- your answers and contact information are not saved.
          </p>

          <Card className={styles.contextCard}>
            <dl className={styles.contextList}>
              <div>
                <dt>Student</dt>
                <dd>Your Student</dd>
              </div>
              <div>
                <dt>Call</dt>
                <dd>Free Pathways Planning Call</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{PLANNING_CALL_DURATION_MINUTES} minutes</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>Video (preferred)</dd>
              </div>
            </dl>
          </Card>

          <form onSubmit={handleSubmit} className={formStyles.form} noValidate>
            <ConsultationContactFields values={values} errors={errors} />
            <button
              type="submit"
              className={`${buttonStyles.button} ${buttonStyles.primary} ${formStyles.submit}`}
            >
              Continue to Scheduling
            </button>
          </form>
        </>
      ) : (
        <>
          <p className={styles.savedNotice}>Your information is saved.</p>
          <h1 className={styles.headline}>Choose a Time for Your Pathways Planning Call</h1>
          <p className={styles.demoNote}>
            This is a demo preview -- no real appointment is booked.
          </p>
          <Card className={styles.contextCard}>
            <ul className={styles.detailsList}>
              <li>Free</li>
              <li>{PLANNING_CALL_DURATION_MINUTES} minutes</li>
              <li>Video preferred</li>
              <li>Phone available</li>
            </ul>
          </Card>
          <p className={styles.body}>
            Google Calendar will handle selecting and confirming your appointment time.
          </p>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary}`}
            onClick={() => setShowDemoNotice(true)}
          >
            Choose My Time
          </button>
          {showDemoNotice ? (
            <p role="status" className={styles.demoNote}>
              This is a demo preview -- no real appointment is booked, and this button does not
              open Google Calendar.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
