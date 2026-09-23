import { describe, expect, it } from "vitest";
import { computeActiveFlow } from "@/lib/discovery/branching";
import { QUESTION_BANK_VERSION, QUESTIONS, getQuestionByField } from "@/lib/discovery/registry";
import { computeEffectiveAnswers } from "@/lib/discovery/normalization";
import { validateAnswerValue, validateDraftPatch } from "@/lib/discovery/validation";
import { describeQuestionsForStage } from "@/lib/discovery/present";
import type { RawAnswers } from "@/lib/discovery/types";

/**
 * Phase 3E discovery calibration coverage (DISCOVERY_CALIBRATION_SPEC_V2.md
 * section 19). These tests prove correct visibility/wording-hook/
 * branching/effective-answer/normalization/derived-fact behavior for
 * the calibrated question bank -- they deliberately do NOT assert any
 * Phase 4 recommendation output, which does not exist yet.
 */

function active(raw: RawAnswers): Set<string> {
  return new Set(computeActiveFlow(raw).activeFields);
}

describe("question-bank contract version and question count", () => {
  it("is the Phase 3E calibrated version with all 39 canonical questions preserved", () => {
    expect(QUESTION_BANK_VERSION).toBe("2.0.0-discovery-calibrated");
    expect(QUESTIONS).toHaveLength(39);
  });
});

describe("DISC_003 (student_age): conditional, not universal", () => {
  it("is inactive for an ordinary numbered grade with no grade-planning reason", () => {
    const fields = active({ current_grade: "5", discovery_reasons: ["ATHLETICS"] });
    expect(fields.has("student_age")).toBe(false);
  });

  it("is active when current_grade is OTHER", () => {
    expect(active({ current_grade: "OTHER" }).has("student_age")).toBe(true);
  });

  it("is active when current_grade is UNKNOWN", () => {
    expect(active({ current_grade: "UNKNOWN" }).has("student_age")).toBe(true);
  });

  it("is active when GRADE_PLANNING is among the discovery reasons, even with a known numeric grade", () => {
    const fields = active({ current_grade: "6", discovery_reasons: ["GRADE_PLANNING"] });
    expect(fields.has("student_age")).toBe(true);
  });
});

describe("DISC_006 legacy environment normalization", () => {
  it("normalizes every retired environment value to BETTER_FIT_ENVIRONMENT in effective answers", () => {
    for (const legacy of ["CURRENT_SCHOOL_CONCERN", "DIFFERENT_ENVIRONMENT", "ENVIRONMENT_CONCERN"] as const) {
      const raw: RawAnswers = { current_grade: "6", discovery_reasons: [legacy] };
      const { answers } = computeEffectiveAnswers(raw);
      expect(answers.discovery_reasons).toEqual(["BETTER_FIT_ENVIRONMENT"]);
    }
  });

  it("never rewrites the raw stored answer -- Review must keep showing exactly what was selected", () => {
    const raw: RawAnswers = { current_grade: "6", discovery_reasons: ["CURRENT_SCHOOL_CONCERN"] };
    expect(raw.discovery_reasons).toEqual(["CURRENT_SCHOOL_CONCERN"]);
  });

  it("dedupes when a legacy value and the new canonical value are both present", () => {
    const raw: RawAnswers = {
      current_grade: "6",
      discovery_reasons: ["CURRENT_SCHOOL_CONCERN", "BETTER_FIT_ENVIRONMENT", "DIFFERENT_ENVIRONMENT"],
    };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.discovery_reasons).toEqual(["BETTER_FIT_ENVIRONMENT"]);
  });

  it("SMALLER_ENVIRONMENT stays its own separate value, never merged into BETTER_FIT_ENVIRONMENT", () => {
    const raw: RawAnswers = { current_grade: "6", discovery_reasons: ["SMALLER_ENVIRONMENT"] };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.discovery_reasons).toEqual(["SMALLER_ENVIRONMENT"]);
  });
});

describe("DISC_008 (desired_primary_change) shown broadly", () => {
  it("is active for every family, not only an unclear-primary-reason family", () => {
    const fields = active({ current_grade: "6", discovery_reasons: ["ATHLETICS"] });
    expect(fields.has("desired_primary_change")).toBe(true);
  });

  it("hides COLLEGE_COURSES for elementary families (K-4 age-appropriate restriction)", () => {
    const [q] = describeQuestionsForStage("GOALS", { current_grade: "2" }).filter(
      (d) => d.field === "desired_primary_change",
    );
    expect(q?.options?.some((o) => o.value === "COLLEGE_COURSES")).toBe(false);
  });

  it("offers COLLEGE_COURSES for a high-school family", () => {
    const [q] = describeQuestionsForStage("GOALS", { current_grade: "10" }).filter(
      (d) => d.field === "desired_primary_change",
    );
    expect(q?.options?.some((o) => o.value === "COLLEGE_COURSES")).toBe(true);
  });
});

describe("family_priorities: STRUCTURE_ACCOUNTABILITY added, ACADEMIC_QUALITY retired from new entry", () => {
  it("offers STRUCTURE_ACCOUNTABILITY as a new-entry option", () => {
    const [q] = describeQuestionsForStage("GOALS", { current_grade: "6" }).filter(
      (d) => d.field === "family_priorities",
    );
    expect(q?.options?.some((o) => o.value === "STRUCTURE_ACCOUNTABILITY")).toBe(true);
  });

  it("no longer offers ACADEMIC_QUALITY as a new-entry option", () => {
    const [q] = describeQuestionsForStage("GOALS", { current_grade: "6" }).filter(
      (d) => d.field === "family_priorities",
    );
    expect(q?.options?.some((o) => o.value === "ACADEMIC_QUALITY")).toBe(false);
  });

  it("a historical ACADEMIC_QUALITY answer still validates (legacy raw answers keep working)", () => {
    const q = getQuestionByField("family_priorities")!;
    expect(validateAnswerValue(q, ["ACADEMIC_QUALITY"])).toHaveLength(0);
  });

  it("drops ACADEMIC_QUALITY from effective answers -- it is not aliased to STRUCTURE_ACCOUNTABILITY (not semantically equivalent)", () => {
    const raw: RawAnswers = { current_grade: "6", family_priorities: ["ACADEMIC_QUALITY", "FLEXIBILITY"] };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.family_priorities).toEqual(["FLEXIBILITY"]);
  });

  it("an ACADEMIC_QUALITY-only historical answer normalizes to an empty effective array, not a silent substitution", () => {
    const raw: RawAnswers = { current_grade: "6", family_priorities: ["ACADEMIC_QUALITY"] };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.family_priorities).toEqual([]);
  });
});

describe("preferred_learning_environment: BOOKS/TECHNOLOGY retired", () => {
  it("no longer offers BOOKS or TECHNOLOGY as new-entry options", () => {
    const [q] = describeQuestionsForStage("LEARNING", { current_grade: "6" }).filter(
      (d) => d.field === "preferred_learning_environment",
    );
    const values = new Set(q?.options?.map((o) => o.value));
    expect(values.has("BOOKS")).toBe(false);
    expect(values.has("TECHNOLOGY")).toBe(false);
  });

  it("drops BOOKS/TECHNOLOGY from effective answers while keeping other selections", () => {
    const raw: RawAnswers = {
      current_grade: "6",
      preferred_learning_environment: ["BOOKS", "TECHNOLOGY", "HANDS_ON"],
    };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.preferred_learning_environment).toEqual(["HANDS_ON"]);
  });
});

describe("DISC_014 (flexibility_reasons) max 3", () => {
  it("rejects a 4th selection", () => {
    const q = getQuestionByField("flexibility_reasons")!;
    expect(q.max_selections).toBe(3);
    expect(
      validateAnswerValue(q, ["ATHLETIC_TRAINING", "COMPETITION", "ATHLETIC_TRAVEL", "ARTS"]),
    ).toHaveLength(1);
  });
});

describe("DISC_032 (unavailable_academic_times) broader SCHEDULE_CONSTRAINT_CONTEXT branch", () => {
  it("is active when flexibility is SOMEWHAT or higher (as before)", () => {
    expect(active({ current_grade: "6", flexibility_importance: "SOMEWHAT" }).has("unavailable_academic_times")).toBe(
      true,
    );
  });

  it("is now ALSO active from an already-stated schedule-intensive reason (athletics/travel/arts) even when importance itself is not yet SOMEWHAT+", () => {
    const fields = active({
      current_grade: "6",
      discovery_reasons: ["ATHLETICS"],
      flexibility_importance: "NOT_IMPORTANT",
    });
    expect(fields.has("unavailable_academic_times")).toBe(true);
  });

  it("stays inactive with no flexibility signal at all", () => {
    expect(active({ current_grade: "6" }).has("unavailable_academic_times")).toBe(false);
  });
});

describe("DISC_033 (desired_delivery): OPEN_TO_RECOMMENDATIONS", () => {
  it("is a distinct offered value, never defaulted or implied by UNKNOWN", () => {
    const q = getQuestionByField("desired_delivery")!;
    expect(q.allowed_values).toContain("OPEN_TO_RECOMMENDATIONS");
    expect(validateAnswerValue(q, ["OPEN_TO_RECOMMENDATIONS"])).toHaveLength(0);
  });

  it("produces no derived facts different from any other single delivery selection -- it never earns a bonus", () => {
    const withRec = computeEffectiveAnswers({ current_grade: "6", desired_delivery: ["OPEN_TO_RECOMMENDATIONS"] });
    const withInPerson = computeEffectiveAnswers({ current_grade: "6", desired_delivery: ["IN_PERSON"] });
    expect(withRec.derived.home_or_online_interest).toBe(false);
    expect(withInPerson.derived.home_or_online_interest).toBe(false);
  });
});

describe("DISC_022 (advancement_interests): NONE_CURRENTLY exclusivity and grade-tiered options", () => {
  it("NONE_CURRENTLY cannot be combined with another selection", () => {
    const patch = { advancement_interests: ["NONE_CURRENTLY", "HONORS"] };
    const result = validateDraftPatch(patch, { current_grade: "10" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("INVALID_VALUE");
  });

  it("NONE_CURRENTLY alone is valid", () => {
    const result = validateDraftPatch({ advancement_interests: ["NONE_CURRENTLY"] }, { current_grade: "10" });
    expect(result.ok).toBe(true);
  });

  it("offers WORK_BASED_LEARNING/INDUSTRY_CREDENTIALS/ENTREPRENEURSHIP to high schoolers", () => {
    const [q] = describeQuestionsForStage("PLANNING", {
      current_grade: "10",
      reported_academic_position: "AHEAD",
    }).filter((d) => d.field === "advancement_interests");
    const values = new Set(q?.options?.map((o) => o.value));
    expect(values.has("WORK_BASED_LEARNING")).toBe(true);
    expect(values.has("INDUSTRY_CREDENTIALS")).toBe(true);
    expect(values.has("ENTREPRENEURSHIP")).toBe(true);
  });

  it("offers ENRICHMENT (not HONORS/AP) to elementary families", () => {
    const [q] = describeQuestionsForStage("PLANNING", {
      current_grade: "2",
      reported_academic_position: "AHEAD",
    }).filter((d) => d.field === "advancement_interests");
    const values = new Set(q?.options?.map((o) => o.value));
    expect(values.has("ENRICHMENT")).toBe(true);
    expect(values.has("HONORS")).toBe(false);
    expect(values.has("AP")).toBe(false);
  });
});

describe("college-course legacy normalization (DUAL_ENROLLMENT/COLLEGE_COURSES -> COLLEGE_LEVEL_COURSES)", () => {
  it("normalizes both legacy values to the single canonical value", () => {
    for (const legacy of ["DUAL_ENROLLMENT", "COLLEGE_COURSES"] as const) {
      const raw: RawAnswers = {
        current_grade: "10",
        reported_academic_position: "AHEAD",
        advancement_interests: [legacy],
      };
      const { answers } = computeEffectiveAnswers(raw);
      expect(answers.advancement_interests).toEqual(["COLLEGE_LEVEL_COURSES"]);
    }
  });

  it("dedupes when both legacy values (or the legacy and canonical value) are present at once, so no duplicate opportunity is implied", () => {
    const raw: RawAnswers = {
      current_grade: "10",
      reported_academic_position: "AHEAD",
      advancement_interests: ["DUAL_ENROLLMENT", "COLLEGE_COURSES", "COLLEGE_LEVEL_COURSES"],
    };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.advancement_interests).toEqual(["COLLEGE_LEVEL_COURSES"]);
  });
});

describe("Phase 3E derived facts", () => {
  it("support_structure_need: CLOSE_ADULT_SUPPORT and INDEPENDENT_WORK_DIFFICULT are HIGH", () => {
    expect(
      computeEffectiveAnswers({ current_grade: "6", learning_support_pattern: "CLOSE_ADULT_SUPPORT" }).derived
        .support_structure_need,
    ).toBe("HIGH");
    expect(
      computeEffectiveAnswers({ current_grade: "6", learning_support_pattern: "INDEPENDENT_WORK_DIFFICULT" }).derived
        .support_structure_need,
    ).toBe("HIGH");
  });

  it("support_structure_need: INDEPENDENT stays LOW even alongside a STRUCTURE_ACCOUNTABILITY priority", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "6",
      learning_support_pattern: "INDEPENDENT",
      family_priorities: ["STRUCTURE_ACCOUNTABILITY"],
    });
    expect(derived.support_structure_need).toBe("LOW");
  });

  it("support_structure_need: UNKNOWN with no active evidence at all -- never invents a tier", () => {
    expect(computeEffectiveAnswers({ current_grade: "6" }).derived.support_structure_need).toBe("UNKNOWN");
  });

  it("schedule_flexibility_need: an already-stated schedule-intensive reason raises a mild subjective label", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "6",
      discovery_reasons: ["ATHLETICS"],
      flexibility_importance: "NOT_IMPORTANT",
    });
    expect(derived.schedule_flexibility_need).toBe("MODERATE");
  });

  it("schedule_flexibility_need: ESSENTIAL alone is VERY_HIGH", () => {
    expect(
      computeEffectiveAnswers({ current_grade: "6", flexibility_importance: "ESSENTIAL" }).derived
        .schedule_flexibility_need,
    ).toBe("VERY_HIGH");
  });

  it("athletic_schedule_demand: never derived from athletic_level (prestige), only hours/travel/conflict", () => {
    const clubLevel = computeEffectiveAnswers({
      current_grade: "9",
      discovery_reasons: ["ATHLETICS"],
      athletic_level: "CLUB_TRAVEL",
      weekly_athletic_commitment: "UNDER_5",
    });
    const recLevel = computeEffectiveAnswers({
      current_grade: "9",
      discovery_reasons: ["ATHLETICS"],
      athletic_level: "RECREATIONAL",
      weekly_athletic_commitment: "UNDER_5",
    });
    expect(clubLevel.derived.athletic_schedule_demand).toBe(recLevel.derived.athletic_schedule_demand);
  });

  it("athletic_schedule_demand: heavy hours plus a real academic-time conflict is HIGHLY_CONSTRAINED", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "9",
      discovery_reasons: ["ATHLETICS"],
      weekly_athletic_commitment: "HOURS_21_PLUS",
      unavailable_academic_times: ["AFTERNOON"],
    });
    expect(derived.athletic_schedule_demand).toBe("HIGHLY_CONSTRAINED");
  });

  it("athletic_schedule_demand: UNKNOWN with no weekly-hours or travel evidence", () => {
    expect(computeEffectiveAnswers({ current_grade: "9" }).derived.athletic_schedule_demand).toBe("UNKNOWN");
  });

  it("family_management_preference: a direct 1:1 map from desired_parent_involvement", () => {
    expect(
      computeEffectiveAnswers({ current_grade: "6", desired_parent_involvement: "PROGRAM_MANAGES" }).derived
        .family_management_preference,
    ).toBe("PROGRAM_LED");
    expect(
      computeEffectiveAnswers({ current_grade: "6", desired_parent_involvement: "VERY_INVOLVED" }).derived
        .family_management_preference,
    ).toBe("HIGH_FAMILY_INVOLVEMENT");
  });

  it("family_management_preference: UNKNOWN when not yet answered", () => {
    expect(computeEffectiveAnswers({ current_grade: "6" }).derived.family_management_preference).toBe("UNKNOWN");
  });

  it("advancement_opportunities: independent flags, not mutually exclusive -- a student can have both a credit-recovery need and an advancement interest", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "10",
      reported_academic_position: "AHEAD",
      reported_graduation_status: "NO",
      credit_recovery_need: "YES",
      advancement_interests: ["RESEARCH", "WORK_BASED_LEARNING"],
    });
    expect(derived.advancement_opportunities.research_projects).toBe(true);
    expect(derived.advancement_opportunities.work_based_learning).toBe(true);
    expect(derived.advancement_opportunities.industry_credentials).toBe(false);
    expect(derived.advancement_opportunities.entrepreneurship).toBe(false);
  });

  it("advancement_opportunities: NONE_CURRENTLY sets every flag false", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "10",
      reported_academic_position: "AHEAD",
      advancement_interests: ["NONE_CURRENTLY"],
    });
    expect(Object.values(derived.advancement_opportunities).every((v) => v === false)).toBe(true);
  });

  it("advancement_opportunities.subject_challenge is true from DISC_034 alone, with no DISC_022 selection", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "6",
      reported_academic_position: "AHEAD",
      subject_advancement_interests: ["MATH"],
    });
    expect(derived.advancement_opportunities.subject_challenge).toBe(true);
  });
});

describe("cost_preference stays available as feasibility context only", () => {
  it("cost_preference is still a valid, answerable field", () => {
    const q = getQuestionByField("cost_preference")!;
    expect(validateAnswerValue(q, "PREFER_TUITION_FREE")).toHaveLength(0);
  });

  it("no derived fact in EffectiveAnswers reads cost_preference -- it is not an educational-alignment input", () => {
    const withPref = computeEffectiveAnswers({ current_grade: "6", cost_preference: "PREFER_TUITION_FREE" });
    const without = computeEffectiveAnswers({ current_grade: "6" });
    const { grade_band: _g1, ...restWith } = withPref.derived;
    const { grade_band: _g2, ...restWithout } = without.derived;
    expect(restWith).toEqual(restWithout);
  });
});

describe("timeline and free text are excluded from educational facts and scoring inputs", () => {
  it("desired_start_timeline never changes any derived fact", () => {
    const withTimeline = computeEffectiveAnswers({ current_grade: "6", desired_start_timeline: "ASAP" });
    const without = computeEffectiveAnswers({ current_grade: "6" });
    expect(withTimeline.derived).toEqual(without.derived);
  });

  it("parent_context (free text) never changes any derived fact", () => {
    const withText = computeEffectiveAnswers({ current_grade: "6", parent_context: "Some family context." });
    const without = computeEffectiveAnswers({ current_grade: "6" });
    expect(withText.derived).toEqual(without.derived);
  });
});

describe("hidden-answer invalidation still holds for the new Phase 3E branches", () => {
  it("a stale student_age answer is omitted once the grade becomes a plain numbered grade with no grade-planning reason", () => {
    const raw: RawAnswers = { current_grade: "OTHER", student_age: 10 };
    const stillOther = computeEffectiveAnswers(raw);
    expect(stillOther.answers.student_age).toBe(10);

    const nowNumbered = computeEffectiveAnswers({ ...raw, current_grade: "6" });
    expect(nowNumbered.answers.student_age).toBeUndefined();
  });

  it("a stale daytime_support_person answer is omitted once home/remote learning is no longer being considered", () => {
    const raw: RawAnswers = {
      current_grade: "2",
      desired_delivery: ["HOMESCHOOL"],
      daytime_support_person: "PARENT_GUARDIAN",
    };
    expect(computeEffectiveAnswers(raw).answers.daytime_support_person).toBe("PARENT_GUARDIAN");

    const changed = computeEffectiveAnswers({ ...raw, desired_delivery: ["IN_PERSON"] });
    expect(changed.answers.daytime_support_person).toBeUndefined();
  });
});
