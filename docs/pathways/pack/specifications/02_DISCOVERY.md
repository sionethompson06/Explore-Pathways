# Specification 02 - Discovery Questionnaire, normalized
The complete registry is contracts/question-bank.json. DISC IDs are stable. UI grouping can change without changing IDs or meanings. The registry contains 38 question definitions, not a promise to show 38 questions to each family.

## Experience
Use short screens grouped into Student, Goals, Learning, Schedule, Conditional interests, Family preferences, and Review. Most inputs are buttons/chips rather than typing. Keyboard and screen-reader controls must work. Back/edit, refresh/resume within the session, validation errors, loading and recovery are required.

No timer or claim of 'five minutes' until measured. Calculate progress against the current visible branch, and explain when a changed answer adds questions. An interest clicked on the homepage is an editable preselection, not a hidden permanent answer.

## Branch registry
ALL: universal questions, with developmental option filters.
MULTIPLE_DISCOVERY_REASONS: at least two nonexclusive selected reasons; otherwise derive the sole reason.
PRIMARY_REASON_UNCLEAR: primary reason OTHER, EXPLORING or UNKNOWN.
FLEXIBILITY_SOMEWHAT_OR_HIGHER: SOMEWHAT, VERY_IMPORTANT or ESSENTIAL.
FLEXIBILITY_VERY_OR_ESSENTIAL: VERY_IMPORTANT or ESSENTIAL.
ATHLETICS_INTEREST: DISC_006 ATHLETICS, or DISC_014 ATHLETIC_TRAINING/COMPETITION/ATHLETIC_TRAVEL.
ATHLETICS_INTEREST_AND_MIDDLE_OR_HS: prior condition plus MIDDLE/HIGH_SCHOOL.
GRADE_PLANNING_REASON_AND_MIDDLE_OR_HS: explicit GRADE_PLANNING plus applicable band.
ADVANCEMENT_INTEREST_OR_REPORTED_AHEAD_OR_MIXED: explicit academic advancement reason, an advancement-oriented primary desired change, or AHEAD/MIXED reported academic position. This permits a question, not a readiness conclusion.
HIGH_SCHOOL_OR_MIDDLE_WITH_ADVANCEMENT_INTEREST: all HIGH_SCHOOL, or MIDDLE with explicit advancement interest.
HIGH_SCHOOL_AND_GRADUATION_OR_CREDIT_CONCERN: HS plus status MOSTLY/NO/UNKNOWN, CREDIT_RECOVERY reason, or MISSING_CREDITS support.
ELEMENTARY_AND_SUPPORT_PRIORITIES_NOT_ALREADY_KNOWN: elementary with no explicit foundational supports already captured; do not repeat equivalent questions.
ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED: all K-4, or explicit home-based interest plus REGULAR_GUIDANCE/CLOSE_ADULT_SUPPORT/INDEPENDENT_WORK_DIFFICULT.

## State and validation
Store raw answers and effective normalized facts separately. UNKNOWN, NOT_ANSWERED and NOT_APPLICABLE are distinct. When grade or primary interests change, hidden branch answers do not participate in scoring, AI, current report or exports. Create a new revision for a changed completed profile. Retention governs old versions.

None/unknown exclusive choices deselect competing values and are server-validated. Parent priorities allow one to three, not exactly three. Blank required fields block completion; selecting UNKNOWN does not. The server revalidates completion and branch membership; do not trust the browser's grade band, support level, or recommendations.

Optional first name/nickname is display-only. Location does not establish residency or provider eligibility. Do not collect precise geolocation or request browser location permission. Validate ZIP formatting without claiming it confirms a state or school jurisdiction.

## New explicit inputs solving earlier gaps
DISC_031 asks whether the family wants to stay, is open to change, or seeks a change.
DISC_032 asks unavailable instructional times separately from preferred times.
DISC_033 asks delivery-model interest separately from preferred learning activities.
DISC_034 asks subject-specific advancement interest; 'ahead overall' is not 'math ahead'.
DISC_E04 asks actual adult availability separately from who might help and how involved the parent wants to be.

These are proposed clarification additions, not previously approved final wording. Phase 0 must show them in its change log.

## Normalization used by rules
athletics_interest: exact athletics branch condition above.
homeschool_interest: HOMESCHOOL reason or HOMESCHOOL desired_delivery.
home_or_online_interest: homeschool_interest or desired_delivery ONLINE_SELF_PACED/ONLINE_TEACHER_SUPPORTED, or ONLINE reason.
frequent_travel: athletic_travel_frequency SEVERAL_MONTH/WEEKLY. A generic TRAVEL answer without frequency activates a discussion topic but not this strong frequency fact.
foundation_concern: any reported PHONICS/READING/MATH/WRITING or nonexclusive nonempty foundational priorities. Do not infer severity or diagnosis.
supplemental_need: academic support, advancement, advanced-course or college-advancement reason, or explicit academic support/advancement choice. Does not mean current school can deliver it.
grade_band: grade only; age is context, never an automatic grade selector.
ncaa_interest: nested DISC_020 follow-up normalized only if its parent branch remains active.

## Contact is not part of the education questionnaire
No mandatory email wall for a guest report. Save/email asks parent name and email; phone is optional when a phone/contact service is selected. Delivery request, email marketing consent and SMS consent are separately recorded. Student context does not flow into marketing audiences.

---

## Provenance note (added at Phase 0 corrections, this repository)

This file is preserved verbatim from the originally supplied pack. Per owner authorization dated at Phase 0 acceptance, `ncaa_interest` is formalized as canonical question `DISC_020A` in the corrected registry at the repository-root `contracts/question-bank.json`; this archival copy is not updated in place. See `contracts/CHANGELOG.md` for the exact diff and `docs/pathways/DECISION_LOG.md` DEC-C1.
