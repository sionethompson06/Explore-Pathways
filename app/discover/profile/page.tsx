import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  buildReviewSections,
  computeProgress,
  describeQuestionsForStage,
  getOptionLabelForQuestion,
  gradeBandFromGrade,
} from "@/lib/discovery";
import type { RawAnswerValue, StageId } from "@/lib/discovery/types";
import { DiscoveryQuestionnaire } from "@/components/discovery/DiscoveryQuestionnaire";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/marketing/Card";
import { ButtonLink } from "@/components/marketing/Button";
import { saveAnswerAction, submitProfileAction } from "./actions";

export const metadata: Metadata = {
  title: "Your Discovery Profile",
  description: "Answer a few questions to build your student's Discovery profile.",
  robots: { index: false, follow: false },
};

/**
 * Reads the guest-session cookie and loads the server-owned draft --
 * never a client-supplied session id (Phase 3 instruction §40). This
 * page is dynamic-only (it reads cookies()), so Next.js never
 * statically caches it; nothing here is servable from a public/shared
 * cache.
 *
 * The database/session modules are imported dynamically, inside this
 * function, rather than at module scope -- see app/discover/actions.ts's
 * doc comment for why a static top-level import would make this crash
 * outright (bypassing app/discover/error.tsx) whenever the database
 * is misconfigured or unreachable, rather than failing inside this
 * function's own execution where it is actually caught.
 */
export default async function DiscoveryProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const [{ GUEST_SESSION_COOKIE_NAME }, { loadDraftByToken }, { db }] = await Promise.all([
    import("@/server/session"),
    import("@/server/discovery-draft"),
    import("@/db/client"),
  ]);

  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/discover");
  }

  const draft = await loadDraftByToken(db, token);
  if (!draft) {
    return <ExpiredSessionNotice />;
  }

  const { rawAnswers, interestHint } = draft;
  const progress = computeProgress(rawAnswers);
  const validStageIds = new Set<string>([
    ...progress.stages.filter((s) => s.total > 0).map((s) => s.id),
    "REVIEW",
  ]);

  const resolvedParams = await searchParams;
  const requestedStage = resolvedParams.stage;
  const stageId: StageId =
    requestedStage && validStageIds.has(requestedStage)
      ? (requestedStage as StageId)
      : progress.currentStageId;

  // Once landed on a stage, the URL is the sole source of truth for
  // "which stage is being viewed" -- never recomputed fresh from
  // current answer-completeness on every refresh. Without this, a
  // save that completes the current stage's last required question
  // would silently re-point `progress.currentStageId` at the NEXT
  // stage before the user ever clicks Continue, making Continue jump
  // one stage further than intended. A missing or invalid `?stage=`
  // is corrected exactly once, here, into an explicit URL.
  if (!requestedStage || requestedStage !== stageId) {
    redirect(`/discover/profile?stage=${stageId}`);
  }

  const isReview = stageId === "REVIEW";
  const questions = isReview ? [] : describeQuestionsForStage(stageId, rawAnswers);
  const reviewSections = isReview ? buildReviewSections(rawAnswers) : [];

  const gradeBand = gradeBandFromGrade(
    typeof rawAnswers.current_grade === "string" ? rawAnswers.current_grade : undefined,
  );
  const interestHintLabel = interestHint
    ? getOptionLabelForQuestion("discovery_reasons", interestHint, gradeBand)
    : null;

  // The suggested pre-check only applies while DISC_006 has no real
  // answer yet -- once saved, the real answer always wins.
  const answersForClient: Record<string, RawAnswerValue> = { ...rawAnswers };
  if (interestHint && answersForClient.discovery_reasons === undefined) {
    answersForClient.discovery_reasons = [interestHint];
  }

  return (
    <Section tone="default" ariaLabelledBy="discovery-profile-heading" narrow>
      <h1 id="discovery-profile-heading" className="visually-hidden">
        Your Discovery Profile
      </h1>
      <DiscoveryQuestionnaire
        stageId={stageId}
        stages={progress.stages.filter((s) => s.total > 0)}
        questions={questions}
        answers={answersForClient}
        interestHint={interestHint}
        interestHintLabel={interestHintLabel}
        isReadyForReview={progress.isReadyForReview}
        isStaleQuestionBankVersion={draft.isStaleQuestionBankVersion}
        reviewSections={reviewSections}
        saveAnswerAction={saveAnswerAction}
        submitProfileAction={submitProfileAction}
      />
    </Section>
  );
}

function ExpiredSessionNotice() {
  return (
    <Section tone="default" ariaLabelledBy="discovery-expired-heading" narrow>
      <h1 id="discovery-expired-heading">Your previous Discovery session is no longer available</h1>
      <Card>
        <p>
          For your privacy, Discovery sessions expire automatically. Nothing was lost that you
          hadn&apos;t already completed -- you can simply start a new Discovery whenever you&apos;re
          ready.
        </p>
        <div style={{ marginTop: "var(--space-4)" }}>
          <ButtonLink href="/discover" variant="primary">
            Start a New Discovery
          </ButtonLink>
        </div>
      </Card>
    </Section>
  );
}
