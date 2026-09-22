import { describe, it, expect } from "vitest";
import {
  toPublicReportSnapshot,
  InvalidReportContentError,
} from "@/server/dto";
import type { reportSnapshot } from "@/db/schema";

type ReportSnapshotRow = typeof reportSnapshot.$inferSelect;

/**
 * A minimal, fully valid publicContent tree matching every R01-R07
 * section's strict allowlist in src/server/dto.ts. Individual tests
 * mutate a deep clone of this rather than repeating the whole shape.
 */
function validPublicContent() {
  return {
    R01: {
      display_name_or_fallback: "Explorer",
      approved_headline: "A first look at your options",
      attributed_summary: "Based on your answers so far.",
      actual_priority_chips: ["Hands-on learning"],
      scope_statement: "This is an initial exploration, not a placement.",
    },
    R02: { insight_or_summary: "A short, template-approved insight." },
    R03: [
      {
        base_id: "base_model_1",
        friendly_label: "Career Technical Program",
        public_fit_label: "Strong fit",
        fit_explanation: "Matches your stated interests.",
        visible_considerations: ["Requires a placement test."],
      },
    ],
    R04: [
      {
        opportunity_id: "opp_1",
        label: "Summer internship track",
        planning_horizon: "Next 6-12 months",
      },
    ],
    R05: [{ question: "Have you discussed this with a counselor?", is_material_concern: false }],
    R06: {
      pathway_summary: "A preliminary, non-binding combination of the above.",
      components: ["base_model_1", "opp_1"],
    },
    R07: {
      cta_label: "Request a consultation",
      cta_target: "/consultation/request",
      save_available: true,
    },
  };
}

function rowWith(publicContent: unknown): ReportSnapshotRow {
  return {
    id: "report_1",
    engineRunId: "engine_run_secret_internal_id",
    profileRevisionId: "revision_1",
    contentStatus: "PERSONALIZED",
    generationState: "AI_ASSISTED",
    publicContent,
    contentHash: "sha256:should-not-leak",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("public DTO shaping", () => {
  it("strips every internal-only field from a report snapshot", () => {
    const row = rowWith(validPublicContent());

    const dto = toPublicReportSnapshot(row);

    expect(dto.report_id).toBe("report_1");
    expect(dto.profile_revision_id).toBe("revision_1");
    expect(dto.scope_label).toBe("INITIAL_EXPLORATION_NOT_PLACEMENT");
    expect(dto.content_status).toBe("PERSONALIZED");
    expect(dto.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(dto.sections).toEqual(validPublicContent());

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("engine_run_secret_internal_id");
    expect(serialized).not.toContain("should-not-leak");
    expect(serialized).not.toContain("AI_ASSISTED");
    expect(Object.keys(dto)).not.toContain("engineRunId");
    expect(Object.keys(dto)).not.toContain("generationState");
    expect(Object.keys(dto)).not.toContain("contentHash");
  });

  it("throws InvalidReportContentError, never returning raw data, when a top-level section is missing", () => {
    const content = validPublicContent();
    // @ts-expect-error -- deliberately malformed for this test
    delete content.R04;

    expect(() => toPublicReportSnapshot(rowWith(content))).toThrow(
      InvalidReportContentError,
    );
  });

  it("throws on an unrecognized top-level key (e.g. a forbidden_in_public field smuggled in alongside the sections)", () => {
    const content: Record<string, unknown> = {
      ...validPublicContent(),
      internal_sort_score: 42,
    };

    expect(() => toPublicReportSnapshot(rowWith(content))).toThrow(
      InvalidReportContentError,
    );
  });

  it("throws when a forbidden field is smuggled into a nested R03 model card", () => {
    const content = validPublicContent();
    (content.R03[0] as Record<string, unknown>).sales_priority = "HIGH";

    expect(() => toPublicReportSnapshot(rowWith(content))).toThrow(
      InvalidReportContentError,
    );
  });

  it("throws when an R04 opportunity card carries an eligibility field -- the contract requires planning horizon, not eligibility", () => {
    const content = validPublicContent();
    (content.R04[0] as Record<string, unknown>).eligibility = "ELIGIBLE";

    expect(() => toPublicReportSnapshot(rowWith(content))).toThrow(
      InvalidReportContentError,
    );
  });

  it("throws when R03 exceeds the contract's 0-2 model card limit", () => {
    const content = validPublicContent();
    content.R03 = [content.R03[0]!, content.R03[0]!, content.R03[0]!];

    expect(() => toPublicReportSnapshot(rowWith(content))).toThrow(
      InvalidReportContentError,
    );
  });

  it("throws when R05 contains a malformed entry deep in the array, not just at index 0", () => {
    const content = validPublicContent();
    content.R05.push({
      // @ts-expect-error -- deliberately malformed for this test
      question: 12345,
      is_material_concern: false,
    });

    expect(() => toPublicReportSnapshot(rowWith(content))).toThrow(
      InvalidReportContentError,
    );
  });

  it("throws when publicContent is not an object at all", () => {
    expect(() => toPublicReportSnapshot(rowWith("not-an-object"))).toThrow(
      InvalidReportContentError,
    );
    expect(() => toPublicReportSnapshot(rowWith(null))).toThrow(
      InvalidReportContentError,
    );
  });

  it("allows R05 to exceed a nominal count -- material concerns must remain visible beyond it", () => {
    const content = validPublicContent();
    for (let i = 0; i < 10; i++) {
      content.R05.push({
        question: `Material concern ${i}`,
        is_material_concern: true,
      });
    }

    const dto = toPublicReportSnapshot(rowWith(content));
    expect(dto.sections.R05.length).toBeGreaterThan(3);
  });
});
