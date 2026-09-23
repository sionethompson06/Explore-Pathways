"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { QuestionField } from "./QuestionField";
import { useScrollStageAnchor } from "./useScrollStageAnchor";
import type {
  AnswerValue,
  FieldErrorView,
  QuestionDescriptor,
  ReviewSection,
  StageProgressView,
} from "./types";

type SaveAnswerActionResult = { ok: boolean; errors: FieldErrorView[] };
type SubmitProfileActionResult = { ok: boolean; errors: FieldErrorView[] };
import styles from "./DiscoveryQuestionnaire.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

export function DiscoveryQuestionnaire({
  stageId,
  stages,
  questions,
  answers,
  interestHint,
  interestHintLabel,
  isReadyForReview,
  isStaleQuestionBankVersion,
  reviewSections,
  saveAnswerAction,
  submitProfileAction,
}: {
  stageId: string;
  stages: StageProgressView[];
  questions: QuestionDescriptor[];
  answers: Record<string, AnswerValue>;
  interestHint: string | null;
  interestHintLabel: string | null;
  isReadyForReview: boolean;
  isStaleQuestionBankVersion: boolean;
  reviewSections: ReviewSection[];
  saveAnswerAction: (patch: Record<string, unknown>) => Promise<SaveAnswerActionResult>;
  submitProfileAction: () => Promise<SubmitProfileActionResult>;
}) {
  const router = useRouter();
  // Navigation must never be gated on a prior field's in-flight
  // save/refresh transition -- disabling Continue while `isPending`
  // is true (even briefly) can swallow a fast click on a slow
  // connection, so this component only ever uses startTransition's
  // scheduling, never its pending flag, to control button state.
  const [, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitErrors, setSubmitErrors] = useState<FieldErrorView[]>([]);
  const [localAnswers, setLocalAnswers] = useState(answers);
  const [lastFailedPatch, setLastFailedPatch] = useState<Record<string, unknown> | null>(null);

  const stageOrder = useMemo(() => stages.map((s) => s.id), [stages]);
  const currentIndex = stageOrder.indexOf(stageId);
  const previousStage = currentIndex > 0 ? stageOrder[currentIndex - 1] : undefined;
  const isReview = stageId === "REVIEW";

  // Phase 3D: Continue/Back/Edit all resolve to a new `stageId` prop
  // (via router.push to a new ?stage=), so keying this on `stageId`
  // covers every navigation path with one deterministic effect --
  // never a guessed setTimeout, and never fired before the new
  // stage's own content has actually rendered.
  const stageAnchorRef = useScrollStageAnchor<HTMLDivElement>(stageId);

  async function commit(field: string, value: AnswerValue): Promise<boolean> {
    setLocalAnswers((prev) => ({ ...prev, [field]: value }));
    setSaveState("saving");
    setLastFailedPatch(null);
    const patch = { [field]: value };
    const result = await saveAnswerAction(patch);
    if (result.ok) {
      setSaveState("saved");
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      startTransition(() => router.refresh());
      return true;
    } else {
      setSaveState("error");
      setLastFailedPatch(patch);
      const next: Record<string, string> = {};
      for (const error of result.errors) next[error.field] = error.message;
      setFieldErrors((prev) => ({ ...prev, ...next }));
      return false;
    }
  }

  async function retry() {
    if (!lastFailedPatch) return;
    setSaveState("saving");
    const result = await saveAnswerAction(lastFailedPatch);
    if (result.ok) {
      setSaveState("saved");
      setLastFailedPatch(null);
      startTransition(() => router.refresh());
    } else {
      setSaveState("error");
    }
  }

  function goToStage(next: string) {
    router.push(`/discover/profile?stage=${next}`);
  }

  /**
   * Continue from GOALS is special-cased for discovery_reasons (DISC_006,
   * DEC-G5): a homepage marketing-interest hint is shown as an editable
   * preselection but is never written to the stored draft merely because
   * the page loaded. Pressing Continue while that preselection remains
   * visibly selected is itself the parent's explicit confirmation of the
   * visible selection -- they must not be required to uncheck/recheck an
   * already-correct option just to "confirm" it. Any real interaction with
   * the checkboxes already commits immediately (QuestionField's onCommit),
   * so this only needs to persist whatever is currently visible; resaving
   * an already-committed value is a harmless no-op. If the save fails, stay
   * on GOALS (the existing error/retry state is shown) rather than advance
   * past a required question that was never actually persisted.
   */
  async function handleContinue() {
    if (stageId === "GOALS" && interestHint && localAnswers.discovery_reasons !== undefined) {
      const ok = await commit("discovery_reasons", localAnswers.discovery_reasons);
      if (!ok) return;
    }
    const nextStage = stageOrder[currentIndex + 1] ?? "REVIEW";
    goToStage(nextStage);
  }

  async function handleSubmit() {
    setSubmitErrors([]);
    const result = await submitProfileAction();
    if (!result.ok) {
      setSubmitErrors(result.errors);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div ref={stageAnchorRef} tabIndex={-1} className={styles.stageAnchor}>
        <ProgressBar stages={stages} currentStageId={stageId} />
      </div>

      {isStaleQuestionBankVersion ? (
        <p className={styles.notice}>
          Our Discovery questions were recently updated. Please review each section again before
          finishing -- your existing answers are still here.
        </p>
      ) : null}

      {saveState !== "idle" ? (
        <p className={styles.saveIndicator} role="status">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : "Couldn't save your last answer."}
          {saveState === "error" ? (
            <button type="button" className={styles.retryButton} onClick={retry}>
              Retry
            </button>
          ) : null}
        </p>
      ) : null}

      {!isReview ? (
        <>
          {interestHint && stageId === "GOALS" ? (
            <p className={styles.hintBanner}>
              Based on what you told us earlier, we&apos;ve suggested &ldquo;{interestHintLabel}&rdquo;
              below -- change it if that&apos;s not quite right.
            </p>
          ) : null}

          <div className={styles.questions}>
            {questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                value={localAnswers[question.field]}
                onCommit={commit}
                error={fieldErrors[question.field]}
              />
            ))}
          </div>

          <div className={styles.navRow}>
            {previousStage ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => goToStage(previousStage)}
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="button" className={styles.primaryButton} onClick={handleContinue}>
              Continue
            </button>
          </div>
        </>
      ) : (
        <ReviewScreen
          sections={reviewSections}
          isReadyForReview={isReadyForReview}
          submitErrors={submitErrors}
          onEdit={goToStage}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function ProgressBar({
  stages,
  currentStageId,
}: {
  stages: StageProgressView[];
  currentStageId: string;
}) {
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  return (
    <nav aria-label="Discovery progress" className={styles.progress}>
      <ol className={styles.progressList}>
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            className={styles.progressItem}
            data-complete={stage.complete}
            data-current={stage.id === currentStageId}
            aria-current={stage.id === currentStageId ? "step" : undefined}
          >
            <span className={styles.progressDot} aria-hidden="true" />
            {stage.label}
            {index === currentIndex ? null : null}
          </li>
        ))}
        <li
          className={styles.progressItem}
          data-current={currentStageId === "REVIEW"}
          aria-current={currentStageId === "REVIEW" ? "step" : undefined}
        >
          <span className={styles.progressDot} aria-hidden="true" />
          Review
        </li>
      </ol>
      <p className={styles.progressCaption}>
        Your answers may add a few relevant questions -- this list can grow as we learn more.
      </p>
    </nav>
  );
}

function ReviewScreen({
  sections,
  isReadyForReview,
  submitErrors,
  onEdit,
  onSubmit,
}: {
  sections: ReviewSection[];
  isReadyForReview: boolean;
  submitErrors: FieldErrorView[];
  onEdit: (stageId: string) => void;
  onSubmit: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className={styles.review}>
      {!isReadyForReview ? (
        <p className={styles.notice}>
          A few required questions still need an answer -- open a section below to finish it.
        </p>
      ) : null}

      {sections.map((section) => (
        <div key={section.stageId} className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <h3>{section.stageLabel}</h3>
            <button
              type="button"
              className={styles.editLink}
              aria-label={`Edit ${section.stageLabel}`}
              onClick={() => onEdit(section.stageId)}
            >
              Edit
            </button>
          </div>
          <dl className={styles.reviewList}>
            {section.items.map((item) => (
              <div key={item.field} className={styles.reviewItem}>
                <dt>{item.wording}</dt>
                <dd>{item.valueLabel}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {submitErrors.length > 0 ? (
        <div className={styles.notice} role="alert">
          <p>We couldn&apos;t finish your Discovery profile yet:</p>
          <ul>
            {submitErrors.map((error) => (
              <li key={error.field}>{error.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.primaryButton}
        disabled={!isReadyForReview || isSubmitting}
        onClick={async () => {
          setIsSubmitting(true);
          await onSubmit();
          setIsSubmitting(false);
        }}
      >
        {isSubmitting ? "Submitting…" : "Complete My Discovery Profile"}
      </button>
    </div>
  );
}
