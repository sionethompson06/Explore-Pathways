import { describe, expect, it } from "vitest";
import { getQuestionByField, QUESTIONS } from "@/lib/discovery/registry";
import { computeEffectiveAnswers } from "@/lib/discovery/normalization";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import { buildReviewSections, describeQuestionsForStage } from "@/lib/discovery/present";
import { findBlockingOtherTextFields } from "@/components/discovery/otherTextGate";
import type { AnswerValue, QuestionDescriptor } from "@/components/discovery/types";
import type { RawAnswers } from "@/lib/discovery/types";

/**
 * Phase 3F.1 cleanup patch coverage
 * (docs/pathways/DISCOVERY_UX_SIMPLIFICATION_PHASE3F.md section 10;
 * task letters A-J below match the instruction's own lettered test
 * list). This file is additive to tests/discovery-ux-simplification.test.ts
 * (Phase 3F) and tests/discovery-option-count-qa.test.ts, which already
 * cover A/B and most of H/J -- this file adds the DISC_006-specific and
 * Continue-gate coverage those two files do not.
 */

const BASE_RAW: RawAnswers = {
  current_grade: "6",
  residence: { state: "UNKNOWN" },
  current_education_model: "TRADITIONAL",
};

// C: new DISC_006 parent-facing option set/order
describe("DISC_006 (discovery_reasons): new parent-facing option set and order", () => {
  it("new-entry order at MIDDLE/HIGH_SCHOOL/UNDETERMINED is exactly the 11 consolidated values", () => {
    const q = getQuestionByField("discovery_reasons")!;
    expect(q.grade_band_allowed_values!.MIDDLE).toEqual([
      "SCHEDULE_FLEXIBILITY",
      "ATHLETICS",
      "HOMESCHOOL",
      "ONLINE",
      "ACADEMIC_ACCELERATION",
      "ACADEMIC_SUPPORT",
      "BETTER_FIT_ENVIRONMENT",
      "PERSONALIZED_LEARNING",
      "GRADE_PLANNING",
      "EXPLORING",
      "OTHER",
    ]);
    expect(q.grade_band_allowed_values!.HIGH_SCHOOL).toEqual(q.grade_band_allowed_values!.MIDDLE);
    expect(q.grade_band_allowed_values!.UNDETERMINED).toEqual(q.grade_band_allowed_values!.MIDDLE);
  });

  it("ELEMENTARY hides GRADE_PLANNING, keeping the other 10", () => {
    const q = getQuestionByField("discovery_reasons")!;
    expect(q.grade_band_allowed_values!.ELEMENTARY).toEqual([
      "SCHEDULE_FLEXIBILITY",
      "ATHLETICS",
      "HOMESCHOOL",
      "ONLINE",
      "ACADEMIC_ACCELERATION",
      "ACADEMIC_SUPPORT",
      "BETTER_FIT_ENVIRONMENT",
      "PERSONALIZED_LEARNING",
      "EXPLORING",
      "OTHER",
    ]);
    expect(q.grade_band_allowed_values!.ELEMENTARY).not.toContain("GRADE_PLANNING");
  });

  it("retired-only values (ADVANCED_COURSES, COLLEGE_ADVANCEMENT, CREDIT_RECOVERY, SMALLER_ENVIRONMENT, TRAVEL, ARTS, FAMILY_INVOLVEMENT) no longer appear in any grade band's new-entry list, but remain in allowed_values for historical validation", () => {
    const q = getQuestionByField("discovery_reasons")!;
    const retired = [
      "ADVANCED_COURSES",
      "COLLEGE_ADVANCEMENT",
      "CREDIT_RECOVERY",
      "SMALLER_ENVIRONMENT",
      "TRAVEL",
      "ARTS",
      "FAMILY_INVOLVEMENT",
    ];
    for (const value of retired) {
      for (const band of ["ELEMENTARY", "MIDDLE", "HIGH_SCHOOL", "UNDETERMINED"] as const) {
        expect(q.grade_band_allowed_values![band], `${value} @ ${band}`).not.toContain(value);
      }
      expect(q.allowed_values, value).toContain(value);
    }
  });
});

// D: legacy DISC_006 values still normalize correctly
describe("DISC_006 legacy value normalization (effective answers only, raw never rewritten)", () => {
  it.each([
    ["ADVANCED_COURSES", "ACADEMIC_ACCELERATION"],
    ["COLLEGE_ADVANCEMENT", "ACADEMIC_ACCELERATION"],
    ["CREDIT_RECOVERY", "ACADEMIC_SUPPORT"],
    ["SMALLER_ENVIRONMENT", "BETTER_FIT_ENVIRONMENT"],
  ])("%s normalizes to %s in effective answers", (legacyValue, canonicalValue) => {
    const raw: RawAnswers = { ...BASE_RAW, discovery_reasons: [legacyValue] };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.discovery_reasons).toEqual([canonicalValue]);
  });

  it("TRAVEL, ARTS, and FAMILY_INVOLVEMENT are NOT aliased -- they keep their own distinct effective value", () => {
    for (const value of ["TRAVEL", "ARTS", "FAMILY_INVOLVEMENT"]) {
      const raw: RawAnswers = { ...BASE_RAW, discovery_reasons: [value] };
      const { answers } = computeEffectiveAnswers(raw);
      expect(answers.discovery_reasons, value).toEqual([value]);
    }
  });

  it("a mixed legacy+current answer normalizes and deduplicates correctly", () => {
    const raw: RawAnswers = {
      ...BASE_RAW,
      discovery_reasons: ["ADVANCED_COURSES", "ACADEMIC_ACCELERATION", "COLLEGE_ADVANCEMENT"],
    };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.discovery_reasons).toEqual(["ACADEMIC_ACCELERATION"]);
  });

  it("raw storage is never rewritten by normalization", () => {
    const raw: RawAnswers = { ...BASE_RAW, discovery_reasons: ["CREDIT_RECOVERY"] };
    computeEffectiveAnswers(raw);
    expect(raw.discovery_reasons).toEqual(["CREDIT_RECOVERY"]);
  });
});

function makeOtherQuestion(field: string, otherTextField: string, wording = "Test question"): QuestionDescriptor {
  return {
    id: "TEST",
    field,
    wording,
    inputType: "multi",
    required: true,
    otherTextField,
    options: [
      { value: "OTHER", label: "Something else" },
      { value: "SOMETHING", label: "Something" },
    ],
  };
}

// E, F, G: the shared client Continue-gate
describe("Other-text Continue gate (findBlockingOtherTextFields, src/components/discovery/otherTextGate.ts)", () => {
  it("(E) blank Other text blocks Continue", () => {
    const question = makeOtherQuestion("discovery_reasons", "discovery_reasons_other_text");
    const failures = findBlockingOtherTextFields(
      [question],
      () => ["OTHER"] as AnswerValue,
      () => undefined,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]!.field).toBe("discovery_reasons_other_text");
    expect(failures[0]!.message).toMatch(/please add a short description/i);
  });

  it("(F) whitespace-only Other text blocks Continue", () => {
    const question = makeOtherQuestion("discovery_reasons", "discovery_reasons_other_text");
    const failures = findBlockingOtherTextFields(
      [question],
      () => ["OTHER"] as AnswerValue,
      () => "   \t  ",
    );
    expect(failures).toHaveLength(1);
  });

  it("(G) valid, nonblank Other text allows Continue", () => {
    const question = makeOtherQuestion("discovery_reasons", "discovery_reasons_other_text");
    const failures = findBlockingOtherTextFields(
      [question],
      () => ["OTHER"] as AnswerValue,
      () => "We split time between two homes.",
    );
    expect(failures).toEqual([]);
  });

  it("never blocks when OTHER is not selected, regardless of text state", () => {
    const question = makeOtherQuestion("discovery_reasons", "discovery_reasons_other_text");
    const failures = findBlockingOtherTextFields(
      [question],
      () => ["SOMETHING"] as AnswerValue,
      () => undefined,
    );
    expect(failures).toEqual([]);
  });

  it("never blocks a question without otherTextField declared", () => {
    const question: QuestionDescriptor = {
      id: "TEST",
      field: "preferred_learning_environment",
      wording: "Test",
      inputType: "multi",
      required: true,
      options: [{ value: "OTHER", label: "Something else" }],
    };
    const failures = findBlockingOtherTextFields(
      [question],
      () => ["OTHER"] as AnswerValue,
      () => undefined,
    );
    expect(failures).toEqual([]);
  });

  it("proves the rule is shared, not DISC_006-only: applies identically to a second Other-sidecar field (reported_support_needs)", () => {
    const question = makeOtherQuestion("reported_support_needs", "reported_support_needs_other_text");
    const blank = findBlockingOtherTextFields(
      [question],
      () => ["OTHER"] as AnswerValue,
      () => "",
    );
    expect(blank).toHaveLength(1);
    expect(blank[0]!.field).toBe("reported_support_needs_other_text");

    const filled = findBlockingOtherTextFields(
      [question],
      () => ["OTHER"] as AnswerValue,
      () => "Needs help with executive functioning.",
    );
    expect(filled).toEqual([]);
  });

  it("checks every question in the list independently -- multiple simultaneous blockers are all reported", () => {
    const q1 = makeOtherQuestion("discovery_reasons", "discovery_reasons_other_text");
    const q2 = makeOtherQuestion("family_priorities", "family_priorities_other_text");
    const failures = findBlockingOtherTextFields(
      [q1, q2],
      () => ["OTHER"] as AnswerValue,
      () => undefined,
    );
    expect(failures.map((f) => f.field).sort()).toEqual([
      "discovery_reasons_other_text",
      "family_priorities_other_text",
    ]);
  });
});

// H: deselecting OTHER clears the sidecar (DISC_006-specific; the general
// rule across all five fields is already covered in
// tests/discovery-ux-simplification.test.ts)
describe("DISC_006: deselecting OTHER clears the sidecar from effective answers", () => {
  it("OTHER selected with text keeps the sidecar in effective answers", () => {
    const raw: RawAnswers = {
      ...BASE_RAW,
      discovery_reasons: ["OTHER"],
      discovery_reasons_other_text: "We split time between two households.",
    };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.discovery_reasons_other_text).toBe("We split time between two households.");
  });

  it("OTHER deselected drops the sidecar from effective answers even if raw text is still present", () => {
    const raw: RawAnswers = {
      ...BASE_RAW,
      discovery_reasons: ["SCHEDULE_FLEXIBILITY"],
      discovery_reasons_other_text: "Stale text left over from an earlier selection.",
    };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.discovery_reasons_other_text).toBeUndefined();
    // Raw storage itself is untouched -- only the effective view excludes it.
    expect(raw.discovery_reasons_other_text).toBe("Stale text left over from an earlier selection.");
  });
});

// I: Review/Edit preserves valid Other text for DISC_006
describe("DISC_006: Review preserves valid Other text", () => {
  it("buildReviewSections appends the Other text to DISC_006's own Review row", () => {
    const raw: RawAnswers = {
      ...BASE_RAW,
      discovery_reasons: ["OTHER"],
      discovery_reasons_other_text: "We split time between two homes.",
    };
    const sections = buildReviewSections(raw);
    const goalsSection = sections.find((s) => s.stageId === "GOALS")!;
    const reasonsItem = goalsSection.items.find((i) => i.field === "discovery_reasons")!;
    expect(reasonsItem.valueLabel).toMatch(/Something else/);
    expect(reasonsItem.valueLabel).toMatch(/Other: "We split time between two homes\."/);
    // Not a second, fabricated row for the sidecar field.
    expect(goalsSection.items.some((i) => i.field === "discovery_reasons_other_text")).toBe(false);
  });

  it("describeQuestionsForStage's returned descriptor carries otherTextField for DISC_006, so Edit can re-render the input with its current value", () => {
    const raw: RawAnswers = { ...BASE_RAW };
    const questions = describeQuestionsForStage("GOALS", raw);
    const reasonsQuestion = questions.find((q) => q.field === "discovery_reasons")!;
    expect(reasonsQuestion.otherTextField).toBe("discovery_reasons_other_text");
  });
});

// J: Other text still does not affect derived facts (DISC_006-specific)
describe("DISC_006: Other text never affects derived facts", () => {
  it("identical raw answers except for discovery_reasons_other_text produce identical derived facts", () => {
    const withoutText: RawAnswers = { ...BASE_RAW, discovery_reasons: ["OTHER"] };
    const withText: RawAnswers = {
      ...BASE_RAW,
      discovery_reasons: ["OTHER"],
      discovery_reasons_other_text: "Anything at all, even something that looks like a real reason.",
    };
    const a = computeEffectiveAnswers(withoutText).derived;
    const b = computeEffectiveAnswers(withText).derived;
    expect(b).toEqual(a);
  });

  it("no function in the derived-fact computation reads discovery_reasons_other_text as a value driver", () => {
    // A text value that would flip every boolean/tier if it were ever
    // read as if it were a canonical discovery_reasons value.
    const raw: RawAnswers = {
      ...BASE_RAW,
      discovery_reasons: ["OTHER"],
      discovery_reasons_other_text: "ATHLETICS HOMESCHOOL ONLINE",
    };
    const { derived } = computeEffectiveAnswers(raw);
    expect(derived.athletics_interest).toBe(false);
    expect(derived.homeschool_interest).toBe(false);
    expect(derived.home_or_online_interest).toBe(false);
  });
});

// Confirms the completion-boundary REQUIRED check (Phase 3F,
// validation.ts) still holds for DISC_006 specifically, as the
// server-authoritative backstop underneath the new client gate.
describe("DISC_006: server-side REQUIRED check at final completion (backstop under the Continue gate)", () => {
  it("rejects OTHER with blank sidecar text at validateCompletedProfile", () => {
    const raw: RawAnswers = { ...BASE_RAW, discovery_reasons: ["OTHER"] };
    const result = validateCompletedProfile(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "discovery_reasons_other_text")).toBe(true);
    }
  });
});

it("sanity: DISC_006 remains a registered question with exactly one other_text_field declaration", () => {
  const matches = QUESTIONS.filter((q) => q.field === "discovery_reasons");
  expect(matches).toHaveLength(1);
  expect(matches[0]!.other_text_field).toBe("discovery_reasons_other_text");
});
