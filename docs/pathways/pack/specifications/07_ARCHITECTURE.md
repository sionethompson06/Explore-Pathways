# Proposed Technical Architecture
## Default, not an instruction to rewrite a sound repository
For a new custom app: Next.js App Router + TypeScript, PostgreSQL with a typed migration/ORM layer, runtime schema validation (for example Zod), accessible React components, utility CSS/design tokens, unit/integration tests and browser E2E tests. Vercel is a proposed hosting destination, not a verified connected project. If the chosen builder has an equivalent supported stack, document equivalence for persistence, access control, server secrets, auditability, portability and tests before proceeding. Pin tested supported versions; do not invent version numbers from memory.

Use one modular application, not microservices. Keep source-controlled content and rules initially; no drag-and-drop rule editor, vector database, multi-agent framework or live web research needed. Established authentication with verified email, not home-grown security. Google sign-in is optional, not a prerequisite.

## Modules
Public marketing / question registry and branching / profile normalizer / pure recommendation engine / report assembler / optional prose adapter / identity and saved records / consultation adapter / advisor workflow / minimal first-party analytics / content validation.

The engine and report logic are framework-independent server modules. UI components never contain a second scoring implementation. No browser credentials for database, email, AI or scheduler. Schemas govern both request validation and public DTOs.

## Routes (proposed)
/ homepage
/how-it-works service explanation
/pathways/[slug] approved audience pages: athletes, homeschool, flexible-learning, academic-opportunities
/for-partners honest introduction, no unsupported operational form
/discover introduction
/discover/profile conditional questionnaire
/discover/report protected guest result in the current session
/reports/[id] verified saved-report access
/consultation request/schedule for current authorized profile
/consultation/confirmation only after actual verification
/sign-in parent/staff authentication
/family minimal saved-report and next-step view
/advisor assigned-case list
/advisor/cases/[id] assigned case, report and status
/admin configuration health and authorized aggregate metrics
/privacy and /terms approved final content required before live collection

No public report URLs, role-specific information in page source, or dynamic social preview containing child information. Index only approved public marketing pages. noindex is supplementary, not access control.

## Data objects
GuardianUser; StudentPathwayRecord; GuardianStudentAccess (explicit links, not a broad shared-family shortcut); DiscoverySession (guest session owner, expiry); ProfileRevision (validated raw and effective answers, question version); EngineRun (internal findings and versions); ReportSnapshot (public content and hash); ConsentEvent (purpose, action, version, timestamp); ConsultationRequest (request status distinct from booking); Booking (provider reference, actual time zone and state); AdvisorAssignment; AdvisorNote; WorkflowEvent; AuditEvent; AggregateEvent.

Separate report content state (PERSONALIZED, LIMITED_INFORMATION, ADVISOR_FIRST), generation state (TEMPLATE, AI_ASSISTED, FALLBACK, FAILED), record persistence (GUEST, VERIFIED_SAVED), and consultation state (NONE, REQUESTED, PENDING_VERIFICATION, BOOKED, CANCELLED, COMPLETED, NO_SHOW). Avoid a single enum that cannot express combinations.

## Ownership and privacy
Guest receives a cryptographically random, HttpOnly, Secure in deployed HTTPS, SameSite session cookie. Server stores only the needed draft behind that session, with an explicit expiry. No raw child answers in persistent browser storage. Parent can discard. Sensitive private responses use private/no-store cache policy and cannot be reused in public RSC/CDN caches.

Verified parent may save only a report belonging to their active guest or existing authorized account context. Email entry alone never merges accounts or attaches someone else's report. Family grouping never grants access without explicit guardian-student association. Use proven single-use expiring email sign-in semantics; do not log authentication tokens or detailed report content. Raw IDs and random UUIDs are not authorization.

Every read, write, export, action and callback enforces object-level policy. Advisors see assigned consented cases only; anonymous unsaved drafts are not a sales inbox. Admin privileges are allowlisted/assigned server-side; no public account can select staff role. Log privileged access without copying raw answers. Limit admin bulk export; no raw-data CSV export in MVP.

Privacy release gates include configured retention, scheduled cleanup, ability to remove saved data, backup/log handling, vendor review, neutral email contents, rate limits, abuse prevention, input validation, CSRF protections and real multi-user access tests. Do not claim automatic COPPA, FERPA or other legal certification.

## Adapters
Email: request -> provider acceptance -> delivery/bounce states where supported; never call delivery confirmed merely because a form submitted. Neutral saved-report notification. Marketing enrollment separate and off by default.
Scheduler: UNCONFIGURED, REQUEST_ONLY or LIVE_VERIFIED. Booking confirmation from validated provider API/webhook or documented provider confirmation, never client redirect alone. Verify webhook signatures, replay protection and idempotency. Correct student/report owner and appointment time zone, daylight saving, cancellation and reschedule behavior.
AI: DISABLED, APPROVED_PROVIDER or FALLBACK. Feature flag server-side. No tool access or autonomous sends. Non-PII approved facts; strict schema and semantic checks; cost/time limits; stored output per version. Missing key leaves template reports fully operational.

## Operations
Prototype mode is synthetic, no external email, no real appointments, no actual child data. It must be visibly distinguished and deployment-protected. Production startup/readiness checks reject prohibited fixture auth/bypass flags. Never silently use demo integrations in live mode.

Phase deliverables use a feature branch in the designated repository. No force pushes, branch renames, production merges, destructive migrations, account purchases or domain changes without specific authorization. Maintain backups/rollback for approved schema changes. Preview deployments do not count as production approval.

## Analytics
Allowed event properties: stage, coarse pathway-interest category if approved, viewport class, experiment version, aggregate error code, public campaign code, timestamp. Keep event/session identifiers appropriately scoped; no child name, free text, exact location, email, health/academic concern detail, auth token or raw URLs. Small-cell subgroup reporting needs a disclosure threshold; avoid re-identifying one household.
Store allowed first-touch attribution separately from educational inputs; recommendation engine must not receive it. No third-party ad pixels or session replay on intake, report, auth, booking or staff screens. Measure report completion, save request/verified save, booking intent/verified booking, attendance, service fit and correction rate with defined denominators.

---

## Provenance note (added at Phase 0 corrections, this repository)

This file is preserved verbatim from the originally supplied pack. The approved Phase 1 stack selection (Next.js App Router, TypeScript, PostgreSQL, Drizzle for schema/migrations, Better Auth for authentication, Zod for runtime validation, pnpm with a committed lockfile) is recorded in `docs/pathways/INTEGRATION_REGISTER.md` with exact pinned versions as installed.
