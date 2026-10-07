# Discovery Calibration Spec V2 (Phase 3E)

**Status:** IMPLEMENTED. Authoritative repo source of truth for the Phase 3E discovery calibration -- a controlled enhancement of the existing Phase 3 Discovery build, not a new phase. **Phase 4 (the recommendation engine, scoring evaluator, final Discovery Report) is not authorized by this spec and was not started.**

This document records *what was approved and implemented*. The line-by-line mechanics of every contract change are in `contracts/CHANGELOG.md`'s "Phase 3E" section; the owner-decision rationale for each non-obvious call is in `docs/pathways/DECISION_LOG.md` section K (DEC-H1 through DEC-H6). This file is the index and the UX/architecture record; it does not repeat every value mapping those two files already state precisely.

## 0. Repository state this spec was built against

Branch `claude/kind-gauss-f2d7ng`, starting HEAD `dbd0842` (Phase 3D, scroll/focus UX fix). Confirmed before any code change: 39 canonical question definitions in `contracts/question-bank.json`; `contracts/rules.json` and `contracts/scoring-policy.json` are Zod-validated but have no evaluator anywhere in the codebase (`grep -rln` for either file's consumers returns only `src/lib/contracts/{loader,schemas,validate}.ts`) -- Phase 4 genuinely does not exist yet, so editing their *data* is safe and inert at runtime. `fixtures/golden-profiles.json` is similarly unexecuted (only exposed as a path constant in `loader.ts`) and was deliberately left untouched.

**Question-bank version:** `1.1.0-phase0-corrected` -> `2.0.0-discovery-calibrated` (a contract-level major bump: enum choices, branch conditions, wording and semantic behavior all materially changed).

## 1. UX principle (hard owner decision, unchanged from the approved instruction)

Discovery is not an intake form. Every reworded question wording, option label and helper text is positive/possibility-oriented -- never diagnostic, never anxiety-inducing, never pressuring, never implying a provider is already available or that the student is already eligible for anything. **There is no interpretive "what we're hearing" moment anywhere in the questionnaire.** The flow remains exactly: Questions -> adaptive questions -> Review -> Complete. A future reflective synthesis belongs to the completed Discovery Report in a later phase (Phase 5+), explicitly not built here. Demo completion (`/discover/demo`) remains a neutral completion state -- no fabricated recommendation cards.

## 2. What changed, by mechanism

### 2.1 Wording, options and grade-tiering (question-bank.json)

Nearly every question's `parent_wording` was reworked to positive language; several gained `helper_text` and/or per-option `option_helpers`. A new, generic `grade_band_allowed_values` mechanism (DEC-H1) lets a question's *new-entry* option set differ by grade band while `allowed_values` keeps every legacy value so historical raw answers keep validating and Review keeps reading them back correctly. Full per-question detail: `contracts/CHANGELOG.md` "Phase 3E" section. Still exactly 39 canonical question IDs -- no question was added, removed, or renamed.

### 2.2 Legacy value migration (never rewriting raw history)

`contracts/legacy-aliases.json` gained two new sections, applied only inside `computeEffectiveAnswers` (`src/lib/discovery/normalization.ts`) and never to raw stored answers or the Review screen's own display:

- `question_value_aliases`: a retired value maps to its canonical replacement for effective evaluation only (`discovery_reasons`'s three retired environment values -> `BETTER_FIT_ENVIRONMENT`; `advancement_interests`'s `DUAL_ENROLLMENT`/`COLLEGE_COURSES` -> `COLLEGE_LEVEL_COURSES`).
- `question_value_removals`: a retired value with no forward-compatible replacement is simply dropped from effective evaluation (`preferred_learning_environment`'s `BOOKS`/`TECHNOLOGY`; `family_priorities`'s `ACADEMIC_QUALITY` -- explicitly *not* aliased to the new `STRUCTURE_ACCOUNTABILITY`, since the two are not semantically equivalent).

Both are deduplicated on application, so a profile carrying both a legacy and its canonical value (or two legacy synonyms) never produces a duplicate effective entry.

### 2.3 Branching (src/lib/discovery/branching.ts)

Two branches were retired and replaced, and one was fixed mid-phase after its own new test coverage caught a dead condition:

- `FLEXIBILITY_VERY_OR_ESSENTIAL` -> `SCHEDULE_CONSTRAINT_CONTEXT`: broadened to also include `SOMEWHAT` flexibility and any already-stated schedule-intensive `discovery_reasons` (`ATHLETICS`/`TRAVEL`/`ARTS` -- always active, never gated). **DEC-H6**: the first implementation read this secondary signal from `flexibility_reasons` (DISC_014), which is itself gated behind the same flexibility-importance condition and so could never independently fire; caught by `tests/discovery-calibration.test.ts` before commit and corrected to read `discovery_reasons` instead.
- `ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED` -> `HOME_OR_REMOTE_SUPPORT_CONTEXT` (**DEC-H5**): now requires home/remote learning to actually be under consideration (a homeschool/online discovery reason, or a home/remote `desired_delivery` selection) before the elementary-grade-band-or-support-need condition can activate it -- a genuine bug fix, since the retired predicate asked every elementary family about daytime supervision regardless of whether home/remote learning was ever mentioned.
- New `AGE_CONTEXT_USEFUL`: DISC_003 (`student_age`) is active only for `current_grade` `OTHER`/`UNKNOWN`, or when `GRADE_PLANNING` is among the discovery reasons -- no longer universal, and never used to infer placement/eligibility/acceleration/retention.

### 2.4 Normalized facts (src/lib/discovery/normalization.ts, src/lib/discovery/types.ts)

Five new fields on `DerivedFacts`, all deterministic, conservative, and explicitly not a public score or Phase 4 output:

| Fact | Type | Source(s) |
|---|---|---|
| `support_structure_need` | `LOW\|MODERATE\|HIGH\|UNKNOWN` | DISC_011 primary; `STRUCTURE_ACCOUNTABILITY` priority / live-teacher-or-small-group preference can only raise it |
| `schedule_flexibility_need` | `LOW\|MODERATE\|HIGH\|VERY_HIGH\|UNKNOWN` | DISC_013 primary; a real DISC_032 conflict, DISC_014 reason, or already-stated `discovery_reasons` context can only raise it |
| `athletic_schedule_demand` | `LIGHT\|MODERATE\|SUBSTANTIAL\|HIGHLY_CONSTRAINED\|UNKNOWN` | weekly hours + travel frequency + real academic-time conflict -- **never** `athletic_level` (prestige) |
| `family_management_preference` | `HIGH_FAMILY_INVOLVEMENT\|SHARED_RESPONSIBILITY\|LIGHT_FAMILY_MANAGEMENT\|PROGRAM_LED\|UNKNOWN` | direct 1:1 map from DISC_027 |
| `advancement_opportunities` | 10 independent booleans | legacy-normalized DISC_022 + DISC_034; deliberately not mutually exclusive |

`UNKNOWN` means "not enough active evidence yet," never a real tier. `cost_preference`, `desired_start_timeline` and `parent_context` (free text) feed none of these -- verified directly in `tests/discovery-calibration.test.ts`.

### 2.5 Contract-level reconciliation (rules.json, taxonomy.json, scoring-policy.json)

Data/documentation-only changes, per Section 16's boundary (stale enum refs, impossible branch refs, legacy mappings, taxonomy reachability for newly captured interests -- never a Phase 4 evaluator, scoring weights, or report UI):

- `ADV_003` retired (replaced by `ADV_004`, whose condition now matches `COLLEGE_LEVEL_COURSES`); `OP04` retired in taxonomy to match (DEC-H3).
- `ADV_006` extended to include `ADVANCED_ELA`.
- `ENV_001`'s condition updated to the single canonical `BETTER_FIT_ENVIRONMENT` (rules read *effective*, already-normalized answers).
- `COST_001` retired, no replacement (DEC-H2) -- cost is feasibility context, never an alignment score input; `REV_COST_ALIGNMENT` remains the only mechanism by which cost reaches a future report.
- Five new rules (`ADV_009`-`ADV_013`) reach DISC_022 options that previously activated nothing (`ENRICHMENT`, `CHALLENGING_COURSEWORK`, `WORK_BASED_LEARNING`, `INDUSTRY_CREDENTIALS`, `ENTREPRENEURSHIP`); all have empty `score_effects` (signals only).
- `OP07`/`OP09`/`OP12` moved `RESERVED` -> `ACTIVE` (DEC-H4); `OP13`/`OP15` remain the only forever-reserved opportunities.
- `scoring-policy.json` gained `BETTER_FIT_ENVIRONMENT`/`STRUCTURE_ACCOUNTABILITY` group mappings and a postprocess-rules line documenting DEC-H2.

Rule count: 55 -> 60 (57 evaluable + 3 retired: the pre-existing `HOME_003`, plus `ADV_003` and `COST_001`).

### 2.6 UI threading

`present.ts` now consults `grade_band_allowed_values` when present and threads `helper_text`/`option_helpers` into `QuestionDescriptor`/`OptionDescriptor` (new optional fields, `src/components/discovery/types.ts`). `QuestionField.tsx` (shared by both `/discover/profile` and `/discover/demo` -- no duplicate demo-only logic) renders the question-level helper via the existing `.hint` class and a new per-option `.optionHelper` class, and its multi-select exclusivity set now also includes `NONE_CURRENTLY` to mirror the server-authoritative `EXTRA_EXCLUSIVE_VALUES` in `validation.ts`.

## 3. Two architectural boundaries, documented but not implemented

- **Educational alignment vs. practical feasibility** (Section 12): academic direction, support structure, schedule needs, delivery preferences, family role, social needs and continuity preference are EDUCATIONAL ALIGNMENT; cost, location, service/provider availability, state restrictions, attendance/schedule requirements, credit acceptance and other implementation constraints are PRACTICAL FEASIBILITY. Phase 3E creates/normalizes the facts needed to keep these distinct (DEC-H2 is the concrete instance) but does not implement the engine that will consume the distinction.
- **Cross-answer invariants** (Section 13, for future Phase 4 testing, not implemented here): high flexibility and high support need can coexist; homeschool with low adult availability remains explorable but needs a support plan; online with high peer-importance remains viable with a social plan; athletics without a real schedule conflict must not push alternative schooling; staying at the current school with a targeted need remains legitimate; recovery and advancement may coexist (`advancement_opportunities` is independent of any credit-recovery field, by construction); `OPEN_TO_RECOMMENDATIONS` must never receive an automatic bonus (verified directly in test).

## 4. Verification performed

- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm vitest run`: full contract referential-integrity suite (`tests/contracts.test.ts`) green against the updated rule/taxonomy counts; new `tests/discovery-calibration.test.ts` (50 cases) covers legacy normalization, grade-tiered options, the new branches, all five derived facts, `NONE_CURRENTLY`/`OPEN_TO_RECOMMENDATIONS` exclusivity and non-bonus behavior, and hidden-answer invalidation for the new branches; existing branching/validation/demo suites updated only where the question-bank version string changed, otherwise pass unmodified.
- Six pre-existing suites (`access-control`, `discovery-draft`, `discovery-security`, `magic-link`, `principal`, `session`) fail in this sandbox purely because no local PostgreSQL is reachable and `.env.local` is not auto-loaded by Vitest -- a pre-existing, already-tracked environment limitation (Phase 3B, DEC-G9), unrelated to this phase's code; the real CI environment provisions a database service for these.

## 5. Explicit scope exclusions (per the owner instruction, not gaps)

- No Phase 4 evaluator, no scoring weights for the new derived facts, no recommendation cards, no ranking UI, no percentages, no AI report prose.
- No change to the hosted database provisioning problem (DEC-G9, still open) or to the `/discover/demo` DB-free path's own architecture.
- `fixtures/golden-profiles.json` left byte-identical -- confirmed dormant/unexecuted, rewriting it was out of scope for a phase that implements no consuming engine.
- B10 / Future Pathways mastery exclusion untouched.
