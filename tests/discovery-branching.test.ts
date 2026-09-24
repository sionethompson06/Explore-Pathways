import { describe, expect, it } from "vitest";
import {
  computeActiveFlow,
  derivePrimaryReason,
  gradeBandFromGrade,
} from "@/lib/discovery/branching";
import { QUESTION_BANK_VERSION, QUESTIONS } from "@/lib/discovery/registry";
import type { RawAnswers } from "@/lib/discovery/types";

describe("registry", () => {
  it("loads the corrected 39-question canonical bank", () => {
    expect(QUESTION_BANK_VERSION).toBe("2.1.0-discovery-ux-simplified");
    expect(QUESTIONS).toHaveLength(39);
    expect(QUESTIONS.some((q) => q.id === "DISC_020A")).toBe(true);
  });
});

describe("gradeBandFromGrade", () => {
  it.each([
    ["K", "ELEMENTARY"],
    ["4", "ELEMENTARY"],
    ["5", "MIDDLE"],
    ["8", "MIDDLE"],
    ["9", "HIGH_SCHOOL"],
    ["12", "HIGH_SCHOOL"],
    ["OTHER", "UNDETERMINED"],
    ["UNKNOWN", "UNDETERMINED"],
    [undefined, "UNDETERMINED"],
  ] as const)("%s -> %s", (grade, band) => {
    expect(gradeBandFromGrade(grade)).toBe(band);
  });
});

describe("derivePrimaryReason", () => {
  it("is undefined with no reasons selected", () => {
    expect(derivePrimaryReason({})).toBeUndefined();
  });

  it("auto-derives the sole reason when exactly one is selected", () => {
    expect(derivePrimaryReason({ discovery_reasons: ["ATHLETICS"] })).toBe("ATHLETICS");
  });

  it("is undefined when multiple reasons are selected and DISC_007 is unanswered", () => {
    expect(
      derivePrimaryReason({ discovery_reasons: ["ATHLETICS", "HOMESCHOOL"] }),
    ).toBeUndefined();
  });

  it("uses DISC_007 when it matches a current selection", () => {
    expect(
      derivePrimaryReason({
        discovery_reasons: ["ATHLETICS", "HOMESCHOOL"],
        primary_discovery_reason: "HOMESCHOOL",
      }),
    ).toBe("HOMESCHOOL");
  });

  it("treats a stale DISC_007 answer (reason no longer selected) as unresolved", () => {
    expect(
      derivePrimaryReason({
        discovery_reasons: ["ATHLETICS", "HOMESCHOOL"],
        primary_discovery_reason: "ONLINE",
      }),
    ).toBeUndefined();
  });
});

describe("computeActiveFlow", () => {
  function active(raw: RawAnswers): Set<string> {
    return new Set(computeActiveFlow(raw).activeFields);
  }

  it("K-2 homeschool: elementary lens, no athletics/HS branches, DISC_007 hidden for a single reason", () => {
    const raw: RawAnswers = {
      current_grade: "1",
      discovery_reasons: ["HOMESCHOOL"],
      flexibility_importance: "ESSENTIAL",
      learning_support_pattern: "REGULAR_GUIDANCE",
    };
    const flow = computeActiveFlow(raw);
    expect(flow.gradeBand).toBe("ELEMENTARY");
    expect(flow.primaryReason).toBe("HOMESCHOOL");
    const fields = new Set(flow.activeFields);
    expect(fields.has("primary_discovery_reason")).toBe(false); // exactly one reason
    expect(fields.has("daytime_support_person")).toBe(true); // home-based + REGULAR_GUIDANCE
    expect(fields.has("daytime_support_availability")).toBe(true);
    expect(fields.has("foundational_learning_priorities")).toBe(true); // elementary, no overlap captured yet
    expect(fields.has("reported_graduation_status")).toBe(false);
    expect(fields.has("college_athletics_interest")).toBe(false);
    expect(fields.has("ncaa_interest")).toBe(false);
  });

  it("grade 4 support: elementary lens, no credit/graduation branch", () => {
    const fields = active({
      current_grade: "4",
      discovery_reasons: ["ACADEMIC_SUPPORT"],
      reported_support_needs: ["READING"],
    });
    expect(fields.has("foundational_learning_priorities")).toBe(false); // READING already captured
    expect(fields.has("reported_graduation_status")).toBe(false);
    expect(fields.has("credit_recovery_need")).toBe(false);
  });

  it("grade 7 athlete: athletics branch active, DISC_020A only after DEFINITELY/POSSIBLY, no HS graduation branch", () => {
    const withoutCollegeAnswer = computeActiveFlow({
      current_grade: "7",
      discovery_reasons: ["ATHLETICS"],
    });
    const activeWithout = new Set(withoutCollegeAnswer.activeFields);
    expect(activeWithout.has("primary_sport")).toBe(true);
    expect(activeWithout.has("college_athletics_interest")).toBe(true);
    expect(activeWithout.has("ncaa_interest")).toBe(false); // not yet answered DEFINITELY/POSSIBLY
    expect(activeWithout.has("reported_graduation_status")).toBe(false); // MIDDLE, not HS

    const withDefinitely = active({
      current_grade: "7",
      discovery_reasons: ["ATHLETICS"],
      college_athletics_interest: "DEFINITELY",
    });
    expect(withDefinitely.has("ncaa_interest")).toBe(true);

    const withPossibly = active({
      current_grade: "7",
      discovery_reasons: ["ATHLETICS"],
      college_athletics_interest: "POSSIBLY",
    });
    expect(withPossibly.has("ncaa_interest")).toBe(true);

    const withNo = active({
      current_grade: "7",
      discovery_reasons: ["ATHLETICS"],
      college_athletics_interest: "NO",
    });
    expect(withNo.has("ncaa_interest")).toBe(false);
  });

  it("grade 10 credit concern: HS branch, DISC_025 shown under canonical trigger, no inference of missing credits", () => {
    const fields = active({
      current_grade: "10",
      discovery_reasons: ["CREDIT_RECOVERY"],
      reported_graduation_status: "NO",
    });
    expect(fields.has("reported_graduation_status")).toBe(true);
    expect(fields.has("credit_recovery_need")).toBe(true); // shown, not answered -- asking is not asserting
  });

  it("undetermined grade: universal flow stays usable, grade-specific branches do not falsely activate", () => {
    for (const grade of ["OTHER", "UNKNOWN"] as const) {
      const fields = active({ current_grade: grade });
      expect(fields.has("family_priorities")).toBe(true); // ALL, always usable
      expect(fields.has("reported_graduation_status")).toBe(false);
      expect(fields.has("foundational_learning_priorities")).toBe(false);
      expect(fields.has("primary_sport")).toBe(false);
    }
  });

  it("unknown location remains a valid, completable state (no ZIP required)", () => {
    const result = computeActiveFlow({
      current_grade: "6",
      residence: { state: "UNKNOWN" },
    });
    expect(result.activeFields).toContain("residence");
  });

  describe("branch-change neutralization", () => {
    it("grade 10 -> grade 4 hides HS-only fields", () => {
      const hs = active({ current_grade: "10", discovery_reasons: ["CREDIT_RECOVERY"] });
      expect(hs.has("reported_graduation_status")).toBe(true);

      const elementary = active({ current_grade: "4", discovery_reasons: ["CREDIT_RECOVERY"] });
      expect(elementary.has("reported_graduation_status")).toBe(false);
      expect(elementary.has("credit_recovery_need")).toBe(false);
    });

    it("removing ATHLETICS hides the athletics branch", () => {
      const withAthletics = active({ current_grade: "8", discovery_reasons: ["ATHLETICS"] });
      expect(withAthletics.has("primary_sport")).toBe(true);

      const without = active({ current_grade: "8", discovery_reasons: ["HOMESCHOOL"] });
      expect(without.has("primary_sport")).toBe(false);
      expect(without.has("athletic_level")).toBe(false);
    });

    it("flexibility ESSENTIAL -> NOT_IMPORTANT hides schedule-detail questions", () => {
      const essential = active({ current_grade: "6", flexibility_importance: "ESSENTIAL" });
      expect(essential.has("flexibility_reasons")).toBe(true);
      expect(essential.has("unavailable_academic_times")).toBe(true);

      const notImportant = active({ current_grade: "6", flexibility_importance: "NOT_IMPORTANT" });
      expect(notImportant.has("flexibility_reasons")).toBe(false);
      expect(notImportant.has("unavailable_academic_times")).toBe(false);
    });

    it("removing advancement interest hides the advancement-only branch", () => {
      const advancing = active({
        current_grade: "8",
        reported_academic_position: "AHEAD",
      });
      expect(advancing.has("advancement_interests")).toBe(true);

      const notAdvancing = active({
        current_grade: "8",
        reported_academic_position: "ON_LEVEL",
      });
      expect(notAdvancing.has("advancement_interests")).toBe(false);
    });
  });
});
