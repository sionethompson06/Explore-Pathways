import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { PLANNING_CALL_DURATION_MINUTES, PLANNING_TIME_ZONE, PLANNING_TIME_ZONE_LABEL } from "@/lib/consultation/scheduling-policy";
import styles from "./confirmed.module.css";

export const metadata: Metadata = {
  title: "Planning Call Reserved",
  description: "Your Pathways planning call is reserved.",
  robots: { index: false, follow: false },
};

function formatFull(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

/**
 * Phase 6A.2 confirmation route (docs/pathways instruction sections
 * 32-35). Requires the same authorized guest session plus an active
 * BOOKED consultation with an active Booking -- otherwise redirects
 * safely (never fabricates a confirmation). No IDs in the URL; no
 * client-supplied booking id is ever accepted.
 */
export default async function DiscoveryConsultationConfirmedPage() {
  const [
    { GUEST_SESSION_COOKIE_NAME },
    { loadDraftByToken },
    { db },
    { getActiveConsultationRequestForSession },
    { getActiveBookingForSession },
    { resolveReportOutcomeForConsultation },
  ] = await Promise.all([
    import("@/server/session"),
    import("@/server/discovery-draft"),
    import("@/db/client"),
    import("@/server/consultation"),
    import("@/server/booking"),
    import("@/server/report-outcome"),
  ]);

  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/discover");

  const draft = await loadDraftByToken(db, token);
  if (!draft) redirect("/discover");

  const activeRequest = await getActiveConsultationRequestForSession(db, draft.sessionId);
  if (!activeRequest || activeRequest.status !== "BOOKED") {
    redirect("/discover/consultation/schedule");
  }

  const activeBooking = await getActiveBookingForSession(db, draft.sessionId);
  if (!activeBooking) {
    redirect("/discover/consultation/schedule");
  }

  const outcome = await resolveReportOutcomeForConsultation(db, draft.sessionId);
  const studentLabel = outcome?.report.studentLabel ?? "Your Student";
  const startIso = activeBooking.scheduledAt.toISOString();
  const preferredCallFormat = activeRequest.preferredCallFormat ?? "VIDEO";

  return (
    <Section tone="default" ariaLabelledBy="confirmed-heading" narrow>
      <h1 id="confirmed-heading" className={styles.headline}>
        Your Pathways Planning Call Is Reserved
      </h1>
      <Card className={styles.card}>
        <p className={styles.studentLine}>{studentLabel}</p>
        <p className={styles.date}>{formatFull(startIso, PLANNING_TIME_ZONE)}</p>
        {activeBooking.bookerTimeZone && activeBooking.bookerTimeZone !== PLANNING_TIME_ZONE ? (
          <p className={styles.time}>
            {formatTime(startIso, activeBooking.bookerTimeZone)} your time
          </p>
        ) : null}
        <p className={styles.timeSecondary}>
          {formatTime(startIso, PLANNING_TIME_ZONE)} {PLANNING_TIME_ZONE_LABEL}
        </p>
        <p className={styles.meta}>
          {PLANNING_CALL_DURATION_MINUTES} minutes · {preferredCallFormat === "VIDEO" ? "Video" : "Phone"}
        </p>
      </Card>

      <p className={styles.body}>Your Pathways advisor will review your Discovery before the call.</p>
      {preferredCallFormat === "VIDEO" ? (
        <p className={styles.body}>Connection details will be provided before your appointment.</p>
      ) : (
        <p className={styles.body}>Pathways will use the phone number you provided for this planning request.</p>
      )}
    </Section>
  );
}
