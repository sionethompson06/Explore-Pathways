# Phase 6A.3 — End-to-End Preview Integration

## Business objective

Phase 5.1 built an interactive, DB-free Discovery demo (`/discover/demo`) that generates a real personalized Discovery Report from the actual Phase 4 engine and Phase 5 assembler. Phase 6A.2/6A.2a separately built a DB-free consultation/booking demo (`/discover/consultation/demo`) with a native Pathways booking calendar. Until this phase, the two demos were islands: the interactive demo's report still ended at "See What Comes Next" → `/how-it-works`, with no way to preview the booking experience from inside a personalized report.

Phase 6A.3 connects them, entirely at the presentation layer, so the owner can walk one continuous preview of the full intended customer journey:

**Discovery → Review My Answers → Personalized Discovery Report → "Schedule My Free Pathways Planning Call" → Contact Information → Native Pathways Calendar → Select Date/Time → Demo Confirmation.**

This is a preview-integration phase only. No new scheduler was built, no production consultation/booking behavior changed, and no educational recommendation logic changed.

## What did not change (frozen)

- **Phase 4 decision engine** — `contracts/rules.json`, `taxonomy.json`, `scoring-policy.json`, `question-bank.json`, `fixtures/golden-profiles.json`, and everything under `src/lib/engine/`.
- **Phase 5 report content and design** — `contracts/report-content.json`, `fixtures/golden-reports.json`, and every R01–R07 component's visual design, copy, and structure. The Golden Report fixture demo (`/discover/report/demo?fixture=GRxx`) is byte-identical to before; it never passes the new override.
- **Phase 6A/6A.1/6A.2/6A.2a production behavior** — real contact persistence, `Booking` persistence, scheduler policy (Mon–Thu, 9AM–6PM Pacific, 45+15, 24h notice, 30-day horizon), Postgres uniqueness constraints, booking concurrency handling, `ConsultationRequest` statuses, `WorkflowEvent` semantics, report-snapshot persistence. The real `/discover/report`, `/discover/consultation`, `/discover/consultation/schedule`, and `/discover/consultation/confirmed` routes are untouched.
- No AI, provider matching, Blueprint Preview, Admin/Advisor workspace, parent account, payment workflow, or Google integration was added. No schema migration. No merge to `main`.

## The presentation-only override: `ReportView`'s `primaryActionOverride`

The canonical `DiscoveryReportDTO` the interactive demo assembles (`buildDemoDiscoveryReport()`, `app/discover/demo/actions.ts`) honestly reports `operational.consultationState: "UNCONFIGURED"` — this repository has no real scheduler configured, and that has not changed. Mutating the DTO to claim otherwise, just so the demo could link somewhere, would have made the "canonical report" a fiction.

Instead, `ReportView` (`src/components/report/ReportView.tsx`) gained one new optional prop:

```ts
primaryActionOverride?: ReportAction;
```

resolved as:

```ts
const primaryAction = primaryActionOverride ?? report.actions.primary;
```

and used consistently everywhere the primary CTA renders: `InlineConversionBand` (the contextual band after R03), `ConversionBandFull` (R07, the final conversion section), and `MobileReportCta` (the mobile sticky bar). `report.actions` itself — and therefore the assembled `DiscoveryReportDTO` — is never mutated. Only the interactive demo's questionnaire component ever supplies the override; production's `/discover/report` and the Golden Report fixture's `/discover/report/demo` never pass it, so both remain byte-for-byte identical to their pre-Phase-6A.3 behavior.

A dedicated Vitest assertion (`tests/discovery-demo-report.test.ts`) proves this separation directly against the real server action: `buildDemoDiscoveryReport()`'s own returned `report.actions.primary` still equals `{ label: "See What Comes Next", href: "/how-it-works", operationallySafe: true }`, regardless of anything the interactive demo's presentation layer does with it afterward.

## Shared CTA label: `PLANNING_CALL_CTA_LABEL`

To guarantee the demo's override uses byte-identical wording to the real production CTA (rather than risk a second, independently-typed copy of the string drifting over time), the label was extracted to a single shared constant in `src/lib/report/cta.ts`:

```ts
export const PLANNING_CALL_CTA_LABEL = "Schedule My Free Pathways Planning Call";
```

`resolvePrimaryAction()`'s real `REQUEST_ONLY` branch (production, unchanged destination `/discover/consultation`) and the interactive demo's override object (new destination `/discover/consultation/demo`) both reference this one constant. Production's CTA output is unchanged — confirmed byte-identical.

## Wiring the interactive demo

`src/components/discovery/DiscoveryDemoQuestionnaire.tsx` defines the override object passed to `ReportView`:

```ts
const CONSULTATION_DEMO_ACTION = {
  label: PLANNING_CALL_CTA_LABEL,
  href: "/discover/consultation/demo",
  operationallySafe: true,
} as const;
```

passed as `primaryActionOverride={CONSULTATION_DEMO_ACTION}`. Every representation of the primary CTA on the interactive demo's generated report — inline band, R07 final conversion, and the mobile sticky bar — now shows "Schedule My Free Pathways Planning Call" and links only to `/discover/consultation/demo`. None still link to `/how-it-works`; none link to the real DB-backed `/discover/consultation`; none link to Google. Verified end-to-end by asserting all three same-labeled `<a>` elements on the rendered report share the identical `href`, not merely the first one found.

The interactive demo's own subordinate report label was also clarified (never redesigning the header, just extending its existing subordinate notice): "Interactive Discovery demo — answers are not saved and scheduling is a preview."

## No state transfer between the two demos

The transition from the report's CTA to `/discover/consultation/demo` is a plain link — no query string, no localStorage, no sessionStorage, no cookie, no server cache, no hidden ID. `new URL(page.url()).search` is asserted empty immediately after the click. Both demo routes remain fully DB-free: neither imports `@/db/client`, `@/server/session`, `@/server/discovery-draft`, nor uses `next/headers` cookies anywhere in their dependency path. No guest-session cookie is ever set, and no contact/`Booking` row is ever persisted by either demo.

## Consultation demo copy truthfulness (demo-only)

Two copy corrections were made to `src/components/consultation/ConsultationDemoFlow.tsx` — the demo-only component. The identical copy on the real, DB-backed `/discover/consultation/schedule` production route (which genuinely does save contact info before scheduling) was **not** touched.

- **Schedule step**: "Your information is saved." → **"Contact step complete."** (the demo never actually saves anything). The adjacent demo notice was strengthened to explicitly state contact information is not saved either.
- **Confirmed step**: "This is a demo preview -- no real appointment is booked." → **"This is a preview of the confirmation experience -- no real appointment is booked."** — making explicit that even the confirmation screen itself is simulated. The confirmation never implies a real email was sent, an advisor was assigned, a Meet link was created, an account was created, or anything was actually persisted.

## Test coverage added

- **`tests/discovery-demo-report.test.ts`** — new assertion proving `buildDemoDiscoveryReport()`'s own `report.actions.primary` remains the honest `UNCONFIGURED` CTA (`"See What Comes Next"` / `/how-it-works`), never the demo's presentation override.
- **`tests/e2e/discovery-demo-integration.spec.ts`** — the interactive demo's generated-report test now asserts the connected CTA (`"Schedule My Free Pathways Planning Call"` → `/discover/consultation/demo`) instead of the old dead-end CTA, with an explicit negative assertion that `"See What Comes Next"` no longer appears at all on this route, plus a strengthened assertion that all three primary-CTA `<a>` elements on the page (inline band, R07, mobile sticky) share the identical label and `href` — not merely the first one found.
- **`tests/e2e/consultation.spec.ts`** — the DB-free demo preview test's exact-string assertion was updated from the now-corrected-away "Your information is saved." to "Contact step complete.", and its date-selection step was hardened with a `selectFirstAvailableDate()` helper (mirroring the one already proven in `tests/e2e-internal/booking-internal.spec.ts`/`calendar-ux.spec.ts`) that advances month-by-month until a selectable date exists — the demo calendar's synthetic slots are generated against the real current wall-clock time, so the initially-displayed month can legitimately have zero selectable dates left by the time a test runs.
- **`tests/e2e/discovery-to-consultation-preview.spec.ts`** (new) — a true end-to-end test driving the full connected journey: Discovery questionnaire → Review → generated report → click the primary CTA → assert URL/label/href → contact form → native calendar → select date and time → summary card → Confirm → fake confirmation, with assertions that zero new cookies and zero localStorage/sessionStorage entries were created anywhere across the entire journey. A companion test proves a page refresh mid-journey (after reaching the fake confirmation) restarts the consultation demo from an empty contact form, with no prior contact values or "reserved" state surviving — both demos hold only in-memory React state.

## Verification

- Full Vitest suite: all pre-existing tests pass, plus the new canonical-DTO assertion (26/26 in `tests/discovery-demo-report.test.ts`).
- Full default Playwright suite (including the new `discovery-to-consultation-preview.spec.ts` file): all green.
- Golden Report regression tests (`tests/e2e/report-demo.spec.ts`, `tests/e2e/report-visual-polish.spec.ts`): unweakened, all pass — the Golden fixture demo's CTA still honestly resolves `UNCONFIGURED` → "See What Comes Next".
- Internal Playwright suite (`playwright.internal.config.ts`): unaffected by this phase, re-verified green.
- Typecheck, lint, production build: clean.
- Mobile (375px) and desktop (1440px) visual QA of the full connected journey performed directly in-browser.

## Owner action

None required. Phase 4 educational decision logic, Phase 5 report content/design, and the Phase 6A booking domain/scheduling policy are unchanged. No AI, provider matching, Blueprint Preview, Admin/Advisor workspace, parent account, or payment workflow was added. No schema migration. No merge to `main` occurred.
