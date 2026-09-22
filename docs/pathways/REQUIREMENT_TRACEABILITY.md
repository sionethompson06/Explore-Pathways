# Pathways Discovery App — Requirement Traceability

Version: 0.3.0-phase1a-repair
Supersedes the 0.1.0-phase0-candidate version of this document. This revision regenerates every count directly from the corrected source JSON in `contracts/` and `fixtures/` (verified by the scripts shown inline, not retyped by hand), corrects two counting errors the owner identified in the prior revision, and adds the requested Total/Active/Reserved/Retired/Excluded/Missing-input breakdown.

**Corrections to the prior revision, as identified by the owner:**
1. The "academic" scoring group was previously labeled 12 rules with 13 IDs listed; the actual, script-verified count in the original 52-rule set was **14** (the list omitted `LEARN_003`, which belongs to this group). Post-Phase-0-corrections it is still 14 (no academic-group rule was added or retired).
2. The "future" scoring group was previously labeled 11 rules with 9 IDs listed; the actual, script-verified count in the original 52-rule set was **9** (the "11" label was simply arithmetic error against a correctly-listed 9 IDs). Post-Phase-0-corrections it is **11** — this is a real change, from the two new rules `ADV_007` and `ADV_008` added to this group, not a residual counting error.
3. "10/10 base models reachable" was self-contradictory, since `B10` is deliberately unreachable by design. Corrected below to 9 `ACTIVE` + 1 `EXCLUDED` (10 total registered).

## 1. Master-prompt nonnegotiable behaviors

(Unchanged from the prior revision — no owner correction affected this section.)

| # | Requirement | Owning module | Phase | Test reference | Status |
|---|---|---|---|---|---|
| N1 | Determinism: same effective answers/versions -> same recommendation; sales/lead fields never causal | recommendation engine | Phase 4 | `fixtures/golden-profiles.json` metamorphic tests 1-3; QA_MATRIX "Unit and contract" | DOCUMENTED |
| N2 | Canonical registries; pathway = base model + overlays + supports + opportunities + reviews; service ≠ school | taxonomy, engine | Phase 4 | `contracts/taxonomy.json` constraints; QA_MATRIX "Unit and contract" | DOCUMENTED |
| N3 | ≥2 independent scored groups required to display a candidate; unknown ≠ no; 0/1 cards valid; no public percentages | scoring policy, report assembler | Phase 4, 5 | `contracts/scoring-policy.json` display_gate; fixtures FX08, FX15-FX17 (0/minimal cards), FX07 (1 qualifies) | DOCUMENTED |
| N4 | K-4 developmental lens; no credit/NCAA/college pressure; no inferred readiness/supervision/eligibility | rules (ELEM_*), postprocess, report | Phase 4, 5 | fixtures FX01, FX02, FX11; postprocess_rules K-4 remap | DOCUMENTED |
| N5 | No mandatory email/account wall; save optional+verified; delivery vs. marketing consent separate; no mandatory phone | discovery flow, saving | Phase 3, 6 | Spec 02 "Contact is not part of the education questionnaire"; Spec 06 §2 | DOCUMENTED |
| N6 | Report tone: recognition/insight/directions/opportunities/questions/sketch/CTA; no fear/guilt/scarcity/fabrication | report assembler, content library | Phase 5 | `contracts/content-library.json` forbidden_claims; QA_MATRIX "Report and content" | DOCUMENTED |
| N7 | Template-complete first; AI limited to R01/R02; never chooses pathways/providers/conclusions | report assembler, AI adapter | Phase 5, 8 | Spec 05 "AI boundary"; Phase 8 acceptance criteria | DOCUMENTED |
| N8 | Record-level authorization from first persistence layer; cross-parent/advisor isolation; no internal scores in public DTO | data-access layer | Phase 1, 6, 7 | `contracts/report-contract.json` forbidden_in_public; QA_MATRIX "Integration" | DOCUMENTED |
| N9 | No real email/booking/AI/child-data/production until gates pass; honest unavailable states | integration adapters | Phase 1, 6, 8, 9 | Spec 07 "Adapters"; `INTEGRATION_REGISTER.md` | DOCUMENTED |
| N10 | Every phase ships tests + traceability + real evidence; compile success ≠ acceptance | all | All | this document; per-phase "End-of-phase evidence" sections | DOCUMENTED |

## 2. Discovery question registry — full enumeration (39/39 traced)

38 questions carried unchanged from the original pack, plus `DISC_020A` added at Phase 0 corrections (DEC-C1). Counts verified by:
```
python3 -c "import json; d=json.load(open('contracts/question-bank.json')); print(len(d['questions']))"
```
which returns 39.

| ID | Field | Show-when | Required-when-shown | Status |
|---|---|---|---|---|
| DISC_001 | student_display_name | ALL | No | unchanged |
| DISC_002 | current_grade | ALL | Yes | unchanged |
| DISC_003 | student_age | ALL | No | unchanged |
| DISC_004 | residence (state, optional ZIP) | ALL | Yes | unchanged |
| DISC_005 | current_education_model | ALL | Yes | unchanged |
| DISC_006 | discovery_reasons | ALL | Yes | unchanged |
| DISC_007 | primary_discovery_reason | MULTIPLE_DISCOVERY_REASONS | Yes (when shown) | unchanged |
| DISC_008 | desired_primary_change | PRIMARY_REASON_UNCLEAR | No | unchanged |
| DISC_009 | reported_academic_position | ALL | Yes | unchanged |
| DISC_010 | reported_support_needs | ALL | No | unchanged |
| DISC_011 | learning_support_pattern | ALL | Yes | unchanged |
| DISC_012 | preferred_learning_environment | ALL | No | unchanged |
| DISC_013 | flexibility_importance | ALL | Yes | unchanged |
| DISC_014 | flexibility_reasons | FLEXIBILITY_SOMEWHAT_OR_HIGHER | No | unchanged |
| DISC_015 | preferred_academic_time | FLEXIBILITY_SOMEWHAT_OR_HIGHER | No | unchanged |
| DISC_016 | primary_sport | ATHLETICS_INTEREST | No | unchanged |
| DISC_017 | athletic_level | ATHLETICS_INTEREST | No | unchanged |
| DISC_018 | weekly_athletic_commitment | ATHLETICS_INTEREST | No | unchanged |
| DISC_019 | athletic_travel_frequency | ATHLETICS_INTEREST | No | unchanged |
| DISC_020 | college_athletics_interest | ATHLETICS_INTEREST_AND_MIDDLE_OR_HS | No | matching_use updated (points to DISC_020A) |
| **DISC_020A** | **ncaa_interest** | **DISC_020 branch active AND DISC_020 = DEFINITELY/POSSIBLY** | **No** | **NEW (DEC-C1)** |
| DISC_021 | reclassification_interest | GRADE_PLANNING_REASON_AND_MIDDLE_OR_HS | No | unchanged |
| DISC_022 | advancement_interests | ADVANCEMENT_INTEREST_OR_REPORTED_AHEAD_OR_MIXED | No | matching_use updated (documents ADV_007) |
| DISC_023 | college_intent | HIGH_SCHOOL_OR_MIDDLE_WITH_ADVANCEMENT_INTEREST | No | matching_use updated (documents ADV_008) |
| DISC_024 | reported_graduation_status | HIGH_SCHOOL | No | unchanged |
| DISC_025 | credit_recovery_need | HIGH_SCHOOL_AND_GRADUATION_OR_CREDIT_CONCERN | No | unchanged |
| DISC_026 | family_priorities (max 3) | ALL | Yes | unchanged |
| DISC_027 | desired_parent_involvement | ALL | Yes | unchanged |
| DISC_028 | cost_preference | ALL | No | unchanged |
| DISC_029 | desired_start_timeline | ALL | No | unchanged |
| DISC_030 | parent_context (free text, excluded from engine/AI/analytics) | ALL | No | unchanged |
| DISC_E01 | foundational_learning_priorities | ELEMENTARY_AND_SUPPORT_PRIORITIES_NOT_ALREADY_KNOWN | No | unchanged |
| DISC_E02 | daytime_support_person | ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED | No | unchanged |
| DISC_E03 | in_person_peer_preference | ALL | No | unchanged |
| DISC_E04 | daytime_support_availability | ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED | No | unchanged |
| DISC_031 | school_change_preference | ALL | No | unchanged |
| DISC_032 | unavailable_academic_times | FLEXIBILITY_VERY_OR_ESSENTIAL | No | unchanged |
| DISC_033 | desired_delivery | ALL | No | unchanged |
| DISC_034 | subject_advancement_interests | ADVANCEMENT_INTEREST_OR_REPORTED_AHEAD_OR_MIXED | No | unchanged |

Owning module for all 39: discovery questionnaire (Phase 3), consumed by engine (Phase 4). Test reference: QA_MATRIX "Browser" (branch/back/resume/validation) and Phase 3 acceptance criteria.

## 3. Rule registry — regenerated by group (55 entries: 54 evaluable + 1 retired)

Regenerated directly from `contracts/rules.json` by script (not hand-counted) — see `contracts/CHANGELOG.md` "Validation performed" for the exact reproducible command. `HOME_003` is excluded from evaluable counts below (status `RETIRED`) but is listed once at the end for completeness.

| Group | Evaluable rule count | Rule IDs | Change from original pack |
|---|---|---|---|
| schedule | 6 | FLEX_001, FLEX_002, FLEX_003, ATH_001, ATH_002, OPP_002 | none |
| delivery | 4 | DELIVERY_001, DELIVERY_002, DELIVERY_003, HOME_001 | none |
| family_role | 5 | HOME_002, PAR_001, ELEM_001, ELEM_002, PAR_002 | HOME_003 retired out of this group's evaluable set (was 6, now 5 evaluable + 1 retired) |
| support_structure | 7 | IND_001, IND_002, LEARN_001, LEARN_002, ELEM_003, ACAD_007, CONF_001 | none |
| social | 2 | SOCIAL_001, SOCIAL_002 | none |
| academic | 14 | LEARN_003, ACAD_001, ACAD_002, ACAD_003, ACAD_004, ACAD_005, ACAD_006, FOUND_001, FOUND_002, ADV_006, HS_001, HS_002, HS_003, CURR_002 | none (corrects the prior revision's mislabeled count of 12; actual was and remains 14) |
| cost | 1 | COST_001 | none |
| continuity | 2 | HS_004, CURR_001 | none |
| future | 11 | ATH_003, ATH_004, ATH_005, ADV_001, ADV_002, ADV_003, ADV_004, ADV_005, OPP_001, ADV_007, ADV_008 | +2 (ADV_007, ADV_008 added; corrects the prior revision's mislabeled count of 11, which was actually 9 before this correction and is genuinely 11 now) |
| context | 2 | ENV_001, GRADE_001 | +1 (GRADE_001 added) |
| **Total evaluable** | **54** | | 52 original + 3 added − 1 retired |
| Retired (kept for history) | 1 | HOME_003 | retired in favor of PAR_002 |
| **Grand total in file** | **55** | | |

## 4. Taxonomy reachability — Total / Active / Reserved / Retired / Excluded / Baseline / Operational-layer

Regenerated directly from `contracts/taxonomy.json` and cross-checked by script against `contracts/rules.json` (see `contracts/CHANGELOG.md`); every row below was confirmed to match, with zero mismatches.

| Category | Total registered | ACTIVE | RESERVED | EXCLUDED | BASELINE | OPERATIONAL_LAYER | Active items with missing inputs/activation paths |
|---|---|---|---|---|---|---|---|
| Base models (B01-B10) | 10 | 9 (B01-B09) | 0 | 1 (B10) | 0 | 0 | none |
| Overlays (O01-O10) | 10 | 10 | 0 | 0 | 0 | 0 | none |
| Supports (S01-S12) | 12 | 11 (S02-S12) | 0 | 0 | 1 (S01) | 0 | none |
| Opportunities (OP01-OP18) | 18 | 13 (OP01-OP06, OP08, OP10, OP11, OP14, OP16-OP18) | 5 (OP07, OP09, OP12, OP13, OP15) | 0 | 0 | 0 | none |
| Review signals (20) | 20 | 19 | 0 | 0 | 0 | 1 (REV_SERVICE_AVAILABILITY) | none |

"Active items with missing inputs or activation paths": none found. Every `ACTIVE`-labeled entry is confirmed reachable by at least one evaluable rule (or, for `REV_COST_ALIGNMENT`, by a documented `scoring-policy.json` postprocess rule), and every field referenced by every evaluable rule's `when` condition exists in the question registry or the documented normalized-fact list. This is the corrected version of the prior revision's "10/10 base models reachable" statement, which was self-contradictory given B10's permanent exclusion; B10 is now correctly reported as `EXCLUDED`, not counted toward reachability at all.

## 5. Specification-level requirements

(Unchanged from the prior revision except where noted; see that revision's §2 for the full list. Rows affected by Phase 0 corrections:)

| Spec | Requirement | Canonical anchor | Status |
|---|---|---|---|
| 02 | New explicit inputs DISC_031-034, DISC_E04 | `contracts/question-bank.json` | DOCUMENTED, owner-accepted (DEC-B1) |
| 02 | Normalized derived fact `ncaa_interest` | `contracts/question-bank.json` DISC_020A | DOCUMENTED — gap closed (was DEC-C1, now resolved) |
| 03/04 | Taxonomy reachability fully classified | `contracts/taxonomy.json` | DOCUMENTED — gaps closed (was DEC-C3/C4/C5, now resolved) |
| 04 | Redundant rule vocabulary retired | `contracts/rules.json` HOME_003 | DOCUMENTED — gap closed (was DEC-C6, now resolved) |
| 04 | Evidence gate and scoring formula | `contracts/scoring-policy.json` | DOCUMENTED, unchanged (DEC-C7 confirms gate stays as-is) |

## 6. Discovery Report sections (7/7 traced)

(Unchanged from the prior revision — no owner correction affected this section. See `IMPLEMENTATION_CONTRACT.md` §5 for the registry-by-reference list; R01-R07 mapping to report assembler, Phase 5, remains as previously documented.)

## 7. Human acceptance requirement

(Unchanged.) Per QA_MATRIX "Human acceptance," at least one authorized education/service reviewer must check representative reports, and parent-comprehension feedback must be recorded, before any release-QA sign-off (Phase 9) can claim this criterion met. Not applicable to Phase 0 or this Phase 1 foundation work.

## 9. Phase 1 status note

The contracts traced above are now consumed by real, tested code: `src/lib/contracts/` (Zod loader + referential-integrity validator) loads and validates every registry in this document, and `tests/contracts.test.ts` asserts the exact counts recorded here (39 questions, 55 rule entries with 1 retired, zero validation errors/warnings), including two negative-control tests that intentionally introduce a bad field reference and a reachable-RESERVED-opportunity violation to confirm the validator actually catches them rather than passing vacuously. See `docs/pathways/PHASE_STATUS.md` "Phase 1 evidence" for full detail.

## 8. Audit method note

This revision was produced entirely by re-deriving every count from the actual corrected JSON via short verification scripts (shown inline in this document and in `contracts/CHANGELOG.md`), specifically because the owner identified that the prior revision's hand-compiled academic/future group counts did not match their own listed IDs. No count in this revision is asserted without a script that reproduces it.

## 10. Phase 1A repair — requirement re-trace

The Phase 1A repair (see `docs/pathways/PHASE_STATUS.md` "Phase 1A repair evidence" for the full finding-to-fix-to-test table) touched only master-prompt nonnegotiable behaviors N8, N9, and N10 from §1 above, plus their owning modules; nothing in §2-§7 (contracts/question-bank/rules/taxonomy/report sections) changed.

| # | Requirement | Phase 1 status before repair | Phase 1A repair evidence | Status |
|---|---|---|---|---|
| N8 | Record-level authorization from first persistence layer; cross-parent/advisor isolation; no internal scores in public DTO | DOCUMENTED, but advisor access checked only assignment (not staff role + assignment composed), the guardian single-record check did not match the list function's soft-delete filter, no reusable principal boundary existed, and `sections: unknown` in `dto.ts` performed no runtime validation of nested content. | `src/server/access-control.ts` now composes staff role AND assignment for all advisor case access (documented no-admin-bypass); `assertGuardianCanAccessStudent` matches `listStudentsForGuardian`'s soft-delete filter; `src/server/principal.ts` added as the one supported request-facing identity boundary; `src/server/dto.ts` now runtime-validates every nested report section against an explicit `z.strictObject` allowlist, throwing `InvalidReportContentError` rather than serving unvalidated content. Verified by 20 tests in `tests/access-control.test.ts`, 4 in `tests/principal.test.ts`, 9 in `tests/dto.test.ts`, all passing against real PostgreSQL. | DOCUMENTED AND REPAIRED |
| N9 | No real email/booking/AI/child-data/production until gates pass; honest unavailable states | DOCUMENTED, but magic-link initiation had no explicit before-hook block while `EMAIL_MODE=UNCONFIGURED`, risking a real verification row being created with no way to deliver it, and session expiry was not an explicit bounded/validated configuration distinguishing deployment mode from `NODE_ENV`. | `src/auth/config.ts`'s `hooks.before` middleware now blocks `/sign-in/magic-link` before Better Auth's handler (and `createVerificationValue`) ever runs, for every `EMAIL_MODE` this app implements; verified to create zero verification rows and log no sensitive values. `src/env.ts`/`src/server/session-config.ts` now make `DEPLOYMENT_MODE`, `GUEST_SESSION_TTL_MINUTES`, and `LIVE_DEPLOYMENT_APPROVED` explicit, bounded, and validated, with LIVE mode refusing to start without explicit approval and TTL. Verified by 7 tests in `tests/magic-link.test.ts`, 7 new tests in `tests/env.test.ts`, 5 in `tests/session-config.test.ts`, 2 new in `tests/session.test.ts`. | DOCUMENTED AND REPAIRED |
| N10 | Every phase ships tests + traceability + real evidence; compile success ≠ acceptance | The Phase 1 CI workflow had not been dispatched against actual GitHub Actions, and nothing forced the required job to fail if the test database or integration suites were unavailable/didn't run. | `.github/workflows/ci.yml` rewritten (`main`/`claude/**` triggers, per-step `NODE_ENV`, `REQUIRE_TEST_DATABASE=true` on the test step). Two independent, layered fail-loud mechanisms added: `tests/helpers/db.ts`'s `REQUIRE_TEST_DATABASE` gate (throws if the DB URL is missing) and `scripts/assert-integration-tests-ran.ts` (parses the JSON test report and fails if the required suites are missing or non-passing). Both verified locally with real non-zero exit codes; see `PHASE_STATUS.md` "CI status" for the actual GitHub Actions dispatch result. | DOCUMENTED AND REPAIRED |

No count in §2-§7 above changed as part of this repair -- confirmed by re-running the same `contracts/CHANGELOG.md` validation script this session with no diff against the counts already recorded in this document.
