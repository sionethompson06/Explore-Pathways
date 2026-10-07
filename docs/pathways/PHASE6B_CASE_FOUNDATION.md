# Phase 6B — Pathways Case Foundation

## Business objective

Phase 6A/6A.1/6A.2/6A.2a/6A.3 built a complete report-to-planning-call funnel and its DB-free preview. Until now, nothing in the schema represented the *operational* relationship a booked family becomes once Pathways needs to actually advise them: the `ConsultationRequest`/`Booking` pair records what a parent did, but there was no single record an advisor could be assigned to, track, or report status against.

Phase 6B adds that record -- `PathwaysCase` -- plus the minimum authorization and audit primitives Phase 6C's advisor workspace will need. It deliberately stops there: no advisor UI, no automatic assignment, no Student Success Blueprint, no provider matching, no payments, no parent accounts. Everything added here is foundation, proven by tests, not yet exposed to anyone.

## What did not change (frozen)

Verified by `git diff --stat` against the Phase 6A.3 starting commit (`3c665352fd2ceead268a1e401684a14199cdebc0`) for every path below -- all empty:

- Phase 4 engine: `contracts/rules.json`, `taxonomy.json`, `scoring-policy.json`, `question-bank.json`, `fixtures/golden-profiles.json`, `src/lib/engine/**`.
- Phase 5 report: `contracts/report-content.json`, `fixtures/golden-reports.json`, `src/components/report/**`.
- Phase 6A/6A.2 production consultation/booking behavior: `app/discover/report/**`, `app/discover/consultation/schedule/**`, `app/discover/consultation/confirmed/**`, `app/discover/consultation/page.tsx`, `src/lib/consultation/**`, `src/components/consultation/**` (component files; `src/server/booking.ts` and `src/server/consultation.ts` gained a small, additive call each -- see "Where case creation happens" below).
- Phase 6A.3 connected demo: `app/discover/consultation/demo/**`, `src/components/discovery/DiscoveryDemoQuestionnaire.tsx`.

No educational recommendation logic, report content, scheduling policy, or demo behavior changed.

## Entity relationships

```
Guardian (user, Better Auth)
  └─ GuardianStudentAccess (explicit, revocable, many-to-many)
       └─ StudentPathwayRecord  (+ new: displayName)
            ├─ ProfileRevision ──► EngineRun ──► ReportSnapshot
            ├─ ConsultationRequest ──► ConsultationContact
            │                     └─► Booking
            └─ PathwaysCase (NEW)
                 ├─► StudentPathwayRecord   (which student)
                 ├─► ConsultationRequest    (1:1 -- unique index)
                 ├─► ProfileRevision        (exact, never re-derived)
                 ├─► ReportSnapshot         (exact, never re-derived)
                 ├─► Booking                (nullable -- set once one exists)
                 └─◄ AdvisorAssignment (NEW: pathwaysCaseId, assignedByUserId)
```

`PathwaysCase` references canonical records; it duplicates none of their content. `StudentPathwayRecord` gained exactly one new column, `displayName` (nullable, currently unpopulated by any write path -- see "What was deliberately not added" below); current grade and grade band remain derivable from the record's latest `ProfileRevision` rather than cached, per "avoid duplication where references are sufficient."

## Case status model

`pathwaysCaseStatusEnum`: `NEW | CONTACT_RECEIVED | BOOKED | COMPLETED | NEEDS_INFORMATION | FOLLOW_UP | NOT_CURRENT_SERVICE_FIT | CLOSED`.

This is a distinct lifecycle from `ConsultationRequest.status` (`consultation.ts`'s `consultationStatusEnum`) and from `Booking`'s own `scheduledAt`/`cancelledAt` fields -- never auto-derived from either in the general case. The one deliberate coupling: a case automatically advances to `BOOKED` the moment an internal `Booking` genuinely exists for its request (a real, already-true fact), but **`COMPLETED` is reachable only from `BOOKED` and only by an explicit future advisor action** -- no code anywhere in this phase sets it, and a scheduled call's time simply passing never does either.

Allowed transitions (`src/server/pathways-case.ts`'s `ALLOWED_CASE_STATUS_TRANSITIONS`, exercised by a table-driven Vitest suite):

| From | May transition to |
|---|---|
| `NEW` | `CONTACT_RECEIVED`, `CLOSED` |
| `CONTACT_RECEIVED` | `BOOKED`, `NEEDS_INFORMATION`, `FOLLOW_UP`, `NOT_CURRENT_SERVICE_FIT`, `CLOSED` |
| `BOOKED` | `COMPLETED`, `NEEDS_INFORMATION`, `FOLLOW_UP`, `NOT_CURRENT_SERVICE_FIT`, `CLOSED` |
| `COMPLETED` | `FOLLOW_UP`, `CLOSED` |
| `NEEDS_INFORMATION` | `CONTACT_RECEIVED`, `BOOKED`, `CLOSED` |
| `FOLLOW_UP` | `BOOKED`, `COMPLETED`, `NOT_CURRENT_SERVICE_FIT`, `CLOSED` |
| `NOT_CURRENT_SERVICE_FIT` | `CLOSED` |
| `CLOSED` | (terminal -- none) |

A same-status "transition" is never considered valid (`isValidCaseStatusTransition(x, x)` is always `false`). Only two transitions are actually exercised by code in this phase (case creation directly into `CONTACT_RECEIVED`, and the automatic `CONTACT_RECEIVED`/other → `BOOKED` advance on real booking); the rest are defined now so Phase 6C's advisor action can reuse this one validator rather than re-deriving the rule matrix.

## Where case creation happens, and why

**Trigger point: the moment a family's contact information is received** -- `src/server/consultation.ts`'s `submitConsultationContact`, inside the exact same database transaction that creates/reuses the `ConsultationRequest` and upserts the `ConsultationContact` row. This is the narrowest point consistent with the existing Phase 6A flow that still genuinely means "the family has entered the service workflow": a parent who only viewed the report, without ever submitting contact info, creates no case at all.

A case is therefore **always created directly in `CONTACT_RECEIVED` status, never `NEW`** -- `NEW` stays reserved in the schema enum for a hypothetical future, earlier trigger point (e.g. a report-view-only funnel entry) this phase does not implement. Choosing to skip an always-skipped `NEW`→`CONTACT_RECEIVED` transition keeps the audit trail honest: no observer could ever have seen the case in `NEW`, so no transition event claims one happened.

Idempotency is both application-level and database-level: `ensureCaseForConsultationRequest` attempts an insert, catches the specific `23505` unique-violation on `pathways_case_consultation_request_unique_idx` (never a generic catch-all), and re-selects the row that already exists -- the exact SAVEPOINT + conflict-catch + re-select pattern already proven throughout this codebase (`discovery-draft.ts`, `consultation.ts`, `booking.ts`). Verified under a genuine `Promise.all` race in `tests/pathways-case.test.ts`, not merely by inspection.

## Booking linkage

`src/server/booking.ts`'s `createInternalBooking`, immediately after a **genuinely new** booking row commits (never for an idempotent "already booked" replay, which linked everything the first time), calls `linkBookingToCase`: sets the case's `bookingId`, advances its status toward `BOOKED` if that transition is currently legal, and writes `BOOKING_LINKED` + (when the status actually changed) `CASE_STATUS_CHANGED` audit events. If no case exists yet for the request (should not happen post-6B, but defensively handled), this is a silent no-op -- a booking must never fail because of case bookkeeping.

## Authorization boundary

`src/server/access-control.ts` gained case-scoped mirrors of the existing `ConsultationRequest`-scoped advisor functions, extending the exact same invariant already enforced there (Phase 1A repair item 3): **access requires BOTH an active, authorized staff role (`ADVISOR` or `ADMIN`) AND an active `advisorAssignment` row for this specific case -- always both, never a blanket admin bypass.**

- `listActivePathwaysCasesForAdvisor(db, advisorUserId)` -- every case actively assigned to this advisor, or `[]` if their staff role is missing/revoked.
- `assertAdvisorCanAccessPathwaysCase(db, advisorUserId, pathwaysCaseId)` -- throws `AuthorizationError` unless both conditions hold.
- `getPathwaysCaseForGuestSession(db, sessionId)` -- a guest's own case, resolved entirely server-side from their session; there is no case-id parameter to pass the wrong value into, structurally identical to the existing `getStudentForGuestToken`.

Staff roles are never self-selected: `staffRole` (Phase 1, unchanged) has no public write path, and nothing in this phase adds one. `advisorAssignment` gained two additive, nullable columns (`pathwaysCaseId`, `assignedByUserId`) rather than replacing its existing `consultationRequestId` scope -- no code path has ever written a row to this table (confirmed by `grep` before this phase began), so this is a pure schema-readiness change, not a migration of live data.

## Idempotency protections, exhaustively

| Entity | Mechanism |
|---|---|
| `StudentPathwayRecord` | Unchanged (Phase 1/3): one new record only when a session doesn't already own one. |
| `PathwaysCase` | NEW: `pathways_case_consultation_request_unique_idx` (this phase). |
| `ConsultationRequest` | Unchanged (Phase 6A): `consultation_request_profile_revision_unique_idx`. |
| `ConsultationContact` | Unchanged (Phase 6A): unique on `consultationRequestId`, `onConflictDoUpdate`. |
| `EngineRun` | Unchanged (Phase 6A): `engine_run_idempotency_unique_idx`. |
| `ReportSnapshot` | Unchanged (Phase 6A): `report_snapshot_idempotency_unique_idx`. |
| `Booking` | Unchanged (Phase 6A.2/6A.2a): `booking_active_per_request_unique_idx`, `booking_resource_slot_unique_idx`, transactional `FOR UPDATE` status recheck. |

Phase 6B's own contribution (`PathwaysCase`) is tested under sequential retry, concurrent (`Promise.all`) retry, and via the natural double-submit path (a second real `submitConsultationContact` call) -- all three in `tests/pathways-case.test.ts`.

## Privacy boundary

- `pathwaysCase` is never imported by `src/server/dto.ts` or any `app/discover/**` route (verified by `grep`) -- no public DTO, demo, or page exposes a case id, status, or any case field.
- `auditEvent.metadata` (new, nullable `jsonb`) is restricted by convention (enforced by the one writer, `recordCaseAuditEvent`) to small operational payloads only -- `{ status }`, `{ bookingId }`, `{ fromStatus, toStatus }` -- never a Discovery answer, contact PII, or free text.
- No analytics, ad pixel, or session-replay integration reads any table this phase touches; none exists in this codebase at all.

## What was deliberately not added

Per the explicit non-goals list: no SSN/government ID/exact address/medical/IEP/transcript/report-card/NCAA-ID/financial field, no document upload, no advisor dashboard or queue UI, no automatic advisor assignment, no Student Success Blueprint, no provider matching, no payments, no parent account requirement, no new input UI to actually collect `StudentPathwayRecord.displayName` (the column exists for a future verified-save flow; the current production Discovery questionnaire collects no durable student name, so this column stays unpopulated by any Phase 6B code path -- documented here as a known limitation, not silently worked around).

## Migration

`drizzle/0004_pathways_case_foundation.sql` -- fully additive, applied to both the `pathways_dev` and `pathways_test` databases:

- **New table:** `pathways_case` (9 columns, 3 indexes incl. the uniqueness constraint, 5 foreign keys).
- **New columns:** `student_pathway_record.display_name` (nullable text), `advisor_assignment.pathways_case_id` (nullable FK), `advisor_assignment.assigned_by_user_id` (nullable FK), `audit_event.metadata` (nullable jsonb).
- **New enum:** `pathways_case_status`.
- No column was dropped, renamed, or had its type changed; no existing NOT NULL constraint was added to a populated column. Every existing Phase 6A/6A.2/6A.2a record is valid under this migration with no backfill required.

## Known limitations

- `StudentPathwayRecord.displayName` has no write path yet (see above).
- The case-status transitions beyond `CONTACT_RECEIVED`→`BOOKED` (`COMPLETED`, `NEEDS_INFORMATION`, `FOLLOW_UP`, `NOT_CURRENT_SERVICE_FIT`, `CLOSED`) are defined and unit-tested but have no caller yet -- Phase 6C's advisor action is expected to be that caller.
- `AdvisorAssignment` has no creation path yet (no advisor-assignment UI or automatic rule) -- this phase proves the read-side authorization boundary only.
- The Phase 3B Vercel PREVIEW database blocker (no real hosted Postgres behind `DEPLOYMENT_MODE=PREVIEW`) remains open and unrelated to this phase.

## Recommended next phase

**Phase 6C — Advisor Assignment & Operational Queue**, as named in this phase's own instruction: build the actual `AdvisorAssignment` creation path (admin-driven, server-side provisioned), a minimal advisor case queue reading `listActivePathwaysCasesForAdvisor`, and the first explicit case-status transition actions (at minimum marking a case `COMPLETED` after a call, which this phase's validator already supports but nothing yet calls).
