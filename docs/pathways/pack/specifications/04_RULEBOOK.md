# Specification 04 - Deterministic Recommendation Rules, normalized
The executable input contract is contracts/rules.json plus scoring-policy.json and the taxonomy. All 52 candidate rules are pilot heuristics, not empirically validated placement criteria. They are proposed engineering normalization of the narrative rulebook; changes are explicit in Specification 06.

## Evaluation sequence
Validate input and branch -> derive documented normalized facts -> select enabled models -> evaluate declarative rules -> deduplicate signals and reason IDs -> aggregate dimension contributions -> add candidate-specific review items -> apply evidence-based display gate -> apply diversity -> assemble parent-safe result.

Educational rules do not read email, name, lead status, timeline, source/channel, referral payments, household income or sales propensity. Unknown values never satisfy a positive condition. All comparisons are typed; an input cannot add a new rule or operator.

## Scoring
Start at 50 only for internal sorting. For each candidate and group, select the largest positive effect and the most negative effect; sum them, apply the single largest applicable priority multiplier and clamp to [-6,+6]. Sum group values with 50, then clamp total to [0,100]. Use full numeric precision for ordering and stable base-model ID as the tie-breaker. Do not round for ranking.

Use 1.75 primary-goal, 1.5 top-priority, 1.15 secondary-goal, otherwise 1.0. Never multiply multipliers. Only the explicit mappings in scoring-policy.json apply. Unmapped priorities remain report/advisor context, not imaginary school-quality proxies.

This replaces uncapped repeated +3 contributions and draft threshold labels. A number alone never enables a card. Display requires at least two distinct positive scored groups and linkage to stated priorities where known. Correlated statements in one group count once. No fixed minimum score substitutes for evidence. No universal '80 means strong fit' claim.

## Interpretation
An eligible candidate with a relevant material review gets WITH_CONSIDERATIONS. A high internal score cannot erase unresolved support, schedule or cost questions. Basic state/provider verification applies to all potential programs; it is not evidence that one is definitely available.

Generic online models should not be rejected just because some implementations are asynchronous. Use support-review signals rather than unverified blanket incapability. K-4 support needs are normal developmental context; do not infer a clinical problem.

If no candidate clears the evidence gate, return a useful limited-information report. No automatic Pathways-school fallback. Current-school support can be a valid direction if the family prefers to stay and has an independently stated support/advancement goal.

## Opportunity safeguards
Reported AHEAD is interest in readiness review, not readiness itself. College interest alone does not activate AP or dual enrollment. Missing credits require YES/POSSIBLY, not a general concern about graduation. High-school transfer review applies grades 9-12 when school change is actually considered. Reclassification only creates review, never encouragement or eligibility conclusions.

Grade-specific display filters run after signals are collected: K-4 gets foundational/enrichment language and no NCAA/credit/college pressure; middle-school college opportunities are future planning. Foreign/unknown state gets general information with no claimed local availability.

## Explainability and testability
Retain matched rule IDs, effective input IDs, reason templates, contributions, contradictions and version IDs in an internal audit record. Export a separate public DTO; never just hide scores with CSS. Use a versioned content library with approved material qualifications.

Advisor correction is a separate attributed assessment with reason and timestamp. It does not silently rewrite the old rule output. Version history is retained only for the approved retention period and remains deletable under the application's policy.

## Independent lead workflow
Timeline maps to READY_NOW (ASAP/30 days), PLANNING (semester/year), EXPLORING (exploring), UNKNOWN. Do not calculate a family worth score. A consultation request updates workflow but not educational ranking or emotional intensity.

## Review scope and logical applicability
A rule with review_model_scope attaches its concern only to those candidate IDs. Do not label every pathway with a homeschool-management conflict. A rule without scope emits a global planning item, unless the postprocess policy explicitly targets a candidate. Deduplicate reviews after scoping. Positive and negative reasons remain separately traceable.
B01 is not applicable when current_education_model = NOT_ENROLLED. A simultaneous STAY_CURRENT answer receives neutral context review, not an invented current school. This is logical applicability, not a determination of admission eligibility.
For elementary output, map OP01 generic advanced-course interest to OP18 foundational challenge/enrichment and suppress OP02-OP09; do not assume a young student is eligible for high-school or college programs. Retain only age-appropriate interpretations of OP10-OP18.

---

## Provenance note (added at Phase 0 corrections, this repository)

This file is preserved verbatim from the originally supplied pack. Owner-authorized corrections to `contracts/rules.json` (new rule mapping RESEARCH -> OP06; new signal-only rule for S08 college planning; retirement of HOME_003 in favor of PAR_002; explicit trigger wiring for REV_AGE_GRADE_CONTEXT and REV_SERVICE_AVAILABILITY) are recorded in `contracts/CHANGELOG.md` and `docs/pathways/DECISION_LOG.md` DEC-C2, C4, C5, C6. These are data-contract corrections, not an early implementation of the Phase 4 recommendation engine itself.
