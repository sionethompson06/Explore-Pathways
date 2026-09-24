import { describe, expect, it } from "vitest";
import { QUESTIONS } from "@/lib/discovery/registry";
import type { GradeBand } from "@/lib/discovery/types";

/**
 * Phase 3F instruction section 23: a standing QA test that reports
 * visible option counts by question and grade band, and flags any
 * question exceeding 12 -- not just to pass once, but to prevent
 * option overload from creeping back in on a future change. DISC_002
 * (current_grade) is explicitly exempt (K-12 + Other + Unknown
 * naturally exceeds 12).
 */

const GRADE_BANDS: readonly GradeBand[] = ["ELEMENTARY", "MIDDLE", "HIGH_SCHOOL", "UNDETERMINED"];
const EXEMPT_FIELDS = new Set(["current_grade"]);
const MAX_VISIBLE_OPTIONS = 12;

/**
 * Phase 3F section 23: "If another question must exceed 12: document
 * the exact reason in the completion report." discovery_reasons
 * (DISC_006) is the one documented exception -- Phase 3F's explicit,
 * field-by-field wording/option instructions (sections 3-15) named
 * every other long-list question but not this one, and DISC_006 is
 * the single most heavily depended-upon field in branching.ts
 * (isAthleticsInterest, isAdvancementInterestOrReportedAheadOrMixed,
 * isHomeOrRemoteLearningConsidered, isGradePlanningReasonAndMiddleOrHs,
 * isScheduleConstraintContext) and in rules.json (ENV_001), so
 * consolidating its canonical values was judged out of Phase 3F's
 * actual scope rather than an oversight. This allowlist keeps that
 * judgment call visible and reviewable -- not a silent pass -- exactly
 * so a future change can't quietly let a SECOND question grow past 12
 * unnoticed.
 */
const DOCUMENTED_EXCEEDING_QUESTIONS = new Set(["discovery_reasons"]);

interface OptionCountRow {
  id: string;
  field: string;
  gradeBand: GradeBand;
  count: number;
}

function computeVisibleOptionCounts(): OptionCountRow[] {
  const rows: OptionCountRow[] = [];
  for (const question of QUESTIONS) {
    if (question.input_type !== "single" && question.input_type !== "multi") continue;
    if (EXEMPT_FIELDS.has(question.field)) continue;
    for (const gradeBand of GRADE_BANDS) {
      const values = question.grade_band_allowed_values?.[gradeBand] ?? question.allowed_values ?? [];
      rows.push({ id: question.id, field: question.field, gradeBand, count: values.length });
    }
  }
  return rows;
}

describe("Discovery option-count QA (Phase 3F section 23)", () => {
  it("no single/multi question (other than the explicitly exempt DISC_002, or the one documented exception) exceeds 12 visible new-entry choices in any grade band", () => {
    const rows = computeVisibleOptionCounts();
    const overLimit = rows.filter(
      (r) => r.count > MAX_VISIBLE_OPTIONS && !DOCUMENTED_EXCEEDING_QUESTIONS.has(r.field),
    );
    const report = overLimit.map((r) => `${r.id} (${r.field}) @ ${r.gradeBand}: ${r.count}`).join("\n");
    expect(overLimit, `Questions exceeding ${MAX_VISIBLE_OPTIONS} visible options:\n${report}`).toEqual([]);
  });

  it("discovery_reasons is the one documented over-limit exception, named explicitly rather than silently passing", () => {
    const rows = computeVisibleOptionCounts().filter((r) => r.field === "discovery_reasons");
    expect(rows.every((r) => r.count > MAX_VISIBLE_OPTIONS)).toBe(true);
  });

  it("DISC_002 (current_grade) is the one documented exception, and is exempt by name, not by accident", () => {
    const currentGrade = QUESTIONS.find((q) => q.field === "current_grade")!;
    expect(currentGrade.allowed_values!.length).toBeGreaterThan(MAX_VISIBLE_OPTIONS);
    expect(EXEMPT_FIELDS.has("current_grade")).toBe(true);
  });

  it("every previously-overloaded Phase 3E question is now within the 8-12 target range", () => {
    const rows = computeVisibleOptionCounts();
    const byField = (field: string) => rows.filter((r) => r.field === field);

    for (const row of byField("family_priorities")) {
      expect(row.count, `family_priorities @ ${row.gradeBand}`).toBeLessThanOrEqual(12);
    }
    for (const row of byField("reported_support_needs")) {
      expect(row.count, `reported_support_needs @ ${row.gradeBand}`).toBeLessThanOrEqual(12);
    }
    for (const row of byField("flexibility_reasons")) {
      expect(row.count, `flexibility_reasons @ ${row.gradeBand}`).toBeLessThanOrEqual(10);
    }
    for (const row of byField("advancement_interests")) {
      expect(row.count, `advancement_interests @ ${row.gradeBand}`).toBeLessThanOrEqual(11);
    }
  });
});
