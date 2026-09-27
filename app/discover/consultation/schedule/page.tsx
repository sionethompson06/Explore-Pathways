import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ButtonLink } from "@/components/marketing/Button";
import { PLANNING_CALL_DURATION_MINUTES } from "@/lib/consultation/constants";
import styles from "./schedule.module.css";

export const metadata: Metadata = {
  title: "Choose Your Planning Call Time",
  description: "Choose a time for your free Pathways planning call.",
  robots: { index: false, follow: false },
};

/**
 * Phase 6A scheduling-intent page (docs/pathways instruction section
 * 29) -- purely presentational; the actual Google Calendar Appointment
 * Schedule handoff happens server-side at
 * /discover/consultation/schedule/go, never here. Requires the same
 * authorized session plus an active ConsultationRequest -- a parent
 * who never submitted contact info is redirected back to the contact
 * form instead of seeing a scheduling page for a request that does
 * not exist.
 */
export default async function DiscoveryConsultationSchedulePage() {
  const [{ GUEST_SESSION_COOKIE_NAME }, { loadDraftByToken }, { db }, { getActiveConsultationRequestForSession }] =
    await Promise.all([
      import("@/server/session"),
      import("@/server/discovery-draft"),
      import("@/db/client"),
      import("@/server/consultation"),
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

  const activeRequest = await getActiveConsultationRequestForSession(db, draft.sessionId);
  if (!activeRequest) {
    redirect("/discover/consultation");
  }

  return (
    <Section tone="default" ariaLabelledBy="schedule-heading" narrow>
      <p className={styles.savedNotice}>Your information is saved.</p>
      <h1 id="schedule-heading" className={styles.headline}>
        Choose a Time for Your Pathways Planning Call
      </h1>
      <Card className={styles.detailsCard}>
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
      <ButtonLink href="/discover/consultation/schedule/go" variant="primary">
        Choose My Time
      </ButtonLink>
    </Section>
  );
}
