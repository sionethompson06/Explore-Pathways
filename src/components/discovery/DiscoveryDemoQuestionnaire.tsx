"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { QuestionField } from "./QuestionField";
import { useScrollStageAnchor } from "./useScrollStageAnchor";
import type {
  AnswerValue,
  FieldErrorView,
  QuestionDescriptor,
  ReviewSection,
  StageProgressView,
} from "./types";
import type { RawAnswers, StageId } from "@/lib/discovery/types";
import styles from "./DiscoveryQuestionnaire.module.css";

/**
 * Preview Demo Mode's client component (Phase 3C). Everything here
 * lives in React memory only -- no localStorage/sessionStorage/
 * IndexedDB, no cookies, no URL params carrying an answer, and no
 * database. A page refresh always loses this component's state and
 * restarts the demo; that is intentional and is disclosed in the
 * notice below, not an error condition.
 *
 * `computeState`/`commitAnswer`/`validateCompletion` are the three
 * stateless "use server" functions from app/discover/demo/actions.ts,
 * passed down as props (never imported directly into this client
 * bundle, matching the convention already used by the real
 * DiscoveryQuestionnaire/saveAnswerAction). Every one of them
 * recomputes its answer purely from the @/lib/discovery domain
 * module -- there is no second question bank and no duplicated
 * branch or validation logic in this file.
 */

interface DemoStateView {
  stageId: StageId;
  stages: StageProgressView[];
  questions: QuestionDescriptor[];
  reviewSections: ReviewSection[];
  isReadyForReview: boolean;
  questionBankVersion: string;
  interestHintLabel: string | null;
}

interface DemoCommitResultView {
  ok: boolean;
  errors: FieldErrorView[];
  rawAnswers: RawAnswers;
  state: DemoStateView;
}

interface DemoCompletionResultView {
  ok: boolean;
  errors: FieldErrorView[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function DiscoveryDemoQuestionnaire({
  initialState,
  interestHint,
  computeState,
  commitAnswer,
  validateCompletion,
}: {
  initialState: DemoStateView;
  interestHint: string | null;
  computeState: (
    rawAnswers: RawAnswers,
    stageId: StageId | undefined,
    interestHint: string | null,
  ) => Promise<DemoStateView>;
  commitAnswer: (
    currentRaw: RawAnswers,
    patch: Record<string, unknown>,
    stageId: StageId | undefined,
    interestHint: string | null,
  ) => Promise<DemoCommitResultView>;
  validateCompletion: (rawAnswers: RawAnswers) => Promise<DemoCompletionResultView>;
}) {
  const [rawAnswers, setRawAnswers] = useState<RawAnswers>({});
  // Mirrors `rawAnswers` synchronously (never waits for a re-render),
  // so two commits started in quick succession (e.g. a text field's
  // blur firing right before a sibling radio's click) each read the
  // OTHER's already-applied value as their base -- a plain closure
  // read of `rawAnswers` here would let whichever commit's server
  // round trip resolves last silently overwrite the other's answer.
  const rawAnswersRef = useRef<RawAnswers>(rawAnswers);
  // Guards against a stale response clobbering a newer one: e.g. a
  // checkbox commit still in flight when Continue is clicked right
  // after it (no wait in between) would otherwise resolve later and
  // overwrite the already-navigated `state` with its own, now-stale,
  // recomputed view for the OLD stage -- discovered while verifying
  // Phase 3D's scroll fix, which made this pre-existing race visibly
  // wrong (the page would settle scrolled to the stale stage's
  // position) rather than a self-correcting flicker.
  const requestSeqRef = useRef(0);
  const [state, setState] = useState<DemoStateView>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastFailedPatch, setLastFailedPatch] = useState<Record<string, unknown> | null>(null);
  const [submitErrors, setSubmitErrors] = useState<FieldErrorView[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const stageOrder = state.stages.map((s) => s.id as StageId);
  const currentIndex = stageOrder.indexOf(state.stageId);
  const previousStage = currentIndex > 0 ? stageOrder[currentIndex - 1] : undefined;
  const isReview = state.stageId === "REVIEW";

  // Phase 3D: the same anchor ref is attached to whichever of the two
  // mutually-exclusive branches below is currently rendered (the
  // stage/Review view, or the Demo Complete screen) -- keying on both
  // `state.stageId` and `isComplete` together covers Continue/Back/
  // Edit (stageId changes) and reaching or restarting Demo Complete
  // (isComplete flips while stageId can stay "REVIEW").
  const stageAnchorRef = useScrollStageAnchor<HTMLDivElement>(`${state.stageId}|${isComplete}`);

  function displayValue(field: string): AnswerValue {
    if (field === "discovery_reasons" && interestHint && rawAnswers.discovery_reasons === undefined) {
      return [interestHint];
    }
    return rawAnswers[field] as AnswerValue;
  }

  /** Updates the ref synchronously (before any await) and the state together, so every commit's base is always the true latest answers, never a stale render closure. */
  function applyLocally(next: RawAnswers) {
    rawAnswersRef.current = next;
    setRawAnswers(next);
  }

  async function commit(field: string, value: AnswerValue): Promise<boolean> {
    // Optimistic, synchronous update -- a controlled radio/checkbox
    // must never revert to unchecked while the round trip to
    // commitAnswer is in flight (mirrors the real DiscoveryQuestionnaire's
    // identical `setLocalAnswers` call before its own await). Using the
    // ref (not the `rawAnswers` render closure) as the base means a
    // second commit started before the first one's round trip resolves
    // still builds on the first one's already-applied value, instead of
    // later silently overwriting it.
    const priorRaw = rawAnswersRef.current;
    applyLocally({ ...priorRaw, [field]: value });
    setSaveState("saving");
    setLastFailedPatch(null);
    const patch = { [field]: value };
    const seq = ++requestSeqRef.current;
    const result = await commitAnswer(priorRaw, patch, state.stageId, interestHint);
    if (requestSeqRef.current !== seq) return result.ok;
    setState(result.state);
    if (result.ok) {
      setSaveState("saved");
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return true;
    }
    setSaveState("error");
    setLastFailedPatch(patch);
    const next: Record<string, string> = {};
    for (const error of result.errors) next[error.field] = error.message;
    setFieldErrors((prev) => ({ ...prev, ...next }));
    return false;
  }

  async function retry() {
    if (!lastFailedPatch) return;
    setSaveState("saving");
    const seq = ++requestSeqRef.current;
    const result = await commitAnswer(rawAnswersRef.current, lastFailedPatch, state.stageId, interestHint);
    if (requestSeqRef.current !== seq) return;
    setState(result.state);
    if (result.ok) {
      setSaveState("saved");
      setLastFailedPatch(null);
    } else {
      setSaveState("error");
    }
  }

  async function goToStage(next: StageId) {
    const seq = ++requestSeqRef.current;
    const nextState = await computeState(rawAnswersRef.current, next, interestHint);
    if (requestSeqRef.current !== seq) return;
    setState(nextState);
  }

  /** DEC-G6 parity: pressing Continue while the hint remains visibly selected is itself the confirmation -- see the real DiscoveryQuestionnaire's identical comment. */
  async function handleContinue() {
    if (state.stageId === "GOALS" && interestHint) {
      const ok = await commit("discovery_reasons", displayValue("discovery_reasons"));
      if (!ok) return;
    }
    const nextStage = (stageOrder[currentIndex + 1] ?? "REVIEW") as StageId;
    await goToStage(nextStage);
  }

  async function handleComplete() {
    setSubmitErrors([]);
    setIsSubmitting(true);
    const result = await validateCompletion(rawAnswersRef.current);
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitErrors(result.errors);
      return;
    }
    setIsComplete(true);
  }

  async function handleRestart() {
    setIsComplete(false);
    applyLocally({});
    setFieldErrors({});
    setSubmitErrors([]);
    setSaveState("idle");
    setLastFailedPatch(null);
    const seq = ++requestSeqRef.current;
    const fresh = await computeState({}, "STUDENT", interestHint);
    if (requestSeqRef.current !== seq) return;
    setState(fresh);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.notice}>
        <p className={styles.noticeHeading}>DEMO PREVIEW</p>
        <p>
          Use sample information only. This preview lets you experience the Pathways Discovery
          questionnaire, but your answers are not saved.
        </p>
        <p className={styles.noticeRestart}>Refreshing this page will restart the demo.</p>
      </div>

      {isComplete ? (
        <CompletionScreen
          headingRef={stageAnchorRef}
          onReview={() => setIsComplete(false)}
          onRestart={handleRestart}
        />
      ) : (
        <>
          <div ref={stageAnchorRef} tabIndex={-1} className={styles.stageAnchor}>
            <ProgressBar stages={state.stages} currentStageId={state.stageId} />
          </div>

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
              {interestHint && state.stageId === "GOALS" ? (
                <p className={styles.hintBanner}>
                  Based on what you told us earlier, we&apos;ve suggested &ldquo;
                  {state.interestHintLabel}&rdquo; below -- change it if that&apos;s not quite
                  right.
                </p>
              ) : null}

              <div className={styles.questions}>
                {state.questions.map((question) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    value={displayValue(question.field)}
                    onCommit={commit}
                    error={fieldErrors[question.field]}
                    otherTextValue={question.otherTextField ? displayValue(question.otherTextField) : undefined}
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
              sections={state.reviewSections}
              isReadyForReview={state.isReadyForReview}
              submitErrors={submitErrors}
              isSubmitting={isSubmitting}
              onEdit={goToStage}
              onSubmit={handleComplete}
            />
          )}
        </>
      )}
    </div>
  );
}

function ProgressBar({
  stages,
  currentStageId,
}: {
  stages: StageProgressView[];
  currentStageId: StageId;
}) {
  return (
    <nav aria-label="Discovery progress" className={styles.progress}>
      <ol className={styles.progressList}>
        {stages.map((stage) => (
          <li
            key={stage.id}
            className={styles.progressItem}
            data-complete={stage.complete}
            data-current={stage.id === currentStageId}
            aria-current={stage.id === currentStageId ? "step" : undefined}
          >
            <span className={styles.progressDot} aria-hidden="true" />
            {stage.label}
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
  isSubmitting,
  onEdit,
  onSubmit,
}: {
  sections: ReviewSection[];
  isReadyForReview: boolean;
  submitErrors: FieldErrorView[];
  isSubmitting: boolean;
  onEdit: (stageId: StageId) => void;
  onSubmit: () => void;
}) {
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
              onClick={() => onEdit(section.stageId as StageId)}
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
          <p>We couldn&apos;t finish this demo profile yet:</p>
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
        onClick={onSubmit}
      >
        {isSubmitting ? "Submitting…" : "Complete My Discovery Profile"}
      </button>
    </div>
  );
}

function CompletionScreen({
  headingRef,
  onReview,
  onRestart,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReview: () => void;
  onRestart: () => void;
}) {
  return (
    <div className={styles.completion}>
      <h2 ref={headingRef} tabIndex={-1} className={styles.stageAnchor}>
        Discovery Demo Complete
      </h2>
      <p>
        You&apos;ve reached the end of the current Pathways Discovery experience. In the live
        system, these answers will be securely saved and used to prepare the next stage of your
        Pathways Discovery.
      </p>
      <div className={styles.completionActions}>
        <button type="button" className={styles.secondaryButton} onClick={onReview}>
          REVIEW MY ANSWERS
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onRestart}>
          START DEMO AGAIN
        </button>
        <Link href="/" className={styles.primaryButton}>
          RETURN TO PATHWAYS
        </Link>
      </div>
    </div>
  );
}
