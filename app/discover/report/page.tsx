import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { GUEST_SESSION_COOKIE_NAME } from "@/server/session";
import { loadDraftByToken, hasCompletedRevision } from "@/server/discovery-draft";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { Badge } from "@/components/marketing/Badge";
import { ButtonLink } from "@/components/marketing/Button";
import buttonStyles from "@/components/marketing/Button.module.css";
import { reopenForEditingAction } from "../profile/actions";

export const metadata: Metadata = {
  title: "Discovery Complete",
  description: "Your Discovery profile completion status.",
  robots: { index: false, follow: false },
};

/**
 * Phase 3's honest completion boundary (instruction §38): confirms
 * the profile was completed and that this session owns it -- nothing
 * more. No recommendation, ranking, score, or provider is generated
 * or implied here; that is Phase 4's report assembler, not built yet.
 * Private/no-store by construction: this page reads cookies(), so
 * Next.js never statically caches or serves it from a shared cache.
 */
export default async function DiscoveryReportPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/discover");
  }

  const draft = await loadDraftByToken(db, token);
  if (!draft) {
    redirect("/discover");
  }

  const completed = await hasCompletedRevision(db, draft.sessionId);

  if (!completed) {
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

  return (
    <Section tone="default" ariaLabelledBy="report-complete-heading" narrow>
      <h1 id="report-complete-heading">Your Discovery Profile Is Complete</h1>
      <Card>
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Badge>Development preview</Badge>
        </div>
        <p>
          Your answers have been organized into your Discovery profile. The pathway
          recommendation and report experience is the next build stage -- it is not enabled in
          this development version yet.
        </p>
        <p style={{ marginBottom: 0 }}>
          Nothing here ranks schools, scores your student, or names a provider. When the report
          experience is ready, it will build directly on the profile you just completed.
        </p>
      </Card>

      <div style={{ marginTop: "var(--space-5)" }}>
        <form action={reopenForEditingAction}>
          <button type="submit" className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
            Review or Edit Your Answers
          </button>
        </form>
      </div>
    </Section>
  );
}
