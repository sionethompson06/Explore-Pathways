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
      // REV_COST_ALIGNMENT is documented as postprocess-triggered, not
      // rule-triggered -- an expected, named exception, not a defect.
      if (review.id !== "REV_COST_ALIGNMENT") {
        warnings.push({
          code: "ACTIVE_REVIEW_UNREACHED",
          message: `Review signal ${review.id} is marked ACTIVE but no evaluable rule currently activates it.`,
        });
      }
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
