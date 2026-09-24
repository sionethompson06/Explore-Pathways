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
