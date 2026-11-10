import type { LoadedContracts } from "./loader";
import type { Rule } from "./schemas";

/**
 * Referential-integrity validation across the canonical registries.
 * This is deliberately narrow and structural -- it does not evaluate
 * or execute a single rule (that is the Phase 4 recommendation
 * engine, not built yet). It answers one question: "does every ID
 * this file references actually exist somewhere else in the
 * registry," which is exactly what the Phase 1 acceptance criterion
 * "canonical registry validation" and the master prompt's "validate
 * every rule target, signal, content reference and field" require
 * before any engine is built on top of this data.
 */

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  /** Non-fatal observations -- e.g. a documented reachability exception. Never blocks. */
  warnings: ValidationIssue[];
}

function isRetired(rule: Rule): boolean {
  return rule.status === "RETIRED";
}

export function validateContracts(contracts: LoadedContracts): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const { questionBank, taxonomy, rules, legacyAliases } = contracts;

  // --- Duplicate ID checks -------------------------------------------------
  checkNoDuplicates(
    questionBank.questions.map((q) => q.id),
    "DISC",
    errors,
  );
  checkNoDuplicates(
    rules.rules.map((r) => r.id),
    "RULE",
    errors,
  );
  checkNoDuplicates(
    taxonomy.base_models.map((m) => m.id),
    "BASE_MODEL",
    errors,
  );
  checkNoDuplicates(
    taxonomy.overlays.map((o) => o.id),
    "OVERLAY",
    errors,
  );
  checkNoDuplicates(
    taxonomy.supports.map((s) => s.id),
    "SUPPORT",
    errors,
  );
  checkNoDuplicates(
    taxonomy.opportunities.map((o) => o.id),
    "OPPORTUNITY",
    errors,
  );
  checkNoDuplicates(
    taxonomy.review_signals.map((r) => r.id),
    "REVIEW_SIGNAL",
    errors,
  );

  // --- Known field set for rule conditions ---------------------------------
  const knownFields = new Set<string>([
    ...questionBank.questions.map((q) => q.field),
    ...rules.normalized_fact_fields,
  ]);

  // --- Known taxonomy ID sets ----------------------------------------------
  const knownBaseModelIds = new Set(taxonomy.base_models.map((m) => m.id));
  const knownOverlayIds = new Set(taxonomy.overlays.map((o) => o.id));
  const knownSupportIds = new Set(taxonomy.supports.map((s) => s.id));
  const knownOpportunityIds = new Set(
    taxonomy.opportunities.map((o) => o.id),
  );
  const knownReviewIds = new Set(taxonomy.review_signals.map((r) => r.id));

  const evaluableRules = rules.rules.filter((r) => !isRetired(r));
  const retiredRules = rules.rules.filter(isRetired);

  // A retired rule must name a replacement that actually exists.
  for (const rule of retiredRules) {
    if (
      rule.replacement_rule_id &&
      !rules.rules.some((r) => r.id === rule.replacement_rule_id)
    ) {
      errors.push({
        code: "RETIRED_RULE_UNKNOWN_REPLACEMENT",
        message: `Retired rule ${rule.id} names replacement_rule_id "${rule.replacement_rule_id}", which does not exist in rules.json.`,
      });
    }
  }

  // --- Per-rule field and target-ID checks (evaluable rules only) ---------
  for (const rule of evaluableRules) {
    for (const condition of rule.when.all) {
      if (!knownFields.has(condition.field)) {
        errors.push({
          code: "RULE_UNKNOWN_FIELD",
          message: `Rule ${rule.id} references unknown field "${condition.field}" in its "when" condition. It must be a question-bank field or a declared normalized_fact_fields entry.`,
        });
      }
    }

    for (const overlayId of rule.activate.overlays) {
      if (!knownOverlayIds.has(overlayId)) {
        errors.push({
          code: "RULE_UNKNOWN_OVERLAY",
          message: `Rule ${rule.id} activates unknown overlay "${overlayId}".`,
        });
      }
    }
    for (const supportId of rule.activate.supports) {
      if (!knownSupportIds.has(supportId)) {
        errors.push({
          code: "RULE_UNKNOWN_SUPPORT",
          message: `Rule ${rule.id} activates unknown support "${supportId}".`,
        });
      }
    }
    for (const opportunityId of rule.activate.opportunities) {
      if (!knownOpportunityIds.has(opportunityId)) {
        errors.push({
          code: "RULE_UNKNOWN_OPPORTUNITY",
          message: `Rule ${rule.id} activates unknown opportunity "${opportunityId}".`,
        });
      }
    }
    for (const reviewId of rule.activate.reviews) {
      if (!knownReviewIds.has(reviewId)) {
        errors.push({
          code: "RULE_UNKNOWN_REVIEW",
          message: `Rule ${rule.id} activates unknown review signal "${reviewId}".`,
        });
      }
    }
    for (const modelId of Object.keys(rule.score_effects)) {
      if (!knownBaseModelIds.has(modelId)) {
        errors.push({
          code: "RULE_UNKNOWN_SCORE_TARGET",
          message: `Rule ${rule.id} scores unknown base model "${modelId}".`,
        });
      }
    }
    if (rule.review_model_scope) {
      for (const modelId of rule.review_model_scope) {
        if (!knownBaseModelIds.has(modelId)) {
          errors.push({
            code: "RULE_UNKNOWN_REVIEW_SCOPE_TARGET",
            message: `Rule ${rule.id} scopes a review to unknown base model "${modelId}".`,
          });
        }
      }
    }
  }

  // B10 must never be a live scoring/activation target of any evaluable rule.
  const b10 = taxonomy.base_models.find((m) => m.id === "B10");
  if (b10 && b10.reachability_status !== "EXCLUDED") {
    errors.push({
      code: "B10_NOT_EXCLUDED",
      message:
        'Base model B10 (future Pathways Mastery Program) must have reachability_status "EXCLUDED".',
    });
  }
  for (const rule of evaluableRules) {
    if ("B10" in rule.score_effects) {
      errors.push({
        code: "B10_SCORED_BY_RULE",
        message: `Rule ${rule.id} scores B10, which must remain excluded from Discovery V1 regardless of any rule.`,
      });
    }
  }

  // --- Phase 4 engine safety guarantees (section 33) -----------------------
  // FEASIBILITY rules must never contribute an educational score -- cost,
  // location, timeline and similar practical-feasibility signals reach a
  // candidate only through a scoped review/consideration, never a score
  // effect (DEC-H2/DEC-N).
  for (const rule of evaluableRules) {
    if (rule.reason_type === "FEASIBILITY" && Object.keys(rule.score_effects).length > 0) {
      errors.push({
        code: "FEASIBILITY_RULE_HAS_SCORE_EFFECTS",
        message: `Rule ${rule.id} is reason_type FEASIBILITY but has non-empty score_effects. Feasibility rules must never contribute an educational score.`,
      });
    }
  }

  // Operational/practical fields that can never contribute score, however
  // they are used in a rule's condition (PHASE4_DECISION_ENGINE_SPEC_V1.md
  // section 33). *_other_text fields are discovered from the question
  // bank's own other_text_field declarations, not hardcoded by name.
  const scoreForbiddenFields = new Set<string>([
    "cost_preference",
    "desired_start_timeline",
    "parent_context",
    "primary_sport",
    "athletic_level",
    ...questionBank.questions
      .map((q) => q.other_text_field)
      .filter((field): field is string => typeof field === "string"),
  ]);
  for (const rule of evaluableRules) {
    const referencesForbiddenField = rule.when.all.some((condition) =>
      scoreForbiddenFields.has(condition.field),
    );
    if (referencesForbiddenField && Object.keys(rule.score_effects).length > 0) {
      const forbiddenFieldsUsed = rule.when.all
        .map((c) => c.field)
        .filter((field) => scoreForbiddenFields.has(field));
      errors.push({
        code: "OPERATIONAL_FIELD_CONTRIBUTES_SCORE",
        message: `Rule ${rule.id} conditions on operational/practical field(s) [${forbiddenFieldsUsed.join(", ")}] (never allowed to contribute an educational score) but has non-empty score_effects.`,
      });
    }
  }

  // --- Legacy alias targets must resolve to real canonical IDs ------------
  const allKnownCanonicalIds = new Set<string>([
    ...knownBaseModelIds,
    ...knownOverlayIds,
    ...knownSupportIds,
    ...knownOpportunityIds,
    ...knownReviewIds,
  ]);
  for (const [alias, target] of Object.entries(legacyAliases.aliases)) {
    if (!allKnownCanonicalIds.has(target)) {
      errors.push({
        code: "LEGACY_ALIAS_UNKNOWN_TARGET",
        message: `Legacy alias "${alias}" points to unknown canonical ID "${target}".`,
      });
    }
  }

  // --- Advisory reachability cross-check (never fails validation) ---------
  const touchedOverlays = new Set<string>();
  const touchedSupports = new Set<string>();
  const touchedOpportunities = new Set<string>();
  const touchedReviews = new Set<string>();
  for (const rule of evaluableRules) {
    rule.activate.overlays.forEach((id) => touchedOverlays.add(id));
    rule.activate.supports.forEach((id) => touchedSupports.add(id));
    rule.activate.opportunities.forEach((id) => touchedOpportunities.add(id));
    rule.activate.reviews.forEach((id) => touchedReviews.add(id));
  }
  for (const overlay of taxonomy.overlays) {
    if (overlay.reachability_status === "ACTIVE" && !touchedOverlays.has(overlay.id)) {
      warnings.push({
        code: "ACTIVE_OVERLAY_UNREACHED",
        message: `Overlay ${overlay.id} is marked ACTIVE but no evaluable rule currently activates it.`,
      });
    }
  }
  for (const support of taxonomy.supports) {
    if (support.reachability_status === "ACTIVE" && !touchedSupports.has(support.id)) {
      warnings.push({
        code: "ACTIVE_SUPPORT_UNREACHED",
        message: `Support ${support.id} is marked ACTIVE but no evaluable rule currently activates it.`,
      });
    }
  }
  for (const opportunity of taxonomy.opportunities) {
    if (
      opportunity.reachability_status === "ACTIVE" &&
      !touchedOpportunities.has(opportunity.id)
    ) {
      warnings.push({
        code: "ACTIVE_OPPORTUNITY_UNREACHED",
        message: `Opportunity ${opportunity.id} is marked ACTIVE but no evaluable rule currently activates it.`,
      });
    }
    if (
      opportunity.reachability_status === "RESERVED" &&
      touchedOpportunities.has(opportunity.id)
    ) {
      errors.push({
        code: "RESERVED_OPPORTUNITY_REACHABLE",
        message: `Opportunity ${opportunity.id} is marked RESERVED but an evaluable rule activates it -- it must never be a personalized result in Discovery V1.`,
      });
    }
  }
  for (const review of taxonomy.review_signals) {
    if (review.reachability_status === "ACTIVE" && !touchedReviews.has(review.id)) {
      // REV_STATE_AVAILABILITY is attached engine-natively (any qualifying
      // candidate in scoring-policy.json's material_review_mapping scope
      // -- src/lib/engine/considerations.ts), not by a rules.json rule --
      // an expected, named exception, not a defect. See scoring-policy.json's
      // state_availability_policy field for the full rationale.
      if (review.id !== "REV_STATE_AVAILABILITY") {
        warnings.push({
          code: "ACTIVE_REVIEW_UNREACHED",
          message: `Review signal ${review.id} is marked ACTIVE but no evaluable rule currently activates it.`,
        });
      }
    }
  }

  const reportContentIssues = validateReportContent(contracts);
  errors.push(...reportContentIssues.errors);
  warnings.push(...reportContentIssues.warnings);

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Phase 5 report-content validation (PHASE5_DISCOVERY_REPORT_SPEC_V1.md
 * section 33): every ACTIVE base model/support/opportunity/review
 * signal Phase 4 can actually activate must have approved public
 * report copy (or, for a RESERVED/RETIRED/EXCLUDED id, must never
 * have any), every archetype must be complete, and no forbidden claim
 * string may appear anywhere in the approved content. This never
 * evaluates a rule or re-derives an educational decision -- purely a
 * referential-integrity and copy-safety check over contracts/report-content.json.
 */
function validateReportContent(contracts: LoadedContracts): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { taxonomy, reportContent } = contracts;

  const REQUIRED_ARCHETYPES = [
    "CURRENT_PLUS_GROWTH",
    "FLEXIBLE_WITH_STRUCTURE",
    "HIGH_DEMAND_SCHEDULE",
    "ADVISOR_FIRST_PLACEMENT_REVIEW",
    "RECOVERY_PLUS_ADVANCEMENT",
    "FIT_THEN_FEASIBILITY",
    "LIMITED_EXPLORATION",
    "GENERIC_PERSONALIZED",
  ];
  for (const archetype of REQUIRED_ARCHETYPES) {
    const entry = reportContent.archetypes[archetype] as Record<string, unknown> | undefined;
    if (!entry) {
      errors.push({ code: "REPORT_ARCHETYPE_MISSING", message: `Report content is missing archetype "${archetype}".` });
      continue;
    }
    for (const requiredField of ["r01_headline", "r02_headline", "r06_stages", "r07_headline", "cta_intent_label"]) {
      if (!(requiredField in entry)) {
        errors.push({
          code: "REPORT_ARCHETYPE_INCOMPLETE",
          message: `Archetype "${archetype}" is missing required field "${requiredField}".`,
        });
      }
    }
  }

  const activeBaseModelIds = taxonomy.base_models.filter((m) => m.reachability_status === "ACTIVE").map((m) => m.id);
  for (const modelId of activeBaseModelIds) {
    if (!(`${modelId}__GENERIC` in reportContent.candidate_cards)) {
      errors.push({
        code: "REPORT_CANDIDATE_CARD_MISSING",
        message: `Base model ${modelId} is ACTIVE but report-content.json has no "${modelId}__GENERIC" candidate card.`,
      });
    }
  }
  for (const key of Object.keys(reportContent.candidate_cards)) {
    const modelId = key.split("__")[0]!;
    if (modelId === "B10") {
      errors.push({ code: "REPORT_B10_PUBLIC_CONTENT", message: `report-content.json candidate_cards must never contain B10 content (key "${key}").` });
    }
    const model = taxonomy.base_models.find((m) => m.id === modelId);
    if (!model) {
      errors.push({ code: "REPORT_UNKNOWN_CANDIDATE_CARD_MODEL", message: `Candidate card "${key}" references unknown base model "${modelId}".` });
    }
  }

  const activeSupportIds = new Set(taxonomy.supports.filter((s) => s.reachability_status === "ACTIVE").map((s) => s.id));
  for (const supportId of activeSupportIds) {
    if (!(supportId in reportContent.support_tiles)) {
      errors.push({ code: "REPORT_SUPPORT_TILE_MISSING", message: `Support ${supportId} is ACTIVE but report-content.json has no support tile for it.` });
    }
  }

  const activeOpportunityIds = new Set(
    taxonomy.opportunities.filter((o) => o.reachability_status === "ACTIVE").map((o) => o.id),
  );
  const nonPublicOpportunityIds = new Set(
    taxonomy.opportunities.filter((o) => o.reachability_status !== "ACTIVE").map((o) => o.id),
  );
  for (const opportunityId of activeOpportunityIds) {
    if (!(opportunityId in reportContent.opportunity_tiles)) {
      errors.push({ code: "REPORT_OPPORTUNITY_TILE_MISSING", message: `Opportunity ${opportunityId} is ACTIVE but report-content.json has no opportunity tile for it.` });
    }
  }
  for (const opportunityId of Object.keys(reportContent.opportunity_tiles)) {
    if (nonPublicOpportunityIds.has(opportunityId)) {
      errors.push({
        code: "REPORT_RESERVED_OPPORTUNITY_PUBLIC",
        message: `Opportunity ${opportunityId} is not ACTIVE (RESERVED/RETIRED) and must never have public report-content tile.`,
      });
    }
  }

  const activeReviewIds = taxonomy.review_signals.filter((r) => r.reachability_status === "ACTIVE").map((r) => r.id);
  for (const reviewId of activeReviewIds) {
    if (!(reviewId in reportContent.review_questions)) {
      errors.push({ code: "REPORT_REVIEW_QUESTION_MISSING", message: `Review signal ${reviewId} is ACTIVE but report-content.json has no approved public translation for it.` });
    }
  }

  // No forbidden claim string may appear anywhere in the approved copy.
  const haystack = JSON.stringify(reportContent).toLowerCase();
  for (const claim of reportContent.forbidden_claims) {
    // The forbidden_claims array itself legitimately contains these strings --
    // check occurrence count exceeds the one expected self-reference.
    const needle = claim.toLowerCase();
    const occurrences = haystack.split(needle).length - 1;
    if (occurrences > 1) {
      errors.push({ code: "REPORT_FORBIDDEN_CLAIM_PRESENT", message: `Forbidden claim "${claim}" appears in approved report content outside of the forbidden_claims list itself.` });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function checkNoDuplicates(
  ids: string[],
  label: string,
  errors: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push({
        code: "DUPLICATE_ID",
        message: `Duplicate ${label} id "${id}".`,
      });
    }
    seen.add(id);
  }
}
