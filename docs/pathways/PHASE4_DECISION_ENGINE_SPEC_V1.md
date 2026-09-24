# Phase 4 — Deterministic Pathways Decision Engine (Spec V1)

**Status:** OWNER_CALIBRATED_ACCEPTANCE, implemented. **Not merged to main.**
**Scope boundary:** this phase builds the deterministic Discovery decision
engine only. It does not build the final parent-facing Discovery Report,
Report UI, AI-written summaries or explanations, provider matching, actual
school/provider search, Blueprint, consultation workflow, advisor workflow,
sales/lead scoring, service upsell logic, enrollment workflow, new
questionnaire questions, or questionnaire wording changes. Phase 5 was not
started.

This document is the authoritative reference for Phase 4. It records the
architecture and the owner's exact acceptance criteria; the canonical,
machine-readable source of truth for every rule, score, multiplier and
signal mapping is always the JSON contracts (`contracts/rules.json`,
`contracts/scoring-policy.json`, `contracts/taxonomy.json`), never prose
in this file. See `docs/pathways/DECISION_LOG.md` section N for the
decision-by-decision record and `contracts/CHANGELOG.md` for the exact
diff summary.

## 1. Purpose

The engine answers three questions from a completed Discovery profile:
which educational directions appear worth exploring, what supports or
opportunities matter, and what still needs verification. It always
answers in terms of **generic educational models** (`contracts/taxonomy.json`
`base_models`, B01-B09) — never an exact school, program or provider. That
narrower match is a later Blueprint/provider-analysis phase's job, not
this one's.

## 2. Core engine layers

```
Effective Answers (src/lib/discovery/normalization.ts)
  -> Derived Facts (same module; grade_band, athletics_interest, …,
     support_structure_need, schedule_flexibility_need,
     athletic_schedule_demand, family_management_preference,
     advancement_opportunities)
  -> Rule Evaluation (src/lib/engine/rules.ts + conditions.ts)
  -> Educational Alignment Contributions (raw, unaggregated per rule)
  -> Group Aggregation (src/lib/engine/scoring.ts)
  -> Candidate Qualification (src/lib/engine/candidates.ts)
  -> Practical/Planning Considerations (src/lib/engine/considerations.ts)
  -> Diversity/Deduplication (candidates.ts)
  -> Deterministic Engine Evaluation (src/lib/engine/evaluate.ts)
```

Educational alignment (academic direction, support structure, schedule
needs, delivery preference, family-management preference, in-person
peer-learning preference, continuity preference) and practical
feasibility (cost, state/provider availability, homeschool requirements,
schedule implementation, credit transfer, transcript/graduation review,
NCAA planning, adult support, provider management capability) are kept
architecturally separate: a feasibility signal (`reason_type: "FEASIBILITY"`)
can never carry a `score_effects` value (contract-validated, see section 8
below), and can only reach a candidate through a scoped review signal.

## 3. Base model universe

B01 (current arrangement) through B09 (homeschool + external providers)
are all evaluated normally. **B10 (Future Pathways Mastery Program) is
always excluded** — no rule, score, fallback, zero-result case, ownership
consideration, or sales consideration may make it eligible. This is
enforced at three independent layers: `taxonomy.json`'s
`reachability_status: "EXCLUDED"` + `discovery_enabled: false`, contract
validation's `B10_NOT_EXCLUDED`/`B10_SCORED_BY_RULE` checks, and the
engine's own candidate universe (`src/lib/engine/candidates.ts`
`getCandidateUniverse`), which filters B10 out before any rule ever runs
— not merely after.

## 4. Internal score — never public

Baseline 50. Group aggregation, per candidate and scoring group: keep the
single largest positive raw effect and the single most negative raw
effect from every triggered (non-RETIRED) rule, sum them, apply **one**
group multiplier, clamp to `[-6, +6]`. Total internal score = baseline +
sum of every group's clamped contribution, clamped to `[0, 100]`. This is
never shown publicly — no percentage, no raw score, anywhere in output
consumed outside the engine's own internal explainability fields.
Evaluation is independent of JSON rule array order (proven by metamorphic
test M07).

Ten scoring groups: `schedule`, `delivery`, `family_role`,
`support_structure`, `social`, `academic`, `cost`, `continuity`, `future`,
`context`. The `cost` group is never scored by any rule — contract
validation enforces this (`FEASIBILITY_RULE_HAS_SCORE_EFFECTS`).

## 5. Evidence multipliers

Exactly one multiplier applies per group, the largest applicable: primary
Discovery reason (1.75) > any selected family priority mapped to that
group (1.50, unranked) > `desired_primary_change` mapped to that group
(1.15) > default (1.00). `desired_primary_change`'s multiplier never
satisfies the display gate's link requirement on its own. The exact group
maps live in `contracts/scoring-policy.json`'s `primary_reason_groups`,
`family_priority_groups` and `desired_change_groups` (including
legacy-safe entries for raw values `primary_discovery_reason` can still
carry from before Phase 3F.1's alias/removal passes, since DISC_007 is
not itself alias-normalized).

**Normalization fix required for this system to work at all:** DISC_007
(`primary_discovery_reason`) only renders when 2+ discovery_reasons are
selected; with exactly one, that one reason IS the effective primary
reason with no DISC_007 shown (`src/lib/discovery/branching.ts`
`derivePrimaryReason`). Before this phase, `computeEffectiveAnswers`
computed this resolved value but never wrote it into `effective.answers`,
silently discarding it for every single-reason profile — the exact fact
the multiplier system depends on. Fixed in
`src/lib/discovery/normalization.ts` (see DECISION_LOG.md DEC-N1).

## 6. Display gate

A normal candidate qualifies only when: `discovery_enabled = true`; not
objectively excluded; internal score **strictly greater than 50**; at
least two distinct scoring groups have a final positive contribution; and
at least one of those positive groups links to the primary Discovery
reason or a selected family priority. Baseline alone never qualifies.

**B01's one narrow, general exception:** when a real (non-`NOT_ENROLLED`,
non-`UNKNOWN`/missing) `current_education_model` exists and
`school_change_preference = STAY_CURRENT`, B01 may qualify on internal
score alone (still `> 50`), even with only one positive group. This is
implemented engine-natively (`src/lib/engine/candidates.ts`
`evaluateB01Continuity`), never as a JSON rule, because its
`OPEN_TO_CHANGE` companion case ("no direct model-change signal already
selected") is a negative/"not contains" test the closed `eq`/`in`/
`contains_any` rule-condition operator set cannot express. It is general
— keyed only on `current_education_model`, `school_change_preference`,
`discovery_reasons` and `supplemental_need` — never on a persona or
profile identity.

## 7. Model-family diversity/deduplication

A ceiling of 2 displayed cards, never a quota. Sort qualifying candidates
by internal score descending, ties broken by ascending stable base-model
ID; select the highest, then prefer the highest-scoring candidate from a
**different** model family; a second same-family candidate is allowed
only when both independently qualify and that family is listed in
`scoring-policy.json`'s `diversity.same_family_multi_display_families`
(currently only `HOMESCHOOL`, i.e. B08+B09). Cost is never used to choose
the representative — a stable-ID tie-break is not itself evidence of
superiority.

## 8. Contract/engine safety guarantees

`src/lib/contracts/validate.ts` enforces (with negative-control tests in
`tests/contracts.test.ts`): every rule field/target ID exists; RETIRED
rules are skipped at evaluation time; B10 can never be a score target;
FEASIBILITY rules must have empty `score_effects`; `cost_preference`,
`desired_start_timeline`, `parent_context`, `primary_sport`,
`athletic_level`, and every `*_other_text` sidecar field (discovered from
the question bank's own `other_text_field` declarations, not hardcoded)
can never contribute a score if referenced in a rule condition; RESERVED
opportunities can never become reachable output.

`src/lib/engine/*` itself: pure deterministic business logic, no browser
API, no database dependency to evaluate, no dynamic eval or arbitrary
JavaScript from JSON, typed operators only (`eq`, `in`, `contains_any`),
stably sorted output, no dependence on JSON rule array order or object
insertion order, and production engine code never imports golden-profile
fixtures (only test files do).

## 9. Engine evaluation output

`evaluateDiscoveryProfile(effective, contracts)` → a deterministic,
immutable `EngineEvaluation` (hashes, derived facts, triggered rule IDs,
per-candidate/group contribution provenance, qualifying/displayed
candidate IDs, public fit labels, activated overlay/support/opportunity
IDs, global vs. candidate-scoped review signals, content status, and
every relevant contract version). `createEngineRun(evaluation, metadata)`
wraps it in a persistence-ready envelope with an **injectable** clock/run
ID, so tests stay byte-equivalent-deterministic (M08). Phase 4 does not
persist `EngineRun` to any database — no live Postgres is required to run
or test the engine.

## 10. Golden Profiles V2 and metamorphic tests

`fixtures/golden-profiles.json` (version `2.0.0-owner-calibrated`) holds
the 15 owner-calibrated acceptance personas P01-P15, transcribed verbatim
from the owner's instruction. The prior fixture is preserved unmodified at
`fixtures/golden-profiles.v1-phase0-corrected.json`. `tests/engine-golden.test.ts`
asserts, per persona: the profile validates; effective answers are
correct; hidden (inactive-branch) answers never participate; expected
derived facts match; exact qualifying/displayed candidates and order
match; required signals are present; forbidden candidates are absent;
content status matches; B10 is absent everywhere; no public numeric score
is exposed. `tests/engine-metamorphic.test.ts` implements the 11 invariant
/ contrast tests M01-M11 (cost, athletic-prestige, other-text, timeline,
hidden-answer, UNKNOWN≠NO, rule-order, determinism, and three named
persona-pair contrasts).

## 11. Known, documented fixture conflicts (not weakened, not patched)

Per the owner's own acceptance-test discipline ("fix generalized engine
behavior instead of relaxing expected arrays; if satisfying one profile
directly contradicts another or the literal rule text, STOP and report
the conflict") — three assertions across two personas do not pass under a
strictly faithful, literal implementation of sections 8-27's verbatim
rule tables. Each was investigated by hand-tracing actual engine output
(not guessed), and none has a fix that is both general (non-persona-keyed)
and faithful to the owner's literal numbers:

1. **P04 (elementary homeschool, strong capacity):** B07 (hybrid)
   mechanically qualifies alongside the expected B08/B09. P04 selects
   family priorities FLEXIBILITY (→ `schedule`) and PERSONAL_SUPPORT
   (→ `support_structure`); `schedule_flexibility_need = HIGH` fires
   `SCHED_HIGH_001` (B07 +2) and `support_structure_need = MODERATE`
   fires `SUPPORT_MODERATE_001` (B07 +2) — both verbatim section-13/15
   rules. Both resulting positive groups independently satisfy the
   display-gate's link requirement, so B07 qualifies under a literal
   reading of the gate (section 11) with no rule text left to adjust
   without deviating from the owner's own numbers.
2. **P14 (cost must not change educational alignment):** B04 (charter/
   independent-study) mechanically qualifies alongside the expected
   B03/B06/B07, for the structurally identical reason `SCHED_VERYHIGH_001`
   (schedule, linked via primary reason `SCHEDULE_FLEXIBILITY`) and
   `DELIVERY_001` (delivery, linked via family priority `SELF_PACED`)
   both fire for B04 — the same mechanism the P02 fixture *requires* B04
   to qualify through (P02 and P14 present near-identical evidence shapes
   for B04 with opposite expected outcomes).
3. **P12 (credit recovery + advancement + flexibility):** the displayed
   virtual-family representative is B06, not the expected B03. B06
   legitimately outscores B03 here (58.25 vs 56.75) because
   `unavailable_academic_times` contains `VARIES`, and the pre-existing,
   unmodified `FLEX_002` rule scores B06 one point higher than B03 for
   that value (`B03: 2, B06: 3`) — the same asymmetry that literally
   appears in the owner's own section-15 LOW-tier table
   (`B03 +1, B04 +1, B06 +2`), so "B03/B06 are always educationally
   equivalent" does not hold universally under the literal rules.

All three were reached only after confirming (via real engine runs, not
assumption) that no available rule-level adjustment resolves them without
either contradicting the verbatim owner-supplied numbers elsewhere or
regressing an already-passing persona (documented in full, including two
reverted attempts, in DECISION_LOG.md section N). No fixture expectation
was changed to make these pass, and no persona-ID branch exists anywhere
in `src/lib/engine`.
