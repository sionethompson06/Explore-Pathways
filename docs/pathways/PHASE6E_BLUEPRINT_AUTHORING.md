# Phase 6E — Student Success Blueprint Architecture & Authoring Workflow

## Business objective

Phase 6D gave the advisor a structured record of the Planning Call conversation, but nothing yet turns that record -- plus the original Discovery profile and the algorithmic Discovery Report -- into Pathways' actual professional planning deliverable. Phase 6E builds the architecture and internal advisor authoring workflow for the **Student Success Blueprint**: a structured, revision-controlled educational planning document that transforms Discovery + the Discovery Report + a completed Planning Call + advisor professional judgment into twelve labeled sections (B01-B12), with an explicit draft/internal-review/ready-for-client lifecycle and a controlled revision process for later updates.

It deliberately stops there: no public delivery, no parent access, no PDF export, no email, no payment/pricing/invoicing/e-signature, no provider marketplace, no enrollment, no document uploads, no AI-generated content, no automated communications. The next phase ("Phase 6F — Blueprint Delivery, Service Recommendation & Commercial Handoff") is explicitly out of scope here.

## Entity architecture: parent/revision, never a flat table

```
PathwaysCase (Phase 6B, unchanged)
  └─◄ StudentSuccessBlueprint (NEW -- thin identity anchor, exactly one per case)
       └─◄ BlueprintRevision (NEW -- all actual content lives here, many per blueprint over time)
            ├─► ProfileRevision     (exact source, never re-derived)
            ├─► ReportSnapshot      (exact source, never re-derived)
            └─► PlanningCallRecord  (exact source + its version at creation time)
```

This mirrors the parent/revision pattern already proven by `ProfileRevision`/`ReportSnapshot` (Phase 1/6A) and is the architecture the instruction required over a single 50-100 column table. `StudentSuccessBlueprint` carries almost no fields of its own (`id`, `pathwaysCaseId`, timestamps) -- it exists purely as a stable identity anchor so "the Blueprint for this case" has one unambiguous row, enforced by `student_success_blueprint_case_unique_idx` (DB-level, one parent per case, no exceptions). Every actual professional judgment, every piece of content, lives on `BlueprintRevision`.

**Cardinality**: exactly one `StudentSuccessBlueprint` per `PathwaysCase` (unique index); any number of `BlueprintRevision` rows per blueprint over time, but at most one `isCurrent = true` at any moment (`blueprint_revision_current_per_blueprint_unique_idx`, the same partial-unique-index pattern Phase 6D's `planningCallRecord.isPrimary` already proved), and exactly one row per `(blueprintId, revisionNumber)` pair (`blueprint_revision_number_unique_idx`).

## Content storage: a strictly-validated versioned JSONB document

The instruction permitted either a JSONB content column (if implemented rigorously) or fully normalized tables, with justification required either way. This phase chose JSONB (`blueprintRevision.content`), justified against each of the instruction's sub-requirements:

1. **Strict runtime schema** — `src/lib/blueprint/content-schema.ts`'s `blueprintContentSchema` is a Zod object tree, every nested object `.strict()` (rejects unknown keys at every level, not just the top), covering all twelve B01-B12 sections and every item shape within them.
2. **Versioned** — `CONTENT_SCHEMA_VERSION = "1.0.0"` is a `z.literal()` discriminant inside the content itself (`schemaVersion`) AND a separate `contentSchemaVersion` database column, so a future schema migration can be detected two independent ways.
3. **Validated on every write** — `parseBlueprintContent()` is called by `saveBlueprintDraft` before anything reaches the database; there is no write path that stores unvalidated JSON.
4. **Unknown/unapproved structures rejected** — every object schema is `.strict()`; an extra key anywhere in the document throws.
5. **Stable section IDs independent of UI headings** — each section object carries a literal `sectionId` (e.g. `"B04_RECOMMENDED_EDUCATIONAL_STRATEGY"`) that never changes even if a future UI relabels its heading.
6. **No arbitrary blobs** — every field, down to each list item (a verification item, an action item, a roadmap item), is an explicitly typed, bounded (`.max()`-capped) shape; there is no free-form "anything goes" field anywhere in the schema.
7. **Migratable** — a version bump plus a documented future migration script is the intended path; since no prior content exists yet (this is the schema's first version), there is nothing to migrate yet, but the mechanism (`schemaVersion` + `contentSchemaVersion`) is in place for when there is.

## Section B01-B12 content model

| Section | Content | Provenance |
|---|---|---|
| B01 Student Snapshot | Display name, grade/grade band, current educational context, stated goals, strengths/interests, important learning context, schedule/lifestyle factors | Discovery-derived (default), per-section tag |
| B02 Family Goals & Priorities | Reason for seeking Pathways, confirmed primary goal, major priorities (list), desired change, non-negotiables (list), longer-term aspirations | Parent-reported (default) |
| B03 Current Educational Situation | Current arrangement, what's working, what the family wants to change, academic concerns, support context, operational constraints, unresolved facts (list) | Parent-reported (default) |
| B04 Recommended Educational Strategy | Recommended pathway model(s) (real `contracts/taxonomy.json` `base_models` IDs), overlay(s) (real `overlays` IDs), support approach, alignment rationale, tradeoffs, risks/considerations, conditions requiring verification | Advisor recommendation |
| B05 Academic Planning | Planning domains (a fixed enum: foundational support, intervention, enrichment, pacing, acceleration exploration, etc.), narrative | Advisor recommendation |
| B06 Schedule & Lifestyle Plan | A fixed set of schedule/lifestyle factors (athletics, performing arts, travel, employment, etc.), each optionally included with notes; narrative | Parent-reported (default) |
| B07 Opportunities to Explore | Items referencing real `opportunities` taxonomy IDs, each with a horizon (explore now / next review / longer term / not currently applicable) and notes | Self-describing (a recommendation by construction) |
| B08 Support Plan | Items referencing real `supports` taxonomy IDs, each with a framing (recommended / possible / worth exploring) and notes | Self-describing |
| B09 Verification Items | Open questions the family/advisor still needs to resolve (category, question, status, owner, evidence note); **never auto-becomes VERIFIED** -- see below | Its own status axis serves as its certainty signal |
| B10 Action Plan | Concrete next steps (text, owner, timing, status, notes) | Implementation-oriented, per instruction requirement |
| B11 30/60/90-Day Roadmap | Three fixed buckets (days 0-30, 31-60, 61-90), each a list of milestone items with status | Implementation-oriented |
| B12 Advisor Professional Summary | A single narrative field, the advisor's own professional synthesis | Advisor recommendation (fixed) |

B04/B07/B08 reference the EXISTING, unmodified `contracts/taxonomy.json` registries (`base_models`, `overlays`, `supports`, `opportunities`) via the same read-only `loadTaxonomy()` the Phase 4 engine and Phase 6D's planning-call pathway checklist already use -- never a new, free-form, hardcoded category list. An unknown taxonomy id is rejected by `blueprintContentSchema`'s `superRefine` validators, surfaced to the caller as `INVALID_CONTENT`.

**B09's never-auto-VERIFIED guarantee**, enforced in three independent layers:

1. **Schema**: a verification item's `superRefine` requires `verifiedAt` whenever `status === "VERIFIED"` -- a bare status flip with no timestamp is rejected outright.
2. **Service**: `src/server/blueprint.ts`'s save path (via the advisor-workspace action layer) stamps `verifiedAt`/`verifiedBy` itself, from the authenticated advisor's own identity, only at the moment a row's status genuinely transitions INTO `VERIFIED` for the first time -- an unchanged already-VERIFIED row's original stamp is preserved, never bumped by an unrelated save (`buildVerificationItems` in `app/advisor/cases/[caseId]/blueprint/actions.ts`).
3. **UI**: there is no form field for `verifiedBy` at all -- it can never be client-supplied, only server-stamped.

## Eligibility & creation (section 1)

A Blueprint may only be created from an eligible Planning Call: `completePlanningCallRecord.status === "COMPLETED"`, `attendance === "ATTENDED"`, `outcome === "CONTINUE_TO_BLUEPRINT"` -- exactly the existing, UNCHANGED `isBlueprintReady()` from Phase 6D's `src/server/planning-call.ts`, re-checked fresh on every call, never cached. `createOrOpenBlueprint` (`src/server/blueprint.ts`) is idempotent: the first eligible call creates the parent + revision 1 (`DRAFT`); every subsequent call reselects the same parent and its current revision. A genuine concurrent first-call race is resolved by the SAVEPOINT + `23505`-catch + re-select pattern already proven throughout this codebase, backed by `student_success_blueprint_case_unique_idx` as the unconditional database-level backstop.

## Status lifecycle

```
DRAFT ──► INTERNAL_REVIEW ──► READY_FOR_CLIENT
                                     │
                                     └─ (new revision created) ──► prior revision becomes SUPERSEDED
                                                                   (only once the NEW revision itself
                                                                    reaches READY_FOR_CLIENT)
```

- **DRAFT → INTERNAL_REVIEW**: `moveBlueprintToInternalReview`, no completeness requirement -- an advisor may self-review an in-progress document.
- **INTERNAL_REVIEW → READY_FOR_CLIENT**: `markBlueprintReadyForClient`, gated by `completenessIssues()` -- checks only the five sections the instruction names as essential (B01 stated goals or current context, B02 confirmed primary goal, B04 at least one recommended model + an alignment rationale, B10 at least one action item, B12 a summary), each for MEANINGFUL (non-whitespace) content, never merely "the key exists." An incomplete attempt is rejected with the specific unmet issues returned to the caller, never a generic failure.
- **READY_FOR_CLIENT is immutable**: no function in `src/server/blueprint.ts` ever updates a `READY_FOR_CLIENT` (or later) revision's `content`; `saveBlueprintDraft` explicitly rejects it as `NOT_EDITABLE`.
- **New revision creation**: `createNewBlueprintRevision`, legal only when the current revision is `READY_FOR_CLIENT`, requires an explicit, controlled `revisionReason` (`FAMILY_UPDATE` / `NEW_VERIFICATION` / `EDUCATIONAL_PLAN_CHANGE` / `CORRECTION` / `OTHER`, with free text only for `OTHER`). The new revision starts from the prior revision's own content (an amendment, not a blank slate), `status = DRAFT`, `isCurrent = true` **immediately** -- but the prior revision's `status` stays `READY_FOR_CLIENT` until the NEW revision itself later reaches `READY_FOR_CLIENT`, at which point (in the same transaction) the prior revision is set to `SUPERSEDED`. This two-step timing is deliberate: a family should never see "superseded" language about their current, still-valid Blueprint merely because an advisor opened a new draft to work on.
- **ARCHIVED** stays reserved in the schema enum for a hypothetical future retraction workflow this phase does not implement -- the same documented-reserved convention `PathwaysCaseStatus.NEW` already established in Phase 6B.

## Optimistic concurrency (section 19)

Identical pattern to Phase 6D's `planningCallRecord.version`: an integer `version` column, every save supplies the `expectedVersion` it loaded, and a mismatch is rejected as `VERSION_CONFLICT` rather than silently overwritten. Verified against real PostgreSQL with two simulated concurrent tabs (`tests/blueprint.test.ts` scenario 23, and the live two-tab Playwright scenario in `tests/e2e-internal/blueprint-workspace.spec.ts`).

## Advisor authoring workspace

`/advisor/cases/[caseId]/blueprint` (`app/advisor/cases/[caseId]/blueprint/page.tsx`): a plain `<form>`-only workspace (no client JavaScript), mirroring Phase 6D's `PlanningCallForm` conventions exactly. Three submit buttons on the same form target three different server actions via the native HTML `formAction` attribute: "Save Draft" (default), "Move to Internal Review," and "Mark Ready for Client" (the latter two also persist the form's current content first, so nothing typed is lost by a status-transition click). An entry point ("Open Student Success Blueprint") appears on the existing `/advisor/cases/[caseId]` page only once `isBlueprintReady()` is true for that case's Planning Call record.

Fixed-row editors (no dynamic add/remove, consistent with the plain-HTML-form constraint): B09 (12 rows), B10 (12 rows), B11 (8 rows per bucket) -- all well within each section's schema-level maximum (40/40/20). B06/B07/B08 instead enumerate the fixed, small set of known taxonomy/factor options directly (one row per known factor/opportunity/support), since those are closed sets, not open-ended lists.

A document-style, read-only internal preview (`src/components/staff/BlueprintPreview.tsx`) renders once a revision is no longer editable (`READY_FOR_CLIENT`/`SUPERSEDED`/`ARCHIVED`), and carries the required internal professional-scope statement: *"This Student Success Blueprint reflects Pathways' professional educational planning guidance based on information available at the time it was authored. It is not a guarantee of enrollment, acceptance, academic outcome, or any third-party approval, and nothing in it constitutes legal, medical, or financial advice."*

## Admin read-only access

`/admin/cases/[caseId]/blueprint` (`app/admin/cases/[caseId]/blueprint/page.tsx`) reuses `BlueprintPreview` in the same read-only mode, plus the revision history list. No write path exists anywhere on this route, the same convention Phase 6D established for `PlanningCallSummary`. A compact status/revision-number summary and a link into the full view were added to the existing admin case-detail page.

## Authorization

Every write function in `src/server/blueprint.ts` reuses the exact, UNCHANGED `assertAdvisorCanAccessPathwaysCase` (Phase 6B/6C/6D) -- an active `ADVISOR` staff role AND an active assignment to this exact case, re-checked fresh on every call, never cached. A reassigned-away advisor loses Blueprint access on their very next request, exactly like the Planning Call workspace. No ADMIN write path exists; read functions (`getCurrentBlueprintRevision`, `listBlueprintRevisions`) perform no authorization of their own, the same "callers already resolved access" convention `getPrimaryPlanningCallRecord` established.

## Bug found and fixed during implementation

An early draft of the advisor Blueprint page's error display nested a `<ul>` (the completeness-issue list) inside a `<p role="alert">` -- invalid HTML that Next.js/React surfaces as a hydration-mismatch console error. Caught by the Playwright test itself (the dev server's own browser-console warning appeared in the test run's webServer log) before this phase was marked complete; fixed by changing the alert container from `<p>` to `<div role="alert">`, with the plain error text in its own nested `<p>` and the issues list as a sibling `<ul>`. Re-run confirmed the warning is gone and the test still passes.

## Tests

`tests/blueprint.test.ts` (37 tests, real PostgreSQL): eligibility in all its negative configurations (no Planning Call, draft-only, wrong outcome), idempotent/cardinality-enforced creation, authorization denial in every configuration (no staff role, wrong-case advisor, unassigned ADMIN, a former advisor across every write function), source-manifest exactness, content validation (invalid provenance, unknown taxonomy id, unknown top-level key, a VERIFIED item missing `verifiedAt`), optimistic-concurrency conflict and resolution, the full status-transition matrix (including the completeness gate and immutability), new-revision creation and its deferred supersession timing, and audit-event/non-mutation proofs.

`tests/e2e-internal/blueprint-workspace.spec.ts` (1 Playwright test, real browser, real PostgreSQL): the full real Discovery→Report→Contact→Schedule→Confirm→Planning-Call-completion→Blueprint-creation journey, draft save surviving a reload, two independent security-denial configurations (a never-assigned advisor, and a reassigned-away former advisor), admin read-only access showing the advisor's own saved content, a completeness-validation rejection with its specific issues shown, the internal-review→ready-for-client lock, new-revision creation carrying forward prior content, and a genuine two-tab optimistic-concurrency conflict.

## Full verification

- `pnpm run typecheck`: clean.
- `pnpm run lint`: clean.
- `pnpm vitest run`: 962/962 passed (925 pre-existing + 37 new).
- `pnpm exec playwright test --config=playwright.internal.config.ts`: 12/12 passed (11 pre-existing + 1 new).
- `pnpm exec playwright test` (default suite): 210/212 passed on the full-suite run; both failures (`consultation.spec.ts` "contact is persisted before scheduling is reached...", `discovery-profile.spec.ts` "branch activation... requires the confirmed answer") are in files this phase never touched, and both pass individually/in isolation (confirmed by a dedicated re-run with `--workers=1`) -- the same class of pre-existing, environment-dependent parallel-worker flake documented in prior phases' own completion reports (e.g. DEC-Y6, DEC-Z9), never attributed to this phase and never worked around by weakening an assertion.
- Production build and migration application to both `pathways_dev` and `pathways_test`: see the completion report.

## Frozen-file verification

Verified by `git diff --stat` against the Phase 6D starting commit (`3a1c8b6f4f6fbaa460148c7e2ea6d85c3f0b7227`) -- every path below is untouched except this phase's own new files and the three narrowly-scoped additions (the advisor case-detail entry-point link, the admin case-detail summary/link, `src/db/schema/index.ts`'s one new export line):

- Discovery questionnaire logic, question IDs, calibration, taxonomy, rules, scoring, engine, report content/design: `contracts/**`, `src/lib/discovery/**`, `src/lib/engine/**`, `src/components/report/**`.
- `ReportSnapshot` historical behavior, the guest consultation funnel, native scheduling policy, the connected DB-free demo: `app/discover/**`, `src/lib/consultation/**`, `src/server/booking.ts`, `src/server/consultation.ts`, `src/components/consultation/**`, `src/components/discovery/**`.
- Phase 6B/6C case-creation, assignment, and queue semantics (`src/server/pathways-case.ts`, `src/server/advisor-assignment.ts`, `src/server/staff-queue.ts`) -- byte-unchanged.
- Phase 6D's `src/server/planning-call.ts`, `PlanningCallForm.tsx`, `PlanningCallSummary.tsx` -- byte-unchanged (read via import only).

## Phase 6E.1 -- Blueprint visual acceptance & polish

Phase 6E was accepted with one outstanding item: the required responsive visual inspection of the authoring/preview UI had never actually been performed. Phase 6E.1 closed that gap. No domain behavior, schema, authorization, or status logic was touched.

**States inspected (actual rendered screenshots, not programmatic assertion):** A (draft, initial), B (draft, populated), D (incomplete-validation), E (internal-review preview, via the admin read-only route while the advisor's revision was INTERNAL_REVIEW), F (ready-for-client, locked advisor view), G (revision 2, new draft), H (optimistic-concurrency conflict, two tabs), I (admin read-only view of a ready revision).

**Breakpoints:** 375/768/1440 for A, B, E, F, G, I; 375/1440 for D and H, per the original acceptance requirement.

**Defects found and fixed (2):**
1. B09's "Question" field and B10's "Action" field were visually crowded out by shorter sibling fields in the same flex-wrapped row at 1440px, and truncated/scrolled as single-line `<input>` elements at 375px regardless of box width. Fixed with a new `.itemPrimaryInput { flex-basis: 100%; }` modifier (`src/components/staff/staff-page.module.css`) forcing the primary field onto its own full-width line, reordered first in the DOM (`src/components/staff/BlueprintForm.tsx`), and converted both fields from `<input type="text">` to `<textarea rows={3}>` (same `name` attributes; no server-action changes).
2. The advisor's editable Blueprint workspace showed no status/revision indicator at all in the common single-revision case (the Revision History block only renders when there is more than one revision). Fixed by adding an always-visible "Revision {N} -- {STATUS}" line to `app/advisor/cases/[caseId]/blueprint/page.tsx`, reusing the existing `statusLabel` helper and `.badge`/`.provenanceNote` styles.

**Consequential test update:** the new status line gave `tests/e2e-internal/blueprint-workspace.spec.ts` a second element matching the text "Revision 1", turning its existing bare-substring assertion into a Playwright strict-mode violation. Fixed by narrowing the locator to the preview's own heading (`getByRole("heading", { name: /Revision 1/ })`) rather than weakening or removing the assertion; the underlying fact verified is unchanged.

**Not changed:** B09's server-side "never silently become VERIFIED" rule, the concurrency-conflict message (no raw database/version terminology), eligibility, revision/status model, authorization, audit behavior, or any other Phase 6E domain logic. The marketing header/footer appearing on staff routes was observed (pre-existing since Phase 6C, a `app/layout.tsx` consequence) but left alone as out of scope for a presentational-only pass.

**Verification:** `pnpm run typecheck` clean; `pnpm run lint` clean; `pnpm vitest run` 962/962; `pnpm exec playwright test --config=playwright.internal.config.ts` 13/13 (12 pre-existing + 1 updated); `pnpm exec playwright test` (default suite) 212/212; `pnpm run build` reproduces the same pre-existing sandbox-only `_global-error`/`useContext` anomaly (digest `3328746128`) documented since Phase 3 (DEC-G4) and reconfirmed in every subsequent phase -- not reproduced on CI, not attributable to this phase's changes.

**Result:** accepted. Phase 6E's visual-acceptance gap is closed.
