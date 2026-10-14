# Phase 6D — Advisor Planning Call Workspace & Consultation Workflow

## Business objective

Phase 6C made it possible for an admin to assign a case to an advisor and for that advisor to see a queue, but the advisor had nothing to actually *do* with a case beyond a read-only glance. Phase 6D builds the advisor's real working environment for the Pathways Planning Call: a pre-call preparation view built from the exact Discovery context the family saw, a structured professional record of the conversation itself, explicit attendance and outcome capture, and the first-ever activation of previously dormant `PathwaysCase` status transitions. This is the moment Pathways moves from algorithmic preliminary exploration to professional human investigation — and that distinction is labeled explicitly everywhere it appears.

It deliberately stops there: no Student Success Blueprint, no provider matching, no payments, no parent account, no AI.

## Section 2 compatibility repair: ADVISOR-only assignment target

The Phase 6C completion report described the assignment target check only as requiring "an authorized staff role." On inspection, `assignAdvisorToCase` actually checked membership in `CASE_ACCESS_ROLES` (`["ADVISOR", "ADMIN"]`) — the same set used elsewhere to decide "who may be *granted* access to a case once assigned." That set is correct for that purpose but wrong for "who may be *assigned as* the advisor": an ADMIN-only account (someone who has never been granted advisor authority) could be assigned as a case's advisor merely because they held *some* staff role.

**Fixed**: `assignAdvisorToCase` (`src/server/advisor-assignment.ts`) now requires `targetRole === "ADVISOR"` exactly. `staff_role` is one row per user (`staff_role_user_unique_idx`), so a user can never legitimately hold both ADVISOR and ADMIN simultaneously under this schema — the fix can never wrongly exclude a genuinely dual-authorized user, because that user does not exist in this data model. `listActiveStaffForAssignment` (`src/server/staff-queue.ts`), which powers the admin's "Assign to" picker, is filtered to `role = "ADVISOR"` the same way, so the picker never offers an option the server would only reject. A new explicit test (`tests/advisor-assignment.test.ts`, "Phase 6D section 2") proves an ADMIN-only account is rejected and a genuine ADVISOR target still succeeds.

## What did not change (frozen)

Verified by `git diff --stat` against the Phase 6C starting commit (`06b2c1226d276aeccefd5e059aad0fa5cbe15d61`) — every path below is untouched except the narrowly-scoped repair above:

- Discovery questionnaire logic, question IDs, calibration, taxonomy, rules, scoring, engine, report content/design: `contracts/**`, `src/lib/discovery/**`, `src/lib/engine/**`, `src/components/report/**`.
- `ReportSnapshot` historical behavior, the guest consultation funnel, native scheduling policy, the connected DB-free demo: `app/discover/**`, `src/lib/consultation/**`, `src/server/booking.ts`, `src/server/consultation.ts`, `src/components/consultation/**`, `src/components/discovery/**`.
- Phase 6B case-creation semantics (`ensureCaseForConsultationRequest`'s trigger point, idempotency, and student-display-name mapping) — byte-unchanged.
- Phase 6C assignment/queue behavior (`src/server/staff-queue.ts`'s query logic, `src/components/staff/CaseDetailView.tsx`, `src/components/staff/format.ts`, the admin queue page) except the one-line ADVISOR-only narrowing above.

## Entity: PlanningCallRecord

```
PathwaysCase (Phase 6B, unchanged)
  └─◄ PlanningCallRecord (NEW, Phase 6D)
       ├─► ConsultationRequest    (denormalized convenience reference)
       ├─► Booking                (nullable -- set if one existed at creation)
       ├─► ProfileRevision        (exact, never re-derived)
       └─► ReportSnapshot         (exact, never re-derived)
```

**Cardinality (section 5)**: at most one *primary* record per case, enforced by a partial unique index (`planning_call_record_primary_per_case_unique_idx`, `WHERE is_primary = true`). The `isPrimary` boolean exists precisely so a future phase can add follow-up-conversation records against the same case without a schema change — Phase 6D itself only ever creates the one primary record; no UI in this phase creates a second.

**Status**: `DRAFT` → `COMPLETED`, one-way, explicit only. A `COMPLETED` record's structured content becomes read-only in this phase (see "Admin corrections" below) — there is no UI or server path that edits a completed record's findings.

## Information provenance (section 6)

The workspace distinguishes five categories, implemented as a combination of fixed section-level labeling and two dedicated structured fields:

| Category | How it's shown |
|---|---|
| Parent-reported | Sections A-F each carry the note "Parent-reported, via advisor." under their heading |
| Pathways Discovery guidance | The reused `CaseDetailView` sections ("What We Heard," "Selected Priorities," the report headline/summary) keep their existing Phase 6C/6B label, "Pathways-generated preliminary Discovery guidance -- not a professional assessment of the student"; the new "Advisor Preparation" section (directions/comparison-guide content) carries the identical label |
| Advisor observation | Section I ("Advisor Assessment") is labeled "Advisor professional judgment -- not a parent statement"; `serviceFit` and `recommendedNextAction` (Section J) carry the same label |
| Verified information | A dedicated `verifiedFacts` list, labeled "Verified information (confirmed by advisor)" |
| Needs verification | A dedicated `verificationNeeded` list, labeled "Needs verification (not yet confirmed)," distinct from the forward-looking `priorityQuestions` ("Open Questions") |

## Pre-call view (section 7)

`/advisor/cases/[caseId]` reuses the exact, unchanged Phase 6C `CaseDetailView` for student context, appointment, case/consultation status, and the family-facing report excerpt — fixing a regression this phase almost introduced (see "Bug found and fixed" below) and guaranteeing byte-identical behavior with the admin route's equivalent section. A new "Advisor Preparation" section adds the two pieces of existing `DiscoveryReportDTO` content `CaseDetailView` doesn't already surface: `sections.directions.cards` ("Preliminary Pathway Directions") and `sections.comparisonGuide.questions` ("Suggested Areas to Clarify") — both already-computed, already-approved Phase 4/5 content, never regenerated or reinterpreted here.

## Structured consultation sections (sections 8-9)

Ten labeled sections (A-J), discrete typed database columns rather than one blank notes field:

| Section | Field(s) | Type |
|---|---|---|
| A. Family's Main Goal | `familyMainGoal`, `primaryGoalConfirmed` | text, boolean |
| B. Current Educational Situation | `currentEducationalSituation`, `currentModelConfirmed` | text, boolean |
| C. Student Strengths & Interests | `studentStrengths` | text |
| D. Learning Needs & Support | `learningNeedsSupport` | text |
| E. Schedule / Lifestyle Requirements | `scheduleLifestyleRequirements` | text |
| F. Academic Planning | `academicPlanningNotes` | text |
| G. Pathway Discussion | `pathwaysDiscussed` | string[] of taxonomy `base_model` ids |
| H. Important Unknowns / Open Questions | `priorityQuestions`, `verifiedFacts`, `verificationNeeded` | string[] (one item per line in the UI) |
| I. Advisor Assessment | `advisorAssessment`, `serviceFit`, `followUpRequired` | text, enum, boolean |
| J. Recommended Next Step | `recommendedNextAction` | text |

`pathwaysDiscussed` is validated server-side against `contracts/taxonomy.json`'s `base_models` (via the existing, unmodified `loadTaxonomy()` loader) — an unknown id throws rather than silently accepting a free-form replacement model. `serviceFit` (`GOOD_FIT | POSSIBLE_FIT | NOT_CURRENT_FIT | UNDETERMINED`) is the advisor's own professional judgment feeding Section I, distinct from the formal `outcome` decision below.

## Draft behavior (section 10)

`savePlanningCallDraft` (`src/server/planning-call.ts`) is idempotent: the first save for a case creates the primary record; every subsequent save updates the same row. Authorization is `assertAdvisorCanAccessPathwaysCase` (Phase 6B/6C, unchanged) — the currently-assigned `ADVISOR` only; admins have no write path in this phase. A `VERSION_CONFLICT` result (never a silent overwrite) is returned if the save's `expectedVersion` doesn't match the row's current `version` (optimistic concurrency, section 19) or if a genuine concurrent first save already created the row (the partial unique index is the unconditional backstop). A `COMPLETED` record rejects further draft saves (`ALREADY_COMPLETED`).

## Attendance model (section 11)

`planningCallAttendanceEnum`: `ATTENDED | NO_SHOW | CANCELLED | RESCHEDULE_NEEDED` — a small, purpose-built enum, never inferred from elapsed time, set only by `completePlanningCall`'s explicit advisor action. Three of its four values map onto the **existing, previously-dormant** `consultationRequest.status` values (`COMPLETED`, `NO_SHOW`, `CANCELLED`) via the existing `workflowEvent` audit table, reusing rather than duplicating that status model; `RESCHEDULE_NEEDED` has no equivalent there and deliberately leaves `consultationRequest.status` untouched (the appointment nominally still stands, pending a human reschedule this phase does not automate).

## Outcome model (section 12) and case-status transitions (section 13)

`planningCallOutcomeEnum`: `CONTINUE_TO_BLUEPRINT | NEEDS_INFORMATION | FOLLOW_UP | NOT_CURRENT_SERVICE_FIT | FAMILY_NOT_PROCEEDING`, mapped to `PathwaysCase.status`:

| Outcome | Case status | Legal from (per the existing/extended `ALLOWED_CASE_STATUS_TRANSITIONS`) |
|---|---|---|
| `CONTINUE_TO_BLUEPRINT` | `COMPLETED` | `BOOKED`, `FOLLOW_UP` |
| `NEEDS_INFORMATION` | `NEEDS_INFORMATION` | `CONTACT_RECEIVED`, `BOOKED` |
| `FOLLOW_UP` | `FOLLOW_UP` | `CONTACT_RECEIVED`, `BOOKED`, `COMPLETED` |
| `NOT_CURRENT_SERVICE_FIT` | `NOT_CURRENT_SERVICE_FIT` | `CONTACT_RECEIVED`, `BOOKED`, `FOLLOW_UP` |
| `FAMILY_NOT_PROCEEDING` | `FAMILY_NOT_PROCEEDING` (**new enum value**) | `BOOKED` only |

In practice, since Phase 6D's workspace always targets the one primary record for a case still early in its lifecycle, the realistic starting status is `CONTACT_RECEIVED` or `BOOKED`; the `FOLLOW_UP`/`COMPLETED` starting points exist for a case already advanced by a prior call attempt.

Every transition is checked against the existing, unmodified `isValidCaseStatusTransition` (`src/server/pathways-case.ts`), which this phase extends with exactly two new edges: `BOOKED → FAMILY_NOT_PROCEEDING` and `FAMILY_NOT_PROCEEDING → CLOSED`. An illegal transition (e.g. attempting `CONTINUE_TO_BLUEPRINT` before a booking exists) is rejected (`INVALID_CASE_TRANSITION`), never silently skipped or forced.

**`FAMILY_NOT_PROCEEDING` is a new, minimally-scoped `pathwaysCaseStatusEnum` value** (migration `0006`), deliberately distinct from `NOT_CURRENT_SERVICE_FIT` (a Pathways-side service-fit judgment) and from the generic terminal `CLOSED`: it exists specifically so a family's own commercial decision not to continue is never recorded as, or allowed to influence, an educational-suitability signal.

**`CONTINUE_TO_BLUEPRINT` may only be chosen when attendance is `ATTENDED`** — enforced server-side (`OUTCOME_NOT_ALLOWED_FOR_ATTENDANCE`) — since a call that did not happen cannot have produced a finding that the family is ready for the next professional step.

## Blueprint readiness (section 14)

`isBlueprintReady(record)` is a pure, **computed-on-read** function (`record.status === "COMPLETED" && record.outcome === "CONTINUE_TO_BLUEPRINT"`) — never a stored column, so it can never drift out of sync with the record it describes. It is purely internal/operational routing: never academic eligibility, acceptance, guaranteed fit, payment, provider selection, or placement. The Student Success Blueprint itself is not built in this phase.

## No payment wall (section 15)

No price, checkout, Stripe, invoice, deposit, subscription, or billing concept exists anywhere in this phase's schema or UI. `CONTINUE_TO_BLUEPRINT` is purely an internal routing signal.

## Advisor notes security (section 16) and public-data isolation

`planningCallRecord` is never imported by `src/server/dto.ts` or any `app/discover/**` route (verified by `grep`, matching the existing Phase 6B/6C convention) — no public DTO, guest route, or demo exposes any planning-call field. A dedicated Vitest assertion (`tests/planning-call.test.ts`, scenario 16) confirms advisor-authored content never enters the `ReportSnapshot` the family already saw. Every staff route carries `robots: { index: false, follow: false }` and `dynamic = "force-dynamic"` (unchanged convention).

## Admin access (section 17) and advisor access (section 18)

**Admin access is read-only in this phase.** Admins may view a planning-call record (`app/admin/cases/[caseId]/page.tsx` renders the shared, read-only `PlanningCallSummary`) for operational purposes, but **no admin write/correction path exists** — this is a deliberate, documented scope decision, not an oversight: the instruction's section 17 conditions correction-tracking machinery ("editor identity, timestamp, change provenance") on corrections being permitted at all, and Phase 6D does not permit them. Deferred to a future phase if ever needed.

**Advisor write access** is gated by the unchanged `assertAdvisorCanAccessPathwaysCase` — an active `ADVISOR` staff role AND an active assignment to this exact case, always both. A reassigned-away advisor loses edit access on the very next request (the function re-checks fresh every call, never from a cached claim) — proven directly in both `tests/planning-call.test.ts` (scenario 6) and the new Playwright suite. The record's content itself is NOT tied to any specific advisor's identity for display purposes — a newly-assigned advisor sees whatever a prior advisor already drafted, exactly as a real handoff would work.

## Concurrency / edit protection (section 19)

Optimistic locking via an integer `version` column, incremented on every successful save. Every save (draft or completion) must supply the `version` it loaded; a mismatch is rejected as `VERSION_CONFLICT` rather than silently overwritten. Tested directly against real PostgreSQL with two simulated concurrent tabs (`tests/planning-call.test.ts` scenario 17) and a genuine `Promise.all` race on first-save creation (scenario 2).

## Audit events (section 20)

Via the existing `audit_event` table (`targetType: "PlanningCallRecord"` or `"PathwaysCase"`), operational metadata only — never narrative content, never a Discovery answer:

- `PLANNING_CALL_CREATED` / `PLANNING_CALL_DRAFT_SAVED` — on first/subsequent draft saves.
- `CONSULTATION_ATTENDANCE_RECORDED` (`{ attendance }`), `PLANNING_CALL_OUTCOME_SET` (`{ outcome }`), `PLANNING_CALL_COMPLETED` — on completion.
- `CASE_STATUS_CHANGED` (`{ fromStatus, toStatus }`) — only when the case's status actually changed, reusing the exact Phase 6B pattern.
- A `workflowEvent` row on `consultationRequest` when attendance maps to a status change, reusing the existing Phase 6A audit trail rather than inventing a parallel one.

## Advisor UI (section 21) and bug found and fixed along the way

`/advisor/cases/[caseId]` layout: the reused `CaseDetailView` header (student/case-status/appointment/current-advisor), the new "Advisor Preparation" section, then the structured `PlanningCallForm` (sections A-J, Open Questions, Outcome) with two submit buttons sharing one plain HTML `<form>` — "Save Draft" (the form's default action) and "Complete Planning Call" (targeting a different server action via the button's own `formAction`, a native HTML mechanism requiring no client JavaScript). Once a record is `COMPLETED`, the read-only `PlanningCallSummary` renders instead of the form.

**A regression was found and fixed before this phase was accepted**: an earlier draft of this page replaced `CaseDetailView` entirely with custom markup, which silently dropped the literal heading text "What We Heard" that the existing Phase 6C Playwright test (`tests/e2e-internal/staff-workflow.spec.ts`) asserts. Caught by re-running the full internal Playwright suite before completion (per this phase's own instruction never to weaken or silently break an existing test); fixed by reusing `CaseDetailView` directly instead of reimplementing its markup, which also restored full parity with the admin route's equivalent section.

## Privacy (section 21) and analytics boundary (section 22, implicit)

No child information, case id, or student name appears in any URL query string (only mutation-result codes and the hidden form fields already established in Phase 6C). No analytics, ad pixel, or session-replay integration exists anywhere in this codebase.

## No AI, no provider matching (sections 23-24)

Nothing in this phase calls any AI/LLM API, summarizes the call, infers needs, scores families, or recommends/invents a pathway, school, tuition, admissions, accreditation, NCAA, or enrollment fact. `pathwaysDiscussed` only ever lets the advisor record which *existing* taxonomy directions were *discussed* — never a new one invented, never evaluated for eligibility.

## Migration

`drizzle/0006_moaning_swordsman.sql` — additive:

- **Four new enums**: `planning_call_attendance`, `planning_call_outcome`, `planning_call_record_status`, `planning_call_service_fit`.
- **One enum value added**: `pathways_case_status` gains `FAMILY_NOT_PROCEEDING` (`ALTER TYPE ... ADD VALUE`, pure DDL, no backfill).
- **One new table**: `planning_call_record` (34 columns, 3 indexes incl. the partial-uniqueness cardinality constraint, 7 foreign keys).
- No column dropped, renamed, or retyped; no existing NOT NULL constraint added to a populated column.

## Tests

- **`tests/advisor-assignment.test.ts`**: one new test for the section-2 ADVISOR-only repair (30 tests total, up from 29).
- **`tests/planning-call.test.ts`** (23 tests, real PostgreSQL): all 20 required scenarios (cardinality, concurrent-creation race, authorization in all four configurations, draft persistence/refresh, explicit completion, no-auto-completion-from-elapsed-time, explicit attendance requirement, case-status transition legality, audit events with content-isolation proof, advisor-notes-never-public proof, concurrent-edit-conflict proof, exact ReportSnapshot/ProfileRevision linkage, Phase 6C assignment-history integrity) plus additional coverage (NO_SHOW/CANCELLED can never unlock `CONTINUE_TO_BLUEPRINT`, double-completion rejected, taxonomy-id validation, plain-user denial).
- **`tests/e2e-internal/planning-call-workspace.spec.ts`** (1 Playwright test, real PostgreSQL, real booking flow): the full admin-assigns → advisor-prepares → draft-saves-and-survives-refresh → different-advisor-denied → admin-reassigns → former-advisor-loses-access → new-advisor-sees-existing-draft → completes-the-call → case-status-reflects-outcome journey.

## Verification

- `pnpm run typecheck` — pass, 0 errors.
- `pnpm run lint` — pass, 0 errors/warnings.
- `pnpm test` (Vitest) — **925/925 passed, 33/33 files** (up from Phase 6C's 901 — 23 new in `tests/planning-call.test.ts`, 1 new in `tests/advisor-assignment.test.ts`).
- `pnpm exec playwright test` (default suite) — **212/212 passed** (the Phase 6C run's one environmental flake did not recur).
- `pnpm exec playwright test --config=playwright.internal.config.ts` — **11/11 passed**, including the pre-existing `staff-workflow.spec.ts` (confirming the "What We Heard" regression was fully fixed, not merely routed around) and the new `planning-call-workspace.spec.ts`.
- `pnpm run build` — reproduces the same pre-existing, environment-specific `_global-error`/`useContext` anomaly documented since Phase 3 (identical digest `3328746128`) — unrelated to this phase's code; CI and Vercel are the authoritative build check.
- Frozen-file verification: `git diff --stat` against the Phase 6C checkpoint touches only the files this document names.
- Visual QA performed at 375/768/1440px on the advisor workspace (draft state and completed/read-only state) and the admin case detail with its new read-only planning-call summary: no horizontal overflow, clear section labeling, readable structured content, visible status badges with text labels, correctly locked completed state.
- Accessibility: one `<h1>` per page, real `<textarea>`/`<select>`/`<input type="checkbox"/"radio">` elements throughout (fieldset/legend for the attendance/outcome radio groups), labels associated via `htmlFor`/implicit wrapping, the existing global `:focus-visible` rule covers every new control, status never represented by color alone.

## Known limitations

- No admin correction/editing path for planning-call content (deliberate, see "Admin access" above).
- `pathwaysDiscussed`, `priorityQuestions`, `verificationNeeded`, and `verifiedFacts` are plain list inputs (one item per line in a textarea) rather than a richer add/remove widget — kept deliberately simple, no client JavaScript.
- No follow-up-conversation (non-primary) planning-call record creation UI exists yet, though the schema supports it.
- The Phase 3B Vercel PREVIEW database blocker and the pre-existing local build anomaly remain open, pre-existing, and unrelated to this phase.

## Recommended next phase

**Phase 6E — Student Success Blueprint Architecture & Authoring Workflow**, as named in this phase's own instruction: build the actual Blueprint entity and authoring workflow that reads a `COMPLETED` `PlanningCallRecord` with `outcome: CONTINUE_TO_BLUEPRINT` as its structured input.
