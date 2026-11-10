import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ButtonLink } from "@/components/marketing/Button";
import buttonStyles from "@/components/marketing/Button.module.css";
import { ReportView } from "@/components/report/ReportView";
import { reopenForEditingAction } from "../profile/actions";

export const metadata: Metadata = {
  title: "Your Discovery Report",
  description: "Your personalized Discovery Report.",
  robots: { index: false, follow: false },
};

/**
 * Phase 5's production report route (PHASE5_DISCOVERY_REPORT_SPEC_V1.md
 * section 36): authorized/guest session -> load the completed profile
 * revision -> recompute effective answers -> run the Phase 4 engine ->
 * assemble the Phase 5 ReportDTO -> render it. Private/no-store by
 * construction (reads cookies()). A completed Discovery user sees the
 * report immediately -- no email wall, no account creation, no payment
 * (section 38).
 *
 * The database/session/contracts/engine/report modules are imported
 * dynamically, inside this function, for the same reason
 * app/discover/actions.ts documents: a static top-level import would
 * make this crash outright (bypassing app/discover/error.tsx) whenever
 * the database is misconfigured or unreachable.
 */
export default async function DiscoveryReportPage() {
  const [{ GUEST_SESSION_COOKIE_NAME }, { loadDraftByToken }, { db }, { ensureReportOutcomeForSession }] =
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

  // Phase 6A (sections 7-10): recomputes the Phase 4 evaluation and
  // Phase 5 DTO exactly as before, and now also idempotently persists
  // the outcome as an immutable EngineRun + ReportSnapshot so a later
  // consultation request can link to the exact revision/report that
  // converted it. Allowed to throw (caught by app/discover/error.tsx)
  // on a genuine database failure -- this route already requires a
  // working database for the reads above, so there is no honest
  // degraded state to fall back to here.
  const outcome = await ensureReportOutcomeForSession(db, draft.sessionId);

  if (!outcome) {
    return (
      <Section tone="default" ariaLabelledBy="report-incomplete-heading" narrow>
        <h1 id="report-incomplete-heading">Your Discovery Profile Isn&apos;t Finished Yet</h1>
        <Card>
          <p>
            We don&apos;t have a completed Discovery profile for this session yet. Head back to
            Discovery to finish your answers.
          </p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <ButtonLink href="/discover/profile" variant="primary">
              Continue My Discovery
            </ButtonLink>
          </div>
        </Card>
      </Section>
    );
  }

  const { report } = outcome;

  const editAnswersOverride = (
    <form action={reopenForEditingAction}>
      <button type="submit" className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
        {report.actions.editAnswers.label}
      </button>
    </form>
  );

  return <ReportView report={report} editAnswersOverride={editAnswersOverride} />;
}
