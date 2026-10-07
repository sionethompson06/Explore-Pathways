import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ConsultationContactForm } from "@/components/consultation/ConsultationContactForm";
import { PLANNING_CALL_DURATION_MINUTES } from "@/lib/consultation/constants";
import styles from "./consultation.module.css";

export const metadata: Metadata = {
  title: "Schedule Your Planning Call",
  description: "Tell us how to reach you for your free Pathways planning call.",
  robots: { index: false, follow: false },
};

/**
 * Phase 6A production contact-capture route (docs/pathways instruction
 * sections 17-21). A premium visual continuation of the report
 * experience, not a generic CRM form -- no full report reproduction,
 * just a compact context card plus the four required fields. Requires
 * a valid guest session with a completed Discovery profile; never
 * accepts a student/revision/report id from the browser as
 * authorization (session-cookie derived only).
 */
export default async function DiscoveryConsultationPage() {
  const [{ GUEST_SESSION_COOKIE_NAME }, { loadDraftByToken }, { db }, { resolveReportOutcomeForConsultation }] =
    await Promise.all([
      import("@/server/session"),
      import("@/server/discovery-draft"),
      import("@/db/client"),
      import("@/server/report-outcome"),
    ]);

  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/discover");
  }

  const draft = await loadDraftByToken(db, token);
  if (!draft) {
    redirect("/discover");
  }

  // Phase 6A.1: reuses the exact ReportSnapshot the parent already saw
  // (the latest one persisted for their completed revision) instead of
  // recomputing a possibly-different one on every visit; only falls
  // back to the ensure/persist pipeline when no snapshot exists yet at
  // all (e.g. arriving here without ever visiting the report page).
  const outcome = await resolveReportOutcomeForConsultation(db, draft.sessionId);
  if (!outcome) {
    redirect("/discover/profile");
  }

  const studentLabel = outcome.report.studentLabel;

  return (
    <Section tone="default" ariaLabelledBy="consultation-heading" narrow>
      <p className={styles.eyebrow}>YOUR NEXT STEP</p>
      <h1 id="consultation-heading" className={styles.headline}>
        Let&apos;s Build the Next Step Together
      </h1>
      <p className={styles.body}>
        Tell us how to reach you, and you&apos;ll be able to choose a time for a free{" "}
        {PLANNING_CALL_DURATION_MINUTES}-minute planning call with Pathways.
      </p>

      <Card className={styles.contextCard}>
        <dl className={styles.contextList}>
          <div>
            <dt>Student</dt>
            <dd>{studentLabel}</dd>
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

      <ConsultationContactForm />

      <p className={styles.backLink}>
        <Link href="/discover/report">Back to My Discovery Report</Link>
      </p>
    </Section>
  );
}
