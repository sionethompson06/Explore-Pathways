import { z } from "zod";

/**
 * Typed schemas for the canonical registries in contracts/. These
 * mirror the JSON shape exactly (Specification 02-05, 07 in
 * docs/pathways/pack/specifications/) -- they do not add, rename, or
 * reinterpret a field. Parsing through these schemas is what
 * "convert JSON contracts to validated typed inputs; no runtime eval
 * or arbitrary rule execution" (Phase 1 acceptance criterion) means
 * in this codebase: nothing downstream reads the raw JSON directly.
 */

const reachabilityStatusSchema = z.enum([
  "ACTIVE",
  "RESERVED",
  "RETIRED",
  "EXCLUDED",
  "BASELINE",
  "OPERATIONAL_LAYER",
]);

// ---------------------------------------------------------------------------
// question-bank.json
// ---------------------------------------------------------------------------

const questionInputTypeSchema = z.enum([
  "short_text",
  "single",
  "multi",
  "integer_or_unknown",
  "location",
  "single_from_previous",
]);

const gradeBandKeySchema = z.enum(["ELEMENTARY", "MIDDLE", "HIGH_SCHOOL", "UNDETERMINED"]);

const questionSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  parent_wording: z.string().min(1),
  input_type: questionInputTypeSchema,
  show_when: z.string().min(1),
  required_when_shown: z.boolean(),
  matching_use: z.string().min(1),
  allowed_values: z.array(z.string()).optional(),
  max_selections: z.number().int().positive().optional(),
  display_labels: z.record(z.string(), z.string()).optional(),
  /** Phase 3E: a short, reassuring line shown under the question wording, before its options. Never a second source of truth for a value -- presentation only. */
  helper_text: z.string().min(1).optional(),
  /** Phase 3E: per-option clarifying text (e.g. DISC_031's STAY_CURRENT/OPEN_TO_CHANGE/SEEKING_CHANGE). Keyed by allowed_value. */
  option_helpers: z.record(z.string(), z.string()).optional(),
  /**
   * Phase 3E: when present, the NEW-entry option set actually rendered
   * to a family is `grade_band_allowed_values[gradeBand]` instead of
   * the full `allowed_values` list -- `allowed_values` still lists
   * every value (including legacy/retired ones) so historical raw
   * answers keep validating. Absent for every question that renders
   * the same options regardless of grade band.
   */
  grade_band_allowed_values: z.record(gradeBandKeySchema, z.array(z.string())).optional(),
  /**
   * Phase 3F: the sidecar field name for this question's inline "Other"
   * free-text elaboration (e.g. "discovery_reasons_other_text"), typed
   * and associated directly with its parent question rather than
   * existing as a 40th+ canonical question. Present only on the small
   * set of multi-select questions broad enough that a fixed list can't
   * reasonably cover every family (DISC_006/010/014/022/026). Context
   * only -- never read by any derived fact or future scoring input.
   */
  other_text_field: z.string().min(1).optional(),
});

export const questionBankSchema = z.object({
  version: z.string().min(1),
  status: z.string().min(1),
  corrections_applied: z.string().optional(),
  questions: z.array(questionSchema).min(1),
  global_rules: z.array(z.string()),
});

export type QuestionBank = z.infer<typeof questionBankSchema>;
export type Question = z.infer<typeof questionSchema>;

// ---------------------------------------------------------------------------
// taxonomy.json
// ---------------------------------------------------------------------------

const baseModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  family: z.string().min(1),
  discovery_enabled: z.boolean(),
  status: z.string().min(1),
  reachability_status: reachabilityStatusSchema,
  excluded_note: z.string().optional(),
});

const overlaySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  reachability_status: reachabilityStatusSchema,
});

const supportSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  default_status: z.string().min(1),
  reachability_status: reachabilityStatusSchema,
  reachability_note: z.string().optional(),
});

const opportunitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  default_status: z.string().min(1),
  reachability_status: reachabilityStatusSchema,
  reachability_note: z.string().optional(),
});

const reviewSignalEntrySchema = z.object({
  id: z.string().min(1),
  reachability_status: reachabilityStatusSchema,
  reachability_note: z.string().optional(),
});

export const taxonomySchema = z.object({
  version: z.string().min(1),
  status: z.string().min(1),
  corrections_applied: z.string().optional(),
  base_models: z.array(baseModelSchema).min(1),
  overlays: z.array(overlaySchema),
  supports: z.array(supportSchema),
  opportunities: z.array(opportunitySchema),
  review_signals: z.array(reviewSignalEntrySchema),
  constraints: z.array(z.string()),
});

export type Taxonomy = z.infer<typeof taxonomySchema>;
export type BaseModel = z.infer<typeof baseModelSchema>;

// ---------------------------------------------------------------------------
// rules.json
// ---------------------------------------------------------------------------

const ruleConditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["eq", "in", "contains_any"]),
  value: z.union([z.string(), z.boolean(), z.array(z.string())]),
});

const ruleActivateSchema = z.object({
  overlays: z.array(z.string()),
  supports: z.array(z.string()),
  opportunities: z.array(z.string()),
  reviews: z.array(z.string()),
});

const ruleSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  group: z.string().min(1),
  when: z.object({
    all: z.array(ruleConditionSchema).min(1),
  }),
  score_effects: z.record(z.string(), z.number()),
  activate: ruleActivateSchema,
  reason_template: z.string().min(1),
  /**
   * FEASIBILITY added at Phase 3E (see docs/pathways/DECISION_LOG.md
   * DEC-H2): a rule whose condition is about whether a direction can
   * practically work (cost, location, provider availability) rather
   * than whether it fits the student educationally. Keeps EDUCATIONAL
   * ALIGNMENT and PRACTICAL FEASIBILITY from being collapsed into one
   * undifferentiated "score" once a Phase 4 evaluator exists.
   */
  reason_type: z.enum(["ALIGNMENT", "CONSIDERATION", "FEASIBILITY"]),
  status: z.string().min(1),
  review_model_scope: z.array(z.string()).optional(),
  dedup_key: z.string().optional(),
  added_at: z.string().optional(),
  added_reason: z.string().optional(),
  retired_at: z.string().optional(),
  retired_reason: z.string().optional(),
  replacement_rule_id: z.string().optional(),
});

export const rulesFileSchema = z.object({
  version: z.string().min(1),
  status: z.string().min(1),
  corrections_applied: z.string().optional(),
  normalized_fact_fields: z.array(z.string()),
  rules: z.array(ruleSchema).min(1),
  review_signal_notes: z.record(z.string(), z.string()).optional(),
});

export type RulesFile = z.infer<typeof rulesFileSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type RuleCondition = z.infer<typeof ruleConditionSchema>;

// ---------------------------------------------------------------------------
// scoring-policy.json
// ---------------------------------------------------------------------------

const scoringPolicyDisplayGateSchema = z.object({
  min_internal_score_exclusive: z.number(),
  min_positive_groups: z.number().int().nonnegative(),
  require_link_to_primary_or_priority: z.boolean(),
  b01_stay_current_exception: z.boolean(),
});

const scoringPolicyDiversitySchema = z.object({
  max_displayed_cards: z.number().int().positive(),
  same_family_multi_display_families: z.array(z.string()),
  description: z.string(),
});

export const scoringPolicySchema = z.object({
  version: z.string().min(1),
  status: z.string().min(1),
  corrections_applied: z.string().optional(),
  baseline: z.number(),
  score_bounds: z.object({ min: z.number(), max: z.number() }),
  group_bounds: z.object({ min: z.number(), max: z.number() }),
  multipliers: z.object({
    primary_reason: z.number(),
    family_priority: z.number(),
    desired_change: z.number(),
    default: z.number(),
  }),
  primary_multiplier: z.number(),
  top_priority_multiplier: z.number(),
  secondary_multiplier: z.number(),
  default_multiplier: z.number(),
  multiplier_policy: z.string(),
  group_aggregation: z.string(),
  display_gate: scoringPolicyDisplayGateSchema,
  display_gate_description: z.string(),
  max_displayed_cards: z.number().int().positive(),
  tie_break: z.string().min(1),
  public_labels: z.array(z.string()).min(1),
  content_status_values: z.array(z.string()).min(1),
  sorting: z.string(),
  diversity: scoringPolicyDiversitySchema,
  groups: z.array(z.string()).min(1),
  primary_reason_groups: z.record(z.string(), z.array(z.string())),
  family_priority_groups: z.record(z.string(), z.array(z.string())),
  desired_change_groups: z.record(z.string(), z.array(z.string())),
  legacy_safe_mappings_note: z.string(),
  unmapped_priority_behavior: z.string(),
  material_review_mapping: z.record(z.string(), z.array(z.string())),
  global_review_signals_never_scope_a_candidate: z.array(z.string()),
  state_availability_policy: z.string(),
  postprocess_rules: z.array(z.string()),
});

export type ScoringPolicy = z.infer<typeof scoringPolicySchema>;

// ---------------------------------------------------------------------------
// report-contract.json
// ---------------------------------------------------------------------------

export const reportContractSchema = z.object({
  version: z.string().min(1),
  public_dto: z.record(z.string(), z.unknown()),
  internal_record: z.record(z.string(), z.unknown()),
  forbidden_in_public: z.array(z.string()).min(1),
  llm_output_schema: z.record(z.string(), z.unknown()),
  llm_validation_note: z.string(),
});

export type ReportContract = z.infer<typeof reportContractSchema>;

// ---------------------------------------------------------------------------
// legacy-aliases.json
// ---------------------------------------------------------------------------

export const legacyAliasesSchema = z.object({
  version: z.string().min(1),
  policy: z.string(),
  aliases: z.record(z.string(), z.string()),
  retired_ambiguous_ids: z.array(z.string()),
  /**
   * Phase 3E: field-scoped ANSWER VALUE aliases (distinct from the
   * taxonomy-ID `aliases` map above). Applied only when computing
   * EFFECTIVE answers (src/lib/discovery/normalization.ts) -- never to
   * stored raw answers, and never to the Review screen's own display
   * of what a family actually selected historically.
   */
  question_value_aliases: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  /** Phase 3E: legacy values that carry no forward-compatible replacement and are simply dropped from EFFECTIVE evaluation (kept, unmodified, in raw storage and Review). */
  question_value_removals: z.record(z.string(), z.array(z.string())).optional(),
});

export type LegacyAliases = z.infer<typeof legacyAliasesSchema>;

// ---------------------------------------------------------------------------
// content-library.json
// ---------------------------------------------------------------------------

const baseCardSchema = z.object({
  id: z.string().min(1),
  base_model_id: z.string().min(1),
  title: z.string().min(1),
  description_template: z.string().min(1),
  review_template: z.string().min(1),
  status: z.string().min(1),
});

export const contentLibrarySchema = z.object({
  version: z.string().min(1),
  base_cards: z.array(baseCardSchema).min(1),
  scope_statement: z.string().min(1),
  cta_templates: z.record(z.string(), z.string()),
  report_intro_fallback: z.string().min(1),
  limited_information_template: z.string().min(1),
  forbidden_claims: z.array(z.string()),
});

export type ContentLibrary = z.infer<typeof contentLibrarySchema>;
