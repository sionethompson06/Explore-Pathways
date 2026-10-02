import { z } from "zod";
import type { reportSnapshot } from "@/db/schema";

/**
 * Public-DTO shaping. This is the one place allowed to turn a
 * database row into something a browser receives -- per
 * report-contract.json's forbidden_in_public list and Specification
 * 04 ("Export a separate public DTO; never just hide scores with
 * CSS"). A route handler must call one of these, never send a raw
 * Drizzle row to a response.
 *
 * Phase 1A repair item 4: `publicContent` is untrusted structured
 * input from this DTO's point of view -- nothing in this phase (the
 * Phase 5 report assembler is not built yet) has ever written a real
 * row here, so this validates the *shape a row must have to be
 * servable*, not "what the current writer produces." Every level
 * (top-level sections, each R0x section, every array entry / nested
 * card) is an explicit Zod allowlist built with z.strictObject, so an
 * unrecognized field anywhere in the tree -- e.g. a forbidden_in_public
 * field like internal_sort_score smuggled into a nested card, or an
 * R04 opportunity card carrying an eligibility field the contract
 * explicitly says must not appear -- fails validation structurally,
 * not by a denylist that has to be kept in sync by hand.
 *
 * report-contract.json's public_dto.sections gives literal field
 * names only for R01 and R02; R03-R07 are prose descriptions (Phase 5
 * has not yet fixed their wire shape). The schemas below translate
 * that prose into the narrowest concrete shape it describes, using
 * the contract's own vocabulary for field names. This is a contract-
 * safety floor, not a Phase 5 design decision: when the Phase 5
 * report assembler is built, it must conform to this schema (or this
 * schema must be extended via its own reviewable change alongside
 * that work) -- it must never be loosened just to make a new producer
 * pass.
 */

type ReportSnapshotRow = typeof reportSnapshot.$inferSelect;

export class InvalidReportContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReportContentError";
  }
}

// ---------------------------------------------------------------------------
// R01-R07 nested section schemas.
// ---------------------------------------------------------------------------

const r01Schema = z.strictObject({
  display_name_or_fallback: z.string(),
  approved_headline: z.string(),
  attributed_summary: z.string(),
  actual_priority_chips: z.array(z.string()),
  scope_statement: z.string(),
});

const r02Schema = z.strictObject({
  insight_or_summary: z.string(),
});

/** "0-2 model cards: base_id, friendly label, public_fit_label, fit explanation, visible considerations". */
const modelFitCardSchema = z.strictObject({
  base_id: z.string().min(1),
  friendly_label: z.string().min(1),
  public_fit_label: z.string().min(1),
  fit_explanation: z.string(),
  visible_considerations: z.array(z.string()),
});
const r03Schema = z.array(modelFitCardSchema).max(2);

/**
 * "0-2 interest-grounded opportunities with planning horizon, not
 * eligibility" -- z.strictObject is what makes "not eligibility"
 * enforced: an eligibility field on a card is an unrecognized key and
 * fails validation, it is not merely omitted from a type.
 */
const opportunityCardSchema = z.strictObject({
  opportunity_id: z.string().min(1),
  label: z.string().min(1),
  planning_horizon: z.string().min(1),
});
const r04Schema = z.array(opportunityCardSchema).max(2);

/**
 * "relevant planning questions; material concerns remain visible even
 * beyond nominal count" -- deliberately no .max() here, since the
 * contract requires material concerns to stay visible past whatever
 * the nominal display count is.
 */
const planningQuestionSchema = z.strictObject({
  question: z.string().min(1),
  is_material_concern: z.boolean(),
});
const r05Schema = z.array(planningQuestionSchema);

/** "preliminary composed pathway; no institution or enrollment promise" -- no institution/enrollment field exists in this allowlist to promise with. */
const r06Schema = z.strictObject({
  pathway_summary: z.string().min(1),
  components: z.array(z.string()),
});

/** "CTA from verified service config plus optional save". */
const r07Schema = z.strictObject({
  cta_label: z.string().min(1),
  cta_target: z.string().min(1),
  save_available: z.boolean(),
});

export const publicReportSectionsSchema = z.strictObject({
  R01: r01Schema,
  R02: r02Schema,
  R03: r03Schema,
  R04: r04Schema,
  R05: r05Schema,
  R06: r06Schema,
  R07: r07Schema,
});

export type PublicReportSections = z.infer<typeof publicReportSectionsSchema>;

export interface PublicReportSnapshotDto {
  report_id: string;
  profile_revision_id: string;
  scope_label: "INITIAL_EXPLORATION_NOT_PLACEMENT";
  content_status: ReportSnapshotRow["contentStatus"];
  sections: PublicReportSections;
  created_at: string;
}

/**
 * Strips every internal-only field: engine_run_id (an internal FK),
 * generation_state (report-contract.json places this under
 * internal_record, not public_dto -- whether AI assisted the wording
 * is not the parent's concern), and content_hash (integrity metadata,
 * not a public field). Only what report-contract.json's public_dto
 * actually lists survives.
 *
 * Throws InvalidReportContentError if the stored publicContent does
 * not match the allowed nested shape, rather than ever falling back
 * to serving the raw, unvalidated stored value -- a malformed or
 * tampered row must produce a controlled failure, not a leak.
 */
export function toPublicReportSnapshot(
  row: ReportSnapshotRow,
): PublicReportSnapshotDto {
  const parsed = publicReportSectionsSchema.safeParse(row.publicContent);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new InvalidReportContentError(
      `Report snapshot ${row.id} has publicContent that does not match the ` +
        `allowed public report section shape; refusing to serve it. ${issues}`,
    );
  }

  return {
    report_id: row.id,
    profile_revision_id: row.profileRevisionId,
    scope_label: "INITIAL_EXPLORATION_NOT_PLACEMENT",
    content_status: row.contentStatus,
    sections: parsed.data,
    created_at: row.createdAt.toISOString(),
  };
}
