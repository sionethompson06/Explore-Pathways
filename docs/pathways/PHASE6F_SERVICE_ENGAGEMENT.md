# Phase 6F — Family Decision, Service Engagement & Payment Plan Confirmation

## Purpose

Once a Student Success Blueprint reaches `READY_FOR_CLIENT`, Pathways staff must be able to record the family's decision, what consulting arrangement and payment terms were agreed to, when, by whom, and whether the case has moved into `ACTIVE_CONSULTANCY`. This is an operational consulting handoff, not an e-commerce phase: no Stripe, checkout, online payment collection, invoices, recurring billing, parent accounts, electronic signatures, contracts, provider research, consultancy task management, or AI.

## Product separation

The Blueprint (what Pathways professionally recommends), the Service Engagement (what consulting the family chooses), and the Payment Arrangement (how the family agreed to pay) are three distinct concepts. A family's payment decision never modifies Discovery recommendations, Blueprint recommendations, advisor professional judgment, or educational suitability — `BLUEPRINT_ONLY` and `NOT_PROCEEDING` are never treated as evidence that the student was not a good educational fit.

## Data model

### `FamilyDecision` (`family_decision` enum)

`CONTINUE_WITH_PATHWAYS` | `BLUEPRINT_ONLY` | `FOLLOW_UP_NEEDED` | `NOT_PROCEEDING`

### `ServiceEngagement` (one mutable row per `PathwaysCase`, `src/db/schema/service-engagement.ts`)

Per section 25's explicit "acceptable to maintain one current engagement record plus audit history rather than building full contract versioning" guidance, this is a single row (never a revisioned architecture like Blueprint's parent/revision shape) enforced by `service_engagement_case_unique_idx` — there is exactly one `ServiceEngagement` per case, ever, by construction, which trivially satisfies "one case should not accidentally accumulate multiple simultaneous active engagements."

Columns: `pathwaysCaseId` (FK), `sourceBlueprintRevisionId` (FK, captured at creation, never repointed, never itself modified), `familyDecision` + `familyDecisionRecordedAt`/`ByUserId`, `serviceArrangement` + optional `serviceArrangementDescription`, `paymentStructure`, `paymentStatus` (derived, never client-settable), `currency` (default `"USD"`), `agreedTotalAmountCents`/`paymentAmountCents`/`installmentCount` (integer cents, never floating-point), `firstPaymentDate`, `termsNote`, `paymentMethodNote`, `paymentHandledExternally`, `followUpNote`/`followUpDate`, `notProceedingReason`, `status` (engagement lifecycle), `confirmedAt`/`ByUserId`, `activatedAt` (set once, never cleared), `version` (optimistic concurrency).

### `ServiceArrangement` (`service_arrangement` enum)

`ONGOING_PATHWAYS_CONSULTING` | `CUSTOM_ENGAGEMENT` (with an optional free-text description) — no package SKUs, product inventory, pricing tables, subscription products, or discount engines.

### `PaymentStructure` (`payment_structure` enum)

`ONE_TIME` | `MONTHLY` | `INSTALLMENTS` | `CUSTOM` | `WAIVED` | `PENDING`. Each structure validates only the fields it actually needs (`src/server/service-engagement.ts`'s `validatePaymentFields`): `ONE_TIME` requires `agreedTotalAmountCents`; `MONTHLY` requires `paymentAmountCents`; `INSTALLMENTS` requires `paymentAmountCents` + `installmentCount`; `CUSTOM` requires a `termsNote`; `WAIVED`/`PENDING` require nothing.

### `PaymentStatus` (`payment_status` enum, derived)

`NOT_REQUIRED` (from `WAIVED`) | `TERMS_PENDING` (from `PENDING`) | `TERMS_CONFIRMED` | `PAYMENT_HANDLED_EXTERNALLY` (an explicit, narrow staff opt-in for "this was already paid outside the system," never a pseudo-ledger, never `PAID`). Computed deterministically from `(paymentStructure, paymentHandledExternally)` by `derivePaymentStatus` — never independently client-settable.

### Money storage

Integer cents only (`parseDollarsToCents`/`formatCentsAsDollars` in `src/server/service-engagement.ts`, round-trip-safe, no floating-point arithmetic anywhere). Default currency `"USD"`; no multi-currency support built.

### `ServiceEngagementStatus` (`service_engagement_status` enum)

`PENDING_DECISION` | `TERMS_PENDING` | `CONFIRMED` | `ACTIVE` | `DECLINED` | `CLOSED` — a small, separate lifecycle from Blueprint status, never a full sales pipeline. `BLUEPRINT_ONLY` → `CLOSED`; `NOT_PROCEEDING` → `DECLINED`; `FOLLOW_UP_NEEDED` → `PENDING_DECISION`; `CONTINUE_WITH_PATHWAYS` with `paymentStructure === "PENDING"` → `CONFIRMED` (decision + arrangement recorded, payment terms not yet finalized); `CONTINUE_WITH_PATHWAYS` with any other payment structure → `ACTIVE`. Once `ACTIVE`, a later save never regresses the status (section 25: never silently overwrite confirmed terms).

## Activation rule (the exact rule, as instructed)

`ACTIVE_CONSULTANCY` occurs when, in one atomic transaction: (1) `familyDecision === "CONTINUE_WITH_PATHWAYS"`, (2) a `serviceArrangement` is recorded, (3) payment terms are confirmed, waived, or explicitly marked handled externally (i.e. `paymentStructure !== "PENDING"`), and (4) authorized staff submits the single "Confirm Engagement" action that carries all of the above. `activatedAt` is set only the first time these conditions are met and is never cleared or moved by a later save (idempotent). At that same moment, `PathwaysCase.status` transitions `COMPLETED → ACTIVE_CONSULTANCY` (reachable only from `COMPLETED`, added to `src/server/pathways-case.ts`'s transition matrix) — the cleanest existing architecture per section 12's own guidance: both the engagement's own status and the case's own status carry the fact, with clearly separated meanings (engagement = the commercial record; case = the operational case-queue state).

## Blueprint gate

`recordFamilyDecision` requires `getCurrentBlueprintRevision(...).status === "READY_FOR_CLIENT"` before any engagement row can be created (`BLUEPRINT_NOT_READY` otherwise) — never modifying the Blueprint itself. `sourceBlueprintRevisionId` records which exact revision satisfied the gate, for traceability only.

## Authorization

An `ADVISOR` must hold an active assignment to the exact case — the UNCHANGED `assertAdvisorCanAccessPathwaysCase` boundary, same as every other advisor write in this codebase; a former/reassigned advisor loses access immediately, with no special-casing. An `ADMIN` needs only the role itself, never an assignment — this extends the SAME "any admin, not assignment-gated" rule `src/server/staff-queue.ts`'s `getCaseDetailForStaff` already applies to case reads everywhere in this codebase, to writes, per section 15's explicit "Admin: may view and update." This is the first place in the codebase ADMIN gets a genuine write path (Blueprint's own authoring module is ADVISOR-only by design); it reuses the existing role/assignment primitives rather than inventing a parallel authorization model. Guest/public/parent: no access — the engagement section lives only on the already-staff-gated `/advisor/.../blueprint` and `/admin/.../blueprint` routes.

## Staff workflow

A single "Continue With Pathways" section (`src/components/staff/ServiceEngagementForm.tsx`) appears on both Blueprint routes once the current revision is `READY_FOR_CLIENT`: a family-decision radio group, and — only for `CONTINUE_WITH_PATHWAYS` — consulting-arrangement and payment-arrangement controls with structure-specific conditional fields, plus a single "Confirm Engagement" submit. Progressive disclosure is implemented entirely with CSS `:has()` selectors (`staff-page.module.css`), matching every other staff workspace form's "plain `<form>`, no client JavaScript" convention — never a client component. Once the engagement reaches `ACTIVE`, `DECLINED`, or `CLOSED`, the page instead renders a concise read-only `ServiceEngagementSummary` (status, family decision, service, payment summary line, follow-up/reason, confirmed-at/by) — no sales dashboard, pipeline Kanban, revenue chart, or package comparison anywhere.

## Follow-up needed / Blueprint only / Not proceeding

`FOLLOW_UP_NEEDED` allows an optional note and date (no scheduling/reminder system). `BLUEPRINT_ONLY` records the decision and creates no active engagement; the Blueprint is never altered, and the case may remain `COMPLETED`/`CLOSED` per the existing lifecycle. `NOT_PROCEEDING` records the decision, date, confirming staff, and an optional reason (never required, never used in educational scoring); nothing is deleted — Discovery, Report, Planning Call, Blueprint, and case history are all preserved untouched.

## Audit events

`SERVICE_ENGAGEMENT_CREATED`, `FAMILY_DECISION_RECORDED`, `SERVICE_TERMS_CONFIRMED`, `PAYMENT_ARRANGEMENT_CONFIRMED`, `CONSULTANCY_ACTIVATED`, `ENGAGEMENT_DECLINED` (plus the existing `CASE_STATUS_CHANGED` convention when the case moves to `ACTIVE_CONSULTANCY`). Audit metadata is restricted to case id, engagement id, family decision, payment structure/status, actor, and timestamp/status-transition — never agreed amounts, terms notes, or any other financial detail.

## Payment-processing boundary

No Stripe, PayPal, Square, ACH provider, credit-card form, payment token, or bank information anywhere. Explore Pathways operates on the premise that payment is handled externally (phone/video/email/offline), with authorized staff recording the confirmed arrangement internally afterward. A future phase can add payment automation without redesigning this engagement domain — the `PaymentStructure`/`PaymentStatus` separation exists specifically so that boundary never requires a schema rewrite.

## Data privacy

Agreed price, installment amount, payment notes, and engagement terms never appear in: the public Discovery Report DTO (`src/server/report-outcome.ts`'s `getLatestPersistedReportSnapshotForRevision`, structurally disconnected from `service-engagement.ts` — no shared type, no shared code path), public routes, URLs, metadata, analytics, client-side logging, or demo flows. Proven by `tests/service-engagement.test.ts` scenario 28 (the real production report-read path is byte-identical before/after an engagement with specific secret figures is confirmed, and the secret figures never appear in its output).

## Tests

`tests/service-engagement.test.ts` (28 tests, real PostgreSQL) covers the Blueprint gate, idempotent/cardinality-enforced creation, authorization in every configuration (assigned advisor, unrelated advisor, former advisor, actively-assigned admin — note: admin access is role-gated only, not assignment-gated, per the authorization section above), all four family-decision branches, all six payment structures, safe money storage, confirm-engagement actor/timestamp recording, the exact activation rule and its idempotency, a genuine stale-concurrent-edit rejection, the full audit-event set, and non-mutation of the Blueprint, PlanningCallRecord, and the Discovery profile/report snapshot (the educational recommendation engine's own output).

`tests/e2e-internal/service-engagement.spec.ts` (4 Playwright tests, real browser, real PostgreSQL): the full real journey from Discovery through a READY_FOR_CLIENT Blueprint, then Continue-With-Pathways → Installments → Confirm → Active Consultancy (with admin read access to the confirmed engagement), Blueprint Only (no activation), Follow-Up Needed (no activation), and a security-denial check for an unassigned advisor.

## Deferred (explicitly out of scope for this phase)

Payment processing/automation (Stripe or any processor), invoices, recurring billing, a parent portal or electronic acceptance, provider research/matching, consultancy task management, ongoing communications, and AI. The Active Consultancy Workspace itself (managing the ongoing relationship once active) is Phase 6G, not built here — this phase stops at recording that the relationship became active.
