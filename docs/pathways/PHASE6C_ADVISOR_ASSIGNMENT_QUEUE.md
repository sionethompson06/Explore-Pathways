# Phase 6C — Advisor Assignment & Operational Queue

## Business objective

Phase 6B gave Pathways a `PathwaysCase` record and the read-side authorization boundary an advisor workspace will need, but nothing could yet *do* anything with it: there was no way to identify a new case, no way for an admin to hand it to an advisor, and no queue an advisor could see. Phase 6C makes that infrastructure operational for staff: an admin can see every case needing attention and assign it to an advisor; assignment and reassignment history is preserved, never destroyed; an advisor sees only the cases actively assigned to them; and a limited, read-only case detail gives each side just enough to act, never a full consultation workspace.

It deliberately stops there: no planning-call workspace, no Student Success Blueprint, no provider matching, no payments, no parent account, no AI, no CRM, no automated communications.

## What did not change (frozen)

Verified by `git diff --stat` against the Phase 6B starting commit (`aca8279b7e377e11f924101a9aea64f4dbc244a5`) for every path below — all empty:

- Phase 4 engine: `contracts/rules.json`, `taxonomy.json`, `scoring-policy.json`, `question-bank.json`, `fixtures/golden-profiles.json`, `src/lib/engine/**`.
- Phase 5 report: `contracts/report-content.json`, `fixtures/golden-reports.json`, `src/components/report/**`.
- Discovery questionnaire logic, question IDs, calibration, branching, normalization: `src/lib/discovery/**` (`validation.ts`'s exported `sanitizeText` is *called*, never modified — see "Student display name" below).
- Phase 6A/6A.2/6A.2a production consultation/booking behavior and the connected Phase 6A.3 DB-free demo: `app/discover/report/**`, `app/discover/consultation/**`, `src/lib/consultation/**`, `src/components/consultation/**`, `src/components/discovery/DiscoveryDemoQuestionnaire.tsx`.
- Phase 6B case-creation trigger point, idempotency, and status-lifecycle validator: `ensureCaseForConsultationRequest`'s SAVEPOINT/conflict-catch/re-select logic and `ALLOWED_CASE_STATUS_TRANSITIONS` in `src/server/pathways-case.ts` are byte-unchanged. The one addition to this file (see DEC-Z7 below) is strictly additive — a new, narrowly-scoped side effect appended after case creation already succeeds, never a change to whether, when, or how a case is created.

No educational recommendation logic, report content, Discovery wording, scheduling policy, or demo behavior changed.

## Entity relationships (additions only)

```
PathwaysCase (Phase 6B, unchanged)
  └─◄ AdvisorAssignment (Phase 1 schema, Phase 6C first writer)
       ├─ advisorUserId    -- who is responsible
       ├─ assignedByUserId -- which ADMIN assigned them
       ├─ assignedAt
       └─ unassignedAt     -- NULL while active; set, never deleted, to end it
```

`AdvisorAssignment` rows are never deleted. Reassignment deactivates the prior active row (`unassignedAt = now()`) and inserts a new one; unassignment deactivates the active row and inserts nothing. A case can accumulate unlimited historical (inactive) assignments; at most one may ever be active at a time.

## Assignment domain service (`src/server/advisor-assignment.ts`)

`assignAdvisorToCase(db, { pathwaysCaseId, advisorUserId, assignedByUserId })`:

1. Looks up `assignedByUserId`'s staff role fresh from `staff_role` — must be `ADMIN`, never inferred from a client claim. A non-admin (including an advisor acting on their own) is rejected with `NOT_ADMIN`.
2. Looks up `advisorUserId`'s staff role — must be `ADVISOR` or `ADMIN` (the same `CASE_ACCESS_ROLES` set `access-control.ts` already recognizes). An ordinary user, or a user with no staff role at all, is rejected with `TARGET_NOT_AUTHORIZED_ADVISOR`.
3. Opens a transaction and locks the target `PathwaysCase` row `FOR UPDATE` for its entire duration — two concurrent assignment attempts against the same case always serialize; the second one observes the first's committed result.
4. If the case already has this exact advisor active, returns `NOOP_ALREADY_ASSIGNED` — no new row, no audit event, so a duplicate form submit can never fabricate a reassignment that didn't really happen.
5. Otherwise deactivates any current active assignment (`unassignedAt = now()`, never deleted) and inserts a new active row, then writes `ADVISOR_ASSIGNED` (first assignment) or `ADVISOR_REASSIGNED` (replacing one) to `audit_event`, with `{ previousAdvisorUserId, newAdvisorUserId }`/`{ advisorUserId }` metadata only — never a Discovery answer or report content.

`unassignAdvisorFromCase(db, { pathwaysCaseId, actorUserId })` — ADMIN-only, same row-lock pattern, deactivates the active assignment (if any) and writes `ADVISOR_UNASSIGNED`. A case with no active assignment returns `{ ok: true, unassigned: false }` — a no-op, never an error, since the caller's desired end state already held. **Unassignment is explicitly supported and explicitly audited**, per the instruction's requirement never to leave this status implicit or inferred from a delete.

**Concurrency backstop:** `advisor_assignment_active_per_case_unique_idx` (new partial unique index, `WHERE unassigned_at IS NULL`) makes "at most one active assignment per case" true at the database level regardless of the application-level lock. Verified under a genuine concurrent (`Promise.all`) race against real PostgreSQL in `tests/advisor-assignment.test.ts` — both racing calls return successfully (one `ASSIGNED`, the other observing it and acting as a `REASSIGNED`/`NOOP`), never a constraint violation surfaced to the caller, because the row lock serializes them before either INSERT runs.

**Case status is never touched by any function in this file.** Assignment and reassignment are purely about *who is responsible*, which is a different concept from `PathwaysCase.status` (*what state the case itself is in*) — an unassigned `BOOKED` case stays `BOOKED` after assignment; nothing in Phase 6C ever sets `COMPLETED` automatically. Verified directly by a dedicated Vitest assertion.

## Staff queue and case-detail read layer (`src/server/staff-queue.ts`)

One shared, unexported join (`listAllCaseRows`) powers three public, role-gated functions. Every DTO is deliberately narrow — no internal recommendation score, no raw Discovery answer dump, no household-income/marketing/priority scoring of any kind (none of these fields exist anywhere in this schema to begin with):

| Function | Who may call it | What it returns |
|---|---|---|
| `listOperationalCasesForAdmin(db, adminUserId, filters)` | `ADMIN` role only (no per-case assignment required — see below) | Every case, safe-field list, optionally filtered |
| `listAssignedCasesForAdvisor(db, advisorUserId)` | `ADVISOR` or `ADMIN` role | Only cases with an active assignment to `advisorUserId`, sorted by `sortAdvisorQueue` |
| `getCaseDetailForStaff(db, staffUserId, pathwaysCaseId)` | `ADMIN` (any case) or `ADVISOR` (own active assignment only, via the unchanged `assertAdvisorCanAccessPathwaysCase`) | The list row plus the exact `ReportSnapshot.publicContent` the family saw |
| `listActiveStaffForAssignment(db, adminUserId)` | `ADMIN` role only | Active, non-revoked staff members eligible to be assigned (`userId`, `name`, `email`, `role`) |

**Admin queue fields (safe-list, exactly):** student display name (with "Student" fallback), grade band, case status, consultation status, booking date/time (only if not cancelled), preferred call format, current advisor's name, date entered the workflow. **Explicitly never included anywhere in this layer:** an internal recommendation/compatibility score, the raw Discovery answer payload, parent free-text narrative beyond what the family-facing report already surfaced, medical information, or any marketing/purchasing-propensity/priority ranking — none of these fields exist in this schema, so there was nothing to filter out by exclusion; the DTO was built field-by-field from the explicit safe list instead.

**Deliberate ADMIN authorization widening (section 5/12 of the instruction):** `listOperationalCasesForAdmin` and the ADMIN branch of `getCaseDetailForStaff` are gated on the `ADMIN` staff role *alone* — deliberately **not** also requiring a per-case `AdvisorAssignment`, unlike every ADVISOR access path in this codebase (Phase 1A, unchanged). This is a narrow, explicit exception for exactly one reason: an admin's job under this phase is to see and assign cases *nobody has been assigned to yet*, which is structurally impossible under the assignment-required rule (an unassigned case has no assignment row for anyone to hold). Every ADVISOR-facing function (`listAssignedCasesForAdvisor`, the non-admin branch of `getCaseDetailForStaff`) still requires both an active staff role *and* an active assignment to that exact case — completely unchanged from Phase 6B. There is no "admin bypass" for advisor-scoped functions; the widening exists only in the two admin-specific functions above, and is fully auditable by reading their source.

**Advisor queue ordering** (`sortAdvisorQueue`, section 20): upcoming booked calls first (soonest first), then `FOLLOW_UP`/`NEEDS_INFORMATION` cases, then everything else by most-recently-entered-first. Pure function, unit-tested without a database.

## Object-level authorization, exhaustively

| Actor | Can access | Cannot access |
|---|---|---|
| Unauthenticated visitor | Nothing — `notFound()` (honest 404, since no real sign-in page exists for any route, staff or guest) | `/admin/cases`, `/advisor/cases`, any case detail |
| Authenticated user, no `staff_role` row | Nothing staff-related | Same as above |
| `ADVISOR` with no active assignment to a given case | — | That case's detail, even knowing its exact UUID (`getCaseDetailForStaff` re-runs `assertAdvisorCanAccessPathwaysCase` fresh on every call) |
| `ADVISOR` with an active assignment | That one case's detail; their own queue | Every other advisor's cases; the admin queue; the admin assignment action (no `ADMIN` role) |
| `ADVISOR` reassigned away mid-session | — (immediately) | The case they just lost — the very next request re-checks the assignment fresh from the database; nothing is cached or held from a prior check |
| `ADMIN` | Every case's detail and the full operational queue; the assignment/reassignment/unassignment actions | — |

Verified end-to-end against real PostgreSQL and a real browser in `tests/e2e-internal/staff-workflow.spec.ts`: an admin assigns advisor 1, advisor 1's own browser context immediately sees the case in their queue and detail page; advisor 2's separate, equally-authorized browser context sees an empty queue and receives a 404 navigating directly to the same case URL; the admin then reassigns to advisor 2; advisor 1's existing open session receives a 404 on the next request to that case; advisor 2 gains access immediately.

## Staff authorization and sign-in

No new authentication mechanism was introduced. `staff_role` (Phase 1, unchanged) remains server-provisioned only — there is no public self-selection UI and no email-domain inference. `src/server/staff-principal.ts`'s `requireStaffPrincipal(allowedRoles)` is the one shared entry point every staff route calls: it resolves the real Better Auth principal, checks their role, and calls `notFound()` on any failure — never a "please sign in" page, since disclosing that one exists would itself leak that a staff area exists at all to an unauthenticated visitor.

**Why a 404, not a 401/403, and not a login page:** this deployment has no working interactive sign-in for anyone (Better Auth's magic-link initiation is blocked at the source whenever `EMAIL_MODE=UNCONFIGURED`, which is the only value this schema currently allows). A login page that only staff could ever reach would itself be a signal that distinguishes "this route exists but you're not allowed" from "this route doesn't exist" — exactly the disclosure the instruction asked to avoid. `notFound()` is indistinguishable from visiting any other nonexistent path.

**Exercising the protected routes in tests:** `app/api/test-only/staff-session/route.ts`, a POST-only Route Handler gated exclusively by `env.ALLOW_TEST_FIXTURES` (already a pre-existing, narrowly-scoped Phase 1 escape hatch, already hard-refused whenever `NODE_ENV=production` — and a deployed Vercel build, Preview or LIVE, always runs `NODE_ENV=production` regardless of `DEPLOYMENT_MODE`, so this route is **structurally unreachable in any deployed environment**, not merely disabled by convention). It drives the exact same real Better Auth magic-link mechanism Phase 1 built to completion server-side, via `buildAuth`'s pre-existing "test-harness override only" parameters (already used by `tests/principal.test.ts`/`tests/magic-link.test.ts` before this phase) — never a separate or invented authentication path, and the real exported `auth` singleton used by `/api/auth/[...all]` (with its magic-link block) is completely untouched. A GET to this route returns `405 Method Not Allowed` (the route module exists and declines the verb); with `ALLOW_TEST_FIXTURES=false` it returns `404` (indistinguishable from a route that doesn't exist at all).

## Student display name (section 16)

Phase 6B left `StudentPathwayRecord.displayName` as a schema column with no write path, since the production Discovery questionnaire collected no durable student name at the time. The interactive Discovery demo's questionnaire (`DiscoveryDemoQuestionnaire.tsx`, Phase 5.1/6A.3, unchanged by this phase) already asks an **optional** "What should we call your student?" field (`student_display_name`) as part of the same existing, already-approved Discovery answer set — no new question was added anywhere by this phase.

`src/server/pathways-case.ts`'s `ensureCaseForConsultationRequest` now maps that exact existing answer through one safe, narrow, server-side path: on a genuinely fresh case, it reads the triggering `ProfileRevision`'s raw answers, extracts `student_display_name` if present (run through the existing, unmodified `sanitizeText` from `src/lib/discovery/validation.ts`), and updates `StudentPathwayRecord.displayName` **only if it is currently NULL** — a later revision's answer never overwrites one already captured. If the parent never supplied a name, `displayName` stays `null` and every staff UI surface falls back to the neutral label `"Student"` (`STUDENT_DISPLAY_FALLBACK` in `staff-queue.ts`). No forced question, no new UI, no new column (the column already existed from Phase 6B).

## Admin UI (`/admin/cases`, `/admin/cases/[caseId]`)

A plain filterable table (student, grade, case-status badge, consultation status, booking date/time, preferred format, advisor name or an explicit "Unassigned" state, date entered, a View link) with a server-side GET filter form (assignment/case-status/advisor/booked), never a client-side dashboard. The detail page adds one assignment control: a `<select>` of active staff plus an Assign/Reassign button (plain `<form action={...}>` server actions, no client JavaScript), and a conditional Unassign button shown only when a case currently has an active advisor. Mutation results are communicated via a redirect query param (`?success=ASSIGNED`/`?error=NOT_ADMIN` etc.) rendered as an accessible `role="status"`/`role="alert"` message — no modal, no toast library, no animation.

## Advisor UI (`/advisor/cases`, `/advisor/cases/[caseId]`)

The same table shape minus the Advisor column (every row is already theirs) and minus the filter form (an advisor's queue is small and pre-scoped by definition). The detail page is read-only — no assignment control, no advisor notes field, nothing beyond what section 11 of the instruction explicitly allowed. `CaseDetailView` (shared by both admin and advisor routes) renders three clearly-labeled sections: "What We Heard" and "Selected Priorities" (explicitly marked "Parent-reported information"), and the family's own report headline/summary (explicitly marked "Pathways-generated preliminary Discovery guidance — not a professional assessment of the student"). No advisor-authored notes field exists anywhere in this phase.

## Privacy

- Every staff route sets `export const metadata = { robots: { index: false, follow: false } }` and `export const dynamic = "force-dynamic"` (no static caching of per-request authorization results).
- No child information, case id, or student name appears in any URL query string — the only query params used anywhere in the new routes are admin list-filter values (`assignment`, `caseStatus`, `advisor`, `booked` — operational metadata, never a family identifier) and the mutation-result codes (`success=ASSIGNED`, `error=NOT_ADMIN`, etc.).
- No analytics, ad pixel, or session-replay integration exists anywhere in this codebase, staff routes included.
- `pathwaysCase`/`advisorAssignment` are never imported by `src/server/dto.ts` or any `app/discover/**` route (unchanged from Phase 6B, re-verified by `grep` this phase) — no public DTO or family-facing page gained a staff name, id, or case reference.

## Migration

`drizzle/0005_advisor_assignment_active_constraint.sql` — fully additive, applied to both `pathways_dev` and `pathways_test`:

- **One new index:** `advisor_assignment_active_per_case_unique_idx`, a partial unique index on `advisor_assignment.pathways_case_id` `WHERE unassigned_at IS NULL AND pathways_case_id IS NOT NULL`.
- No column added, dropped, renamed, or retyped; no existing row is affected (the index only constrains *future* inserts/updates that would create a second active row for the same case — no case had more than one active assignment before this phase, since nothing wrote to this table before Phase 6C).

`StudentPathwayRecord.displayName` is a Phase 6B column, unchanged by this migration — Phase 6C only adds a write path to it in application code (see "Student display name" above).

## Tests

- **`tests/advisor-assignment.test.ts`** (29 tests, real PostgreSQL): the 20 required scenarios (admin assigns an unassigned case; the assignment references a genuinely authorized advisor; a non-admin/advisor/plain user cannot assign; a public guest cannot assign; an invalid target is rejected; at most one active assignment per case; a genuine concurrent-assignment race never creates two active owners; reassignment preserves history; reassignment's audit event carries prior/new advisor ids; an advisor accesses their own case; an advisor is denied another's case even knowing its UUID; a reassigned-away advisor loses access immediately; an inactive assignment grants no access; an admin views the full operational queue; the advisor queue returns only that advisor's active cases; admin filters narrow the queue; the guest journey still works with no parent account; Phase 6B case-creation idempotency is intact; Phase 6A.2 booking concurrency is intact), plus additional coverage for the same-advisor no-op, explicit unassignment, the admin role-only detail-view boundary, the safe-DTO field exclusion, pure-function tests for the filter and sort logic, the student-display-name write path and its neutral fallback, and the case-status/assignment independence guarantee.
- **`tests/e2e-internal/staff-workflow.spec.ts`** (3 Playwright tests, `playwright.internal.config.ts`, real PostgreSQL): the full admin-assign → advisor-sees-it → different-advisor-denied → reassignment-transfers-access journey, driven through a real family completing the existing, unmodified Discovery → Report → Contact funnel first; an unauthenticated visitor receiving an honest 404 on both staff routes; the test-only sign-in route's GET/POST verb enforcement.

## Verification

- `pnpm run typecheck` — pass, 0 errors.
- `pnpm run lint` — pass, 0 errors/warnings.
- `pnpm test` (Vitest) — **901/901 passed, 32/32 files** (up from Phase 6B's 872 — 29 new Phase 6C tests in `tests/advisor-assignment.test.ts`; every pre-existing test file's count is unchanged).
- `pnpm exec playwright test` (default suite, Chromium) — 211/212 passed on the first full-suite run; one test (`discovery-demo-integration.spec.ts` "no horizontal overflow at 375px") failed only under full-suite parallel load and passed cleanly both standalone and on a full re-run of its own file — an environmental timing flake, not a Phase 6C regression (zero code overlap: Phase 6C touched no file under `src/components/discovery/`, `src/components/report/`, or `app/discover/**`).
- `pnpm exec playwright test --config=playwright.internal.config.ts` (internal suite) — **10/10 passed**, including the pre-existing booking/calendar-race specs (no recurrence of the Phase 6B-documented wall-clock flake this run) and all 3 new staff-workflow tests.
- `pnpm run build` — reproduces the same pre-existing, environment-specific `_global-error`/`TypeError: Cannot read properties of null (reading 'useContext')` prerender failure documented and re-confirmed in every phase since Phase 3 (identical digest, identical error shape) — unrelated to any Phase 6C code change. The actual GitHub Actions CI build and the Vercel deployment build are the authoritative build verification for this phase, as for every prior phase affected by this same local anomaly.
- Frozen-file verification: `git diff --stat` against the Phase 6B starting commit touches only the files listed in this document and `next-env.d.ts` (Next.js's own auto-generated file) — no frozen path above was touched.
- Visual QA performed at 375/768/1440px on `/admin/cases`, `/admin/cases/[caseId]`, `/advisor/cases`, `/advisor/cases/[caseId]`: tables remain readable without horizontal overflow, the filter form and assignment controls remain usable and keyboard-operable, status badges render with a visible text label (never color alone), the empty-state and unassigned-state copy renders clearly, and long student/advisor names wrap without breaking the layout.
- Accessibility: one `<h1>` per page, real `<table>` markup with `<caption>`/`scope="col"` headers, real `<form>`/`<label>`/`<select>`/`<button>` elements throughout (no `<div>` pretending to be a control), the global `:focus-visible` outline rule (unchanged, from `app/globals.css`) covers every new interactive element, mutation results render via `role="status"`/`role="alert"` text (never color-only), and the assignment/reassignment/unassignment actions are fully keyboard-operable plain form submissions.

## Known limitations

- No advisor-authored notes, planning-call workspace, or interview questionnaire exists yet — Phase 6D's expected scope.
- `PathwaysCase.status` transitions beyond `CONTACT_RECEIVED`→`BOOKED` (`COMPLETED`, `NEEDS_INFORMATION`, `FOLLOW_UP`, `NOT_CURRENT_SERVICE_FIT`, `CLOSED`) remain defined and unit-tested (Phase 6B) but still have no caller — this phase deliberately did not add one, since case status and advisor ownership are different concepts and marking a case `COMPLETED` is explicit future advisor-workflow scope.
- The Phase 3B Vercel PREVIEW database blocker (no real hosted Postgres behind `DEPLOYMENT_MODE=PREVIEW`) remains open and unrelated to this phase.
- The one pre-existing local-build anomaly (`_global-error`/`useContext`) and the documented wall-clock-dependent internal Playwright flake both remain open, pre-existing, environment conditions unrelated to this phase's code.

## Recommended next phase

**Phase 6D — Advisor Planning Call Workspace & Consultation Workflow**, as named in this phase's own instruction: build the advisor's actual planning-call preparation/notes workspace and the first explicit case-status transition actions (at minimum marking a case `COMPLETED` after a call, which Phase 6B's validator already supports but nothing yet calls).
