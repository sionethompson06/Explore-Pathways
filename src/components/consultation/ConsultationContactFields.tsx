import { PLANNING_CONTACT_CONSENT_COPY } from "@/lib/consultation/constants";
import type { ConsultationContactActionState } from "@/lib/consultation/action-state";
import styles from "./ConsultationContactForm.module.css";

/**
 * The presentational fields shared by the real, DB-backed contact
 * form (ConsultationContactForm, wired to the server action) and the
 * DB-free `/discover/consultation/demo` preview (wired to local
 * client state only) -- section 47's "reuse presentational
 * components ... do not duplicate business logic." Neither validation
 * rules nor persistence live here; this only renders the four
 * required fields plus the consent checkbox against whatever
 * values/errors it is handed.
 */
export function ConsultationContactFields({
  values,
  errors,
}: {
  values: ConsultationContactActionState["values"];
  errors: ConsultationContactActionState["errors"];
}) {
  return (
    <>
      {errors.form ? (
        <p role="alert" className={styles.formError}>
          {errors.form}
        </p>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="guardianName">Parent/Guardian Name</label>
        <input
          id="guardianName"
          name="guardianName"
          type="text"
          autoComplete="name"
          defaultValue={values.guardianName}
          required
          aria-invalid={errors.guardianName ? true : undefined}
          aria-describedby={errors.guardianName ? "guardianName-error" : undefined}
        />
        {errors.guardianName ? (
          <p id="guardianName-error" role="alert" className={styles.fieldError}>
            {errors.guardianName}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={values.email}
          required
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email ? (
          <p id="email-error" role="alert" className={styles.fieldError}>
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="mobilePhone">Mobile Phone</label>
        <input
          id="mobilePhone"
          name="mobilePhone"
          type="tel"
          autoComplete="tel"
          defaultValue={values.mobilePhone}
          required
          aria-invalid={errors.mobilePhone ? true : undefined}
          aria-describedby={errors.mobilePhone ? "mobilePhone-error" : undefined}
        />
        {errors.mobilePhone ? (
          <p id="mobilePhone-error" role="alert" className={styles.fieldError}>
            {errors.mobilePhone}
          </p>
        ) : null}
      </div>

      <fieldset className={styles.field}>
        <legend>Preferred Call Format</legend>
        <div className={styles.radioGroup}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="preferredCallFormat"
              value="VIDEO"
              defaultChecked={values.preferredCallFormat !== "PHONE"}
            />
            Video (preferred)
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="preferredCallFormat"
              value="PHONE"
              defaultChecked={values.preferredCallFormat === "PHONE"}
            />
            Phone
          </label>
        </div>
      </fieldset>

      <div className={styles.consent}>
        <label className={styles.consentLabel}>
          <input
            type="checkbox"
            name="consentAcknowledged"
            value="true"
            required
            aria-describedby={errors.consentAcknowledged ? "consent-error" : undefined}
          />
          <span>{PLANNING_CONTACT_CONSENT_COPY}</span>
        </label>
        {errors.consentAcknowledged ? (
          <p id="consent-error" role="alert" className={styles.fieldError}>
            {errors.consentAcknowledged}
          </p>
        ) : null}
      </div>
    </>
  );
}
