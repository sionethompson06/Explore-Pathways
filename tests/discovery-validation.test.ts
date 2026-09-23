import { describe, expect, it } from "vitest";
import {
  sanitizeText,
  validateAnswerValue,
  validateCompletedProfile,
  validateDraftPatch,
} from "@/lib/discovery/validation";
import { getQuestionByField } from "@/lib/discovery/registry";
import { computeEffectiveAnswers } from "@/lib/discovery/normalization";
import type { RawAnswers } from "@/lib/discovery/types";

describe("sanitizeText", () => {
  it("strips markup and control characters, and trims", () => {
    expect(sanitizeText("  <script>alert(1)</script>Hi  ")).toBe("alert(1)Hi");
    expect(sanitizeText("Line1\u0000Line2")).toBe("Line1Line2");
  });
});

describe("validateAnswerValue", () => {
  it("rejects an enum value not in allowed_values", () => {
    const q = getQuestionByField("current_grade")!;
    const errors = validateAnswerValue(q, "13");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe("INVALID_VALUE");
  });

  it("accepts a valid single value", () => {
    const q = getQuestionByField("current_grade")!;
    expect(validateAnswerValue(q, "5")).toHaveLength(0);
  });

  it("rejects a 4th family priority (max 3, not exactly 3)", () => {
    const q = getQuestionByField("family_priorities")!;
    expect(validateAnswerValue(q, ["FLEXIBILITY", "ACADEMIC_QUALITY"])).toHaveLength(0);
    const errors = validateAnswerValue(q, [
      "FLEXIBILITY",
      "ACADEMIC_QUALITY",
      "PERSONAL_SUPPORT",
      "AFFORDABILITY",
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe("TOO_MANY_SELECTIONS");
  });

  it("enforces NONE/UNKNOWN exclusivity on a multi-select", () => {
    const q = getQuestionByField("reported_support_needs")!;
    expect(validateAnswerValue(q, ["NONE"])).toHaveLength(0);
    expect(validateAnswerValue(q, ["READING", "MATH"])).toHaveLength(0);
    const errors = validateAnswerValue(q, ["NONE", "READING"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe("INVALID_VALUE");
  });

  it("enforces EXPLORING exclusivity on discovery_reasons", () => {
    const q = getQuestionByField("discovery_reasons")!;
    const errors = validateAnswerValue(q, ["EXPLORING", "ATHLETICS"]);
    expect(errors).toHaveLength(1);
  });

  it("rejects oversized free text after sanitization, accepts at the limit", () => {
    const q = getQuestionByField("student_display_name")!; // max 40
    expect(validateAnswerValue(q, "A".repeat(40))).toHaveLength(0);
    const errors = validateAnswerValue(q, "A".repeat(41));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe("TEXT_TOO_LONG");
  });

  it("rejects a malformed location object", () => {
    const q = getQuestionByField("residence")!;
    expect(validateAnswerValue(q, { state: "CA" })).toHaveLength(0);
    expect(validateAnswerValue(q, { state: "CA", zip: "94103" })).toHaveLength(0);
    expect(validateAnswerValue(q, { state: "NOT_A_STATE" })).toHaveLength(1);
    expect(validateAnswerValue(q, { state: "CA", zip: "not-a-zip" })).toHaveLength(1);
    expect(validateAnswerValue(q, { state: "UNKNOWN" })).toHaveLength(0);
  });

  it("rejects an integer age outside sane bounds, accepts UNKNOWN", () => {
    const q = getQuestionByField("student_age")!;
    expect(validateAnswerValue(q, 8)).toHaveLength(0);
    expect(validateAnswerValue(q, "UNKNOWN")).toHaveLength(0);
    expect(validateAnswerValue(q, -1)).toHaveLength(1);
    expect(validateAnswerValue(q, 500)).toHaveLength(1);
  });

  it("restricts single_from_previous (DISC_007) to the currently selected reasons", () => {
    const q = getQuestionByField("primary_discovery_reason")!;
    expect(
      validateAnswerValue(q, "ATHLETICS", { activeDiscoveryReasons: ["ATHLETICS", "HOMESCHOOL"] }),
    ).toHaveLength(0);
    const errors = validateAnswerValue(q, "ONLINE", {
      activeDiscoveryReasons: ["ATHLETICS", "HOMESCHOOL"],
    });
    expect(errors).toHaveLength(1);
  });
});

describe("validateDraftPatch", () => {
  it("rejects an unknown field name outright", () => {
    const result = validateDraftPatch({ not_a_real_field: "x" }, {});
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.code).toBe("UNKNOWN_FIELD");
  });

  it("accepts a valid patch", () => {
    const result = validateDraftPatch({ current_grade: "7" }, {});
    expect(result.ok).toBe(true);
  });
});

describe("validateCompletedProfile", () => {
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

  it("blocks completion when a required active question is blank", () => {
    const raw = minimalValidRaw();
    delete raw.current_education_model;
    const result = validateCompletedProfile(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === "current_education_model")).toBe(true);
  });

  it("an explicit UNKNOWN satisfies a required question (does not block)", () => {
    const raw = minimalValidRaw({ current_education_model: "UNKNOWN" });
    const result = validateCompletedProfile(raw);
    expect(result.ok).toBe(true);
  });

  it("completes successfully with a fully valid minimal profile", () => {
    const result = validateCompletedProfile(minimalValidRaw());
    expect(result.ok).toBe(true);
    expect(result.effective).toBeDefined();
  });

  it("requires DISC_007 when multiple discovery reasons are selected and blocks without it", () => {
    const raw = minimalValidRaw({ discovery_reasons: ["ATHLETICS", "HOMESCHOOL"] });
    const result = validateCompletedProfile(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === "primary_discovery_reason")).toBe(true);
  });

  it("does not validate/require a field that is not active", () => {
    // credit_recovery_need is HIGH_SCHOOL_AND_GRADUATION_OR_CREDIT_CONCERN --
    // inactive here (grade 6, no graduation concern) -- an invalid stale
    // value for it must not block completion.
    const raw = minimalValidRaw({ credit_recovery_need: "NOT_A_REAL_VALUE" as never });
    const result = validateCompletedProfile(raw);
    expect(result.ok).toBe(true);
  });
});

describe("computeEffectiveAnswers (hidden-answer neutralization)", () => {
  it("omits an inactive field's stale raw value from effective answers", () => {
    const raw: RawAnswers = {
      current_grade: "4", // ELEMENTARY -- HS-only fields inactive
      reported_graduation_status: "NO", // stale value from a prior HS state
    };
    const { answers } = computeEffectiveAnswers(raw);
    expect(answers.reported_graduation_status).toBeUndefined();
  });

  it("derives grade_band, athletics_interest, and ncaa_interest facts", () => {
    const { derived } = computeEffectiveAnswers({
      current_grade: "9",
      discovery_reasons: ["ATHLETICS"],
      college_athletics_interest: "DEFINITELY",
      ncaa_interest: "YES",
    });
    expect(derived.grade_band).toBe("HIGH_SCHOOL");
    expect(derived.athletics_interest).toBe(true);
    expect(derived.ncaa_interest).toBe("YES");
  });

  it("ncaa_interest is NOT_APPLICABLE when the question is not active", () => {
    const { derived } = computeEffectiveAnswers({ current_grade: "3" });
    expect(derived.ncaa_interest).toBe("NOT_APPLICABLE");
  });
});
