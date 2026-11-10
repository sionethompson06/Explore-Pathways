# Phase 5 — Discovery Report Specification V1

Status: IMPLEMENTED. Authoritative source of truth for the Phase 5 deterministic personalized Discovery Report layer and report UI, built on top of the Phase 4.1 decision engine (`docs/pathways/PHASE4_DECISION_ENGINE_SPEC_V1.md`) without modifying any Phase 4 educational decision. This document does not rewrite Phase 3/4 history; see `docs/pathways/DECISION_LOG.md` sections N-O for that record and section P for this phase's decisions.

## 1. Absolute phase boundary

**PHASE 4 DECIDES. PHASE 5 EXPLAINS, PRESENTS, AND CONVERTS.**

Phase 4 owns: `qualifyingCandidateIds`, `displayedCandidateIds`, `candidatePublicLabels`, `positiveGroupsByModel`, `activatedOverlayIds`/`activatedSupportIds`/`activatedOpportunityIds`, `globalReviewSignals`/`scopedReviewSignals`, `contentStatus`, and every deterministic educational-reasoning fact.

Phase 5 owns: wording, section selection, report archetype, presentation hierarchy, parent-friendly descriptions, support/opportunity presentation ordering, review-signal translation, preliminary-pathway visualization, conversion copy, CTA presentation, responsive design.

Phase 5 may never: rescore a candidate, rerank displayed candidates, replace a displayed candidate, show a candidate Phase 4 did not display as a recommendation, create a third recommendation card, turn cost into educational fit, interpret arbitrary free text as educational evidence, override Phase 4's `contentStatus`, determine eligibility, or determine placement. `src/lib/report/assemble.ts`'s doc comment restates this boundary at the one call site that could violate it.

No Phase 4 contract, rule, scoring policy, taxonomy entry, or engine module changed in this phase. `contracts/rules.json`, `contracts/scoring-policy.json`, `contracts/taxonomy.json`, `contracts/question-bank.json`, and `fixtures/golden-profiles.json` are byte-identical to their Phase 4.1 state (version strings unchanged: `2.0.0-phase4-engine` / `2.1.0-discovery-ux-simplified` / `2.0.0-owner-calibrated`). Only `contracts/report-contract.json` was touched, and only to describe the now-real Phase 5 DTO shape (bumped to `2.0.0-phase5-report`).

## 2. Versioning

| Contract | Version | Status |
|---|---|---|
| `contracts/question-bank.json` | `2.1.0-discovery-ux-simplified` | unchanged |
| `contracts/rules.json` | `2.0.0-phase4-engine` | unchanged (Phase 4.1 FLEX_002 patch intact) |
| `contracts/scoring-policy.json` | `2.0.0-phase4-engine` | unchanged |
| `contracts/taxonomy.json` | `2.0.0-phase4-engine` | unchanged |
| `fixtures/golden-profiles.json` | `2.0.0-owner-calibrated` | unchanged |
| `contracts/report-contract.json` | `2.0.0-phase5-report` | bumped |
| `contracts/report-content.json` | `1.0.0-phase5-report` | new |
| `fixtures/golden-reports.json` | `1.0.0-owner-calibrated` | new |

`contracts/content-library.json` (Phase 0/candidate-era generic base-card content) is untouched and remains available as legacy/base content; it was not repurposed into the Phase 5 report contract.

## 3. Report domain architecture

`src/lib/report/`:

- `types.ts` -- every Phase 5 type: `ReportAssemblyInput`/`ReportAssemblyProfileContext`/`ReportAssemblyOperational` (input), `DiscoveryReportDTO` and its section types (output), `ReportArchetype`, `ContentProvenance`.
- `archetypes.ts` -- `selectReportArchetype(evaluation, costPreference, taxonomy)`: the deterministic, persona-never-keyed archetype precedence (section 6 below).
- `snapshot.ts` -- R01 (Discovery Snapshot) + priority/feasibility chip selection.
- `insights.ts` -- R02 (What We Heard).
- `directions.ts` -- R03 (Directions Worth Exploring): reads `engine.displayedCandidateIds` only, resolves per-archetype candidate-card copy with a generic fallback, derives one candidate-scoped "consideration" line from the highest-priority scoped review signal Phase 4 already attached.
- `support-map.ts` -- R04 (Support & Opportunity Map): tiers already-activated support/overlay/opportunity ids into presentation order only (never changes which ids are active).
- `comparisons.ts` -- R05 (Comparison Guide): archetype-curated question set plus at most one authorized `PROFILE_CONTEXT:cost_preference` question.
- `pathway.ts` -- R06 (Preliminary Pathway), including parallel-branch stages (`parallelGroup`).
- `cta.ts` -- R07 (Conversion) content plus the operationally-safe CTA/action resolver.
- `provenance.ts` -- the shared internal (never rendered) provenance-object helper.
- `assemble.ts` -- `assembleDiscoveryReport(input, contracts, createdAt)`: the single entry point every route calls.
- `index.ts` -- barrel export.

Every function here is pure, deterministic, server-safe (imports `server-only`), has no React import, no database dependency, no network request, no AI, no random prose selection, no current-time-driven wording, and no persona-ID logic. `assemble.ts` is `"use server"`-adjacent (a plain server module) and is called identically by the production route and the DB-free demo route.

## 4. Report input/output contracts

`ReportAssemblyInput` (`src/lib/report/types.ts`) matches the instruction's conceptual shape exactly: `profile` (presentation-safe context only -- no internal sales priority, staff notes, raw session secrets, raw `parent_context`, arbitrary raw Other text, or private metadata), `engine` (the full `EngineEvaluation`), `operational` (`consultationState`, `saveAvailable`).

`DiscoveryReportDTO`: `reportId`, `profileRevisionId`, `scopeLabel: "INITIAL_EXPLORATION_NOT_PLACEMENT"`, `contentStatus`, `reportArchetype`, `studentLabel`, `sections` (`snapshot`/`insight`/`directions`/`supportOpportunityMap`/`comparisonGuide`/`preliminaryPathway`/`conversion`), `actions` (`primary`/`secondary?`/`editAnswers`/`save?`), `provenance` (`reportTemplateVersion`, `reportContentVersion`, `engineVersions`), `createdAt`.

Never present anywhere in the DTO: `internalSortScore`, raw contribution numbers, sales priority, raw parent context, staff notes, auth tokens, API keys, raw prompts, a private hash rendered as visible content. Enforced by `tests/report-structural.test.ts` and `tests/report-invariants.test.ts` (RPT-M05/RPT-M09) across all 15 golden personas, every time the suite runs.

`reportId` is a deterministic opaque id (`sha256(profileRevisionId, effectiveProfileHash, reportContentVersion)`), never used for authorization -- authorization still comes from session/ownership in the production route.

## 5. Displayed-candidate rule (R03)

R03 renders `engine.displayedCandidateIds` only, in that exact order, capped at 2 -- never `qualifyingCandidateIds`, never a third "honorable mention" card. P14's B06 (Public/Private virtual family representative Phase 4 deliberately deduplicated to B03) is proven, by a dedicated regression test (RPT-M02) and the GR14 golden-report test, to never appear anywhere in the assembled report or its rendered HTML, even though it still qualifies internally.

## 6. Archetype selection (deterministic precedence)

Implemented in `src/lib/report/archetypes.ts`. Reads only structured Phase 4 facts (`contentStatus`, `derivedFacts`, activated overlay/opportunity ids, `displayedCandidateIds`) plus the one authorized profile-context field (`costPreference`); never a persona or profile identity. First match wins:

1. `ADVISOR_FIRST_PLACEMENT_REVIEW` -- `contentStatus === "ADVISOR_FIRST"`.
2. `LIMITED_EXPLORATION` -- `contentStatus === "LIMITED_INFORMATION"`.
3. `RECOVERY_PLUS_ADVANCEMENT` -- `O04` active AND at least one of `O02`/`O03`/`OP01`/`OP02`/`OP03`/`OP05` active.
4. `HIGH_DEMAND_SCHEDULE` -- `athletic_schedule_demand` in `{SUBSTANTIAL, HIGHLY_CONSTRAINED}` AND `schedule_flexibility_need` in `{HIGH, VERY_HIGH}`.
5. `FIT_THEN_FEASIBILITY` -- `costPreference === "PREFER_TUITION_FREE"` AND `contentStatus === "PERSONALIZED"` AND at least one displayed candidate's taxonomy family is `VIRTUAL`/`HYBRID`/`FLEXIBLE_SCHOOL`/`HOMESCHOOL`.
6. `FLEXIBLE_WITH_STRUCTURE` -- `support_structure_need === "HIGH"` AND `schedule_flexibility_need` in `{HIGH, VERY_HIGH}` AND a displayed candidate's family is `HYBRID` or `VIRTUAL`.
7. `CURRENT_PLUS_GROWTH` -- `B01` displayed AND (`O02` active OR any `advancement_opportunities` flag true).
8. `GENERIC_PERSONALIZED` -- fallback for remaining `PERSONALIZED` reports.

Verified against all 15 golden personas' real engine output (`tests/report-golden.test.ts`, `tests/report-structural.test.ts`) and proven persona-independent by RPT-M10 (identical structured facts across two different persona ids always select the identical archetype).

## 7. Report content contract (`contracts/report-content.json`, v1.0.0-phase5-report)

Structure: `archetypes` (per-archetype R01/R02/R05/R06/R07 copy, `central_support_ids`/`central_possibility_ids` presentation-priority hints), `candidate_cards` (keyed `${modelId}__${archetype}`, falling back to `${modelId}__GENERIC`), `support_tiles`/`opportunity_tiles`/`overlay_tiles` (one entry per ACTIVE taxonomy id), `review_questions` (one approved public translation per ACTIVE review signal), `pathway_intro_generic`/`subordinate_statement`, `cta_templates`, `conversion_value_concepts`, `inline_conversion_band`, `scope_statement`, `feasibility_context_questions` (the one authorized `cost_preference:PREFER_TUITION_FREE` addition), `priority_chip_labels`/`feasibility_chip_labels`, `forbidden_claims`.

Validated by `validateReportContent` (`src/lib/contracts/validate.ts`, folded into `validateContracts`'s single result): every ACTIVE base model has generic card content; no `B10` public content; every ACTIVE support/opportunity/review-signal has approved content; no RESERVED/RETIRED opportunity is ever configured as public; every required archetype exists and is complete; no forbidden-claim string appears in the approved copy outside `forbidden_claims`'s own self-documentation.

## 8. Support & Opportunity presentation tiering (R04)

`support-map.ts`'s `tierIds` is presentation-ordering-only (section 19/20): archetype-declared "central" ids render first (up to 3, "Support that may matter" / "Possibilities worth exploring"); a single leftover id renders as "Also worth discussing"; two or more leftover ids are dropped rather than guessed at ("do not create an enormous tile wall"). Never changes which ids Phase 4 activated, never adds a tile for an inactive id. ADVISOR_FIRST/LIMITED_INFORMATION render fixed, non-activation-derived clarification/review tiles instead (`r04_special_heading`/`r04_special_tiles`).

## 9. Comparison Guide (R05) and the one authorized profile-context question

`comparisons.ts` starts from the archetype's curated question set (itself owner-approved copy for the 7 golden archetypes) and appends, at most, the one `PROFILE_CONTEXT:cost_preference` question (only when `costPreference === "PREFER_TUITION_FREE"`), capped at 6 total. This is the only report-layer "rule": it can never change a candidate, its order, or its fit label (RPT-M03), and it is not a second rules engine.

## 10. Operational CTA safety

`cta.ts` separates the marketing intent label (archetype-driven: "Build My Student's Pathway" / "Review This With Pathways" / "Help Me Clarify the Right Direction") from the actual destination, resolved from `operational.consultationState`. No live/verified consultation booking service exists in this codebase yet, so the production route always passes `UNCONFIGURED`, and every resolved action routes to the existing, real, informational `/how-it-works` page -- never a fabricated booking/advisor/payment state. `editAnswers` in production uses the real `reopenForEditingAction` server action (unchanged Phase 3 behavior); the demo route (no session to reopen) links straight to `/discover/profile`.

## 11. Routes

- `app/discover/report/page.tsx` (production): guest/authorized session -> `loadLatestCompletedRevision` (new read-only accessor in `src/server/discovery-draft.ts`, alongside the existing `hasCompletedRevision`/`reopenForEditing` -- no second competing data-access path) -> `validateCompletedProfile` -> `loadContracts` -> `evaluateDiscoveryProfile` -> `assembleDiscoveryReport` -> `<ReportView>`. Keeps the DEC-G10 dynamic-import discipline (db/session modules imported inside the function body, never at module scope) and the existing incomplete-profile screen. `robots: { index: false, follow: false }` preserved.
- `app/discover/report/demo/page.tsx` (DB-free synthetic demo, section 39/66): accepts only `?fixture=GR01|GR03|GR06|GR09|GR12|GR14|GR15`; any other value falls back to `GR01`. No database import anywhere in its module graph, no persistence, no localStorage. Loads the named persona's raw answers straight from `fixtures/golden-profiles.json` and runs the identical live pipeline (`validateCompletedProfile` -> `evaluateDiscoveryProfile` -> `assembleDiscoveryReport`) and identical `<ReportView>` component as production -- `fixtures/golden-reports.json` is the expectation source for tests, never a pre-rendered snapshot this route reads. Includes a fixture-selector nav, a visible "Synthetic report demo" label, and `robots: { index: false, follow: false }`.

## 12. Report UI (`src/components/report/`)

`ReportHero`, `PriorityChips`, `InsightSection`, `DirectionCard`, `DirectionGrid`, `SupportOpportunityMap`, `ComparisonGuide`, `PathwayRoadmap`, `ConversionBand` (full R07 + inline post-R03 band), `MobileReportCta` (the only client component; observes scroll position only, never touches report assembly), `ReportView` (the composed page body both routes render). One `<h1>` (the report headline), logical `<h2>`/`<h3>` hierarchy, semantic sections, 44px minimum tap targets, `prefers-reduced-motion` respected on the sticky CTA, visible focus, no hover-only content. Equal-weight model cards (section 15): identical card markup/styling regardless of position, no rank number, no "Top Match" badge, no first-card emphasis -- order is exactly Phase 4's `displayedCandidateIds`.

## 13. Golden Report fixtures and acceptance

`fixtures/golden-reports.json` (v1.0.0-owner-calibrated) references `personaId` into `fixtures/golden-profiles.json` -- it never duplicates the raw Discovery profile. `tests/report-golden.test.ts` runs the real pipeline for GR01/GR03/GR06/GR09/GR12/GR14/GR15 and asserts exact archetype/contentStatus/displayed-candidate-order/R01 headline/R02 headline/card titles/zero-card heading/R06 stage labels/R07 headline/CTA intent label, plus concept-level body-copy spot checks. `tests/report-structural.test.ts` runs the same real pipeline for all 15 personas and asserts the general safety/validity invariants (no B10, no public score, displayed-cards-equal-Phase-4, max 2 cards, no RESERVED/RETIRED tile, determinism, the ~950-word reading-load ceiling, valid provenance). `tests/report-invariants.test.ts` implements RPT-M01 through RPT-M10. `tests/report-forbidden-copy.test.ts` scans the approved content for ranking/urgency/guarantee language.

## 14. Known, documented, non-blocking deviations from the instruction's literal narrative

Two golden fixtures' real, unmodified Phase 4 engine output activates one taxonomy id the instruction's own R04 narrative did not anticipate (P14 activates `S08` College Planning via `college_intent = PROBABLY`; both are genuinely active, not manufactured). Per this phase's absolute rule that Phase 5 must never suppress an id Phase 4 actually activated to force a narrative match, both render as real "also worth discussing" support content rather than being hidden. Priority-chip label wording (e.g. "Flexibility" vs. a fixture's own "Schedule Flexibility") uses one general, persona-independent label table rather than per-fixture text, since chip wording is outside section 62's exact-match list. Neither deviation changes any exact-match field the instruction actually enumerates (archetype, contentStatus, displayed IDs, R01/R02/R06/R07 headlines, card titles, CTA intent label), and both are covered by passing tests.
