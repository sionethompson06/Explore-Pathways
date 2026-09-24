# Phase 5.1 — End-to-End Interactive Discovery Demo Integration

Owner-authorized integration phase. Connects the existing DB-free interactive Discovery questionnaire demo (`/discover/demo`) directly to the real, unmodified Phase 4 decision engine and the real, unmodified Phase 5 Discovery Report assembler, so a visitor can answer the questionnaire, click through to Review, generate their own personalized Discovery Report from the exact answers just entered, edit those answers and regenerate, or start over — all without a database, a session, a cookie, or any browser-storage/URL persistence. Full record of decisions at `docs/pathways/DECISION_LOG.md` section Q. Full contract-change record at `contracts/CHANGELOG.md`.

This phase does **not** redesign the Phase 5 report, alter Golden Report content, alter Phase 4 scoring/rules/candidate qualification/ordering/public fit labels, change Discovery question wording or branching logic, add provider matching, real school search, AI/LLMs, database persistence, cookies for demo state, browser storage, URL-encoded answers, authentication, email capture, payments, booking, or sales/lead scoring. It is an integration phase only.

## 1. Architectural principle

The interactive demo's raw in-memory answers flow through the exact same pipeline production and the Golden fixture demo already use — no second question bank, no duplicated branching/normalization/scoring/archetype-selection/report-wording/report-component logic exists anywhere in this phase's new code:

```
raw demo answers (React memory)
  -> validateCompletedProfile          (@/lib/discovery/validation)
  -> EffectiveAnswers
  -> evaluateDiscoveryProfile          (@/lib/engine/evaluate, Phase 4, unmodified)
  -> buildReportProfileContext         (@/lib/report/profile-context, new shared helper)
  -> assembleDiscoveryReport           (@/lib/report/assemble, Phase 5, unmodified)
  -> DiscoveryReportDTO
  -> <ReportView>                      (@/components/report/ReportView, unmodified content)
```

## 2. New DB-free demo report server action

`app/discover/demo/actions.ts` gains `buildDemoDiscoveryReport(rawAnswers): Promise<{ ok: true; report: DiscoveryReportDTO } | { ok: false; errors: FieldErrorView[] }>`. It is a `"use server"` function that:

1. Validates the complete raw answer snapshot (`validateCompletedProfile`) — returns field errors on failure, never a report.
2. Loads the canonical contracts (`loadContracts`).
3. Runs the real Phase 4 engine (`evaluateDiscoveryProfile`) on the resulting `EffectiveAnswers`.
4. Derives a deterministic, non-random `profileRevisionId` — `demo_interactive_<first 16 hex chars of evaluation.effectiveProfileHash>` — never a random value, never placed in the URL.
5. Builds the presentation-safe profile context via the new shared helper (section 3).
6. Assembles the report (`assembleDiscoveryReport`) with a fixed `consultationState: "UNCONFIGURED"`, `saveAvailable: false`, and a fixed demo `createdAt` (`2026-01-01T00:00:00.000Z`).
7. Returns the DTO. No database call, no session, no cookie, no file write, no server-side cache of the answers anywhere in this path — every field of the answer snapshot lives only in the caller's React state and is discarded the moment the action returns.

## 3. Shared report profile-context helper

`src/lib/report/profile-context.ts` (new) exports `buildReportProfileContext({ rawAnswers, profileRevisionId, gradeBand })`, extracting the same presentation-only fields (`studentDisplayName`, `currentGrade`, `currentEducationModel`, `selectedFamilyPriorities`, `primaryDiscoveryReason`, `desiredPrimaryChange`, `costPreference`, `gradeBand`) that the production report route and the Golden fixture demo route previously computed inline, each with its own copy of the same extraction logic. All three callers (`app/discover/report/page.tsx`, `app/discover/report/demo/page.tsx`, `app/discover/demo/actions.ts`) now call this one helper. It contains no educational-decision logic — it is pure data shaping, identical to what it replaced.

## 4. Demo identifier determinism

The interactive demo's `profileRevisionId` is derived purely from the already-deterministic `effectiveProfileHash` the Phase 4 engine computes from the effective answers — the same raw answers always produce the same id, and different answers (almost certainly) produce a different one. It is never random and is never placed in the URL (the demo route accepts only the pre-existing `?interest=` marketing hint). The demo report's `createdAt` is a fixed constant, matching the convention the Golden fixture demo route already uses for the same DB-free-determinism reason.

## 5. Interactive demo report generation replaces the old completion screen

The old "Discovery Demo Complete" dead-end screen (`CompletionScreen` in `DiscoveryDemoQuestionnaire.tsx`) is removed entirely. Successful completion from Review now calls `buildDemoDiscoveryReport` and renders the real, personalized `DiscoveryReportDTO` via `<ReportView>` in its place. There is only one completion path now; the two flows never coexisted after this phase.

## 6/7. Review button copy (both flows)

- Interactive demo (`DiscoveryDemoQuestionnaire.tsx`): "Complete My Discovery Profile" → **"See My Personalized Discovery Report"**; its loading label is **"Building Your Discovery Report…"** (never "Submitting…").
- Production (`DiscoveryQuestionnaire.tsx`): the same wording change, for the same reason (the button now truthfully describes what happens next). `submitProfileAction`'s own behavior is unchanged — a completed profile still redirects to `/discover/report`, which still loads/validates/runs Phase 4/assembles Phase 5/renders `<ReportView>` exactly as before.

## 8. Full-width report experience

`app/discover/demo/page.tsx`'s `<Section>` no longer passes `narrow` — the questionnaire's own CSS (`DiscoveryQuestionnaire.module.css`'s `.wrapper`, which already sets its own `max-width`/`margin-inline`) constrains the questionnaire's width independently of the Section wrapper. `DiscoveryDemoQuestionnaire` now renders `<ReportView>` in an early return **outside** `.wrapper` once a report exists, so the generated report gets the same full-width premium layout production and the Golden fixture demo already use. No ReportView CSS was duplicated.

## 9-10. Interactive demo state model and report reuse

All demo state (`rawAnswers`, the server-recomputed questionnaire view, the generated `DiscoveryReportDTO | null`, a report-generation-in-progress flag, and any report-generation error message) lives in React state only, in the one client component. Report generation happens "in place" on the Review stage — clicking the report button does not change `stageId`; it only sets `report`, so returning to edit answers is simply clearing it. The exact same `<ReportView>` component production and the Golden fixture demo already use renders the interactive demo's report — no `DemoReportView`/`FakeReport`/`SimplifiedReport`/`PreviewReport` was created.

## 11. `ReportView` API generalization (UI component change, not a report-contract change)

`ReportView`'s `isDemoRoute: boolean` prop is replaced by `demoLabel?: string` (the presentation-only subordinate notice text) plus a new `secondaryTopAction?: ReactNode` (for the interactive demo's "Start Demo Again" button, alongside the existing `editAnswersOverride`). The Golden fixture route passes `demoLabel="Synthetic report demo"`; the interactive demo passes `demoLabel="Interactive Discovery demo — answers are not saved"`; production passes neither. This is a component prop-API change only — `DiscoveryReportDTO` and every other Phase 5 report-contract type is untouched (see section 14/DEC-Q7).

## 12-14. Review/edit, restart, and top actions

- "Review or Edit My Answers" from the generated report clears `report` (never navigates to `/discover/profile`, never calls `reopenForEditingAction`) and returns to the interactive demo's own Review stage with every in-memory answer and branch state preserved exactly as it was. Regenerating after an edit re-runs the full pipeline against the new snapshot.
- "Start Demo Again" clears the report, all answers, all errors, and all generation state, and recomputes the initial empty state — in place, no browser refresh — retaining only the original `?interest=` marketing-hint behavior.
- Both actions render as the report's top actions (`editAnswersOverride`/`secondaryTopAction`), are ordinary accessible buttons, and never link to `/discover/profile`. The Golden fixture report demo's own top-action behavior is unchanged.

## 15. CTA safety

The interactive demo's generated report always assembles with `consultationState: "UNCONFIGURED"`, so its primary call to action is always the safe informational "See What Comes Next" link to `/how-it-works` — never an operationally-live "Build My Student's Pathway" pretense.

## 16. Demo notices

The existing pre-completion "DEMO PREVIEW… answers are not saved… refresh restarts" notice is unchanged. Once a report renders, the interactive demo shows the same visually-subordinate `demoLabel` span every demo route already uses (`ReportView.module.css`'s existing `.demoLabel` style) — not a new overwhelming banner.

## 17. Stale-comment cleanup

`app/discover/demo/actions.ts`'s top-of-file and `validateDemoCompletion` doc comments, which previously said Phase 4 was "not authorized" and would "never generate a recommendation," were rewritten to describe this phase's actual, now-authorized Phase 4 + Phase 5 usage.

## 18. Golden fixture report demo remains separate and intact

`/discover/report/demo?fixture=GRxx` is completely unchanged in behavior (only its call site was refactored onto the new shared `buildReportProfileContext` helper, with byte-identical output) and continues to exist alongside the interactive demo — the two demos are not merged, and neither route ever renders a Golden Report fixture as the result of answering the interactive questionnaire.

## 19. No URL answer payload

The interactive demo never encodes an answer, a partial answer set, or any derived state into the URL. The only accepted query input on `/discover/demo` remains `?interest=`; the only accepted query input on `/discover/report/demo` remains a fixed fixture id.

## 20. DB/session/storage-free confirmation

`app/discover/demo/actions.ts` and every file this phase added or touched under `app/discover/demo/`, `src/lib/report/profile-context.ts`, and `src/components/discovery/DiscoveryDemoQuestionnaire.tsx` were checked (`grep`, plus the pre-existing structural test in `tests/discovery-demo.test.ts`) for `@/db`, `@/db/client`, `@/server/session`, `@/server/discovery-draft`, `cookies()`, any header-based identity read, and any `localStorage`/`sessionStorage`/`IndexedDB` use. The only textual matches are inside doc-comment prose explaining what the code does *not* do — never a real import or call.

## 21. Report-generation error handling

Expected validation errors (an incomplete profile) surface as ordinary field errors on the Review stage, exactly as before. An unexpected report-generation/contract error is caught and shown as a dedicated, non-destructive error screen ("We couldn't build your Discovery Report just yet. Your demo answers are still here. Please try again.") with "Try Again" and "Review My Answers" actions — the in-memory answers are never erased, and the demo never silently falls back to a Golden Report fixture.

## 22-26. New Playwright coverage

`tests/e2e/discovery-demo-integration.spec.ts` (new) drives the questionnaire through the UI at `/discover/demo` (never the fixture route) and covers:

- Questionnaire → real Phase 5 report (hero, "What We Heard" insight section, R03 directions section, R06 pathway, R07 conversion all present for a stable, deterministic input path), the old completion screen and the Golden fixture selector both absent, and the interactive demo's own label present.
- The final Review CTA is reachable and operable by keyboard alone.
- No horizontal overflow at 375px once the report is showing.
- Editing the student's name and regenerating produces a report reflecting the new name, with the old name gone — proof the result comes from the live in-memory answers, not a cached or fixture result.
- "Start Demo Again" from the generated report clears the report and all prior answers and restarts at the initial stage.
- A browser refresh after generating a report restarts the demo from scratch.
- `localStorage`/`sessionStorage` stay empty and no demo session cookie (or any new cookie at all) is set, even once a report has been generated.

Existing Playwright specs (`discovery-demo.spec.ts`, `discovery-profile.spec.ts`, `discovery-scroll.spec.ts`, `discovery-visual-qa.spec.ts`) were updated for the new button wording and the new report-based completion state; `tests/e2e/report-demo.spec.ts` (the Golden fixture demo) was re-run unchanged and confirmed unaffected.

## 27-28. New Vitest pipeline and parity coverage

`tests/discovery-demo-report.test.ts` (new) calls the real `buildDemoDiscoveryReport` action against the Golden Profiles' raw answers (P01, P03, P09, P12, P15) and asserts its output's `contentStatus`/displayed candidates/absence of non-displayed or public-score leakage/`profileRevisionId` determinism against a directly-computed `evaluateDiscoveryProfile` result — no mocked `EngineEvaluation`. A separate parity block runs GR01/GR03/GR12/GR15's underlying personas through both the new interactive builder and the existing Golden-fixture pipeline and asserts the two `DiscoveryReportDTO`s are identical except for envelope/demo metadata (`profileRevisionId`, `reportId`, `createdAt`).

## 29. Production regression

`submitProfileAction` (`app/discover/profile/actions.ts`) is unchanged — a successfully completed revision still redirects to `/discover/report`, which still loads the stored revision, validates it, runs the Phase 4 engine, assembles the Phase 5 report, and renders `<ReportView>`. Only the Review button's wording changed. `tests/e2e/discovery-profile.spec.ts`'s happy-path test confirms this end to end.

## 30. Visual scope

No visual redesign of the report was performed. One layout consequence of the integration itself was found and fixed in test authoring only (not app code): both demo routes' pages carry their own pre-existing visually-hidden landmark `<h1>` (for the surrounding `<Section>`'s `aria-labelledby`) alongside the report's own `<h1>` once a report renders — the same pattern the Golden fixture demo route has always had. This is a real, pre-existing minor semantic duplication (two `<h1>`s on the page), not something this phase's integration introduced net-new; it is noted here for the owner's awareness rather than redesigned, since fixing it would mean changing the pre-existing Golden fixture demo route's markup too, which is out of this phase's scope.

## 31. Documentation

This document; `docs/pathways/DECISION_LOG.md` section Q; `contracts/CHANGELOG.md`'s Phase 5.1 entry.

## 32. Contract versioning

No question bank, rules, scoring policy, taxonomy, report content, Golden Profile, or Golden Report contract version was bumped. `ReportView`'s `isDemoRoute` → `demoLabel`/`secondaryTopAction` change is a UI component prop-API change, not a report-contract change — `DiscoveryReportDTO` and `contracts/report-contract.json` are byte-for-byte unchanged.

## 33-34. Validation summary

See the Phase 5.1 completion report delivered alongside this document for exact counts (Vitest, Playwright, typecheck, lint, build).
