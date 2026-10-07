import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ButtonLink } from "@/components/marketing/Button";
import { PLANNING_CALL_DURATION_MINUTES } from "@/lib/consultation/constants";
import { BookingCalendarView } from "@/components/consultation/BookingCalendarView";
import styles from "./schedule.module.css";

export const metadata: Metadata = {
  title: "Choose Your Planning Call Time",
  description: "Choose a time for your free Pathways planning call.",
  robots: { index: false, follow: false },
};

/**
 * Phase 6A.2 scheduling page (docs/pathways instruction sections
 * 21-23). Requires the same authorized session plus an active
 * ConsultationRequest as Phase 6A -- a parent who never submitted
 * contact info is redirected back to the contact form. Branches purely
 * on `getConsultationCapability().provider`:
 *
 * - INTERNAL: renders the real, database-backed native Pathways
 *   booking calendar (this file's new behavior).
 * - GOOGLE_EXTERNAL / NONE: unchanged from Phase 6A -- the
 *   presentational "Choose My Time" button that hands off to the
 *   server-controlled /discover/consultation/schedule/go route (which
 *   itself already handles the honest UNCONFIGURED refusal).
 *
 * If this request is already BOOKED, redirects straight to the
 * confirmation page instead of offering another time (section 37).
 */
export default async function DiscoveryConsultationSchedulePage() {
  const [
    { GUEST_SESSION_COOKIE_NAME },
    { loadDraftByToken },
    { db },
    { getActiveConsultationRequestForSession },
    { getConsultationCapability },
    { getAvailableSlotsForSession },
  ] = await Promise.all([
    import("@/server/session"),
    import("@/server/discovery-draft"),
    import("@/db/client"),
    import("@/server/consultation"),
    import("@/server/consultation-capability"),
    import("@/server/booking"),
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

  if (activeRequest.status === "BOOKED") {
    redirect("/discover/consultation/confirmed");
  }

  const capability = getConsultationCapability();

  if (capability.provider === "INTERNAL") {
    const availability = await getAvailableSlotsForSession(db, draft.sessionId);
    if (availability.ok && availability.alreadyBooked) {
      redirect("/discover/consultation/confirmed");
    }
    const initialSlots = availability.ok && !availability.alreadyBooked ? availability.slots : [];
    const windowStartIso =
      availability.ok && !availability.alreadyBooked ? availability.windowStartIso : new Date().toISOString();

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
        <p className={styles.body}>Select a day and time that works for your family.</p>
        <BookingCalendarView
          initialSlotsIso={initialSlots.map((s) => s.toISOString())}
          windowStartIso={windowStartIso}
          preferredCallFormat={activeRequest.preferredCallFormat ?? "VIDEO"}
        />
      </Section>
    );
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
