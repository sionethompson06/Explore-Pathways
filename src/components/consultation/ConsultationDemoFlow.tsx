"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Card } from "@/components/marketing/Card";
import { ConsultationContactFields } from "./ConsultationContactFields";
import { BookingCalendarView } from "./BookingCalendarView";
import { parseConsultationContactForm } from "@/lib/consultation/validation";
import { DEFAULT_CALL_FORMAT, PLANNING_CALL_DURATION_MINUTES, type CallFormat } from "@/lib/consultation/constants";
import {
  PLANNING_TIME_ZONE,
  PLANNING_TIME_ZONE_LABEL,
  generatePlanningSlotCandidates,
} from "@/lib/consultation/scheduling-policy";
import type { ConsultationContactActionState } from "@/lib/consultation/action-state";
import type { ConfirmBookingActionResult } from "../../../app/discover/consultation/schedule/actions";
import buttonStyles from "@/components/marketing/Button.module.css";
import formStyles from "./ConsultationContactForm.module.css";
import styles from "./ConsultationDemoFlow.module.css";

const INITIAL_VALUES: ConsultationContactActionState["values"] = {
  guardianName: "",
  email: "",
  mobilePhone: "",
  preferredCallFormat: DEFAULT_CALL_FORMAT,
};

function formatFullDateInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));
}

function formatTimeInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

/**
 * `/discover/consultation/demo`'s entire interactive surface (docs/pathways
 * instruction sections 66-68): reuses the exact same presentational
 * fields, validation schema, native `BookingCalendarView`, and shared
 * scheduling-policy constants as the real flow, but is entirely
 * client-side React state -- no `fetch` to a database-backed server
 * action, no cookie/localStorage/sessionStorage, no real booking, no
 * external redirect. Synthetic available slots are generated with the
 * same pure `generatePlanningSlotCandidates` the real server uses,
 * evaluated against the actual current time on every mount/render, so
 * the demo can never present a stale or expired slot list. "Confirm
 * Planning Call" never reaches a server action -- it only records the
 * chosen slot in local state and advances to a fake confirmation step.
 */
export function ConsultationDemoFlow() {
  const [step, setStep] = useState<"form" | "schedule" | "confirmed">("form");
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<ConsultationContactActionState["errors"]>({});
  const [preferredCallFormat, setPreferredCallFormat] = useState<CallFormat>(DEFAULT_CALL_FORMAT);
  const [confirmed, setConfirmed] = useState<{ startIso: string; bookerTimeZone: string | null } | null>(null);

  // Both derived from the exact same "now" reference so the calendar's
  // eligible-date window and its slot list are always consistent with
  // each other -- recomputed fresh on every mount, so the demo can never
  // present a stale or expired window (sections 21, 66-68).
  const demoWindowStartIso = useMemo(() => new Date().toISOString(), []);
  const syntheticSlotsIso = useMemo(
    () => generatePlanningSlotCandidates(new Date(demoWindowStartIso)).map((d) => d.toISOString()),
    [demoWindowStartIso],
  );

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
    setPreferredCallFormat(parsed.data.preferredCallFormat);
    setStep("schedule");
  }

  async function handleDemoConfirm(
    selectedStartIso: string,
    bookerTimeZone: string | null,
  ): Promise<ConfirmBookingActionResult> {
    setConfirmed({ startIso: selectedStartIso, bookerTimeZone });
    return { ok: true };
  }

  async function handleDemoRefresh(): Promise<{ slotsIso: string[]; windowStartIso: string }> {
    return { slotsIso: syntheticSlotsIso, windowStartIso: demoWindowStartIso };
  }

  function handleDemoConfirmed() {
    setStep("confirmed");
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
      ) : null}

      {step === "schedule" ? (
        <>
          <p className={styles.savedNotice}>Your information is saved.</p>
          <h1 className={styles.headline}>Choose a Time for Your Pathways Planning Call</h1>
          <p className={styles.demoNote}>This is a demo preview -- no real appointment is booked.</p>
          <Card className={styles.contextCard}>
            <ul className={styles.detailsList}>
              <li>Free</li>
              <li>{PLANNING_CALL_DURATION_MINUTES} minutes</li>
              <li>Video preferred</li>
              <li>Phone available</li>
            </ul>
          </Card>
          <p className={styles.body}>Select a day and time that works for your family.</p>
          <BookingCalendarView
            initialSlotsIso={syntheticSlotsIso}
            windowStartIso={demoWindowStartIso}
            preferredCallFormat={preferredCallFormat}
            onConfirm={handleDemoConfirm}
            onRefresh={handleDemoRefresh}
            onConfirmed={handleDemoConfirmed}
          />
        </>
      ) : null}

      {step === "confirmed" && confirmed ? (
        <>
          <h1 className={styles.headline}>Your Pathways Planning Call Is Reserved</h1>
          <p className={styles.demoNote}>This is a demo preview -- no real appointment is booked.</p>
          <Card className={styles.contextCard}>
            <p className={styles.body}>Your Student</p>
            <p className={styles.body}>{formatFullDateInZone(confirmed.startIso, PLANNING_TIME_ZONE)}</p>
            {confirmed.bookerTimeZone && confirmed.bookerTimeZone !== PLANNING_TIME_ZONE ? (
              <p className={styles.body}>{formatTimeInZone(confirmed.startIso, confirmed.bookerTimeZone)} your time</p>
            ) : null}
            <p className={styles.body}>
              {formatTimeInZone(confirmed.startIso, PLANNING_TIME_ZONE)} {PLANNING_TIME_ZONE_LABEL}
            </p>
            <p className={styles.body}>
              {PLANNING_CALL_DURATION_MINUTES} minutes · {preferredCallFormat === "VIDEO" ? "Video" : "Phone"}
            </p>
          </Card>
          <p className={styles.body}>Your Pathways advisor will review your Discovery before the call.</p>
          {preferredCallFormat === "VIDEO" ? (
            <p className={styles.body}>Connection details will be provided before your appointment.</p>
          ) : (
            <p className={styles.body}>Pathways will use the phone number you provided for this planning request.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
