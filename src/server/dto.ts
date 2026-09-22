import type { reportSnapshot } from "@/db/schema";

/**
 * Public-DTO shaping. This is the one place allowed to turn a
 * database row into something a browser receives -- per
 * report-contract.json's forbidden_in_public list and Specification
 * 04 ("Export a separate public DTO; never just hide scores with
 * CSS"). A route handler must call one of these, never send a raw
 * Drizzle row to a response.
 */

type ReportSnapshotRow = typeof reportSnapshot.$inferSelect;

export interface PublicReportSnapshotDto {
  report_id: string;
  profile_revision_id: string;
  scope_label: "INITIAL_EXPLORATION_NOT_PLACEMENT";
  content_status: ReportSnapshotRow["contentStatus"];
  /** The assembled R01-R07 sections. Opaque here -- the Phase 5 report assembler owns its shape. */
  sections: unknown;
  created_at: string;
}

/**
 * Strips every internal-only field: engine_run_id (an internal FK),
 * generation_state (report-contract.json places this under
 * internal_record, not public_dto -- whether AI assisted the wording
 * is not the parent's concern), and content_hash (integrity metadata,
 * not a public field). Only what report-contract.json's public_dto
 * actually lists survives.
 */
export function toPublicReportSnapshot(
  row: ReportSnapshotRow,
): PublicReportSnapshotDto {
  return {
    report_id: row.id,
    profile_revision_id: row.profileRevisionId,
    scope_label: "INITIAL_EXPLORATION_NOT_PLACEMENT",
    content_status: row.contentStatus,
    sections: row.publicContent,
    created_at: row.createdAt.toISOString(),
  };
}
