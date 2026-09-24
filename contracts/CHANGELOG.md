# Contracts Changelog

This is the single authoritative record of every difference between the originally supplied pack (preserved verbatim at `docs/pathways/pack/contracts/`, version `1.0.0-candidate`) and the corrected, application-consumed registries in this directory (version `1.1.0-phase0-corrected`). Per owner authorization at Phase 0 acceptance (DEC-C1 through DEC-C7 in `docs/pathways/DECISION_LOG.md`).

These are the only authoritative contracts. The Next.js application reads exclusively from this directory (`contracts/`) and `fixtures/`, never from `docs/pathways/pack/`. That location is a historical, byte-identical archive of what was originally supplied and is not consumed by any code.

## question-bank.json (38 -> 39 questions)

- **Added `DISC_020A`** (field `ncaa_interest`), resolving DEC-C1. Owner-specified wording, values (`YES`/`MAYBE`/`NO`/`UNKNOWN`), and display labels. `show_when` resolves to: DISC_020's branch active AND DISC_020 answered `DEFINITELY` or `POSSIBLY`. Never shown for K-4.
- **Updated `DISC_020`'s `matching_use`** to point at the new formal follow-up question instead of describing an undefined nested field.
- **Updated `DISC_022`'s `matching_use`** to document the RESEARCH -> OP06 connection (new rule `ADV_007`) and to note that K-4's existing value-subset filter already excludes RESEARCH, satisfying the age-appropriate-language requirement without further change.
- **Updated `DISC_023`'s `matching_use`** to document the college_intent -> S08 connection (new rule `ADV_008`).
- **Added one `global_rules` entry** generalizing the explicit-UNKNOWN-vs-NOT_APPLICABLE distinction (previously implicit from Specification 02's prose, now stated directly in the machine-readable contract) to every question in the registry, not only DISC_020A.
- No other question was added, removed, or had its `id`, `field`, `allowed_values`, or `show_when` changed.

## rules.json (52 -> 55 rule entries; 54 evaluable, 1 retired)

- **Added `ADV_007`**: `advancement_interests contains RESEARCH` (grade MIDDLE/HIGH_SCHOOL) -> overlay `O02`, opportunity `OP06`, review `REV_ADVANCEMENT_READINESS`. Empty `score_effects` (interest signal only, per DEC-C2's explicit instruction not to change base-model scores). Resolves DEC-C2.
- **Added `ADV_008`**: `college_intent in [DEFINITELY, PROBABLY]` (grade MIDDLE/HIGH_SCHOOL) -> support `S08`. Empty `score_effects` (signal-only, per DEC-C4's explicit instruction that it must not affect base-model ranking). Resolves DEC-C4 (the S08 half).
- **Added `GRADE_001`**: `grade_band = UNDETERMINED` -> review `REV_AGE_GRADE_CONTEXT`. Empty `score_effects` (neutral clarification need, not a scored evidence dimension, per DEC-C5's explicit instruction against an age-versus-grade risk score). Resolves DEC-C5 (the `REV_AGE_GRADE_CONTEXT` half).
- **Retired `HOME_003`**: marked `status: "RETIRED"` with `replacement_rule_id: "PAR_002"` and a `retired_reason` documenting the direct comparison performed (PAR_002's condition is a strict superset of HOME_003's; both produce identical `score_effects` of `{B08: -3, B09: -2}` and identical `review_model_scope` of `[B08, B09]`). The rule object is kept in the array, not deleted, so historical `EngineRun` records that cite `HOME_003` remain explainable. The Phase 4 engine must skip rules with `status: "RETIRED"` during evaluation. Resolves DEC-C6.
- **Added `dedup_key: "HOME_MANAGEMENT_TRADEOFF"` to `PAR_002`**, so the report assembler can deduplicate its reason text against any other rule sharing the same key (relevant now that `HOME_003` is retired in `PAR_002`'s favor). Resolves the report-layer half of DEC-C6.
- **Added a top-level `review_signal_notes.REV_SERVICE_AVAILABILITY`** entry documenting that this signal is deliberately *not* wired to any rule in this file: it is an operational/service-configuration concern (Phase 6 consultation adapter), architecturally outside the educational scoring function, per DEC-C5's explicit instruction. Resolves DEC-C5 (the `REV_SERVICE_AVAILABILITY` half).
- **No existing rule's `when` condition, `score_effects`, or `activate` block was changed** except the two additions above (`dedup_key` on `PAR_002`; `status`/`retired_reason`/`replacement_rule_id` on `HOME_003`, which does not change what `HOME_003` itself would have scored had it still been evaluated -- only whether it is evaluated at all).
- **Independent verification performed**: a script cross-checked every field referenced by every non-retired rule's `when` conditions against the question-bank's `field` values plus its `normalized_fact_fields`, and confirmed zero unknown fields, zero duplicate rule IDs, and that reachability of every taxonomy entry now exactly matches its declared `reachability_status` (see the "Validation performed" section below).

## taxonomy.json (structural addition only, no ID added, removed, or renamed)

- **Added `reachability_status` to every base model, overlay, support, opportunity, and review signal**, resolving DEC-C3, DEC-C4, and DEC-C5's request to "distinguish ACTIVE, RESERVED, RETIRED and intentionally excluded items in contract validation and reachability reporting":
  - `ACTIVE` (reachable by a non-retired rule, or — for two named exceptions — wired outside the rules engine as documented): all 10 base models except B10, all 10 overlays, 11 of 12 supports, 13 of 18 opportunities (12 originally reachable + `OP06` newly reachable), 19 of 20 review signals (18 originally reachable + `REV_AGE_GRADE_CONTEXT` newly reachable, plus `REV_COST_ALIGNMENT` which is postprocess-triggered).
  - `RESERVED`: `OP07` (Internship), `OP09` (Industry credential), `OP12` (Entrepreneurship), `OP13` (STEM enrichment), `OP15` (Travel-related learning) — kept in the taxonomy with their IDs and descriptions, explicitly forbidden from ever appearing as a personalized opportunity, and explicitly exempted from failing a reachability check. No question currently captures the underlying interest for OP07/OP09/OP12/OP13; OP15's underlying travel answers already drive schedule scoring rather than this specific opportunity. Resolves DEC-C3.
  - `EXCLUDED`: `B10` only, with an explicit note that exclusion is permanent for Discovery V1 by architectural rule, not oversight, and does not cancel the separately planned future school model.
  - `BASELINE`: `S01` (Pathways advising) only, with an explicit note that it is intentionally not rule-gated because it is the product's universal next step, and that actual availability comes from service configuration, never from this taxonomy entry. Resolves the S01 half of DEC-C4.
  - `OPERATIONAL_LAYER`: `REV_SERVICE_AVAILABILITY` only, cross-referencing the note in `rules.json`. Resolves the `REV_SERVICE_AVAILABILITY` half of DEC-C5.
- **Added one `constraints` entry** stating RESERVED opportunities must never be displayed and must not fail a reachability check.
- No base model, overlay, support, opportunity, or review signal `id` or `label` was added, removed, or renamed.

## scoring-policy.json, report-contract.json, content-library.json, legacy-aliases.json

**Unchanged.** Byte-identical to the originally supplied pack. None of DEC-C1 through DEC-C7 required a change to the scoring formula, the display gate (DEC-C7 explicitly required the gate be kept unchanged), the public DTO shape, the content library, or the legacy alias map.

## fixtures/golden-profiles.json (14 -> 17 cases)

- **Added `FX15_AFFORDABILITY_ONLY`, `FX16_ENVIRONMENT_ONLY`, `FX17_MOSTLY_UNKNOWN`**, resolving DEC-C7's request for regression cases covering affordability-only, environment-concern-only, and mostly-unknown profiles. Each fixture's `expect` block documents that a zero-or-minimal-card, `LIMITED_INFORMATION` outcome is the valid, correct result — not a defect. `FX17` additionally exercises the new `REV_AGE_GRADE_CONTEXT` signal (`GRADE_001`).
- No existing fixture (`FX01`-`FX14`) was changed.

## Validation performed at Phase 0 corrections

A script (not committed as application code; reproducible with the commands below) loaded all three corrected contracts and confirmed:
1. Every field referenced in every non-retired rule's `when` conditions exists in the question-bank's `field` list or `normalized_fact_fields` — zero unknown fields.
2. Every rule ID is unique across all 55 entries (54 evaluable + 1 retired).
3. Every taxonomy entry's `reachability_status` exactly matches whether it is actually referenced by a non-retired rule's `activate` block, with the two documented, intentional exceptions (`REV_COST_ALIGNMENT`, `REV_SERVICE_AVAILABILITY`, both postprocess/operational rather than rule-triggered by design).

Reproduce with:
```
python3 -c "
import json
qb = json.load(open('contracts/question-bank.json'))
rules = json.load(open('contracts/rules.json'))
tax = json.load(open('contracts/taxonomy.json'))
qb_fields = {q['field'] for q in qb['questions']} | set(rules['normalized_fact_fields'])
active = [r for r in rules['rules'] if r.get('status') != 'RETIRED']
unknown = {(r['id'], c['field']) for r in active for c in r['when']['all'] if c['field'] not in qb_fields}
assert not unknown, unknown
ids = [r['id'] for r in rules['rules']]
assert len(ids) == len(set(ids))
print('OK')
"
```

This is a structural/reference check equivalent in spirit to the original pack's `checks/PACK_VALIDATION.json`, run against the corrected contracts. It is not a test of a built application (none exists in this repository yet) and is superseded by the real automated Zod-based contract validator once Phase 1 builds it.

## Phase 3E — Discovery calibration (question-bank.json 1.1.0-phase0-corrected -> 2.0.0-discovery-calibrated)

Owner-approved revision documented in full at `docs/pathways/DISCOVERY_CALIBRATION_SPEC_V2.md` and `docs/pathways/DECISION_LOG.md` section K (DEC-H1 through DEC-H3+). This is a controlled enhancement of the Phase 3 Discovery build, not Phase 4: no recommendation engine, final Discovery Report, or scoring evaluator was implemented or started.

### question-bank.json (still 39 questions -- no question ID added, removed, or renamed)

- Reworded nearly every `parent_wording` to positive/possibility-oriented language, per the hard owner decision that Discovery must never read as diagnostic, anxiety-inducing, or presuming eligibility/availability. No interpretive "what we're hearing" card was inserted anywhere in the flow -- it remains Questions -> adaptive questions -> Review -> Complete.
- Added optional `helper_text` (a question-level reassuring line) and `option_helpers` (per-option clarifying text, e.g. DISC_031's STAY_CURRENT/OPEN_TO_CHANGE/SEEKING_CHANGE) to the schema (`src/lib/contracts/schemas.ts`) and to the questions that use them; threaded through `present.ts` -> `QuestionDescriptor`/`OptionDescriptor` -> `QuestionField.tsx` (new `.optionHelper` CSS class, reusing `.hint` for the question-level line).
- Added a new, generic `grade_band_allowed_values` mechanism (schema + `present.ts`) so a question's *new-entry* option set can differ by grade band while `allowed_values` keeps every legacy/retired value so historical raw answers keep validating. Used by DISC_006, DISC_008, DISC_012, DISC_022, DISC_026, DISC_034.
- **DISC_003** (`student_age`) changed from universal to conditional: active only when `current_grade` is `OTHER`/`UNKNOWN`, or when `GRADE_PLANNING` is among the family's discovery reasons. New branch `AGE_CONTEXT_USEFUL` (`branching.ts`), replacing an implicit "always ask" assumption.
- **DISC_006** (`discovery_reasons`): retired `CURRENT_SCHOOL_CONCERN`/`DIFFERENT_ENVIRONMENT`/`ENVIRONMENT_CONCERN` from new-entry use, replaced by one canonical `BETTER_FIT_ENVIRONMENT` (`SMALLER_ENVIRONMENT` stays separate). All three legacy values remain valid historical answers and alias to `BETTER_FIT_ENVIRONMENT` in *effective* answers only (`contracts/legacy-aliases.json` `question_value_aliases`); raw stored records and Review are never rewritten.
- **DISC_008** (`desired_primary_change`): broadened from `PRIMARY_REASON_UNCLEAR`-only to `show_when: "ALL"`; kept optional; `COLLEGE_COURSES` hidden for elementary via `grade_band_allowed_values`.
- **DISC_026** (`family_priorities`): retired `ACADEMIC_QUALITY` from new-entry use (`question_value_removals`, not aliased -- not semantically equivalent to anything); added canonical `STRUCTURE_ACCOUNTABILITY`.
- **DISC_012** (`preferred_learning_environment`): retired `BOOKS`/`TECHNOLOGY` from new-entry use (`question_value_removals`).
- **DISC_014** (`flexibility_reasons`): added `max_selections: 3`.
- **DISC_032** (`unavailable_academic_times`): retired branch `FLEXIBILITY_VERY_OR_ESSENTIAL`, replaced by new `SCHEDULE_CONSTRAINT_CONTEXT` (`isFlexibilitySomewhatOrHigher` OR an already-stated schedule-intensive discovery reason -- `ATHLETICS`/`TRAVEL`/`ARTS` -- so a family who hasn't rated flexibility highly, or hasn't answered DISC_013 at all, can still be asked when a real potential conflict is already on record).
- **DISC_033** (`desired_delivery`): added canonical `OPEN_TO_RECOMMENDATIONS`, distinct from `UNKNOWN`; must never default to any model or receive an automatic bonus (verified in `tests/discovery-calibration.test.ts`).
- **DISC_E02/DISC_E04** (`daytime_support_person`/`daytime_support_availability`): retired branch `ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED` (asked every elementary family about daytime supervision regardless of interest), replaced by new `HOME_OR_REMOTE_SUPPORT_CONTEXT`, which requires home/remote learning to actually be under consideration (homeschool/online discovery reason, or a home/remote value in `desired_delivery`) AND (elementary grade band OR a regular/close/difficult support-need signal).
- **DISC_022** (`advancement_interests`): major rework. Grade-tiered option sets for K-4/5-8/9-12. Added canonical `NONE_CURRENTLY` (exclusive, added to `EXTRA_EXCLUSIVE_VALUES` in `validation.ts`), `WORK_BASED_LEARNING`, `INDUSTRY_CREDENTIALS`, `ENTREPRENEURSHIP` -- connecting to previously-`RESERVED` taxonomy opportunities `OP07`/`OP09`/`OP12` (see taxonomy.json below). Merged `DUAL_ENROLLMENT`/`COLLEGE_COURSES` into one canonical `COLLEGE_LEVEL_COURSES` (both legacy values alias to it in effective answers; no duplicate opportunity card results). `ENRICHMENT` and `CHALLENGING_COURSEWORK` are no longer dead ends (see `ADV_009`/`ADV_010` below).
- **DISC_034** (`subject_advancement_interests`): added canonical `ELA` and `SOCIAL_STUDIES_HUMANITIES` for older students (K-4 keeps its existing age-appropriate value set).

### legacy-aliases.json (new `question_value_aliases`/`question_value_removals` sections)

Two new optional sections, applied only inside `computeEffectiveAnswers` (`src/lib/discovery/normalization.ts`), never to raw storage or Review's own display of history:

- `question_value_aliases.discovery_reasons`: `CURRENT_SCHOOL_CONCERN`/`DIFFERENT_ENVIRONMENT`/`ENVIRONMENT_CONCERN` -> `BETTER_FIT_ENVIRONMENT`.
- `question_value_aliases.advancement_interests`: `DUAL_ENROLLMENT`/`COLLEGE_COURSES` -> `COLLEGE_LEVEL_COURSES`.
- `question_value_removals.preferred_learning_environment`: `BOOKS`, `TECHNOLOGY`.
- `question_value_removals.family_priorities`: `ACADEMIC_QUALITY`.

### New Phase 3E derived facts (`src/lib/discovery/types.ts` `DerivedFacts`, computed in `normalization.ts`)

Deterministic, conservative, never a public score and never Phase 4 output: `support_structure_need`, `schedule_flexibility_need`, `athletic_schedule_demand`, `family_management_preference` (each a small closed enum with `UNKNOWN` as a valid non-derivable state), and `advancement_opportunities` (10 independent, non-mutually-exclusive booleans: `subject_challenge`, `advanced_coursework`, `early_high_school_coursework`, `college_level_learning`, `research_projects`, `career_cte`, `work_based_learning`, `industry_credentials`, `entrepreneurship`, `accelerated_graduation`). `athletic_schedule_demand` is derived only from weekly hours, travel frequency and academic-time conflicts -- never from `athletic_level` (prestige). `cost_preference` and `desired_start_timeline` and `parent_context` (free text) feed no derived fact (verified in `tests/discovery-calibration.test.ts`).

### rules.json (55 -> 60 rule entries; 3 retired: `HOME_003` from Phase 0, plus `ADV_003` and `COST_001` from Phase 3E)

- **Retired `ADV_003`** (`advancement_interests contains DUAL_ENROLLMENT` -> `OP04`), `replacement_rule_id: "ADV_004"`: its condition can never again be met once `DUAL_ENROLLMENT` normalizes to `COLLEGE_LEVEL_COURSES` in effective answers.
- **Updated `ADV_004`**'s condition from `COLLEGE_COURSES` to `COLLEGE_LEVEL_COURSES`, making it the sole rule for the merged college-course concept, targeting `OP05`.
- **Updated `ADV_006`**'s condition to add `ADVANCED_ELA` alongside `ADVANCED_MATH`/`ADVANCED_SCIENCE`/`HIGH_SCHOOL_EARLY`.
- **Updated `ENV_001`**'s condition from the three retired environment values to `BETTER_FIT_ENVIRONMENT` only (a rule reads *effective*, already-normalized answers).
- **Retired `COST_001`** (`cost_preference = PREFER_TUITION_FREE` -> `score_effects: {B02: 2, B03: 3, B04: 3}`), no replacement: DEC-H2's architectural decision that cost belongs to PRACTICAL FEASIBILITY, never EDUCATIONAL ALIGNMENT -- a tuition-free preference must never itself raise a base model's score or be presented as proof of better educational fit. Cost still reaches the report only through the existing `REV_COST_ALIGNMENT` postprocess signal.
- **Added `ADV_009`** (`ENRICHMENT` -> `O02`/`OP18`/`REV_ADVANCEMENT_READINESS`), **`ADV_010`** (`CHALLENGING_COURSEWORK` -> `O02`/`OP01`/`REV_ADVANCEMENT_READINESS`), **`ADV_011`** (`WORK_BASED_LEARNING` -> `O09`/`OP07`), **`ADV_012`** (`INDUSTRY_CREDENTIALS` -> `O09`/`OP09`), **`ADV_013`** (`ENTREPRENEURSHIP` -> `O09`/`OP12`) -- reaching DISC_022 options that previously activated nothing. All empty `score_effects` (interest signals only).

### taxonomy.json

- **`OP04`** (Dual-enrollment exploration) moved `ACTIVE` -> `RETIRED`: no rule targets it any longer (its sole rule, `ADV_003`, is retired above).
- **`OP07`/`OP09`/`OP12`** (Internship / Industry-credential / Entrepreneurship exploration) moved `RESERVED` -> `ACTIVE`: DISC_022 now genuinely captures these interests and `ADV_011`/`ADV_012`/`ADV_013` reach them.
- Updated the `constraints` array's forever-RESERVED list to `OP13`, `OP15` only.

### scoring-policy.json

- Added `BETTER_FIT_ENVIRONMENT: ["context"]` to `primary_reason_groups` (legacy keys kept, unchanged).
- Added `STRUCTURE_ACCOUNTABILITY: ["support_structure"]` to `family_priority_groups`.
- Added a `postprocess_rules` entry documenting DEC-H2: cost is feasibility context, never a base-model score input; `REV_COST_ALIGNMENT` is the only mechanism by which it reaches a candidate.

### fixtures/golden-profiles.json, report-contract.json, content-library.json

**Unchanged.** `golden-profiles.json` remains dormant/unexecuted by any current code (confirmed by inspection: only exposed as a path constant in `loader.ts`); rewriting it was deliberately out of scope for a phase that does not implement the engine that would consume it.

## Phase 3F — Discovery UX simplification (question-bank.json 2.0.0-discovery-calibrated -> 2.1.0-discovery-ux-simplified)

Owner-approved manual-review refinement of the Phase 3E calibrated build, documented in full at `docs/pathways/DISCOVERY_UX_SIMPLIFICATION_PHASE3F.md` and `docs/pathways/DECISION_LOG.md` section L. Still not Phase 4.

### question-bank.json (still 39 questions -- no question ID added, removed, or renamed)

- Reworded DISC_008/009/010/011/012/013/024/033/E03 to shorter wording (see the UX doc's table); removed the explanatory helper sentences on DISC_010/026/E03 (DISC_012 keeps its "Choose up to three." helper, still needed to communicate the limit).
- DISC_031: fixed card order (STAY_CURRENT/SEEKING_CHANGE/OPEN_TO_CHANGE/UNKNOWN) and removed all three per-option helper texts.
- Added a new optional schema field, `other_text_field` (`src/lib/contracts/schemas.ts`), declared directly on a parent question rather than as a 40th+ canonical question. Set on `discovery_reasons`, `reported_support_needs`, `flexibility_reasons`, `advancement_interests`, `family_priorities`.
- Reduced grade-tiered/flat option lists on `family_priorities`, `reported_support_needs`, `flexibility_reasons`, `advancement_interests`, `desired_primary_change` (before -> after counts in the UX doc), each retiring or consolidating specific legacy values -- see legacy-aliases.json below.
- Added `max_selections: 3` to `reported_support_needs`.
- Added new canonical values: `ORGANIZATION_STUDY_HABITS`, `ENGAGEMENT_CONFIDENCE` (reported_support_needs); `HONORS_AP`, `CAREER_CTE_CREDENTIALS` (advancement_interests); `OTHER` added to `reported_support_needs`, `advancement_interests`, `family_priorities`, `desired_primary_change` (the last two as a plain card with no inline text).
- Reordered `preferred_learning_environment` (DISC_012) to precede `learning_support_pattern` (DISC_011) in `stages.ts`'s LEARNING field list and `branching.ts`'s `EVALUATION_ORDER` -- both remain `show_when: "ALL"`, so this is a pure reordering. See the UX doc section 4 for the full branch-decision rationale (DISC_011 stays broadly active, not a DISC_012-gated follow-up).

### legacy-aliases.json (new aliases and removals)

- `question_value_aliases.advancement_interests`: added `ADVANCED_MATH`/`ADVANCED_SCIENCE`/`ADVANCED_ELA` -> `CHALLENGING_COURSEWORK`.
- `question_value_aliases.reported_support_needs` (new section): `ROUTINES`/`ORGANIZATION`/`TIME_MANAGEMENT`/`TASK_COMPLETION`/`STUDY_SKILLS` -> `ORGANIZATION_STUDY_HABITS`; `ENGAGEMENT`/`CONFIDENCE` -> `ENGAGEMENT_CONFIDENCE`.
- `question_value_aliases.learning_support_pattern` (new section): `INDEPENDENT_WORK_DIFFICULT` -> `CLOSE_ADULT_SUPPORT`.
- `question_value_aliases.flexibility_reasons` (new section): `COMPETITION`/`ATHLETIC_TRAVEL` -> `ATHLETIC_TRAINING`; `BUSINESS` -> `WORK`.
- `question_value_removals.family_priorities`: added `ATHLETIC_FLEXIBILITY`, `LOCATION_FLEXIBILITY`, `ADVANCED_COURSES`, `ACCREDITATION`, `DIPLOMA` (alongside the existing `ACADEMIC_QUALITY`) -- none aliased to a survivor, per the instruction's "do not introduce a combined value unless necessary."
- `PHONICS` (reported_support_needs) and `FAMILY_TIME` (flexibility_reasons) are retired from new-entry use via `grade_band_allowed_values` only -- deliberately **not** added to `question_value_removals` or `question_value_aliases`, since historical answers carry their own still-valid effective meaning that no survivor value safely represents.

### rules.json (60 -> 62 rule entries; 3 retired, unchanged from Phase 3E)

- Narrowed `ADV_006`'s condition to `HIGH_SCHOOL_EARLY` only (`ADVANCED_MATH`/`ADVANCED_SCIENCE`/`ADVANCED_ELA` now alias to `CHALLENGING_COURSEWORK`, which already reaches `ADV_006`'s exact O02+OP01+REV_ADVANCEMENT_READINESS target via `ADV_010`).
- Added `ADV_014` (`HONORS_AP` -> `O02`/`OP02`+`OP03`/`REV_ADVANCEMENT_READINESS`) and `ADV_015` (`CAREER_CTE_CREDENTIALS` -> `O09`/`OP08`+`OP09`/`REV_ADVANCEMENT_READINESS`) -- each rule activates two opportunities from one broad Discovery selection rather than making the parent choose a technical distinction, per the instruction's explicit guidance. All empty `score_effects` (interest signals only).
- No taxonomy.json change was needed: OP02/OP03/OP08/OP09 were already `ACTIVE`.

### src/lib/discovery/normalization.ts (derived facts)

- `advancement_opportunities.subject_challenge` now derives solely from DISC_034 (`subject_advancement_interests`) -- the DISC_022-based `ADVANCED_MATH`/`ADVANCED_SCIENCE`/`ADVANCED_ELA` clause was removed, since those values are retired from DISC_022 and DISC_034 is the sole architecturally-correct subject-area source per Phase 3F.
- `advancement_opportunities.advanced_coursework` additionally checks `HONORS_AP`; `.career_cte` and `.industry_credentials` both additionally check `CAREER_CTE_CREDENTIALS`.
- Added Other-text sidecar exclusion: a `*_other_text` field is effective only while its parent question is active and its parent's (already legacy-normalized) value still includes `OTHER`.

### New: "Other" inline free-text sidecar mechanism

New optional `other_text_field` on the Question schema; `src/lib/discovery/registry.ts` exports `getParentQuestionForOtherTextField`/`OTHER_TEXT_FIELDS`; `KNOWN_FIELDS` includes sidecar field names. `src/lib/discovery/validation.ts` validates each sidecar as sanitized short text capped at 150 characters, and requires nonblank text at profile-completion time exactly when the parent's active value includes `OTHER`. `src/lib/discovery/present.ts` threads `otherTextField` onto `QuestionDescriptor` and appends sidecar text to its parent's own Review row. `src/components/discovery/QuestionField.tsx` renders the inline input and clears it on deselect. See `docs/pathways/DISCOVERY_UX_SIMPLIFICATION_PHASE3F.md` section 6 for the full design.

## Phase 3F.1 — Discovery cleanup patch (question-bank.json 2.1.0-discovery-ux-simplified, no version bump -- data-only edits within the same schema shape)

Small, owner-approved cleanup patch to Phase 3F. Documented in full at `docs/pathways/DISCOVERY_UX_SIMPLIFICATION_PHASE3F.md` section 10 and `docs/pathways/DECISION_LOG.md` section M. Still not Phase 4.

### question-bank.json (still 39 questions)

- `discovery_reasons` (DISC_006) new-entry choices reduced from 15-18 to 11 (10 at ELEMENTARY): `SCHEDULE_FLEXIBILITY`, `ATHLETICS`, `HOMESCHOOL`, `ONLINE`, `ACADEMIC_ACCELERATION`, `ACADEMIC_SUPPORT`, `BETTER_FIT_ENVIRONMENT`, `PERSONALIZED_LEARNING`, `GRADE_PLANNING` (MIDDLE/HIGH_SCHOOL/UNDETERMINED only), `EXPLORING`, `OTHER`. `matching_use` rewritten to remove the now-inaccurate "OTHER needs no mandatory narrative" and document the new required-before-Continue behavior.

### legacy-aliases.json (discovery_reasons, new)

- `question_value_aliases.discovery_reasons`: added `SMALLER_ENVIRONMENT` -> `BETTER_FIT_ENVIRONMENT`, `ADVANCED_COURSES`/`COLLEGE_ADVANCEMENT` -> `ACADEMIC_ACCELERATION`, `CREDIT_RECOVERY` -> `ACADEMIC_SUPPORT`.
- `TRAVEL`, `ARTS`, `FAMILY_INVOLVEMENT` retired from new-entry use via `grade_band_allowed_values` only -- no alias, no removal (their historical meaning is not equivalent to any surviving value, same pattern as `PHONICS`/`FAMILY_TIME` in Phase 3F).

### src/lib/discovery/labels.ts

- `discovery_reasons` overrides updated for all 11 surviving new-entry values (e.g. `ATHLETICS`: "More time for athletics"; `ACADEMIC_SUPPORT`: "More academic support or help getting back on track").

### src/lib/discovery/normalization.ts (derived-fact preservation)

- `supplemental_need`'s `discoveryReasons` check simplified to `["ACADEMIC_SUPPORT", "ACADEMIC_ACCELERATION"]` (the two retired/aliased literals can never appear post-normalization).
- `schedule_flexibility_need`'s `hasRealConstraint` now also checks `ARTS` on `flexibility_reasons`, so that signal keeps its new home now that `ARTS`/`TRAVEL` are gone from `discovery_reasons`' new-entry list.

### tests/discovery-option-count-qa.test.ts

- `DOCUMENTED_EXCEEDING_QUESTIONS` allowlist is now empty (`discovery_reasons` no longer exceeds 12); kept as a named, empty `Set` rather than deleted, so a future over-12 question still must add itself explicitly.

### "Other" required before Continue (new, `src/components/discovery/otherTextGate.ts`)

- New shared `findBlockingOtherTextFields` function, called identically from both `DiscoveryQuestionnaire.tsx` (real profile) and `DiscoveryDemoQuestionnaire.tsx` (demo): blocks stage Continue with an inline error when an active `OTHER` selection's sidecar text is blank or whitespace-only. `QuestionField.tsx`/`OtherTextInput` gained a live (non-debounced) value-getter registration (`registerOtherTextLiveValue`) so Continue always sees the truly current typed text. `validateCompletedProfile`'s existing final Review/Submit REQUIRED check is unchanged and remains the server-authoritative backstop.

## Phase 4 — Deterministic Pathways decision engine (question-bank.json unchanged at 39 questions; rules.json/taxonomy.json/scoring-policy.json/fixtures/golden-profiles.json all bumped)

Owner-authorized: build the deterministic Discovery decision engine only. Full record at `docs/pathways/PHASE4_DECISION_ENGINE_SPEC_V1.md` and `docs/pathways/DECISION_LOG.md` section N. Not merged to main; the final Discovery Report, Report UI, AI, provider matching and Phase 5 were not built.

### question-bank.json

- No question added, removed, or changed. Still 39 questions, version `2.1.0-discovery-ux-simplified`.

### rules.json (1.3.0-phase3f-ux-simplification -> 2.0.0-phase4-engine, 77 rules, 12 RETIRED)

- `normalized_fact_fields` gained `support_structure_need`, `schedule_flexibility_need`, `athletic_schedule_demand`, `family_management_preference`, `advancement_opportunities`.
- New rules: `SCHED_HIGH_001`/`SCHED_VERYHIGH_001` (schedule_flexibility_need-driven, replacing `FLEX_001`), `DELIVERY_001B` (ONLINE_TEACHER_SUPPORTED split out of `DELIVERY_001`), `SUPPORT_HIGH_001`/`SUPPORT_MODERATE_001`/`SUPPORT_LOW_SELFPACED_001`/`SUPPORT_LOW_SELFPACED_HOMESCHOOL_001`/`SUPPORT_HIGH_ONLINE_TRADEOFF` (support_structure_need-driven), `ACAD_ORG_001`/`ACAD_ENGAGE_001`/`ACAD_SCIENCE_001`/`ACAD_ATTENDANCE_001`/`ACAD_COMMUNICATION_001`, `OPP_002B` (flexibility_reasons ARTS trigger, `OPP_002` kept unchanged for legacy explainability), `COST_ALIGNMENT_REVIEW` (FEASIBILITY, empty score_effects).
- Retired: `FLEX_001`, `PAR_001` (blanket PROGRAM_MANAGES reward -- no replacement), `IND_002`, `CONF_001`, `ACAD_007`, `ATH_002`, `CURR_001`, `CURR_002` (B01 continuity is now engine-native, `src/lib/engine/candidates.ts`), `LEARN_001`.
- `LEARN_002` kept evaluable but its B07 target removed (now scores only B03/B06).
- `PAR_002`/`HOME_002` conditions moved from raw `desired_parent_involvement` to the `family_management_preference` derived fact (behaviorally identical 1:1 map); `PAR_002` also now activates `REV_PROGRAM_MANAGEMENT`.
- `ELEM_001`'s `REV_ADULT_SUPPORT` `review_model_scope` widened to include B07.
- `FLEX_002`/`FLEX_003`/`IND_001` gained a `review_model_scope` they were missing (each activated a candidate-scoped review signal without one, which the Phase 4 engine now treats as a global signal unless declared). `FLEX_003` no longer activates `REV_STATE_AVAILABILITY` (engine-native only now, see taxonomy.json below).

### taxonomy.json (1.2.0-phase3e-discovery-calibrated -> 2.0.0-phase4-engine)

- New `review_signals`: `REV_PROGRAM_MANAGEMENT`, `REV_ATTENDANCE_CONTEXT`, `REV_COMMUNICATION_CONTEXT` (all global, never candidate-scoped).
- `REV_COST_ALIGNMENT`'s note updated: now rule-triggered (`COST_ALIGNMENT_REVIEW`), not postprocess-only.

### scoring-policy.json (1.1.0-phase3e-discovery-calibrated -> 2.0.0-phase4-engine)

- Extended with structured, machine-readable fields alongside the existing human-readable prose: `baseline`, `score_bounds`, `group_bounds`, `multipliers`, `display_gate` (object), `diversity` (object), `max_displayed_cards`, `tie_break`, `content_status_values`, `desired_change_groups`, `legacy_safe_mappings_note`, `global_review_signals_never_scope_a_candidate`, `state_availability_policy`. `src/lib/contracts/schemas.ts`'s `scoringPolicySchema` updated to match.

### fixtures/golden-profiles.json (1.1.0-phase0-corrected -> 2.0.0-owner-calibrated)

- Prior fixture (FX01-FX17 + metamorphic_tests) preserved unmodified at `fixtures/golden-profiles.v1-phase0-corrected.json`.
- New canonical fixture: 15 owner-calibrated acceptance personas P01-P15, transcribed verbatim from the owner's Phase 4 instruction.

### src/lib/discovery/normalization.ts

- `computeEffectiveAnswers` now writes the resolved `primaryReason` (from `computeActiveFlow`) into `effective.answers.primary_discovery_reason`, fixing a pre-existing gap where a single-selected discovery reason (no DISC_007 shown) never populated this field at all.
- `deriveScheduleFlexibilityNeed` reordered to take the already-derived `athleticScheduleDemand`; only a real constraint (not bare athlete identity) elevates the tier. `deriveAthleticScheduleDemand`'s real-academic-conflict check gained `VARIES`.

### src/lib/contracts/validate.ts

- New checks: FEASIBILITY rules must have empty `score_effects`; `cost_preference`/`desired_start_timeline`/`parent_context`/`primary_sport`/`athletic_level`/every `*_other_text` field can never appear in a rule condition alongside a non-empty `score_effects`.

### src/lib/engine/ (new module)

- `types.ts`, `conditions.ts`, `rules.ts`, `scoring.ts`, `candidates.ts`, `considerations.ts`, `evaluate.ts`, `hash.ts`, `index.ts`. `evaluateDiscoveryProfile`/`createEngineRun`. No database dependency; no dynamic eval; B10 excluded at the candidate-universe level.

### tests/

- `tests/engine-golden.test.ts` (15 personas x 10 assertions each), `tests/engine-metamorphic.test.ts` (M01-M11), `tests/contracts.test.ts` (updated counts + 3 new negative-control tests), `tests/discovery-calibration.test.ts` (updated for DEC-N2).

## Phase 4.1 — Resolve owner-calibrated engine acceptance conflicts (DEC-N7 resolution; rules.json data-only edit, no version bump beyond 2.0.0-phase4-engine)

Owner-authorized narrow correction resolving DEC-N7. Full record at `docs/pathways/DECISION_LOG.md` section O and `docs/pathways/PHASE4_DECISION_ENGINE_SPEC_V1.md` sections 6a/11. Not merged to main; no Discovery Report, AI, questionnaire change, or Phase 5.

### rules.json (FLEX_002 corrected)

- `FLEX_002`'s `score_effects.B06` changed from `3` to `2`, now identical to `B03` (both `2`). `B04`/`B07`/`B08`/`B09` unchanged. Unavailable academic times are generic remote/virtual-schedule evidence and do not make a privately funded online model (B06) inherently more schedule-compatible than a publicly funded virtual one (B03).

### src/lib/engine/candidates.ts (new)

- `evaluateDirectionalEvidenceGate(modelId, groupContributions, positiveGroups)`: a general qualification requirement applied after the existing display gate, for B02-B09 only. Qualifies when either (A) a raw positive contribution `>= 2` exists in `delivery`/`family_role`/`continuity`, or (B) at least 3 distinct scoring groups have a final positive contribution. B01 is exempt (returns `qualifies: true` immediately).

### src/lib/engine/evaluate.ts

- Applies the Directional Evidence Gate after the base display gate already qualifies a candidate; appends its reason to `displayGate.reasons` when it fails.

### src/lib/engine/index.ts

- Exports `evaluateDirectionalEvidenceGate`.

### fixtures/golden-profiles.json / tests/engine-golden.test.ts

- Removed the Phase 4 follow-up `knownConflicts`/`knownConflictNote` fields and the corresponding conditional `it.fails` mechanism. All P01-P15 assertions are ordinary must-pass tests again; no expected value was changed.

### tests/engine-directional-gate.test.ts (new)

- 12 regression tests (sections A-E of the Phase 4.1 instruction) covering the Directional Evidence Gate and the FLEX_002 correction.

## Phase 5 — Deterministic personalized Discovery Report + report UI

Owner-authorized. Full record at `docs/pathways/DECISION_LOG.md` section P and `docs/pathways/PHASE5_DISCOVERY_REPORT_SPEC_V1.md`. Builds the report layer strictly on top of the unmodified Phase 4.1 engine; no Phase 4 contract (`question-bank.json`/`rules.json`/`scoring-policy.json`/`taxonomy.json`) or `fixtures/golden-profiles.json` changed. Not merged to main; no AI, no provider matching, no enrollment/advisor/payment workflow.

### report-contract.json (`1.0.0-candidate` -> `2.0.0-phase5-report`)

- Version bumped and a `corrections_applied` note added describing that the `public_dto` shape is now implemented exactly by `src/lib/report/types.ts`'s `DiscoveryReportDTO`, produced by `src/lib/report/assemble.ts`. The shape/forbidden-field contract itself is unchanged; wording/templates now live in the new `report-content.json`.

### report-content.json (new, `1.0.0-phase5-report`)

- Archetype copy for the 8 documented report archetypes (`CURRENT_PLUS_GROWTH`, `FLEXIBLE_WITH_STRUCTURE`, `HIGH_DEMAND_SCHEDULE`, `ADVISOR_FIRST_PLACEMENT_REVIEW`, `RECOVERY_PLUS_ADVANCEMENT`, `FIT_THEN_FEASIBILITY`, `LIMITED_EXPLORATION`, `GENERIC_PERSONALIZED`), per-model candidate-card copy (archetype-specific keys with a `${modelId}__GENERIC` fallback for every ACTIVE base model B01-B09), support/opportunity/overlay tile copy for every ACTIVE taxonomy id, approved public translations for every ACTIVE review signal, pathway/CTA templates, the one authorized `PROFILE_CONTEXT:cost_preference` comparison question, and a `forbidden_claims` list.

### fixtures/golden-reports.json (new, `1.0.0-owner-calibrated`)

- Seven owner-calibrated Golden Report fixtures (GR01/GR03/GR06/GR09/GR12/GR14/GR15), each referencing a `personaId` into `fixtures/golden-profiles.json` -- never duplicating the raw Discovery profile.

### src/lib/contracts/schemas.ts, loader.ts, validate.ts, index.ts

- New `reportContentSchema`/`loadReportContent`/`ReportContent` type. New `validateReportContent` check folded into `validateContracts`'s single result (see DEC-P3 for the full list of guarantees it enforces).

### src/lib/report/* (new)

- `types.ts`, `archetypes.ts`, `snapshot.ts`, `insights.ts`, `directions.ts`, `support-map.ts`, `comparisons.ts`, `pathway.ts`, `cta.ts`, `provenance.ts`, `assemble.ts`, `index.ts`. `assembleDiscoveryReport(input, contracts, createdAt)` is the pure, deterministic entry point every route calls; it never rescores, reranks, replaces, or invents a candidate.

### src/server/discovery-draft.ts

- New read-only `loadLatestCompletedRevision(db, sessionId)`, alongside the existing `hasCompletedRevision`/`reopenForEditing`.

### app/discover/report/page.tsx (rewritten) and app/discover/report/demo/page.tsx (new)

- Production route now renders the real Phase 5 report (previously a development-preview placeholder). New DB-free synthetic demo route at `/discover/report/demo?fixture=GR0x` for visual QA without DEC-G9's DB gap.

### src/components/report/* (new)

- `ReportHero`, `PriorityChips`, `InsightSection`, `DirectionCard`, `DirectionGrid`, `SupportOpportunityMap`, `ComparisonGuide`, `PathwayRoadmap`, `ConversionBand`, `MobileReportCta`, `ReportView`.

### tests/report-golden.test.ts, tests/report-structural.test.ts, tests/report-invariants.test.ts, tests/report-forbidden-copy.test.ts (new)

- 94 + 150 + 13 + 15 = 272 new tests. Full Vitest suite: 421 pre-existing + 272 new = 693 passed.

## Phase 5.1 — End-to-end interactive Discovery demo integration

Owner-authorized. Full record at `docs/pathways/DECISION_LOG.md` section Q and `docs/pathways/PHASE5_1_END_TO_END_DEMO_INTEGRATION.md`. Integration-only phase on top of the unmodified Phase 4/Phase 4.1/Phase 5 layers; no question bank, rules, scoring policy, taxonomy, report content, Golden Profile, or Golden Report contract changed. Not merged to main; no AI, no database/session/cookie/browser-storage persistence added to the interactive demo, no URL answer payload.

### src/lib/report/profile-context.ts (new)

- `buildReportProfileContext({ rawAnswers, profileRevisionId, gradeBand })`, replacing three previously-duplicated inline copies of the same presentation-only field-extraction logic. Re-exported from `src/lib/report/index.ts`. Contains no educational-decision logic.

### app/discover/demo/actions.ts

- New DB-free `buildDemoDiscoveryReport(rawAnswers)` server action: validates the raw answer snapshot, runs the real Phase 4 engine (`evaluateDiscoveryProfile`), derives a deterministic `profileRevisionId` (`demo_interactive_<effectiveProfileHash prefix>`, never random, never in the URL), and assembles the report (`assembleDiscoveryReport`) with a fixed `consultationState: "UNCONFIGURED"`/`saveAvailable: false` and a fixed demo `createdAt`. Stale doc comments claiming Phase 4 was "not authorized" were corrected.

### src/components/report/ReportView.tsx, ReportView.module.css

- `isDemoRoute: boolean` prop replaced by `demoLabel?: string` plus a new `secondaryTopAction?: ReactNode`. UI component prop-API change only — `DiscoveryReportDTO`/`report-contract.json` unchanged. `.topActions` gained `flex-wrap`/`gap` to accommodate two top actions.

### app/discover/report/page.tsx, app/discover/report/demo/page.tsx

- Both routes' inline profile-context extraction replaced by the new shared `buildReportProfileContext` helper (DEC-Q1), with confirmed byte-identical output. The Golden fixture demo route now passes `demoLabel="Synthetic report demo"` in place of the removed `isDemoRoute` prop; its own behavior is otherwise unchanged.

### app/discover/demo/page.tsx, src/components/discovery/DiscoveryDemoQuestionnaire.tsx

- The old `CompletionScreen` ("Discovery Demo Complete") removed entirely; successful Review now generates and displays the real Phase 5 report via `<ReportView demoLabel="Interactive Discovery demo — answers are not saved">`, rendered outside the questionnaire's own narrow-width wrapper. New "Review or Edit My Answers" (returns to Review in place, preserving all answers) and "Start Demo Again" (clears all state) actions. Review button copy changed to "See My Personalized Discovery Report" / "Building Your Discovery Report…". An unexpected report-generation error shows a dedicated retry screen without erasing answers.

### src/components/discovery/DiscoveryQuestionnaire.tsx (production)

- Same Review button copy change, for wording parity only; `submitProfileAction`'s redirect-to-`/discover/report` behavior is unchanged.

### tests/discovery-demo-report.test.ts (new)

- Pipeline tests for P01/P03/P09/P12/P15 (no mocked `EngineEvaluation`) plus demo/Golden-fixture parity tests for GR01/GR03/GR12/GR15. 25 new tests.

### tests/e2e/discovery-demo-integration.spec.ts (new), plus updates to discovery-demo.spec.ts, discovery-profile.spec.ts, discovery-scroll.spec.ts, discovery-visual-qa.spec.ts

- New end-to-end coverage for the interactive demo's questionnaire → report → edit → regenerate → restart → refresh-reset → persistence-safety flow; existing specs updated for the new button wording and report-based completion state. Full Playwright suite: 160 passed. Full Vitest suite: 693 pre-existing + 25 new = 718 passed.

## Phase 5.1a — Final end-to-end demo acceptance cleanup

Owner-authorized narrow acceptance cleanup on top of Phase 5.1. Full record at `docs/pathways/DECISION_LOG.md` section R and the addendum to `docs/pathways/PHASE5_1_END_TO_END_DEMO_INTEGRATION.md`. No question bank, rules, scoring policy, taxonomy, report content, Golden Profile, or Golden Report contract changed. Not merged to main; no AI, no persistence added.

### tests/e2e/discovery-demo-integration.spec.ts

- New material structured-answer edit/regenerate test: changes `school_change_preference` from unanswered to `STAY_CURRENT` between report generations on the stable K-4 input path, and asserts the regenerated report's `contentStatus`/displayed candidate/headlines actually change (a real Phase 4 engine input, verified against the real pipeline). Kept alongside the existing student-name-change test.
- Every `h1:not(#discovery-demo-heading)` selector replaced with a plain `page.locator("h1")` count-1 assertion, now that DEC-Q7 is resolved.

### app/discover/demo/page.tsx, app/discover/report/demo/page.tsx

- The route-landmark heading used only for `<Section>`'s `aria-labelledby` is now a non-heading, visually-hidden `<span>` instead of an `<h1>`. No visual change.

### src/components/discovery/DiscoveryDemoQuestionnaire.tsx

- Now renders its own visually-hidden `<h1>Discovery Preview Demo</h1>` directly, but only while no report exists; once a report exists, this heading stops rendering and `ReportHero`'s own `<h1>` becomes the page's sole H1. Resolves DEC-Q7: exactly one H1 in the questionnaire state, exactly one in the interactive report state, and exactly one on the Golden fixture demo route (verified in real Chromium).

### tests/e2e/discovery-demo.spec.ts, discovery-scroll.spec.ts

- Remaining `h1:not(#discovery-demo-heading)` workarounds replaced with plain `page.locator("h1")` assertions.
- `discovery-scroll.spec.ts`'s report-scroll test also fixed a pre-existing, unrelated test bug found during reverification (DEC-R4): it checked the ReportHero H1's own position for "scrolled to top," when the H1 sits well below the demo label/top actions/hero eyebrow-title-badge; now checks the demo label (the anchor container's real first content) instead.
