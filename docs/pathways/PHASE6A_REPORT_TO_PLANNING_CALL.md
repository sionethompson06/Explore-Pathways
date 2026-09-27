# Phase 6A — Report-to-Planning-Call Conversion Funnel

## Business objective

Turn the completed, already-built Discovery Report into the first real client-acquisition funnel: a parent who has just seen their personalized report can now request a free planning call with Pathways, submit how to reach them, and (when Google Calendar Appointment Scheduling is actually configured) be handed off to choose a time. This is Pathways' first operational lead-generation path — everything before this phase was either marketing content or a non-persisted preview.

## Owner-locked business decisions

1. Discovery is saved immediately (unchanged from Phase 3).
2. Discovery-only records may exist before contact info is submitted.
3. Discovery-only records do **not** enter the active Advisor lead queue (no Advisor queue exists yet regardless).
4. Once contact info is submitted, the record becomes an operational Pathways lead/case (`ConsultationRequest`, status `REQUESTED`).
5. No parent account is created in Phase 6A.
6. Parent account creation happens **after** the advisor planning call, via a future, separate, secure invitation flow — not built here.
7. The parent does not choose an advisor.
8. Pathways assigns the advisor later (not built here).
9. The parent books a live call via Google Calendar Appointment Scheduling.
10. Call formats: Video preferred, Phone available as an equal alternative.
11. Scheduler: Google Calendar Appointment Schedules (an external booking page handoff — no OAuth, no Calendar API integration).
12. The planning call is free.
13. Duration: 45 minutes (`PLANNING_CALL_DURATION_MINUTES`).
14. Conversion sequence: **contact first, scheduling second** — never the reverse.
15. Contact submission must remain useful even if the parent abandons scheduling entirely.
16. No documents uploaded. No pricing shown. No payment taken. No parent account created. No detailed Blueprint generated. No advisor workspace built.

## Why contact-first

A parent who fills out their name/email/phone but never picks a time still gave Pathways a real, actionable lead — that must not be lost. The contact route (`/discover/consultation`) is architected so it never depends on the scheduler being configured: it only requires a valid guest session with a completed Discovery profile. Submitting contact info is a complete, durable transaction on its own (creates/reuses a `ConsultationRequest` at status `REQUESTED`, persists a `ConsultationContact` row, appends a `WorkflowEvent`) — reaching the scheduling step is a separate, later, optional action.

## The 45-minute free call; video preferred, phone available

`PLANNING_CALL_DURATION_MINUTES = 45` and `DEFAULT_CALL_FORMAT = "VIDEO"` (`src/lib/consultation/constants.ts`) are the single source of truth for this copy everywhere it appears (contact page, schedule page, demo preview). The application cannot verify or enforce that the external Google Appointment Schedule is itself actually configured for a 45-minute slot — that is an operational setup step outside this codebase.

## No parent account is created

`ConsultationRequest.guardianUserId` stays `NULL` throughout Phase 6A. Contact info lives in a new, dedicated `ConsultationContact` table — never a fake `GuardianUser`, and never reusing the existing `consentEvent` table (which requires an already-authenticated `guardianUserId` this pre-auth flow never has). No Better Auth `user`/`session`/`account`/`verification` row is ever created by any Phase 6A code path (verified directly by an integration test).

## Report-snapshot persistence and case linkage

The production report route now idempotently persists an immutable `EngineRun` + `ReportSnapshot` pair (previously it only recomputed the report on every view, never saving it). `ConsultationRequest` carries new, nullable `profileRevisionId`/`reportSnapshotId` columns, so a consultation case can always be traced back to the *exact* Discovery profile revision and the *exact* report snapshot that produced the conversion — without reconstructing historical state from scratch. Both are backward-compatible: existing Phase 1 rows without this linkage are untouched.

## Status meanings

- `NONE` — no conversion has happened yet (a Discovery-only record, if a `ConsultationRequest` exists at all).
- `REQUESTED` — contact info has been received. This is the state a contact-first, scheduling-abandoned lead sits in indefinitely, and that's fine — it's still a real, actionable lead.
- `PENDING_VERIFICATION` — the parent has been handed off to Google's scheduler. This does **not** mean a booking happened; it means the redirect happened.
- `BOOKED` — reserved for a future, verified integration. **Never set by any code in this phase.** A browser redirect to Google is not proof of a booking.

## Google Calendar handoff, and why it never fakes a booking

`/discover/consultation/schedule/go` is the only place a redirect to Google occurs. It resolves the session, verifies `getConsultationCapability()` is actually `REQUEST_ONLY` with a real configured URL, transitions `REQUESTED → PENDING_VERIFICATION` (never regressing a request that's already progressed further), appends a `WorkflowEvent`, and redirects to the **server-configured** URL only — never a URL taken from a query string, form field, header, or client script. If scheduling is not configured, it redirects back into the app with an honest message instead of fabricating availability.

Redirecting a browser to Google's page proves nothing about whether the parent actually completed a booking there. **Google Calendar appointment confirmation synchronization (an event-sync integration — API/webhook/polling matching a booked calendar event back to its `ConsultationRequest`, and only then setting `BOOKED`/`scheduledAt`/creating a `Booking` row and eventually an advisor assignment) is intentionally deferred to a future, separately verified integration.** Nothing in this phase implements OAuth, a Google service account, Calendar API writes, or webhook signature verification.

## Demo mode

`/discover/consultation/demo` mirrors the existing `/discover/demo` (Phase 3C) precedent: entirely client-side React state, zero database/session/cookie/storage access, clearly labeled "DEMO PREVIEW" with explicit "answers and contact information are not saved" / "no real appointment is booked" copy, and its "Choose My Time" button never navigates anywhere.

## Phase 6B handoff readiness

A Phase 6A case is fully queryable later via `ConsultationRequest → StudentPathwayRecord`, the exact `ProfileRevision`, the exact `ReportSnapshot`, the `ConsultationContact`, and the ordered `WorkflowEvent` history — without reconstructing any state that wasn't already persisted. No staff/advisor UI is built in this phase; that is explicitly Phase 6B+ work.

## What Phase 6A deliberately does not do

- No AI, no LLM, no provider matching.
- No Blueprint Preview of any kind (self-service or advisor-built) before or during scheduling.
- No advisor auto-assignment, no parent choosing their own advisor.
- No payment or pricing workflow anywhere in this funnel.
- No redesign of the staff/admin access-control system.
- No email sent by Pathways (EMAIL_MODE remains UNCONFIGURED); Google may independently send its own scheduling emails, which Pathways never claims credit for.
- No real Google Appointment Schedule URL was invented, searched for, or hardcoded for this environment — this repository's actual configuration remains UNCONFIGURED, exactly reflecting that no such URL has been provided.
