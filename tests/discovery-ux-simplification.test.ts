import { describe, expect, it } from "vitest";
import { computeActiveFlow } from "@/lib/discovery/branching";
import { getQuestionByField } from "@/lib/discovery/registry";
import { computeEffectiveAnswers } from "@/lib/discovery/normalization";
import { validateAnswerValue, validateCompletedProfile, validateDraftPatch } from "@/lib/discovery/validation";
import { describeQuestionsForStage } from "@/lib/discovery/present";
import { STAGE_LABELS } from "@/lib/discovery/stages";
import type { RawAnswers } from "@/lib/discovery/types";

/**
 * Phase 3F discovery UX simplification coverage
 * (docs/pathways/DISCOVERY_UX_SIMPLIFICATION_PHASE3F.md section 22's
 * numbered list). These prove correct wording/order/option-reduction/
 * Other-text behavior for the calibrated question bank -- not any
 * Phase 4 recommendation output, which still does not exist.
 */

function active(raw: RawAnswers): Set<string> {
  return new Set(computeActiveFlow(raw).activeFields);
}

// 1-2: DISC_031 card order + helper text removed
describe("DISC_031 (school_change_preference): fixed card order, helpers removed", () => {
  it("orders cards STAY_CURRENT, SEEKING_CHANGE, OPEN_TO_CHANGE, UNKNOWN", () => {
    const q = getQuestionByField("school_change_preference")!;
    expect(q.allowed_values).toEqual(["STAY_CURRENT", "SEEKING_CHANGE", "OPEN_TO_CHANGE", "UNKNOWN"]);
  });

  it("has no per-option helper text", () => {
    const q = getQuestionByField("school_change_preference")!;
    expect(q.option_helpers).toBeUndefined();
  });

  it("labels read exactly as owner-specified", () => {
    const [q] = describeQuestionsForStage("STUDENT", { current_grade: "6" }).filter(
      (d) => d.field === "school_change_preference",
    );
    const labels = q?.options?.map((o) => o.label);
    expect(labels).toEqual([
      "Improve what we already have",
      "Explore a different educational fit",
      "Open to both",
      "We're still figuring it out",
    ]);
    expect(q?.options?.every((o) => o.helper === undefined)).toBe(true);
  });
});

// 3: DISC_008 exact new wording
describe("DISC_008 (desired_primary_change) wording", () => {
  it("reads exactly as specified", () => {
    const q = getQuestionByField("desired_primary_change")!;
    expect(q.parent_wording).toBe("What would you most like your student's education to provide?");
  });
});

// 4: DISC_026 helper removed
describe("DISC_026 (family_priorities) helper removed", () => {
  it("has no helper_text, but still enforces max 3", () => {
    const q = getQuestionByField("family_priorities")!;
    expect(q.helper_text).toBeUndefined();
    expect(q.max_selections).toBe(3);
  });
});

// 5: DISC_009 exact new wording
describe("DISC_009 (reported_academic_position) wording", () => {
  it("reads exactly as specified", () => {
    const q = getQuestionByField("reported_academic_position")!;
    expect(q.parent_wording).toBe("How is your student's learning going now?");
  });
});

// 6-8: DISC_010 wording, consolidated options, max selections
describe("DISC_010 (reported_support_needs): wording, consolidation, max 3", () => {
  it("reads exactly as specified", () => {
    const q = getQuestionByField("reported_support_needs")!;
    expect(q.parent_wording).toBe("Where would you need the most support?");
    expect(q.helper_text).toBeUndefined();
  });

  it("enforces max 3 selections", () => {
    const q = getQuestionByField("reported_support_needs")!;
    expect(q.max_selections).toBe(3);
    expect(
      validateAnswerValue(q, ["READING", "WRITING", "MATH", "SCIENCE"]),
    ).toHaveLength(1);
  });

  it("offers the consolidated ORGANIZATION_STUDY_HABITS/ENGAGEMENT_CONFIDENCE cards, not the five/two legacy concepts", () => {
    const [q] = describeQuestionsForStage("LEARNING", { current_grade: "6" }).filter(
      (d) => d.field === "reported_support_needs",
    );
    const values = new Set(q?.options?.map((o) => o.value));
    expect(values.has("ORGANIZATION_STUDY_HABITS")).toBe(true);
    expect(values.has("ENGAGEMENT_CONFIDENCE")).toBe(true);
    for (const legacy of ["ROUTINES", "ORGANIZATION", "TIME_MANAGEMENT", "TASK_COMPLETION", "STUDY_SKILLS", "ENGAGEMENT", "CONFIDENCE"]) {
      expect(values.has(legacy)).toBe(false);
    }
  });

  it("hides MISSING_CREDITS (\"Credits or graduation\") outside HIGH_SCHOOL/UNDETERMINED", () => {
    const [elementary] = describeQuestionsForStage("LEARNING", { current_grade: "3" }).filter(
      (d) => d.field === "reported_support_needs",
    );
    expect(elementary?.options?.some((o) => o.value === "MISSING_CREDITS")).toBe(false);

    const [highSchool] = describeQuestionsForStage("LEARNING", { current_grade: "10" }).filter(
      (d) => d.field === "reported_support_needs",
    );
    expect(highSchool?.options?.some((o) => o.value === "MISSING_CREDITS")).toBe(true);
  });

  it("hides PHONICS from the universal screen at every grade band (still reachable via DISC_E01 separately)", () => {
    for (const grade of ["1", "6", "10"]) {
      const [q] = describeQuestionsForStage("LEARNING", { current_grade: grade }).filter(
        (d) => d.field === "reported_support_needs",
      );
      expect(q?.options?.some((o) => o.value === "PHONICS")).toBe(false);
    }
  });
});

// 9-10: DISC_012 precedes DISC_011, exact wording
describe("Learning section order: DISC_012 precedes DISC_011", () => {
  it("preferred_learning_environment comes before learning_support_pattern in evaluation order and stage display", () => {
    const { activeFields } = computeActiveFlow({ current_grade: "6" });
    const envIndex = activeFields.indexOf("preferred_learning_environment");
    const patternIndex = activeFields.indexOf("learning_support_pattern");
    expect(envIndex).toBeGreaterThanOrEqual(0);
    expect(patternIndex).toBeGreaterThan(envIndex);
  });

  it("describeQuestionsForStage(LEARNING) lists preferred_learning_environment before learning_support_pattern", () => {
    const descriptors = describeQuestionsForStage("LEARNING", { current_grade: "6" });
    const fields = descriptors.map((d) => d.field);
    expect(fields.indexOf("preferred_learning_environment")).toBeLessThan(
      fields.indexOf("learning_support_pattern"),
    );
  });

  it("preferred_learning_environment reads \"How does your student learn best?\"", () => {
    const q = getQuestionByField("preferred_learning_environment")!;
    expect(q.parent_wording).toBe("How does your student learn best?");
  });

  it("learning_support_pattern reads \"How does your student work best?\" and stays broadly active (never a hidden/skipped follow-up)", () => {
    const q = getQuestionByField("learning_support_pattern")!;
    expect(q.parent_wording).toBe("How does your student work best?");
    expect(q.show_when).toBe("ALL");
    for (const environment of ["SELF_PACED", "BLEND", "LIVE_TEACHER", "HANDS_ON", "SMALL_GROUP", "ONE_TO_ONE", "MOVEMENT"]) {
      const fields = active({ current_grade: "6", preferred_learning_environment: [environment] });
      expect(fields.has("learning_support_pattern"), `learning_support_pattern must show after ${environment}`).toBe(true);
    }
  });
});

// 13: DISC_013 wording
describe("DISC_013 (flexibility_importance) wording", () => {
  it("reads exactly as specified", () => {
    const q = getQuestionByField("flexibility_importance")!;
    expect(q.parent_wording).toBe("How much flexibility would be helpful?");
  });
});

// 14-15: DISC_014 reduced list + max selections
describe("DISC_014 (flexibility_reasons): reduced list, max 3", () => {
  it("keeps max_selections at 3", () => {
    expect(getQuestionByField("flexibility_reasons")!.max_selections).toBe(3);
  });

  it("offers <=10 choices at every grade band, using ATHLETIC_TRAINING/WORK as umbrella values", () => {
    for (const grade of ["2", "6", "10"]) {
      const [q] = describeQuestionsForStage("SCHEDULE", { current_grade: grade }).filter(
        (d) => d.field === "flexibility_reasons",
      );
      expect(q?.options?.length ?? 0).toBeLessThanOrEqual(10);
      const values = new Set(q?.options?.map((o) => o.value));
      expect(values.has("COMPETITION")).toBe(false);
      expect(values.has("ATHLETIC_TRAVEL")).toBe(false);
      expect(values.has("BUSINESS")).toBe(false);
    }
  });
});

// 16: DISC_033 wording
describe("DISC_033 (desired_delivery) wording", () => {
  it("reads exactly as specified", () => {
    const q = getQuestionByField("desired_delivery")!;
    expect(q.parent_wording).toBe("What learning opportunities are you open to exploring?");
  });
});

// 17: DISC_022 reduced grade-specific lists
describe("DISC_022 (advancement_interests) reduced grade-specific lists", () => {
  it("K-4 offers ~5 choices, consolidating subject-specific advanced values into CHALLENGING_COURSEWORK", () => {
    const [q] = describeQuestionsForStage("PLANNING", {
      current_grade: "2",
      reported_academic_position: "AHEAD",
    }).filter((d) => d.field === "advancement_interests");
    expect(q?.options?.length).toBe(5);
    const values = new Set(q?.options?.map((o) => o.value));
    expect(values.has("ADVANCED_MATH")).toBe(false);
    expect(values.has("ADVANCED_SCIENCE")).toBe(false);
    expect(values.has("ADVANCED_ELA")).toBe(false);
  });

  it("K-4's CHALLENGING_COURSEWORK card reads \"More challenging learning\"", () => {
    const [q] = describeQuestionsForStage("PLANNING", {
      current_grade: "2",
      reported_academic_position: "AHEAD",
    }).filter((d) => d.field === "advancement_interests");
    const option = q?.options?.find((o) => o.value === "CHALLENGING_COURSEWORK");
    expect(option?.label).toBe("More challenging learning");
  });

  it("middle school offers 10 or fewer choices", () => {
    const [q] = describeQuestionsForStage("PLANNING", {
      current_grade: "7",
      reported_academic_position: "AHEAD",
    }).filter((d) => d.field === "advancement_interests");
    expect(q?.options?.length ?? 0).toBeLessThanOrEqual(10);
  });

  it("high school offers 11 or fewer choices", () => {
    const [q] = describeQuestionsForStage("PLANNING", {
      current_grade: "10",
      reported_academic_position: "AHEAD",
    }).filter((d) => d.field === "advancement_interests");
    expect(q?.options?.length ?? 0).toBeLessThanOrEqual(11);
  });
});

// 18: DISC_024 wording
describe("DISC_024 (reported_graduation_status) wording", () => {
  it("reads exactly as specified", () => {
    const q = getQuestionByField("reported_graduation_status")!;
    expect(q.parent_wording).toBe("How clear is your student's path to graduation?");
  });
});

// 19: DISC_E03 wording + helper removed
describe("DISC_E03 (in_person_peer_preference) wording and helper", () => {
  it("reads exactly as specified, with no helper text", () => {
    const q = getQuestionByField("in_person_peer_preference")!;
    expect(q.parent_wording).toBe("How important is in-person learning with other students?");
    expect(q.helper_text).toBeUndefined();
  });
});

// 20-24: Other inline text behavior
describe("Inline \"Other\" free-text behavior", () => {
  it("discovery_reasons, reported_support_needs, flexibility_reasons, advancement_interests and family_priorities each declare an other_text_field", () => {
    for (const field of ["discovery_reasons", "reported_support_needs", "flexibility_reasons", "advancement_interests", "family_priorities"]) {
      expect(getQuestionByField(field)!.other_text_field, field).toBeDefined();
    }
  });

  it("preferred_learning_environment and desired_primary_change do NOT declare an other_text_field (plain OTHER card, by explicit Phase 3F discretion)", () => {
    expect(getQuestionByField("preferred_learning_environment")!.other_text_field).toBeUndefined();
    expect(getQuestionByField("desired_primary_change")!.other_text_field).toBeUndefined();
  });

  it("accepts a draft patch to the sidecar Other-text field directly", () => {
    const result = validateDraftPatch(
      { discovery_reasons_other_text: "We split time between two households." },
      { current_grade: "6" },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects Other text over 150 characters", () => {
    const result = validateDraftPatch(
      { reported_support_needs_other_text: "x".repeat(151) },
      { current_grade: "6" },
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("TEXT_TOO_LONG");
  });

  it("requires nonblank Other text at completion when OTHER is selected", () => {
    const raw: RawAnswers = {
      student_display_name: "Sam",
      current_grade: "6",
      residence: { state: "UNKNOWN" },
      current_education_model: "UNKNOWN",
      school_change_preference: "UNKNOWN",
      discovery_reasons: ["OTHER"],
      family_priorities: ["FLEXIBILITY"],
      reported_academic_position: "ON_LEVEL",
      preferred_learning_environment: ["SELF_PACED"],
      learning_support_pattern: "INDEPENDENT",
      flexibility_importance: "NOT_IMPORTANT",
      desired_parent_involvement: "REGULAR_SUPPORT",
    };
    const result = validateCompletedProfile(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === "discovery_reasons_other_text")).toBe(true);
  });

  it("passes completion once nonblank Other text is supplied", () => {
    const raw: RawAnswers = {
      student_display_name: "Sam",
      current_grade: "6",
      residence: { state: "UNKNOWN" },
      current_education_model: "UNKNOWN",
      school_change_preference: "UNKNOWN",
      discovery_reasons: ["OTHER"],
      discovery_reasons_other_text: "We're relocating mid-year for work.",
      family_priorities: ["FLEXIBILITY"],
      reported_academic_position: "ON_LEVEL",
      preferred_learning_environment: ["SELF_PACED"],
      learning_support_pattern: "INDEPENDENT",
      flexibility_importance: "NOT_IMPORTANT",
      desired_parent_involvement: "REGULAR_SUPPORT",
    };
    const result = validateCompletedProfile(raw);
    expect(result.errors.some((e) => e.field === "discovery_reasons_other_text")).toBe(false);
  });

  it("effective answers include Other text only while OTHER is still selected", () => {
    const withOther = computeEffectiveAnswers({
      current_grade: "6",
      discovery_reasons: ["OTHER"],
      discovery_reasons_other_text: "Family relocation.",
    });
    expect(withOther.answers.discovery_reasons_other_text).toBe("Family relocation.");

    // OTHER deselected (client forgot to clear it, or a stale value survives another way) -- server excludes it regardless.
    const otherDeselected = computeEffectiveAnswers({
      current_grade: "6",
      discovery_reasons: ["ATHLETICS"],
      discovery_reasons_other_text: "Family relocation.",
    });
    expect(otherDeselected.answers.discovery_reasons_other_text).toBeUndefined();
  });

  it("Other text never changes any derived fact", () => {
    const withText = computeEffectiveAnswers({
      current_grade: "6",
      discovery_reasons: ["OTHER"],
      discovery_reasons_other_text: "Some free text that could look like anything.",
    });
    const withoutText = computeEffectiveAnswers({
      current_grade: "6",
      discovery_reasons: ["OTHER"],
    });
    expect(withText.derived).toEqual(withoutText.derived);
  });
});

// 25: legacy normalization for consolidated values
describe("Legacy normalization for Phase 3F consolidated values", () => {
  it("reported_support_needs: ROUTINES/ORGANIZATION/TIME_MANAGEMENT/TASK_COMPLETION/STUDY_SKILLS all normalize to ORGANIZATION_STUDY_HABITS", () => {
    for (const legacy of ["ROUTINES", "ORGANIZATION", "TIME_MANAGEMENT", "TASK_COMPLETION", "STUDY_SKILLS"]) {
      const { answers } = computeEffectiveAnswers({ current_grade: "6", reported_support_needs: [legacy] });
      expect(answers.reported_support_needs, legacy).toEqual(["ORGANIZATION_STUDY_HABITS"]);
    }
  });

  it("reported_support_needs: ENGAGEMENT/CONFIDENCE both normalize to ENGAGEMENT_CONFIDENCE, deduped", () => {
    const { answers } = computeEffectiveAnswers({
      current_grade: "6",
      reported_support_needs: ["ENGAGEMENT", "CONFIDENCE"],
    });
    expect(answers.reported_support_needs).toEqual(["ENGAGEMENT_CONFIDENCE"]);
  });

  it("learning_support_pattern: INDEPENDENT_WORK_DIFFICULT normalizes to CLOSE_ADULT_SUPPORT and keeps its HIGH support_structure_need signal", () => {
    const { answers, derived } = computeEffectiveAnswers({
      current_grade: "6",
      learning_support_pattern: "INDEPENDENT_WORK_DIFFICULT",
    });
    expect(answers.learning_support_pattern).toBe("CLOSE_ADULT_SUPPORT");
    expect(derived.support_structure_need).toBe("HIGH");
  });

  it("flexibility_reasons: COMPETITION/ATHLETIC_TRAVEL normalize to ATHLETIC_TRAINING, BUSINESS normalizes to WORK", () => {
    for (const [legacy, canonical] of [
      ["COMPETITION", "ATHLETIC_TRAINING"],
      ["ATHLETIC_TRAVEL", "ATHLETIC_TRAINING"],
      ["BUSINESS", "WORK"],
    ] as const) {
      const raw: RawAnswers = {
        current_grade: "10",
        flexibility_importance: "SOMEWHAT",
        flexibility_reasons: [legacy],
      };
      const { answers } = computeEffectiveAnswers(raw);
      expect(answers.flexibility_reasons, legacy).toEqual([canonical]);
    }
  });

  it("advancement_interests: ADVANCED_MATH/ADVANCED_SCIENCE/ADVANCED_ELA all normalize to CHALLENGING_COURSEWORK", () => {
    for (const legacy of ["ADVANCED_MATH", "ADVANCED_SCIENCE", "ADVANCED_ELA"]) {
      const { answers } = computeEffectiveAnswers({
        current_grade: "8",
        reported_academic_position: "AHEAD",
        advancement_interests: [legacy],
      });
      expect(answers.advancement_interests, legacy).toEqual(["CHALLENGING_COURSEWORK"]);
    }
  });

  it("family_priorities: ATHLETIC_FLEXIBILITY/LOCATION_FLEXIBILITY/ADVANCED_COURSES/ACCREDITATION/DIPLOMA are dropped (not aliased) from effective answers", () => {
    const { answers } = computeEffectiveAnswers({
      current_grade: "10",
      family_priorities: ["ATHLETIC_FLEXIBILITY", "LOCATION_FLEXIBILITY", "ADVANCED_COURSES", "ACCREDITATION", "DIPLOMA", "FLEXIBILITY"],
    });
    expect(answers.family_priorities).toEqual(["FLEXIBILITY"]);
  });

  it("historical raw values are never rewritten by any of the above", () => {
    const raw: RawAnswers = { current_grade: "6", reported_support_needs: ["ROUTINES", "ENGAGEMENT"] };
    computeEffectiveAnswers(raw);
    expect(raw.reported_support_needs).toEqual(["ROUTINES", "ENGAGEMENT"]);
  });
});

// 26: hidden-answer invalidation (Phase 3F reorder doesn't break it)
describe("Hidden-answer invalidation still holds after the Learning-section reorder", () => {
  it("a stale MISSING_CREDITS-only reported_support_needs answer is neutralized in effective answers for a non-HIGH_SCHOOL band, but the field itself stays active (ALL) so the raw value is preserved, not merely hidden", () => {
    const raw: RawAnswers = { current_grade: "10", reported_support_needs: ["MISSING_CREDITS"] };
    const highSchool = computeEffectiveAnswers(raw);
    expect(highSchool.answers.reported_support_needs).toEqual(["MISSING_CREDITS"]);
  });

  it("switching from HIGH_SCHOOL to ELEMENTARY still hides HS-only branches (Phase 3E behavior unchanged by the reorder)", () => {
    const hs = active({ current_grade: "10", discovery_reasons: ["CREDIT_RECOVERY"] });
    expect(hs.has("reported_graduation_status")).toBe(true);
    const elementary = active({ current_grade: "4", discovery_reasons: ["CREDIT_RECOVERY"] });
    expect(elementary.has("reported_graduation_status")).toBe(false);
  });
});

// 27: UNKNOWN / NONE exclusivity unaffected
describe("UNKNOWN/NONE exclusivity is unaffected by Phase 3F changes", () => {
  it("reported_support_needs: NONE cannot combine with a substantive choice", () => {
    const q = getQuestionByField("reported_support_needs")!;
    expect(validateAnswerValue(q, ["NONE"])).toHaveLength(0);
    expect(validateAnswerValue(q, ["NONE", "READING"])).toHaveLength(1);
  });

  it("advancement_interests: NONE_CURRENTLY stays exclusive", () => {
    const q = getQuestionByField("advancement_interests")!;
    expect(validateAnswerValue(q, ["NONE_CURRENTLY"])).toHaveLength(0);
    expect(validateAnswerValue(q, ["NONE_CURRENTLY", "RESEARCH"])).toHaveLength(1);
  });
});

// 28: Phase 3E derived facts still behave correctly
describe("Phase 3E derived facts still behave correctly after Phase 3F consolidation", () => {
  it("advancement_opportunities.subject_challenge now comes solely from DISC_034, not from any DISC_022 value", () => {
    const fromSubjectQuestion = computeEffectiveAnswers({
      current_grade: "6",
      reported_academic_position: "AHEAD",
      subject_advancement_interests: ["MATH"],
    });
    expect(fromSubjectQuestion.derived.advancement_opportunities.subject_challenge).toBe(true);

    const fromChallengingCoursework = computeEffectiveAnswers({
      current_grade: "6",
      reported_academic_position: "AHEAD",
      advancement_interests: ["CHALLENGING_COURSEWORK"],
    });
    expect(fromChallengingCoursework.derived.advancement_opportunities.subject_challenge).toBe(false);
  });

  it("advancement_opportunities: the combined HONORS_AP card sets advanced_coursework true", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "10",
      reported_academic_position: "AHEAD",
      advancement_interests: ["HONORS_AP"],
    });
    expect(derived.advancement_opportunities.advanced_coursework).toBe(true);
  });

  it("advancement_opportunities: the combined CAREER_CTE_CREDENTIALS card sets both career_cte and industry_credentials true", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "10",
      reported_academic_position: "AHEAD",
      advancement_interests: ["CAREER_CTE_CREDENTIALS"],
    });
    expect(derived.advancement_opportunities.career_cte).toBe(true);
    expect(derived.advancement_opportunities.industry_credentials).toBe(true);
  });

  it("support_structure_need still derives HIGH from CLOSE_ADULT_SUPPORT directly (not just via the retired-value alias)", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "6",
      learning_support_pattern: "CLOSE_ADULT_SUPPORT",
    });
    expect(derived.support_structure_need).toBe("HIGH");
  });
});

describe("stage labels are unaffected by the Learning-section field reorder", () => {
  it("STAGE_LABELS.LEARNING is still \"Learning\"", () => {
    expect(STAGE_LABELS.LEARNING).toBe("Learning");
  });
});
