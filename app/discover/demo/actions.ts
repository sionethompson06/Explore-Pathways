"use server";

import {
  buildReviewSections,
  computeProgress,
  describeQuestionsForStage,
  getOptionLabelForQuestion,
  gradeBandFromGrade,
  validateCompletedProfile,
  validateDraftPatch,
  QUESTION_BANK_VERSION,
} from "@/lib/discovery";
import type { RawAnswers, StageId } from "@/lib/discovery/types";
import type {
  FieldErrorView,
  QuestionDescriptor,
  ReviewSection,
  StageProgressView,
} from "@/components/discovery/types";
import { loadContracts } from "@/lib/contracts/loader";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { assembleDiscoveryReport } from "@/lib/report/assemble";
import { buildReportProfileContext } from "@/lib/report/profile-context";
import type { DiscoveryReportDTO } from "@/lib/report/types";

/**
 * Preview Demo Mode (Phase 3C; extended by Phase 5.1,
 * PHASE5_1_END_TO_END_DEMO_INTEGRATION.md): a stateless, database-free
 * recompute layer. Every call receives the ENTIRE current in-memory
 * answer snapshot from the client and returns a freshly recomputed
 * view -- nothing is stored here, and this file imports nothing from
 * @/db, @/server/session, or @/server/discovery-draft. It reuses the
 * exact same canonical registry/branching/normalization/validation/
 * labeling functions the real, database-backed Discovery flow uses
 * (@/lib/discovery), and, as of Phase 5.1, the exact same canonical
 * Phase 4 engine (@/lib/engine) and Phase 5 report assembler
 * (@/lib/report) production uses -- there is no second question bank,
 * no duplicated branch/validation logic, no duplicated scoring, and no
 * duplicated report-wording anywhere in this file. Phase 5.1
 * intentionally authorizes this demo to run the canonical Phase 4
 * engine and Phase 5 report assembler once a demo profile validates as
 * complete; earlier phases' "Phase 4 is not authorized" restriction on
 * this route no longer applies.
 */

export interface DemoState {
  stageId: StageId;
  stages: StageProgressView[];
  questions: QuestionDescriptor[];
  reviewSections: ReviewSection[];
  isReadyForReview: boolean;
  questionBankVersion: string;
  /** The homepage marketing-interest hint's human label, re-resolved against the CURRENT grade band every call (DEC-G6 parity) -- never stale. */
  interestHintLabel: string | null;
}

function buildState(
  rawAnswers: RawAnswers,
  requestedStageId: StageId | undefined,
  interestHint: string | null,
): DemoState {
  const progress = computeProgress(rawAnswers);
  const activeStages = progress.stages.filter((s) => s.total > 0);
  const validStageIds = new Set<string>([...activeStages.map((s) => s.id), "REVIEW"]);
  const stageId: StageId =
    requestedStageId && validStageIds.has(requestedStageId)
      ? requestedStageId
      : progress.currentStageId;

  const isReview = stageId === "REVIEW";
  const gradeBand = gradeBandFromGrade(
    typeof rawAnswers.current_grade === "string" ? rawAnswers.current_grade : undefined,
  );

  return {
    stageId,
    stages: activeStages,
    questions: isReview ? [] : describeQuestionsForStage(stageId, rawAnswers),
    reviewSections: isReview ? buildReviewSections(rawAnswers) : [],
    isReadyForReview: progress.isReadyForReview,
    questionBankVersion: QUESTION_BANK_VERSION,
    interestHintLabel: interestHint
      ? getOptionLabelForQuestion("discovery_reasons", interestHint, gradeBand)
      : null,
  };
}

/** Initial load and pure stage navigation (Back/Continue/Edit) -- no answer change, no validation. */
export async function computeDemoState(
  rawAnswers: RawAnswers,
  requestedStageId: StageId | undefined,
  interestHint: string | null,
): Promise<DemoState> {
  return buildState(rawAnswers, requestedStageId, interestHint);
}

export interface DemoCommitResult {
  ok: boolean;
  errors: FieldErrorView[];
  rawAnswers: RawAnswers;
  state: DemoState;
}

/**
 * One field commit. Validated with the same validateDraftPatch the
 * real saveAnswerAction uses (checked against the CURRENT snapshot so
 * single_from_previous / NONE-UNKNOWN exclusivity is checked against
 * up-to-date sibling answers) -- then the patch is merged into the
 * in-memory snapshot and echoed back to the client, which is the only
 * place this merged snapshot lives.
 */
export async function commitDemoAnswer(
  currentRaw: RawAnswers,
  patch: Record<string, unknown>,
  requestedStageId: StageId | undefined,
  interestHint: string | null,
): Promise<DemoCommitResult> {
  const validation = validateDraftPatch(patch, currentRaw);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map((e) => ({ field: e.field, message: e.message })),
      rawAnswers: currentRaw,
      state: buildState(currentRaw, requestedStageId, interestHint),
    };
  }

  const merged: RawAnswers = { ...currentRaw };
  for (const [field, value] of Object.entries(patch)) {
    merged[field] = value as RawAnswers[string];
  }

  return {
    ok: true,
    errors: [],
    rawAnswers: merged,
    state: buildState(merged, requestedStageId, interestHint),
  };
}

export interface DemoCompletionResult {
  ok: boolean;
  errors: FieldErrorView[];
}

/**
 * The same server-authoritative completeness check submitProfileAction
 * relies on (validateCompletedProfile) -- but this never writes
 * anything anywhere. Kept as its own pure validation-only entry point
 * (covered directly by tests/discovery-demo.test.ts); the interactive
 * questionnaire's own "generate my report" action
 * (`buildDemoDiscoveryReport` below) performs this identical check
 * itself before running the engine, so the component no longer needs
 * a separate round trip through this function first.
 */
export async function validateDemoCompletion(
  rawAnswers: RawAnswers,
): Promise<DemoCompletionResult> {
  const result = validateCompletedProfile(rawAnswers);
  if (!result.ok) {
    return { ok: false, errors: result.errors.map((e) => ({ field: e.field, message: e.message })) };
  }
  return { ok: true, errors: [] };
}

export type DemoReportResult =
  | { ok: true; report: DiscoveryReportDTO }
  | { ok: false; errors: FieldErrorView[] };

/** Fixed demo `createdAt` (PHASE5_1_END_TO_END_DEMO_INTEGRATION.md section 4) -- keeps repeat evaluations of the same answers byte-equivalent; never wall-clock-driven. */
const DEMO_REPORT_CREATED_AT = "2026-01-01T00:00:00.000Z";

/**
 * Builds a real, personalized Discovery Report from the CURRENT
 * in-memory demo answer snapshot (Phase 5.1). This is the same
 * canonical pipeline the production report route and the golden-
 * fixture report demo use -- validateCompletedProfile -> the real
 * Phase 4 `evaluateDiscoveryProfile` -> the real Phase 5
 * `assembleDiscoveryReport` -- never a second, simplified, or
 * fixture-backed recomputation. No database, no session, no cookie,
 * no file write, and no server-side cache of the answers this
 * function receives: everything it reads comes from `rawAnswers`,
 * and everything it returns is handed straight back to the caller.
 *
 * The `profileRevisionId` passed into report assembly is deterministic
 * (derived from the engine's own `effectiveProfileHash`, never a
 * random value) so that regenerating a report from the identical
 * answer snapshot always produces the identical opaque report id --
 * this identifier is nonauthorizing and is never placed in the
 * browser URL.
 */
export async function buildDemoDiscoveryReport(rawAnswers: RawAnswers): Promise<DemoReportResult> {
  const validation = validateCompletedProfile(rawAnswers);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors.map((e) => ({ field: e.field, message: e.message })) };
  }

  const contracts = loadContracts();
  const evaluation = evaluateDiscoveryProfile(validation.effective!, contracts);
  const profileRevisionId = `demo_interactive_${evaluation.effectiveProfileHash.slice(0, 16)}`;
  const profile = buildReportProfileContext({
    rawAnswers: rawAnswers as Record<string, unknown>,
    profileRevisionId,
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
    DEMO_REPORT_CREATED_AT,
  );

  return { ok: true, report };
}
