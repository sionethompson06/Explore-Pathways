# Discovery UX Simplification (Phase 3F)

**Status:** IMPLEMENTED. A controlled refinement of the Phase 3E calibrated Discovery questionnaire after owner manual review -- not a new phase, and not Phase 4. This document is layered on top of `docs/pathways/DISCOVERY_CALIBRATION_SPEC_V2.md` (Phase 3E), which it does not overwrite or supersede except where explicitly noted below. **Phase 4 (the recommendation engine, scoring evaluator, final Discovery Report) is not authorized by this document and was not started.**

## 0. Owner rationale

Manual review of the Phase 3E build found several questions still presenting too many cards at once, some wording still longer than it needed to be, and one section (Learning) asking about independent-work style before the family had even said how their student learns. Phase 3F is a targeted simplification pass: shorter questions, fewer cards per screen (an 8-12 target, never a hard rule that would destroy information), a better question order, and a lightweight "Other" escape hatch for the handful of questions where a fixed list can never cover every family. No question was removed, no canonical question ID was added, and no branch, review, or normalization guarantee from Phase 3C/3D/3E was weakened.

## 1. Global standard applied

Target 8-10 visible choices per question, 12 as a loose ceiling, never a target to hit mechanically at the cost of real information. Where a list still needed to shrink, the priority order actually used (Phase 3F section 17) was: (1) remove true duplicates, (2) combine closely related concepts into one new canonical umbrella value, (3) let an existing later question own that detail instead, (4) add "Other" with a short free-text elaboration. `docs/pathways/DECISION_LOG.md` section L records each judgment call.

`discovery_reasons` (DISC_006) is the one question still over 12 choices after this pass (15-18 depending on grade band) -- deliberately not touched, because it is the single most heavily depended-upon field in `branching.ts` (five predicates) and `rules.json` (`ENV_001`), Phase 3F's own field-by-field instructions (sections 3-15) enumerated every other long-list question but not this one, and a real reduction there would mean redesigning branch predicates and rule conditions well beyond a wording/option-consolidation pass. `tests/discovery-option-count-qa.test.ts` names this exception explicitly (an allowlist of one field, visible and reviewable) rather than silently exempting it, so a second question can never quietly grow past 12 unnoticed.

## 2. Questions changed (exact wording)

| Field | Old wording | New wording |
|---|---|---|
| desired_primary_change (DISC_008) | "If the right educational plan were in place, what would you most like it to make possible?" | "What would you most like your student's education to provide?" |
| reported_academic_position (DISC_009) | "Which best describes how learning is going overall right now?" | "How is your student's learning going now?" |
| reported_support_needs (DISC_010) | "Where could the right support make the biggest difference?" | "Where would you need the most support?" |
| learning_support_pattern (DISC_011) | "When your student is working on their own, what level of support helps them do their best?" | "How does your student work best?" |
| preferred_learning_environment (DISC_012) | "What kinds of learning experiences tend to bring out your student's best?" | "How does your student learn best?" |
| flexibility_importance (DISC_013) | "How much schedule flexibility would be helpful for your family?" | "How much flexibility would be helpful?" |
| desired_delivery (DISC_033) | "Which ways of learning are you open to exploring?" | "What learning opportunities are you open to exploring?" |
| reported_graduation_status (DISC_024) | "How clear does your student's path to graduation feel right now?" | "How clear is your student's path to graduation?" |
| in_person_peer_preference (DISC_E03) | "How important is regular in-person connection with other students?" | "How important is in-person learning with other students?" |

`school_change_preference` (DISC_031) and `advancement_interests` (DISC_022) keep their existing wording (per the instruction, unchanged) but had their card order/labels/option list changed -- see below. `flexibility_reasons` (DISC_014) keeps its exact existing wording, per the instruction's explicit "KEEP."

Helper text removed entirely: DISC_026 ("Choose up to three. There are no wrong answers...") and DISC_E03 ("Think about the school day, learning groups, activities, clubs..."). DISC_010's helper ("Choose any areas where a little more support...") was also removed. DISC_012 keeps its "Choose up to three." helper (still needed to communicate the selection limit).

## 3. Option consolidations and reductions

**DISC_031 (school_change_preference):** card order fixed to `STAY_CURRENT` ("Improve what we already have"), `SEEKING_CHANGE` ("Explore a different educational fit"), `OPEN_TO_CHANGE` ("Open to both"), `UNKNOWN` ("We're still figuring it out"); the three descriptive per-option helper sentences were removed. Continuity semantics unchanged.

**DISC_008 (desired_primary_change):** `OUTSIDE_OPPORTUNITIES` retired from new-entry use (kept for historical answers) in favor of a plain `OTHER` card (no inline text -- not one of the five fields listed in section 2). 11 new-entry choices at MIDDLE/HIGH_SCHOOL/UNDETERMINED, 10 at ELEMENTARY (K-4 still hides `COLLEGE_COURSES`). Before -> after: 11 -> 11 (content changed, count held).

**DISC_026 (family_priorities):** `ATHLETIC_FLEXIBILITY` and `LOCATION_FLEXIBILITY` retired (athletics/schedule questions already capture why flexibility matters), `ADVANCED_COURSES` retired (covered by `ACADEMIC_ADVANCEMENT` + later advancement questions), `ACCREDITATION`/`DIPLOMA` retired without a combined replacement (judged unnecessary -- neither was reachable by any rule, and `scoring-policy.json` already documents that neither proves generic-model superiority). None of these five are aliased to a survivor; they are simply retired, like `ACADEMIC_QUALITY` in Phase 3E. Added `OTHER` with inline text. Before -> after: ELEMENTARY 14 -> 11, MIDDLE/HIGH_SCHOOL/UNDETERMINED 16 -> 12.

**DISC_010 (reported_support_needs):** `ROUTINES`/`ORGANIZATION`/`TIME_MANAGEMENT`/`TASK_COMPLETION`/`STUDY_SKILLS` consolidated into new canonical `ORGANIZATION_STUDY_HABITS` ("Organization and study habits"); `ENGAGEMENT`/`CONFIDENCE` consolidated into new canonical `ENGAGEMENT_CONFIDENCE` ("Engagement and confidence"); both aliased from every legacy value. `PHONICS` retired from this universal screen (still reachable via DISC_E01's elementary foundational follow-up, unaliased -- historical `PHONICS` answers keep their own effective meaning). `MISSING_CREDITS` ("Credits or graduation") grade-tiered to HIGH_SCHOOL/UNDETERMINED only. Added `max_selections: 3` and `OTHER` with inline text. Before -> after: 17 (ungated) -> 11 (ELEMENTARY/MIDDLE) / 12 (HIGH_SCHOOL/UNDETERMINED).

**DISC_014 (flexibility_reasons):** `ATHLETIC_TRAINING` is the new-entry umbrella for athletics/training/competition ("Athletics, training, or competition"); `COMPETITION`/`ATHLETIC_TRAVEL` retired from new-entry use and aliased to it. `WORK` is the new-entry umbrella for work/entrepreneurship ("Work or entrepreneurship"); `BUSINESS` retired and aliased to it. `FAMILY_TIME` retired from new-entry use only -- deliberately **not** aliased (not a safely equivalent meaning to `FAMILY_RESPONSIBILITIES`/`OTHER`); historical `FAMILY_TIME` answers keep their own effective value. Before -> after: ELEMENTARY/MIDDLE 11 -> 8, HIGH_SCHOOL/UNDETERMINED 14 -> 10.

**DISC_022 (advancement_interests):** DISC_034 now owns subject-area detail exclusively, so `ADVANCED_MATH`/`ADVANCED_SCIENCE`/`ADVANCED_ELA` are retired from new-entry use at every grade band and aliased to `CHALLENGING_COURSEWORK` (identical `ADV_010` activation target -- no Phase-4-relevant distinction lost; `ADV_006` was narrowed to `HIGH_SCHOOL_EARLY` only for the same reason). New canonical `HONORS_AP` ("Honors/AP", HIGH_SCHOOL tier) activates both `OP02` and `OP03` via new rule `ADV_014` -- legacy `HONORS`-only/`AP`-only answers are **not** aliased to it and keep activating their own more precise single-opportunity rule. New canonical `CAREER_CTE_CREDENTIALS` ("Career/CTE or industry credentials", HIGH_SCHOOL tier only) activates both `OP08` and `OP09` via new rule `ADV_015`; MIDDLE tier keeps plain `CAREER_CTE` ("Career/technical exploration", a grade-conditional label) since industry credentials was never offered at that tier. Added `OTHER` with inline text at every tier. Before -> after: ELEMENTARY 6 -> 5, MIDDLE 11 -> 10, HIGH_SCHOOL 13 -> 11, UNDETERMINED 11 -> 10.

**DISC_012 (preferred_learning_environment):** added a plain `OTHER` card (9 total new-entry choices) with **no** inline text -- judged unnecessary complexity for this question, an explicit Phase 3F discretion point (section 8). `BLEND`/`HANDS_ON`/`MOVEMENT` labels reworded ("A mix of independent and live learning" / "Hands-on/project-based" / "Movement/active learning"). `BOOKS`/`TECHNOLOGY` remain retired from Phase 3E.

## 4. DISC_012 -> DISC_011 order and branch decision

DISC_012 ("How does your student learn best?") now precedes DISC_011 ("How does your student work best?") in both `stages.ts`'s LEARNING field list and `branching.ts`'s `EVALUATION_ORDER` -- both fields are `show_when: "ALL"`, so this is a pure display/evaluation reordering, not a behavior change for either predicate.

**Branch decision (documented per the instruction's explicit requirement):** DISC_011 stays `show_when: "ALL"` -- broadly active immediately after DISC_012 -- rather than becoming a DISC_012-gated follow-up shown only for `SELF_PACED`/`BLEND`. The instruction's own minimum ("if SELF_PACED is selected, DISC_011 MUST show; if BLEND is selected, DISC_011 MUST show") is satisfied trivially by this choice, and the instruction's own escape hatch applies: "if hiding DISC_011 for some learning modes would weaken support_structure_need or create unsupported inference, it is acceptable to keep DISC_011 broadly active." Since `support_structure_need`'s only primary signal is DISC_011 itself, hiding it for `LIVE_TEACHER`/`HANDS_ON`/`SMALL_GROUP`/`ONE_TO_ONE`/`MOVEMENT` (most of DISC_012's answer space) would have left that derived fact `UNKNOWN` for the majority of families -- a real regression, not a simplification. `INDEPENDENT_WORK_DIFFICULT` is retired from new-entry use and aliased to `CLOSE_ADULT_SUPPORT` (both already produced identical `HIGH` `support_structure_need` output), leaving a simpler 5-answer set: Independently / With occasional check-ins / With regular guidance / With frequent support / I'm not sure yet.

## 5. In-person peer-learning semantic clarification (DISC_E03)

Reworded to "How important is in-person learning with other students?" with its explanatory helper removed. This question measures **in-person peer learning preference** specifically -- whether a fully remote/home pathway would need a deliberate in-person social/learning plan -- and must never be read, scored, or reported as a general social-development or psychological measure. `contracts/question-bank.json`'s `matching_use` for this question states this explicitly for any future Phase 4 author.

## 6. "Other" inline free-text architecture

Five fields declare an `other_text_field` sidecar on their own canonical question record (`contracts/question-bank.json`): `discovery_reasons`, `reported_support_needs`, `flexibility_reasons`, `advancement_interests`, `family_priorities`. This is a **typed, server-validated sidecar associated with the parent question**, not a 40th+ canonical question -- the registry (`src/lib/discovery/registry.ts`) maps each sidecar field name back to its parent `Question`, and `KNOWN_FIELDS` includes both. `preferred_learning_environment` and `desired_primary_change` deliberately do **not** get this treatment (explicit Phase 3F discretion, documented above and in section 8/2 of the instruction).

- **Client (`QuestionField.tsx`):** selecting `OTHER` in a multi-select reveals an inline, debounced text input (mirrors `ShortText`'s pattern); unchecking `OTHER` clears its sidecar value via the same generic `onCommit`.
- **Validation (`validation.ts`):** the sidecar field validates as short text, sanitized, capped at 150 characters (`OTHER_TEXT_MAX_LENGTH`), independent of any `Question` object. `validateCompletedProfile` requires nonblank sidecar text if and only if the parent's active value currently includes `OTHER` -- enforced at the same completion boundary every other `required_when_shown` field already uses (there is no per-stage "Continue" validation gate in this architecture; only Review/Submit is authoritative).
- **Normalization (`normalization.ts`):** the sidecar value is effective **only** while its parent is active and its parent's (already legacy-normalized) value still includes `OTHER` -- enforced server-side regardless of client behavior, so a stale value can never leak into a future evaluator.
- **Review:** the sidecar text is appended to the SAME Review row as its parent (`(Other: "...")`), not a second fabricated row for a field that isn't itself a canonical question. Editing returns to the same stage, where the input reappears with its current value.
- **Storage/URL:** persisted exactly like any other field in the same `draftAnswers` JSON blob (real profile) or in-memory `rawAnswers` (demo) -- never in the URL, never in demo browser storage, matching every other Discovery answer's existing guarantees.
- **Never a derived-fact input.** No function in `normalization.ts` reads any `*_other_text` field.

## 7. Derived-fact changes required by consolidation

- `advancement_opportunities.subject_challenge` now comes solely from DISC_034 (`subject_advancement_interests`) -- the `ADVANCED_MATH`/`ADVANCED_SCIENCE`/`ADVANCED_ELA` clause was removed from its DISC_022-based check, since those values no longer carry subject-specific signal on DISC_022 (they alias to `CHALLENGING_COURSEWORK`) and DISC_034 is the architecturally correct sole source per section 13's own instruction.
- `advancement_opportunities.advanced_coursework` additionally checks `HONORS_AP`.
- `advancement_opportunities.career_cte` and `.industry_credentials` both additionally check `CAREER_CTE_CREDENTIALS` -- one combined selection sets both flags, mirroring rule `ADV_015`'s dual `OP08`+`OP09` activation.
- No new derived fact was added and no existing derived fact's public shape changed. No public numeric score exists or was added. Other-text is not read by any derived fact.

## 8. No mid-survey reflection

Unchanged from Phase 3E: the flow remains Questions -> adaptive questions -> Review -> Complete, with no "what we're hearing," interim analysis, personalized interpretation, recommendation, or reflection card anywhere between stages. Verified directly in Playwright (`tests/e2e/discovery-demo.spec.ts`) and by manual visual QA (section 24 of the Phase 3F instruction) at 375/768/1440px.

## 9. Confirmation

Phase 4 (the recommendation engine, scoring evaluator, final Discovery Report) was not started by this document or by any code change in this phase.
