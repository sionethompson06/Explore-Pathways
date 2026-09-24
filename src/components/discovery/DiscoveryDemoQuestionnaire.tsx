"use client";

import { useRef, useState } from "react";
import { QuestionField } from "./QuestionField";
import { findBlockingOtherTextFields } from "./otherTextGate";
import { useScrollStageAnchor } from "./useScrollStageAnchor";
import type {
  AnswerValue,
  FieldErrorView,
  QuestionDescriptor,
  ReviewSection,
  StageProgressView,
} from "./types";
import type { RawAnswers, StageId } from "@/lib/discovery/types";
import type { DiscoveryReportDTO } from "@/lib/report/types";
import { ReportView } from "@/components/report/ReportView";
import styles from "./DiscoveryQuestionnaire.module.css";

/**
 * Preview Demo Mode's client component (Phase 3C; extended by Phase
 * 5.1 to generate a real Discovery Report). Everything here lives in
 * React memory only -- no localStorage/sessionStorage/IndexedDB, no
 * cookies, no URL params carrying an answer, and no database. A page
 * refresh always loses this component's state (including any
 * generated report) and restarts the demo; that is intentional and is
 * disclosed in the notice below, not an error condition.
 *
 * `computeState`/`commitAnswer`/`validateCompletion`/`buildReport` are
 * stateless "use server" functions from app/discover/demo/actions.ts,
 * passed down as props (never imported directly into this client
 * bundle, matching the convention already used by the real
 * DiscoveryQuestionnaire/saveAnswerAction). Every one of them
 * recomputes purely from the @/lib/discovery domain module and, for
 * `buildReport`, the canonical Phase 4 engine and Phase 5 report
 * assembler -- there is no second question bank, no duplicated
 * branch/validation logic, and no duplicated scoring/report-wording
 * logic in this file.
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

type DemoReportResultView =
  | { ok: true; report: DiscoveryReportDTO }
  | { ok: false; errors: FieldErrorView[] };

type SaveState = "idle" | "saving" | "saved" | "error";

const INTERACTIVE_DEMO_LABEL = "Interactive Discovery demo — answers are not saved";

export function DiscoveryDemoQuestionnaire({
  initialState,
  interestHint,
  computeState,
  commitAnswer,
  validateCompletion,
  buildReport,
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
  buildReport: (rawAnswers: RawAnswers) => Promise<DemoReportResultView>;
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
  // Phase 3F.1: kept separate from `fieldErrors` above -- a field's own
  // save-success handler (in `commit`) clears its `fieldErrors` entry
  // unconditionally, which would otherwise race with and silently wipe
  // out a still-valid Continue-gate blocking message the instant the
  // Other text field's own (now-valid-shaped, just still-blank) save
  // round trip resolves.
  const [otherTextGateErrors, setOtherTextGateErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastFailedPatch, setLastFailedPatch] = useState<Record<string, unknown> | null>(null);
  const [submitErrors, setSubmitErrors] = useState<FieldErrorView[]>([]);
  const [isBuildingReport, setIsBuildingReport] = useState(false);
  const [report, setReport] = useState<DiscoveryReportDTO | null>(null);
  // Distinct from `submitErrors` (expected field/completion validation
  // errors, shown inline on Review): this is the safe fallback for an
  // UNEXPECTED report-generation/contract failure (section 21) --
  // never fabricates a generic report, never erases current answers.
  const [reportError, setReportError] = useState<string | null>(null);
  // Phase 3F.1: mirrors the real DiscoveryQuestionnaire's identical ref --
  // each mounted OtherTextInput registers its own live text getter here.
  const otherTextLiveRef = useRef<Record<string, () => string>>({});

  function registerOtherTextLiveValue(field: string, getValue: (() => string) | null) {
    if (getValue) {
      otherTextLiveRef.current[field] = getValue;
    } else {
      delete otherTextLiveRef.current[field];
    }
  }

  const stageOrder = state.stages.map((s) => s.id as StageId);
  const currentIndex = stageOrder.indexOf(state.stageId);
  const previousStage = currentIndex > 0 ? stageOrder[currentIndex - 1] : undefined;
  const isReview = state.stageId === "REVIEW";

  // Phase 3D: the same anchor ref is attached to whichever of the two
  // mutually-exclusive branches below is currently rendered (the
  // stage/Review view, or the generated report) -- keying on both
  // `state.stageId` and whether a report exists together covers
  // Continue/Back/Edit (stageId changes) and reaching or leaving the
  // generated report (report flips between null/non-null while
  // stageId can stay "REVIEW").
  const stageAnchorRef = useScrollStageAnchor<HTMLDivElement>(`${state.stageId}|${Boolean(report)}`);

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
    // Phase 3F.1: identical Continue-gate to the real
    // DiscoveryQuestionnaire (see findBlockingOtherTextFields) -- shared
    // code, not a demo-only reimplementation of the same rule.
    const otherTextFields = state.questions
      .map((q) => q.otherTextField)
      .filter((f): f is string => Boolean(f));
    const blocking = findBlockingOtherTextFields(
      state.questions,
      (field) => displayValue(field),
      (field) =>
        otherTextLiveRef.current[field]?.() ??
        (typeof rawAnswers[field] === "string" ? (rawAnswers[field] as string) : undefined),
    );
    if (blocking.length > 0) {
      setOtherTextGateErrors((prev) => {
        const next = { ...prev };
        for (const field of otherTextFields) delete next[field];
        for (const failure of blocking) next[failure.field] = failure.message;
        return next;
      });
      return;
    }
    if (otherTextFields.length > 0) {
      setOtherTextGateErrors((prev) => {
        const next = { ...prev };
        for (const field of otherTextFields) delete next[field];
        return next;
      });
    }

    if (state.stageId === "GOALS" && interestHint) {
      const ok = await commit("discovery_reasons", displayValue("discovery_reasons"));
      if (!ok) return;
    }
    const nextStage = (stageOrder[currentIndex + 1] ?? "REVIEW") as StageId;
    await goToStage(nextStage);
  }

  /**
   * "See My Personalized Discovery Report" (Phase 5.1). Sends the
   * CURRENT in-memory answer snapshot to the DB-free
   * `buildDemoDiscoveryReport` action, which validates it (identical
   * completeness check the old validateCompletion round trip used),
   * then runs the real Phase 4 engine and Phase 5 assembler. Expected
   * validation failures stay on Review as ordinary field errors,
   * exactly like before; an unexpected thrown error (contract/engine
   * failure) is caught here and shown as a safe, non-fabricated
   * fallback -- current answers are never cleared either way.
   */
  async function handleGenerateReport() {
    setSubmitErrors([]);
    setReportError(null);
    setIsBuildingReport(true);
    try {
      const result = await buildReport(rawAnswersRef.current);
      setIsBuildingReport(false);
      if (!result.ok) {
        setSubmitErrors(result.errors);
        return;
      }
      setReport(result.report);
    } catch {
      setIsBuildingReport(false);
      setReportError(
        "We couldn't build your Discovery Report just yet. Your demo answers are still here. Please try again.",
      );
    }
  }

  /** "Review or Edit My Answers" from the generated report -- returns to the REVIEW stage in place, with every current answer preserved (never the database-backed /discover/profile or reopenForEditingAction). */
  function handleEditFromReport() {
    setReport(null);
    setReportError(null);
  }

  async function handleRestart() {
    setReport(null);
    setReportError(null);
    setIsBuildingReport(false);
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

  // Phase 5.1: a generated report renders full-width, OUTSIDE the narrow
  // `styles.wrapper` questionnaire layout -- the premium Phase 5 report
  // experience is never squeezed into the questionnaire's prose-width
  // column (see app/discover/demo/page.tsx, which no longer forces a
  // narrow Section either).
  if (report) {
    return (
      <div ref={stageAnchorRef} tabIndex={-1} className={styles.stageAnchor}>
        <ReportView
          report={report}
          demoLabel={INTERACTIVE_DEMO_LABEL}
          editAnswersOverride={
            <button type="button" className={styles.secondaryButton} onClick={handleEditFromReport}>
              Review or Edit My Answers
            </button>
          }
          secondaryTopAction={
            <button type="button" className={styles.secondaryButton} onClick={handleRestart}>
              Start Demo Again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Phase 5.1a (DEC-Q7): the page's own landmark label
          (app/discover/demo/page.tsx) is a non-heading <span> so it
          never competes with a document H1. This client-rendered,
          visually-hidden H1 is the page's sole H1 while the
          questionnaire/Review is showing; it stops rendering the
          instant a report exists (see the `report` branch above),
          where the ReportHero's own H1 becomes the page's sole H1
          instead -- never two H1s at once. */}
      <h1 className="visually-hidden">Discovery Preview Demo</h1>
      <div className={styles.notice}>
        <p className={styles.noticeHeading}>DEMO PREVIEW</p>
        <p>
          Use sample information only. This preview lets you experience the Pathways Discovery
          questionnaire, but your answers are not saved.
        </p>
        <p className={styles.noticeRestart}>Refreshing this page will restart the demo.</p>
      </div>

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
                otherTextError={question.otherTextField ? otherTextGateErrors[question.otherTextField] : undefined}
                registerOtherTextLiveValue={registerOtherTextLiveValue}
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
      ) : reportError ? (
        <ReportErrorScreen
          message={reportError}
          isRetrying={isBuildingReport}
          onRetry={handleGenerateReport}
          onReviewAnswers={() => setReportError(null)}
        />
      ) : (
        <ReviewScreen
          sections={state.reviewSections}
          isReadyForReview={state.isReadyForReview}
          submitErrors={submitErrors}
          isBuildingReport={isBuildingReport}
          onEdit={goToStage}
          onGenerateReport={handleGenerateReport}
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
  isBuildingReport,
  onEdit,
  onGenerateReport,
}: {
  sections: ReviewSection[];
  isReadyForReview: boolean;
  submitErrors: FieldErrorView[];
  isBuildingReport: boolean;
  onEdit: (stageId: StageId) => void;
  onGenerateReport: () => void;
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
        disabled={!isReadyForReview || isBuildingReport}
        onClick={onGenerateReport}
      >
        {isBuildingReport ? "Building Your Discovery Report…" : "See My Personalized Discovery Report"}
      </button>
    </div>
  );
}

/**
 * The safe fallback for an UNEXPECTED report-generation failure
 * (section 21) -- never a fabricated generic report, never a silent
 * fall back to a Golden fixture, and current answers stay intact
 * underneath (this screen only replaces the Review list, it does not
 * clear `rawAnswers`).
 */
function ReportErrorScreen({
  message,
  isRetrying,
  onRetry,
  onReviewAnswers,
}: {
  message: string;
  isRetrying: boolean;
  onRetry: () => void;
  onReviewAnswers: () => void;
}) {
  return (
    <div className={styles.completion} role="alert">
      <p>{message}</p>
      <div className={styles.completionActions}>
        <button type="button" className={styles.primaryButton} disabled={isRetrying} onClick={onRetry}>
          {isRetrying ? "Building Your Discovery Report…" : "Try Again"}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onReviewAnswers}>
          Review My Answers
        </button>
      </div>
    </div>
  );
}
