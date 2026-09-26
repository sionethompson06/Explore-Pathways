import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  commitDemoAnswer,
  computeDemoState,
  validateDemoCompletion,
} from "../app/discover/demo/actions";
import { computeActiveFlow } from "@/lib/discovery/branching";
import { QUESTIONS, QUESTION_BANK_VERSION, getQuestionById } from "@/lib/discovery/registry";
import type { RawAnswers, StageId } from "@/lib/discovery/types";

/**
 * Phase 3C: proves Preview Demo Mode (app/discover/demo/*) reuses the
 * exact same canonical @/lib/discovery registry/branching/validation
 * functions the real, database-backed Discovery flow uses, with zero
 * duplicated logic, and never touches a database anywhere in its own
 * source. See docs/pathways/PHASE_STATUS.md for the full Phase 3C
 * evidence writeup.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
// Matches an actual import/dynamic-import specifier, never a bare
// mention of the module name inside a prose comment.
const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["']@\/db\/client["']/,
  /import\(\s*["']@\/db\/client["']/,
  /from\s+["']@\/server\/session["']/,
  /import\(\s*["']@\/server\/session["']/,
  /from\s+["']@\/server\/discovery-draft["']/,
  /import\(\s*["']@\/server\/discovery-draft["']/,
  /from\s+["']next\/headers["']/,
];

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("Preview Demo Mode is structurally database-free", () => {
  const demoSourceFiles = [
    "app/discover/demo/actions.ts",
    "app/discover/demo/page.tsx",
    "src/components/discovery/DiscoveryDemoQuestionnaire.tsx",
  ];

  it.each(demoSourceFiles)("%s imports nothing DB-, session-, or cookie-touching", (file) => {
    const source = readSource(file);
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(pattern.test(source)).toBe(false);
    }
  });
});

describe("Preview Demo Mode sources every question from the same canonical registry", () => {
  it("reports the exact same QUESTION_BANK_VERSION as the real flow", async () => {
    const state = await computeDemoState({}, "STUDENT", null);
    expect(state.questionBankVersion).toBe(QUESTION_BANK_VERSION);
    expect(QUESTION_BANK_VERSION).toBe("2.1.0-discovery-ux-simplified");
  });

  it("every question the demo renders exists in the canonical QUESTIONS array (no second question bank)", async () => {
    const raw: RawAnswers = {
      current_grade: "9",
      discovery_reasons: ["ATHLETICS", "CREDIT_RECOVERY"],
      primary_discovery_reason: "ATHLETICS",
    };
    for (const stageId of ["STUDENT", "GOALS", "LEARNING", "SCHEDULE", "PLANNING", "FAMILY"] as StageId[]) {
      const state = await computeDemoState(raw, stageId, null);
      for (const question of state.questions) {
        expect(getQuestionById(question.id)).toBeDefined();
        expect(QUESTIONS.some((q) => q.id === question.id)).toBe(true);
      }
    }
  });
});

describe("Preview Demo Mode: K-4 flow (elementary, no NCAA, no graduation/credit-recovery)", () => {
  it("never activates athletics/NCAA/graduation/credit-recovery fields for a grade-2 profile", async () => {
    let raw: RawAnswers = {};
    let result = await commitDemoAnswer(raw, { current_grade: "2" }, "STUDENT", null);
    expect(result.ok).toBe(true);
    raw = result.rawAnswers;

    result = await commitDemoAnswer(raw, { discovery_reasons: ["ACADEMIC_SUPPORT"] }, "GOALS", null);
    expect(result.ok).toBe(true);
    raw = result.rawAnswers;

    const reviewState = await computeDemoState(raw, "REVIEW", null);
    const activeFieldsSeenAcrossStages = new Set<string>();
    for (const stageId of ["STUDENT", "GOALS", "LEARNING", "SCHEDULE", "PLANNING", "FAMILY"] as StageId[]) {
      const state = await computeDemoState(raw, stageId, null);
      for (const q of state.questions) activeFieldsSeenAcrossStages.add(q.field);
    }

    expect(activeFieldsSeenAcrossStages.has("primary_sport")).toBe(false);
    expect(activeFieldsSeenAcrossStages.has("college_athletics_interest")).toBe(false);
    expect(activeFieldsSeenAcrossStages.has("ncaa_interest")).toBe(false);
    expect(activeFieldsSeenAcrossStages.has("reported_graduation_status")).toBe(false);
    expect(activeFieldsSeenAcrossStages.has("credit_recovery_need")).toBe(false);

    // Matches the canonical branching module directly (no duplicated rules).
    const canonical = new Set(computeActiveFlow(raw).activeFields);
    expect(canonical.has("primary_sport")).toBe(false);
    expect(canonical.has("reported_graduation_status")).toBe(false);
    expect(reviewState.reviewSections.length).toBeGreaterThan(0);
  });
});

describe("Preview Demo Mode: middle-school athlete flow + NCAA conditional", () => {
  it("activates the athletics branch and college-athletics question for a grade-7 athlete", async () => {
    let raw: RawAnswers = { current_grade: "7" };
    let result = await commitDemoAnswer(raw, { discovery_reasons: ["ATHLETICS"] }, "GOALS", null);
    expect(result.ok).toBe(true);
    raw = result.rawAnswers;

    const state = await computeDemoState(raw, "ATHLETICS", null);
    const fields = new Set(state.questions.map((q) => q.field));
    expect(fields.has("primary_sport")).toBe(true);
    expect(fields.has("college_athletics_interest")).toBe(true);
    expect(fields.has("ncaa_interest")).toBe(false); // not yet answered DEFINITELY/POSSIBLY
  });

  it("shows the NCAA follow-up only after DEFINITELY/POSSIBLY, never after NO", async () => {
    const base: RawAnswers = {
      current_grade: "7",
      discovery_reasons: ["ATHLETICS"],
    };

    for (const answer of ["DEFINITELY", "POSSIBLY"] as const) {
      const result = await commitDemoAnswer(base, { college_athletics_interest: answer }, "ATHLETICS", null);
      expect(result.ok).toBe(true);
      const fields = new Set(result.state.questions.map((q) => q.field));
      expect(fields.has("ncaa_interest")).toBe(true);
    }

    const noResult = await commitDemoAnswer(base, { college_athletics_interest: "NO" }, "ATHLETICS", null);
    expect(noResult.ok).toBe(true);
    expect(noResult.state.questions.some((q) => q.field === "ncaa_interest")).toBe(false);
  });
});

describe("Preview Demo Mode: high-school flow (graduation status + credit-recovery branch)", () => {
  it("shows reported_graduation_status and credit_recovery_need for a grade-10 credit-recovery profile", async () => {
    let raw: RawAnswers = { current_grade: "10" };
    let result = await commitDemoAnswer(raw, { discovery_reasons: ["CREDIT_RECOVERY"] }, "GOALS", null);
    raw = result.rawAnswers;
    result = await commitDemoAnswer(raw, { reported_graduation_status: "NO" }, "PLANNING", null);
    raw = result.rawAnswers;

    const state = await computeDemoState(raw, "PLANNING", null);
    const fields = new Set(state.questions.map((q) => q.field));
    expect(fields.has("reported_graduation_status")).toBe(true);
    expect(fields.has("credit_recovery_need")).toBe(true);
  });
});

describe("Preview Demo Mode: branch changes immediately stop affecting active questions", () => {
  it("grade 10 -> grade 4 hides HS-only fields from the live demo state", async () => {
    const hsRaw: RawAnswers = { current_grade: "10", discovery_reasons: ["CREDIT_RECOVERY"] };
    const hsState = await computeDemoState(hsRaw, "PLANNING", null);
    expect(hsState.questions.some((q) => q.field === "reported_graduation_status")).toBe(true);

    const result = await commitDemoAnswer(hsRaw, { current_grade: "4" }, "STUDENT", null);
    expect(result.ok).toBe(true);
    const elementaryState = await computeDemoState(result.rawAnswers, "PLANNING", null);
    expect(elementaryState.questions.some((q) => q.field === "reported_graduation_status")).toBe(false);
    expect(elementaryState.questions.some((q) => q.field === "credit_recovery_need")).toBe(false);
  });

  it("removing ATHLETICS hides the athletics branch from the live demo state", async () => {
    const withAthletics: RawAnswers = { current_grade: "8", discovery_reasons: ["ATHLETICS"] };
    const stateWith = await computeDemoState(withAthletics, "ATHLETICS", null);
    expect(stateWith.questions.some((q) => q.field === "primary_sport")).toBe(true);

    const result = await commitDemoAnswer(
      withAthletics,
      { discovery_reasons: ["HOMESCHOOL"] },
      "GOALS",
      null,
    );
    expect(result.ok).toBe(true);
    const stateWithout = await computeDemoState(result.rawAnswers, "ATHLETICS", null);
    expect(stateWithout.questions.some((q) => q.field === "primary_sport")).toBe(false);
  });

  it("flexibility ESSENTIAL -> NOT_IMPORTANT hides schedule-detail questions (flexibility branch)", async () => {
    const essential: RawAnswers = { current_grade: "6", flexibility_importance: "ESSENTIAL" };
    const essentialState = await computeDemoState(essential, "SCHEDULE", null);
    expect(essentialState.questions.some((q) => q.field === "flexibility_reasons")).toBe(true);

    const result = await commitDemoAnswer(
      essential,
      { flexibility_importance: "NOT_IMPORTANT" },
      "SCHEDULE",
      null,
    );
    expect(result.ok).toBe(true);
    expect(result.state.questions.some((q) => q.field === "flexibility_reasons")).toBe(false);
  });

  it("academic advancement interest activates and deactivates the advancement branch", async () => {
    const advancing: RawAnswers = { current_grade: "8", reported_academic_position: "AHEAD" };
    const advancingState = await computeDemoState(advancing, "PLANNING", null);
    expect(advancingState.questions.some((q) => q.field === "advancement_interests")).toBe(true);

    const result = await commitDemoAnswer(
      advancing,
      { reported_academic_position: "ON_LEVEL" },
      "PLANNING",
      null,
    );
    expect(result.ok).toBe(true);
    expect(result.state.questions.some((q) => q.field === "advancement_interests")).toBe(false);
  });
});

describe("Preview Demo Mode: adaptive progress", () => {
  it("the Athletics stage itself only appears once the athletics branch opens (never a fixed 'question N of 39')", async () => {
    const before = await computeDemoState({ current_grade: "6" }, "STUDENT", null);
    expect(before.stages.some((s) => s.id === "ATHLETICS")).toBe(false);

    const after = await computeDemoState(
      { current_grade: "6", discovery_reasons: ["ATHLETICS"] },
      "STUDENT",
      null,
    );
    const athleticsStage = after.stages.find((s) => s.id === "ATHLETICS");
    expect(athleticsStage).toBeDefined();
    expect(athleticsStage!.total).toBeGreaterThan(0);
    expect(athleticsStage!.answered).toBe(0);
  });

  it("answered count rises as the athletics branch's own questions are committed", async () => {
    const raw: RawAnswers = { current_grade: "8", discovery_reasons: ["ATHLETICS"] };
    const before = await computeDemoState(raw, "ATHLETICS", null);
    const beforeAthletics = before.stages.find((s) => s.id === "ATHLETICS")!;

    const result = await commitDemoAnswer(raw, { primary_sport: "Soccer" }, "ATHLETICS", null);
    expect(result.ok).toBe(true);
    const afterAthletics = result.state.stages.find((s) => s.id === "ATHLETICS")!;
    expect(afterAthletics.answered).toBeGreaterThan(beforeAthletics.answered);
  });
});

describe("Preview Demo Mode: Review reflects only active, answered questions (Edit re-enters the right stage)", () => {
  it("an answer hidden by a later branch change never appears in Review", async () => {
    let raw: RawAnswers = { current_grade: "10" };
    let result = await commitDemoAnswer(raw, { reported_graduation_status: "NO" }, "PLANNING", null);
    raw = result.rawAnswers;
    result = await commitDemoAnswer(raw, { credit_recovery_need: "YES" }, "PLANNING", null);
    raw = result.rawAnswers;

    let review = await computeDemoState(raw, "REVIEW", null);
    const hasCreditQuestionBefore = review.reviewSections.some((s) =>
      s.items.some((i) => i.field === "credit_recovery_need"),
    );
    expect(hasCreditQuestionBefore).toBe(true);

    result = await commitDemoAnswer(raw, { current_grade: "4" }, "STUDENT", null);
    raw = result.rawAnswers;
    review = await computeDemoState(raw, "REVIEW", null);
    const hasCreditQuestionAfter = review.reviewSections.some((s) =>
      s.items.some((i) => i.field === "credit_recovery_need"),
    );
    expect(hasCreditQuestionAfter).toBe(false);

    // The stale raw answer itself is preserved in memory (never silently deleted).
    expect(raw.credit_recovery_need).toBe("YES");
  });
});

describe("Preview Demo Mode completion (validateDemoCompletion == validateCompletedProfile, no persistence)", () => {
  function minimalValidRaw(overrides: RawAnswers = {}): RawAnswers {
    return {
      current_grade: "6",
      residence: { state: "UNKNOWN" },
      current_education_model: "TRADITIONAL_PUBLIC",
      discovery_reasons: ["ATHLETICS"],
      reported_academic_position: "ON_LEVEL",
      learning_support_pattern: "OCCASIONAL_CHECK_INS",
      flexibility_importance: "NOT_IMPORTANT",
      family_priorities: ["FLEXIBILITY"],
      desired_parent_involvement: "REGULAR_SUPPORT",
      ...overrides,
    };
  }

  it("blocks completion when a required active question is missing", async () => {
    const raw = minimalValidRaw();
    delete raw.current_education_model;
    const result = await validateDemoCompletion(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === "current_education_model")).toBe(true);
  });

  it("completes successfully with a fully valid minimal profile -- and never generates a recommendation, ranking, or pathway result", async () => {
    const result = await validateDemoCompletion(minimalValidRaw());
    expect(result.ok).toBe(true);
    // Only ok/errors -- no recommendation/ranking/pathway field exists on this result shape.
    expect(Object.keys(result).sort()).toEqual(["errors", "ok"]);
  });
});

describe("Preview Demo Mode: required visible questions, UNKNOWN, and family-priorities-max-3 still enforced", () => {
  it("an explicit UNKNOWN satisfies a required question", async () => {
    const raw: RawAnswers = {
      current_grade: "6",
      residence: { state: "UNKNOWN" },
      current_education_model: "UNKNOWN",
      discovery_reasons: ["ATHLETICS"],
      reported_academic_position: "ON_LEVEL",
      learning_support_pattern: "OCCASIONAL_CHECK_INS",
      flexibility_importance: "NOT_IMPORTANT",
      family_priorities: ["FLEXIBILITY"],
      desired_parent_involvement: "REGULAR_SUPPORT",
    };
    const result = await validateDemoCompletion(raw);
    expect(result.ok).toBe(true);
  });

  it("rejects a 4th family priority through the same commitDemoAnswer path the UI uses", async () => {
    const result = await commitDemoAnswer(
      { current_grade: "6" },
      { family_priorities: ["FLEXIBILITY", "ACADEMIC_QUALITY", "PERSONAL_SUPPORT", "AFFORDABILITY"] },
      "FAMILY",
      null,
    );
    expect(result.ok).toBe(false);
  });

  it("enforces NONE/UNKNOWN exclusivity through commitDemoAnswer", async () => {
    const result = await commitDemoAnswer(
      { current_grade: "4" },
      { reported_support_needs: ["NONE", "READING"] },
      "LEARNING",
      null,
    );
    expect(result.ok).toBe(false);
  });
});
