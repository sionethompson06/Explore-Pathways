import { describe, it, expect } from "vitest";
import { toPublicReportSnapshot } from "@/server/dto";
import type { reportSnapshot } from "@/db/schema";

type ReportSnapshotRow = typeof reportSnapshot.$inferSelect;

describe("public DTO shaping", () => {
  it("strips every internal-only field from a report snapshot", () => {
    const row: ReportSnapshotRow = {
      id: "report_1",
      engineRunId: "engine_run_secret_internal_id",
      profileRevisionId: "revision_1",
      contentStatus: "PERSONALIZED",
      generationState: "AI_ASSISTED",
      publicContent: { R01: { headline: "Example" } },
      contentHash: "sha256:should-not-leak",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };

    const dto = toPublicReportSnapshot(row);

    expect(dto).toEqual({
      report_id: "report_1",
      profile_revision_id: "revision_1",
      scope_label: "INITIAL_EXPLORATION_NOT_PLACEMENT",
      content_status: "PERSONALIZED",
      sections: { R01: { headline: "Example" } },
      created_at: "2026-01-01T00:00:00.000Z",
    });

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("engine_run_secret_internal_id");
    expect(serialized).not.toContain("should-not-leak");
    expect(serialized).not.toContain("AI_ASSISTED");
    expect(Object.keys(dto)).not.toContain("engineRunId");
    expect(Object.keys(dto)).not.toContain("generationState");
    expect(Object.keys(dto)).not.toContain("contentHash");
  });
});
