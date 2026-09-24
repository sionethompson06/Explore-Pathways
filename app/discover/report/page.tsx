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
  const [
    { GUEST_SESSION_COOKIE_NAME },
    { loadDraftByToken, loadLatestCompletedRevision },
    { db },
    { validateCompletedProfile },
    { loadContracts },
    { evaluateDiscoveryProfile },
    { assembleDiscoveryReport },
    { buildReportProfileContext },
  ] = await Promise.all([
    import("@/server/session"),
    import("@/server/discovery-draft"),
    import("@/db/client"),
    import("@/lib/discovery/validation"),
    import("@/lib/contracts/loader"),
    import("@/lib/engine/evaluate"),
    import("@/lib/report/assemble"),
    import("@/lib/report/profile-context"),
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

  const revision = await loadLatestCompletedRevision(db, draft.sessionId);

  if (!revision) {
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

  const validation = validateCompletedProfile(revision.rawAnswers);
  if (!validation.ok || !validation.effective) {
    // A stored completed revision should always still validate under the
    // current contracts; if it somehow doesn't (contract/version drift),
    // fail loudly rather than fabricate a generic recommendation (section 67).
    throw new Error("Stored completed Discovery profile no longer validates against the current contracts.");
  }

  const contracts = loadContracts();
  const evaluation = evaluateDiscoveryProfile(validation.effective, contracts);

  const profile = buildReportProfileContext({
    rawAnswers: revision.rawAnswers as Record<string, unknown>,
    profileRevisionId: revision.revisionId,
    gradeBand: evaluation.derivedFacts.grade_band,
  });
  const report = assembleDiscoveryReport(
    {
      profile,
      engine: evaluation,
      // No live/verified consultation service is configured in this build --
      // never claim LIVE_VERIFIED or REQUEST_ONLY without one actually existing.
      operational: { consultationState: "UNCONFIGURED", saveAvailable: false },
    },
    contracts,
    revision.createdAt.toISOString(),
  );

  const editAnswersOverride = (
    <form action={reopenForEditingAction}>
      <button type="submit" className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
        {report.actions.editAnswers.label}
      </button>
    </form>
  );

  return <ReportView report={report} editAnswersOverride={editAnswersOverride} />;
}
