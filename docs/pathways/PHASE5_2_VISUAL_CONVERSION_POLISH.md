# Phase 5.2 — Discovery Report Visual & Conversion Polish

Status: IMPLEMENTED, not merged to main. Full decision record: `docs/pathways/DECISION_LOG.md` section S. Contract/version record: `contracts/CHANGELOG.md` "Phase 5.2" section.

## 1. Objective

Move the Discovery Report from "clean, correct beta" to a premium, personalized education-advisory product — presentation, information design, and conversion framing only. The educational decision system (Phase 4) and the approved report content (Phase 5's `contracts/report-content.json` / `fixtures/golden-reports.json`) are untouched.

## 2. Absolute scope boundary (verified, not just declared)

Byte-unchanged (verified via `git diff --stat` against the pre-Phase-5.2 `HEAD`, `49164cc`):

- `contracts/question-bank.json`, `contracts/rules.json`, `contracts/scoring-policy.json`, `contracts/taxonomy.json`
- `contracts/report-contract.json`, `contracts/report-content.json`
- `fixtures/golden-profiles.json`, `fixtures/golden-reports.json`
- `src/lib/engine/**`, `src/lib/report/types.ts`, `src/lib/report/assemble.ts`, `src/lib/report/cta.ts`

No contract version was bumped (`question-bank` stays `2.1.0-discovery-ux-simplified`; `rules`/`scoring-policy`/`taxonomy` stay `2.0.0-phase4-engine`; `report-contract` stays `2.0.0-phase5-report`; `report-content` stays `1.0.0-phase5-report`; `golden-profiles` stays `2.0.0-owner-calibrated`; `golden-reports` stays `1.0.0-owner-calibrated`). `DiscoveryReportDTO` is unchanged — every new prop threaded through components (`contentStatus`) is a value already present at the top of the existing DTO, not a new field.

Nothing added: no AI/LLM, no provider matching, no school search, no enrollment/payment/booking, no advisor assignment, no lead scoring, no fabricated urgency, no testimonials, no stock photography, no new visual/UI framework, no new icon library, no new font package. No new client component or React state was introduced for styling — every touched component (`ReportUtilityHeader`, `DirectionCard`, `DirectionGrid`, `SupportOpportunityMap`, `ComparisonGuide`, `PathwayRoadmap`, `ConversionBand`, `InsightSection`, `ReportHero`) is a Server Component; `MobileReportCta` remains the only client component, restyled only.

## 3. What changed, section by section

**Report utility header (new, section 22):** `ReportUtilityHeader` replaces the previous bare `demoLabel`/`topActions` strip above the hero. Left: the existing `Logo` wordmark + a "Discovery Report" label + the optional demo badge. Right: the same edit-answers action/override and secondary action ("Start Demo Again" on the interactive demo) as before — no behavior change, only layout.

**R01 — Hero:** Same abstract SVG motif and dark navy/green/blue gradient. Tightened eyebrow/title/headline rhythm, a subtle top-border rule above the scope statement for hierarchy, and mobile-specific (≤640px) padding/sizing so the headline, summary, and badge never clip or overflow at 375px.

**R02 — What We Heard:** Exact copy unchanged. A left accent rule + eyebrow now frame it as Pathways' interpretation rather than a plain paragraph; LIMITED_INFORMATION gets a visibly softer (neutral, not green) version of the same treatment — honest limited information stays visually humbler than fabricated personalization would be.

**R03 — Directions Worth Exploring:**
- The section heading is now a visible `<h2>` for personalized reports (previously `visually-hidden`).
- `DirectionCard`'s internal motif no longer renders the internal `baseModelId` (e.g. "B07") as visible text at all — it was previously inside an `aria-hidden` span, which hides it from assistive tech but not from sighted users. It is now a purely decorative SVG glyph.
- "Why this surfaced" and "What to look for" are now two separate, distinctly-styled regions: a green-tinted "Why This Surfaced" evidence zone (confirming check-mark icon) and a blue-navy "What To Look For" action zone (checklist icon) — different background, border accent, and icon, never sharing typography.
- The two zero-card special states (ADVISOR_FIRST / LIMITED_INFORMATION) now render two distinct presentational wrappers over the identical `emptyStateHeading`/`emptyStateBody` DTO content: ADVISOR_FIRST is a confident navy/blue "under review" panel (shield-check icon); LIMITED_INFORMATION is a warmer, lighter "still exploring" panel (compass icon). Neither reads as an error.
- Two equal-weight cards remain visually identical (same column width/border/shadow/padding/heading scale) — verified by a new bounding-box Playwright assertion.

**R04 — Support & Opportunity Map:** Tiles are now smaller and icon-led (a linked-circles glyph for SUPPORT, an upward-arrow glyph for OPPORTUNITY), on a warm-neutral surface with a 1px border and no card shadow — deliberately lighter than R03. A new "The ecosystem around this direction" eyebrow reframes the section as the surrounding ecosystem rather than a second row of recommendations. The special-state tiles get the same two-variant (navy-accent vs. warm-neutral) wrapper as R03's zero-card states, over the same `specialHeading`/`specialTiles` content.

**R05 — Comparison Guide:** The existing `guide.title` becomes a small uppercase eyebrow. A new, UI-only universal heading — "Questions That Matter Before You Choose" — and supporting copy — "These are the questions worth answering before you choose a direction or program." — render above the question list (both new strings live in `ComparisonGuide.tsx`, never in `report-content.json`). Numbered markers are larger and solid navy; question typography is stronger; per-question separation is a subtle top border rather than a repeated flat panel; the whole section sits on a blue/navy advisory-tinted surface.

**R06 — Preliminary Pathway:** Now a single continuous vertical stepper at every viewport. The previous ≥900px switch to a CSS-grid auto-fit column layout — which squeezed a parallel group's two branches into an unreadably narrow ~180px track — is removed entirely. A connector line now threads behind every numbered stage. The parallel-group step (GR12) visibly forks off that line into a bracketed two-track box, labeled both visibly and via `role="group" aria-label="Parallel pathway priorities"`, and then the line continues to the next stage — split → parallel tracks → rejoin, legible without reading the subordinate paragraph. `groupStages()`'s existing accessible reading-order grouping (one `<li>` per parallel group) was already correct and is unchanged. Genuinely sequential pathways (GR09/GR15/GR03/GR06/GR14) are unaffected structurally — only more premium in spacing, numbering, and typography; no artificial branching was added.

**R07 — Conversion:** Stronger CTA sizing/spacing/typography, a subtle arrow icon, a full-width mobile CTA, and a presentational-only accent variant by `contentStatus` (a top accent bar + CTA tint: green for PERSONALIZED, blue for ADVISOR_FIRST, a muted neutral for LIMITED_INFORMATION). `action.label`/`action.href` are passed through completely unchanged in every case — CTA-resolution safety in `src/lib/report/cta.ts` was not touched, and UNCONFIGURED still always resolves to "See What Comes Next" at the existing safe informational href. The inline conversion band placed after R03 now uses `contentStatus`-specific copy (new UI-only strings in `ReportView.tsx`) instead of the previous hardcoded PERSONALIZED-only copy, while still rendering the same `report.actions.primary` in every variant.

**Golden fixture selector (mobile, section 30):** `app/discover/report/demo/page.tsx`'s fixture nav is now `flex-wrap: nowrap` with `overflow-x: auto`, so on narrow viewports it scrolls horizontally as a single row instead of wrapping — plain CSS on the existing server-rendered links, no new client JS or rendering path.

## 4. Design system discipline

Only existing tokens from `app/globals.css` were used (`--color-navy-900/800/700/600`, `--color-green-600/700` via the `--color-accent*` aliases, `--color-blue-600/500` via `--color-emphasis`, `--color-warm-white`, `--color-neutral-*`, `--radius-sm/md/lg/full`, `--space-1`…`--space-9`, `--font-size-*`, `--shadow-card`). All new iconography is inline, decorative SVG with `aria-hidden="true"` — no icon package. No new font, no animation library.

## 5. Accessibility

- Single `<h1>` per rendered state is unchanged (untouched by this phase; still verified by the existing Playwright `h1` count-1 assertions across every state).
- New/changed headings keep a correct H2/H3 hierarchy; R03's heading went from hidden to visible, never the reverse.
- The parallel pathway group uses `role="group"` with a visible `aria-label` naming it, per the spec's accessible-parallel-reading-order requirement — assistive tech and sighted users get the same label.
- All new icons are `aria-hidden="true"`; no information is icon-only (every icon sits beside real text).
- Status differentiation (ADVISOR_FIRST/LIMITED_INFORMATION/PERSONALIZED) is always icon + color + typography together, never color alone.
- CTA targets remain ≥44px; the mobile CTA is full-width.
- `prefers-reduced-motion` handling is untouched (already global in `app/globals.css`; nothing in this phase added new motion).

## 6. Test coverage

- New `tests/e2e/report-visual-polish.spec.ts` (24 tests, all passing): no visible internal candidate IDs, evidence/action as separate regions, the visible R03 heading, two-card equal width, the R04 ecosystem eyebrow, R05's new heading/subcopy alongside the original `guide.title`, GR12's parallel group (accessible group + desktop side-by-side + mobile grouped-stacked + no overflow), CTA safety across 5 fixtures, the 3 contentStatus-specific inline-band copy variants, GR09/GR15 never reading as an error, and the utility header's content.
- The full pre-existing suite was re-run, not assumed: 185 Playwright tests (including `report-demo.spec.ts`'s Golden Report coverage, `discovery-scroll.spec.ts`'s single-H1/scroll assertions, and every marketing/navigation/discovery spec) and 781 Vitest tests (including the DB-backed `access-control`/`discovery-draft`/`discovery-security`/`session`/`magic-link`/`principal` suites, with local PostgreSQL started and `TEST_DATABASE_URL` set) — zero regressions, zero weakened assertions.

## 7. Pre-existing, non-blocking anomaly (DEC-G4, re-confirmed)

`pnpm build` in this sandbox fails prerendering Next's own internal `/_global-error` page. This was already diagnosed and documented in Phase 3 as DEC-G4 (a Turbopack/Next 16.3.5-vs-container anomaly that does not reproduce in GitHub Actions' `ubuntu-latest` runner). It was independently re-confirmed in this phase by `git stash -u`-ing every Phase 5.2 change and rebuilding against the unmodified Phase 5.1a `HEAD` before writing any Phase 5.2 code: the identical failure reproduces with zero Phase 5.2 changes present. Not fixed here (pre-existing, already diagnosed, out of this phase's scope); `pnpm dev` (used for every manual and Playwright verification in this phase) is unaffected.

## 8. Deferred (P2)

None of the P0/P1 items in the authorizing instruction were deferred. The one P2 item (golden fixture selector mobile compactness) was implemented, not deferred.

## 9. Explicitly not started

Phase 6, provider/school matching, the Blueprint product, advisor workflow tooling, booking, payments, AI/LLM integration, CRM/lead capture, analytics, and any merge to `main` — none of these were touched, per the phase's own stop boundary.
