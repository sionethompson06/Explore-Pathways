# Pathways Discovery App — Requirement Traceability

Version: 0.1.0-phase0-candidate
Purpose: link every source requirement to a canonical ID, the module that owns it, the phase that implements it, a test reference, current status, and the evidence standard that will close it. Phase 0 itself changes no application code; "status" below is **DOCUMENTED** (traced and accounted for) or **GAP** (traced, but incomplete — see `DECISION_LOG.md` section C) — never **PASS**, since nothing has been built or run yet against this codebase.

Counts are cross-checked against `checks/PACK_VALIDATION.json`: 38 question definitions, 52 rule definitions, 14 synthetic reference cases. All three counts were independently re-verified during this Phase 0 audit by direct enumeration (not merely trusted from the pack's own claim) and confirmed to match.

## 1. Master-prompt nonnegotiable behaviors

| # | Requirement | Owning module | Phase | Test reference | Status |
|---|---|---|---|---|---|
| N1 | Determinism: same effective answers/versions -> same recommendation; sales/lead fields never causal | recommendation engine | Phase 4 | `golden-profiles.json` metamorphic tests 1-3; QA_MATRIX "Unit and contract" | DOCUMENTED |
| N2 | Canonical registries; pathway = base model + overlays + supports + opportunities + reviews; service ≠ school | taxonomy, engine | Phase 4 | `taxonomy.json` constraints; QA_MATRIX "Unit and contract" | DOCUMENTED |
| N3 | ≥2 independent scored groups required to display a candidate; unknown ≠ no; 0/1 cards valid; no public percentages | scoring policy, report assembler | Phase 4, 5 | `scoring-policy.json` display_gate; fixtures FX08 (0 cards), FX07 (1 qualifies) | DOCUMENTED |
| N4 | K-4 developmental lens; no credit/NCAA/college pressure; no inferred readiness/supervision/eligibility | rules (ELEM_*), postprocess, report | Phase 4, 5 | fixtures FX01, FX02, FX11; postprocess_rules K-4 remap | DOCUMENTED |
| N5 | No mandatory email/account wall; save optional+verified; delivery vs. marketing consent separate; no mandatory phone | discovery flow, saving | Phase 3, 6 | Spec 02 "Contact is not part of the education questionnaire"; Spec 06 §2 | DOCUMENTED |
| N6 | Report tone: recognition/insight/directions/opportunities/questions/sketch/CTA; no fear/guilt/scarcity/fabrication | report assembler, content library | Phase 5 | `content-library.json` forbidden_claims; QA_MATRIX "Report and content" | DOCUMENTED |
| N7 | Template-complete first; AI limited to R01/R02; never chooses pathways/providers/conclusions | report assembler, AI adapter | Phase 5, 8 | Spec 05 "AI boundary"; Phase 8 acceptance criteria | DOCUMENTED |
| N8 | Record-level authorization from first persistence layer; cross-parent/advisor isolation; no internal scores in public DTO | data-access layer | Phase 1, 6, 7 | `report-contract.json` forbidden_in_public; QA_MATRIX "Integration" | DOCUMENTED |
| N9 | No real email/booking/AI/child-data/production until gates pass; honest unavailable states | integration adapters | Phase 1, 6, 8, 9 | Spec 07 "Adapters"; `INTEGRATION_REGISTER.md` | DOCUMENTED |
| N10 | Every phase ships tests + traceability + real evidence; compile success ≠ acceptance | all | All | this document; per-phase "End-of-phase evidence" sections | DOCUMENTED |

## 2. Specification-level requirements

| Spec | Requirement | Canonical anchor | Owning module | Phase | Status |
|---|---|---|---|---|---|
| 01 | Model 2 launch; Model 3 (B10) excluded/contingent | `taxonomy.json` B10 | taxonomy, engine | Phase 4 | DOCUMENTED |
| 01 | Grade bands ELEMENTARY/MIDDLE/HIGH_SCHOOL/UNDETERMINED | `question-bank.json` DISC_002 | discovery | Phase 3 | DOCUMENTED |
| 01 | MVP users: guest, verified parent, assigned advisor, admin; no self-assigned staff role | data model | Phase 1 | DOCUMENTED |
| 01 | One student profiled per Discovery session in this release | data model | Phase 1 | DOCUMENTED |
| 02 | 38-question registry, branch-gated, not a fixed 38-question experience | `question-bank.json` | discovery | Phase 3 | DOCUMENTED — see §3 below for full enumeration |
| 02 | Raw answers vs. effective normalized facts stored separately; revisions on change | data model | Phase 1, 3 | DOCUMENTED |
| 02 | New explicit inputs DISC_031-034, DISC_E04 | `question-bank.json` | discovery | Phase 3 | DOCUMENTED (content present); owner acceptance requested — DEC-B1 |
| 02 | Normalized derived facts: athletics_interest, homeschool_interest, home_or_online_interest, frequent_travel, foundation_concern, supplemental_need, grade_band, ncaa_interest | `rules.json` normalized_fact_fields + Spec 02 prose | engine | Phase 4 | DOCUMENTED, except `ncaa_interest` — see DEC-C1 (GAP: no canonical question ID backs this normalized fact) |
| 03 | Base models B01-B10; B10 permanently excluded | `taxonomy.json` | taxonomy | Phase 4 | DOCUMENTED |
| 03 | Overlays/supports/opportunities/reviews are distinct from base models | `taxonomy.json` | taxonomy | Phase 4 | DOCUMENTED |
| 03 | Parent labels: WORTH_EXPLORING / WORTH_EXPLORING_WITH_CONSIDERATIONS / MORE_INFORMATION_HELPFUL; up to 2 cards | `scoring-policy.json` public_labels | report | Phase 5 | DOCUMENTED |
| 04 | Evaluation sequence (validate -> derive -> select models -> evaluate rules -> dedupe -> aggregate -> review items -> gate -> diversity -> assemble) | engine | Phase 4 | DOCUMENTED |
| 04 | Scoring formula: baseline 50, group max-pos/max-neg, single largest multiplier, clamp ±6/group, clamp 0-100 total | `scoring-policy.json` | engine | Phase 4 | DOCUMENTED |
| 04 | 52 candidate rules | `rules.json` | engine | Phase 4 | DOCUMENTED — see §4 below; GAPs DEC-C2, C3, C4, C5, C6 |
| 04 | No automatic B10 fallback when no candidate clears the gate | `rules.json`, `taxonomy.json` | engine | Phase 4 | DOCUMENTED; fixture FX08 |
| 05 | Seven report sections R01-R07 | `report-contract.json` sections | report assembler | Phase 5 | DOCUMENTED — see §5 below |
| 05 | 500-650 visible word target, subordinate to necessary qualifications | report assembler | Phase 5 | DOCUMENTED |
| 05 | AI boundary: two slots, structured output, evidence IDs, fallback to template on doubt | AI adapter | Phase 8 | DOCUMENTED |
| 05 | Conversion states tied to actual scheduler config; never claim "booked" without verification | consultation adapter | Phase 6 | DOCUMENTED |
| 06 | Reconciliation items 1-16 | this pack's Spec 06 | all | Phase 1-7 | DOCUMENTED — see `DECISION_LOG.md` sections A/B |
| 06 | Launch-only decisions (entity, terms, staffing, providers, retention, AI approval, media rights) | operations | Launch (Phase 9+) | DOCUMENTED — see `DECISION_LOG.md` section D |
| 07 | Route map (18 routes) | app router | Phase 2, 3, 5, 6, 7 | DOCUMENTED — see `IMPLEMENTATION_CONTRACT.md` §7 |
| 07 | Data objects (14 entities + 4 status enums kept separate) | schema | Phase 1 | DOCUMENTED — see `IMPLEMENTATION_CONTRACT.md` §8 |
| 07 | Adapter modes: email, scheduler (UNCONFIGURED/REQUEST_ONLY/LIVE_VERIFIED), AI (DISABLED/APPROVED_PROVIDER/FALLBACK) | integration adapters | Phase 1, 6, 8 | DOCUMENTED — see `INTEGRATION_REGISTER.md` |
| 07 | Analytics allowlist; no child data, no ad pixels/session replay on private flows | analytics | Phase 7 | DOCUMENTED |

## 3. Discovery question registry — full enumeration (38/38 traced)

Every question below is traced to its field name, its show-when branch condition (from Spec 02's branch registry), and the phase that will implement it. This confirms 100% of the question bank is accounted for with no orphaned entries.

| ID | Field | Show-when | Required-when-shown |
|---|---|---|---|
| DISC_001 | student_display_name | ALL | No |
| DISC_002 | current_grade | ALL | Yes |
| DISC_003 | student_age | ALL | No |
| DISC_004 | residence (state, optional ZIP) | ALL | Yes |
| DISC_005 | current_education_model | ALL | Yes |
| DISC_006 | discovery_reasons | ALL | Yes |
| DISC_007 | primary_discovery_reason | MULTIPLE_DISCOVERY_REASONS | Yes (when shown) |
| DISC_008 | desired_primary_change | PRIMARY_REASON_UNCLEAR | No |
| DISC_009 | reported_academic_position | ALL | Yes |
| DISC_010 | reported_support_needs | ALL | No |
| DISC_011 | learning_support_pattern | ALL | Yes |
| DISC_012 | preferred_learning_environment | ALL | No |
| DISC_013 | flexibility_importance | ALL | Yes |
| DISC_014 | flexibility_reasons | FLEXIBILITY_SOMEWHAT_OR_HIGHER | No |
| DISC_015 | preferred_academic_time | FLEXIBILITY_SOMEWHAT_OR_HIGHER | No |
| DISC_016 | primary_sport | ATHLETICS_INTEREST | No |
| DISC_017 | athletic_level | ATHLETICS_INTEREST | No |
| DISC_018 | weekly_athletic_commitment | ATHLETICS_INTEREST | No |
| DISC_019 | athletic_travel_frequency | ATHLETICS_INTEREST | No |
| DISC_020 | college_athletics_interest (+ implicit ncaa_interest follow-up — see DEC-C1) | ATHLETICS_INTEREST_AND_MIDDLE_OR_HS | No |
| DISC_021 | reclassification_interest | GRADE_PLANNING_REASON_AND_MIDDLE_OR_HS | No |
| DISC_022 | advancement_interests | ADVANCEMENT_INTEREST_OR_REPORTED_AHEAD_OR_MIXED | No |
| DISC_023 | college_intent | HIGH_SCHOOL_OR_MIDDLE_WITH_ADVANCEMENT_INTEREST | No |
| DISC_024 | reported_graduation_status | HIGH_SCHOOL | No |
| DISC_025 | credit_recovery_need | HIGH_SCHOOL_AND_GRADUATION_OR_CREDIT_CONCERN | No |
| DISC_026 | family_priorities (max 3) | ALL | Yes |
| DISC_027 | desired_parent_involvement | ALL | Yes |
| DISC_028 | cost_preference | ALL | No |
| DISC_029 | desired_start_timeline | ALL | No |
| DISC_030 | parent_context (free text, excluded from engine/AI/analytics) | ALL | No |
| DISC_E01 | foundational_learning_priorities | ELEMENTARY_AND_SUPPORT_PRIORITIES_NOT_ALREADY_KNOWN | No |
| DISC_E02 | daytime_support_person | ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED | No |
| DISC_E03 | in_person_peer_preference | ALL | No |
| DISC_E04 | daytime_support_availability | ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED | No |
| DISC_031 | school_change_preference | ALL | No |
| DISC_032 | unavailable_academic_times | FLEXIBILITY_VERY_OR_ESSENTIAL | No |
| DISC_033 | desired_delivery | ALL | No |
| DISC_034 | subject_advancement_interests | ADVANCEMENT_INTEREST_OR_REPORTED_AHEAD_OR_MIXED | No |

Owning module for all 38: discovery questionnaire (Phase 3), consumed by engine (Phase 4). Test reference: QA_MATRIX "Browser" (branch/back/resume/validation) and Phase 3 acceptance criteria (K-2 homeschool, grade-4 support, grade-7 athlete, grade-10 credit, undecided-grade, unknown-location, branch-change cases).

## 4. Rule registry — traced by group (52/52 accounted)

Full per-rule detail lives in `rules.json`, where every rule already carries its own canonical ID, version, and status (`PILOT_UNVALIDATED`) as an inline traceability key. This table confirms group coverage and flags the specific gaps found (full detail in `DECISION_LOG.md` §C).

| Group | Rule count | Rule IDs | Coverage note |
|---|---|---|---|
| schedule | 6 | FLEX_001-003, ATH_001-002, OPP_002 | Full |
| delivery | 4 | DELIVERY_001-003, HOME_001 | Full |
| family_role | 6 | HOME_002-003, PAR_001-002, ELEM_001-002 | HOME_003/PAR_002 redundancy — DEC-C6 |
| support_structure | 7 | IND_001-002, LEARN_001-002, ELEM_003, ACAD_007, CONF_001 | Full |
| social | 2 | SOCIAL_001-002 | Full |
| academic | 12 | ACAD_001-006, FOUND_001-002, ADV_006, HS_001-003, CURR_002 | RESEARCH interest unmapped — DEC-C2 |
| cost | 1 | COST_001 | Thin coverage — DEC-C7 (advisory) |
| continuity | 2 | HS_004, CURR_001 | Full |
| future | 11 | ATH_003-005, ADV_001-005, OPP_001 | S08/college-planning support unreachable — DEC-C4 |
| context | 1 | ENV_001 | Thin coverage — DEC-C7 (advisory) |

Total: 6+4+6+7+2+12+1+2+11+1 = 52. Matches `checks/PACK_VALIDATION.json`. Owning module: recommendation engine (Phase 4). Test reference: `golden-profiles.json` FX01-FX14, all 9 metamorphic tests, QA_MATRIX "Unit and contract."

Taxonomy reachability cross-check (Phase 4 must resolve before its acceptance criteria can be fully met):
- Base models: 10/10 reachable (B01-B09 via rules; B10 permanently unreachable by design).
- Overlays: 10/10 reachable.
- Supports: 10/12 reachable (S01, S08 unreachable — DEC-C4).
- Opportunities: 12/18 reachable (OP06, OP07, OP09, OP12, OP13, OP15 unreachable — DEC-C3).
- Review signals: 18/20 reachable (REV_AGE_GRADE_CONTEXT, REV_SERVICE_AVAILABILITY unreachable — DEC-C5).

## 5. Discovery Report sections (7/7 traced)

| Section | Content | Owning module | Phase | Test reference |
|---|---|---|---|---|
| R01 | Starting point: name/fallback, headline, attributed summary, up to 3 priorities, scope statement | report assembler | Phase 5 | QA_MATRIX "Report and content" |
| R02 | One combined insight or plain summary if unsupported | report assembler (+ optional AI) | Phase 5, 8 | Spec 05 sample copy; fixture-driven review |
| R03 | 0-2 model cards (title, fit label, why, considerations) | report assembler | Phase 5 | fixtures FX07 (1 card), FX08 (0 cards) |
| R04 | 0-2 opportunity signals with explore/next-review/longer-term/not-eligible scope | report assembler | Phase 5 | fixture-driven (interest-grounded only) |
| R05 | 1-3 planning questions; material concerns override count | report assembler | Phase 5 | QA_MATRIX "Report and content" |
| R06 | Preliminary pathway sketch; no invented schedule/grades/credits/advisor | report assembler | Phase 5 | Spec 05 R06 |
| R07 | CTA from actual consultation config + optional save | report assembler, consultation adapter | Phase 5, 6 | Spec 05 "Conversion states" |

## 6. Human acceptance requirement

Per QA_MATRIX "Human acceptance," at least one authorized education/service reviewer must check representative reports, and parent-comprehension feedback must be recorded, before any release-QA sign-off (Phase 9) can claim this criterion met. This cannot be satisfied by an automated tool alone and is not applicable to Phase 0.

## 7. Audit method note

This traceability record was built by direct enumeration of every contract file (not by trusting the pack's own summary counts), then cross-checked against `checks/PACK_VALIDATION.json`. All three headline counts (38 questions, 52 rules, 14 fixtures) were independently reproduced. The gaps in §4 were found by mapping every rule's referenced fields and activated IDs against the question registry and taxonomy, entry by entry — not sampled.
