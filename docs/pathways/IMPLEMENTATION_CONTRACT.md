# Pathways Discovery App — Implementation Contract

Version: 0.1.0-phase0-candidate
Status: Proposed canonical build contract, produced by Phase 0 reconciliation. Awaiting owner acceptance before Phase 1 coding begins.
Repository: sionethompson06/Explore-Pathways
Branch: claude/kind-gauss-f2d7ng

Source-of-truth order (per master prompt): owner's latest explicit decisions -> engineering resolutions explicitly accepted for this build -> normalized specifications in the handoff pack -> contracts/fixtures -> historical narrative -> implementation convenience. This document is the single place those layers are reconciled into one contract. Where the pack disagrees with itself, the discrepancy is recorded below rather than silently resolved.

This document does not itself authorize Phase 1. Per the master prompt, only a separately authorized phase may be implemented.

---

## 1. Repository findings (as inspected)

- Remote: `https://github.com/sionethompson06/Explore-Pathways` (origin, fetch+push) — matches the owner-confirmed target.
- Current branch: `claude/kind-gauss-f2d7ng` (already the designated feature branch; also exists on `origin`). `main` also exists on `origin`.
- Working tree: clean at inspection time.
- History: one commit (`9abc7c4`, "Initial commit").
- Contents: a single `README.md` containing only the title `# Explore-Pathways`. No package manifest, no source tree, no CI configuration, no test runner, no existing framework, no unrelated application identity (this is not the TEACH Ticket System repository and contains no TEACH Ticket System code).
- Conclusion: this is a **greenfield repository**. Phase 1 is not migrating or extending an existing stack; it is establishing one. No preservation-of-existing-functionality constraint applies beyond this `README.md`.

## 2. Product summary (normalized from Specification 01 and the master prompt)

Pathways is an Education Pathways Ecosystem, not an online school at launch (Model 2 of a longer-term, board-undecided roadmap; Model 3 — an independent mastery school — is a 3-5 year contingent destination, not part of this build). The MVP is K-12 capable with a grades 5-12 marketing emphasis. It helps a parent explore alternatives, produces an honest preliminary Discovery Report, and offers an appropriate next conversation with a human advisor.

MVP journey: marketing homepage -> age/grade-appropriate parent profile -> deterministic exploratory directions -> honest personalized Discovery Report -> optional verified save -> available consultation workflow -> small advisor workspace.

Explicitly **not** part of this build: a school, LMS, grades, transcripts, an NCAA eligibility engine, a provider marketplace, payments, Blueprint authoring, tutoring delivery, or a student-facing AI companion. The future Pathways Mastery School (taxonomy ID `B10`) is not available, not recommended, and is structurally excluded from candidate selection regardless of score or unmet need.

## 3. Reconciliation register

Each item below carries a disposition. **ACCEPTED** items are already reflected in the normalized specifications and contracts and require no further owner action to begin coding against them. **PROPOSED** items are corrections the handoff pack itself flags as requiring explicit owner acceptance before they control implementation (Specification 06 says Phase 0 "must surface these changes for owner acceptance rather than silently applying a rewrite"). **NEW FINDING** items are gaps this Phase 0 audit discovered that are not resolved anywhere in the pack. Full detail and per-item status lives in `DECISION_LOG.md`; this section is the summary.

### 3.1 Carried from the latest decisions (ACCEPTED)
1. K-12 supported; grades 5-12 marketing emphasis; grade bands are ELEMENTARY (K-4), MIDDLE (5-8), HIGH_SCHOOL (9-12), UNDETERMINED — branching categories, not assertions about local school organization.
2. No mandatory email/account wall for a useful guest Discovery Report. Saving is optional and requires verified email.
3. Public labels are `WORTH_EXPLORING`, `WORTH_EXPLORING_WITH_CONSIDERATIONS`, `MORE_INFORMATION_HELPFUL` only. No percentages, no "Strong Potential Fit," anywhere in this release.
4. No live Pathways school, no automatic school fallback, no named provider recommendation, no assured local eligibility, anywhere in Discovery V1.
5. AI (when enabled at all, per Phase 8) has exactly two narrow writing slots (R01 summary, R02 insight). It never selects models, providers, or qualifications, and is not required for a functional report.
6. Actual provider, business, and legal details must be configured/approved before they are asserted anywhere. The supplied homepage mockups are visual/design reference only — not evidence of staffing, partnerships, accreditation, or outcomes, and no statistic, testimonial, or claim from the mockup pixels may be copied into the product.

### 3.2 Builder-review corrections proposed in Specification 06 (PROPOSED — presented here for explicit owner acceptance; not yet implemented)
7. Add explicit inputs for school-change preference (`DISC_031`), unavailable instructional times (`DISC_032`), delivery-model interest (`DISC_033`), subject-specific advancement interest (`DISC_034`), and real daytime adult-support availability (`DISC_E04`) — because prior drafts used these facts in scoring without ever collecting them.
8. Allow optional nickname/display name and optional ZIP; do not collect precise identifiers the product doesn't need.
9. Use only canonical IDs (`B01-B10`, `O01-O10`, `S01-S12`, `OP01-OP18`, `REV_*`); legacy `P-series`/inconsistent `S09`/generic `SUP_`/`OPP_` values are import-only aliases, never minted fresh.
10. Replace uncapped additive scoring with within-group deduplication (largest positive + largest negative per group, single largest priority multiplier, clamp ±6 per group, clamp 0-100 total) and a hard display gate: at least two independent scored groups required before a candidate can be shown; a public numeric score alone never qualifies a card.
11. Do not infer facts that were never asked: no strong travel-frequency inference from a bare "travel" interest; no "math advanced" from "generally ahead"; no "afternoons unavailable" from "mornings preferred"; no "limited supervision" from a low desired-parental-involvement answer.
12. Graduation concern does not automatically imply missing credits; college desire does not imply AP/dual-enrollment readiness; school-change credit review applies from grade 9 onward.
13. Do not rank all private-online implementations as inherently superior, and do not assume "hybrid" means both live-online and on-campus simultaneously; unverified capabilities remain review items, not assumptions.
14. The rule engine, its content library, and reported learning preferences remain three distinct things; a stated learning preference is not a diagnosed "learning style."
15. Report storage/versioning is subordinate to an approved deletion/retention policy, not indefinite retention by default.
16. The advisory/sales workflow (lead status, timeline, consultation state) is architecturally independent of the educational model and its rank — the recommendation engine must never read it.

**Owner action requested:** a single confirmation that items 7-16 are accepted as written is sufficient to close this section; the underlying contracts (`question-bank.json`, `rules.json`, `scoring-policy.json`) already implement them, so acceptance here is a sign-off on already-drafted content, not new drafting work.

### 3.3 New findings from this Phase 0 audit (NOT previously resolved anywhere in the pack)

These were found by cross-checking every one of the 52 rules in `contracts/rules.json` against `contracts/question-bank.json` (38 questions) and `contracts/taxonomy.json` (10 overlays, 12 supports, 18 opportunities, 20 review signals), field by field. None of these break the pack's internal consistency (nothing contradicts an explicit statement elsewhere), but each is a gap the pack does not currently resolve and that Phase 1's typed-contract conversion cannot silently paper over.

1. **`ncaa_interest` has no canonical question ID.** Specification 02 describes it as "nested DISC_020 follow-up," and rule `ATH_004` reads it directly (`ncaa_interest in [YES, MAYBE, UNKNOWN]`), and golden fixture `FX04_HS_ATHLETE` supplies it as a top-level profile field — but no entry in the 38-question registry (`DISC_001`-`DISC_034`, `DISC_E01`-`DISC_E04`) defines it, its wording, or its full allowed-value set (`DISC_020`'s own note says "YES/MAYBE/NO/UNKNOWN," which is four values, but the registry never states them as a formal question). **Decision needed before Phase 3/4 coding:** give this its own canonical question ID (e.g. `DISC_020A` or the next unused `DISC_0xx`) with formal wording, show-when condition (nested under `DISC_020` = `DEFINITELY`/`POSSIBLY`), and allowed values, or explicitly document it in the question-bank schema as a structurally implicit sub-field of `DISC_020` rather than a standalone registry entry. Either is workable; the pack must pick one so Phase 1's schema validator has something authoritative to check `ATH_004` against.
2. **One question answer value has no rule anywhere.** `DISC_022` (`advancement_interests`) offers `RESEARCH` as a selectable value, and taxonomy defines `OP06` ("Research and independent projects") to represent it — but no rule in `rules.json` connects the two. A parent who selects "Research" today receives no acknowledgment of that choice anywhere in scoring, overlays, or opportunities.
3. **Six of eighteen opportunities are currently unreachable** by any of the 52 rules: `OP06` (Research), `OP07` (Internship), `OP09` (Industry-credential), `OP12` (Entrepreneurship), `OP13` (STEM enrichment), `OP15` (Travel-related learning). All 10 base models and all 10 overlays are reachable; this gap is specific to the opportunity layer.
4. **Two of twelve possible supports are currently unreachable:** `S01` (Pathways advising) and `S08` (College planning). This may be intentional — `S01` in particular reads like something that should always be offered as the natural next step regardless of scoring (Specification 05's R07 CTA already does something similar) rather than something gated by a rule — but the pack does not say so explicitly, and `S08` (college planning) has no rule despite `DISC_023` (`college_intent`) existing as exactly the kind of input that should drive it.
5. **Two of twenty review signals have no documented trigger.** `REV_AGE_GRADE_CONTEXT` and `REV_SERVICE_AVAILABILITY` are declared in `taxonomy.json`'s `review_signals` list but are not emitted by any rule in `rules.json` nor named in `scoring-policy.json`'s `postprocess_rules`. Given Specification 04's own prose ("Other/unknown grade keeps universal questions and neutral review") and Specification 03's advising-coverage language, these two most plausibly correspond to (a) `grade_band = UNDETERMINED` and (b) advising not being live in the family's stated location — but that mapping is inferred by this audit, not stated in the pack, and must be confirmed rather than assumed by an implementer.
6. **Two rules are logically redundant.** `HOME_003` (`homeschool_interest = true` AND `desired_parent_involvement = PROGRAM_MANAGES`) and `PAR_002` (`desired_parent_involvement = PROGRAM_MANAGES` alone) produce an identical score effect (`B08: -3, B09: -2`) and an identical `review_model_scope` (`B08`, `B09`), under conditions where `PAR_002`'s is a strict superset of `HOME_003`'s. Since scoring aggregation already takes only the single most-negative effect per group (so this is **not** a double-counting bug), the redundancy shows up instead at the report layer: the two rules carry different `reason_template` wording for what is, to a parent, the same underlying observation, so Phase 4's reason-deduplication step needs to treat them as one reason, not two near-identical ones, when both fire together.
7. **Rule density is uneven across scoring groups.** `cost` and `context` each have exactly one contributing rule (`COST_001`; `ENV_001`); most other groups have three or more. Because the display gate requires at least two independent positive scored groups, a family whose only strong signal is affordability or environment-concern alone is structurally unlikely to ever clear the gate on that signal by itself. This is not a defect, but it is a product-quality/coverage observation Phase 4/authoring should be aware of, since it affects how often `MORE_INFORMATION_HELPFUL` (zero-card) outcomes occur for genuinely real families.

**Disposition:** these are not blockers to writing Phase 0 documentation, and per the master prompt they are not blockers to *starting* Phase 1 foundation work either (foundation work does not require the rule content to be complete). They **are** blockers to a *complete* Phase 4 (engine) implementation, since Phase 4's acceptance criteria require "every rule target, signal, content reference and field" to validate and "every displayed reason traceable." Recommendation: resolve findings 1-6 as small content/schema additions before Phase 4 begins; finding 7 is advisory only and does not require a code or content change to proceed.

## 4. Nonnegotiable behaviors (restated as contract clauses; verbatim intent from the master prompt)

1. Determinism: identical effective answers + identical content/rule versions -> identical recommendations. Name, contact details, lead source, timeline, referral economics, and willingness-to-buy must have zero causal path into the recommendation engine.
2. Canonical registries only: a pathway = one base model + applicable overlays + possible supports + relevant opportunities + review items. A service is never conflated with a school.
3. Display gate: at least two independent supported dimensions per displayed candidate; baseline score alone is never sufficient; zero or one displayed card is a valid, expected outcome; "unknown" is never treated as "no."
4. K-4 gets a separate developmental lens: no credit/NCAA/college pressure; no inferred readiness, supervision, or local eligibility from stated interests.
5. No mandatory email/account wall for the guest report; saving is optional and verified; delivery request and marketing consent are recorded separately; no mandatory phone number for email saving.
6. Report tone: recognition, one meaningful insight, credible directions, relevant opportunities, important questions, a preliminary sketch, an available CTA — never fear, guilt, fake scarcity, fabricated testimonials, hours-saved claims, guaranteed placement, or asserted school authority.
7. Template-complete first: the full report must work with zero AI keys configured; AI (when later enabled) may only personalize R01's summary and R02's insight, never choose pathways, investigate providers, or produce a consequential academic conclusion.
8. Authorization at the persistence layer from day one: every read/write/action/export is record-level authorized; Parent A can never reach Parent B's record even with its exact ID; advisors see only their authorized, assigned cases; internal scores/notes never appear in a public API response.
9. No real email send, no real booking, no real AI call, no real child-data collection, and no production deployment until the relevant operational/privacy gates pass. Unconfigured features return an honest unavailable/request state — never a faked success.
10. Every phase ships with tests, traceability, and actual completion evidence; a successful compile/build is not, by itself, feature acceptance.

## 5. Canonical registries (by reference, not duplicated here)

The authoritative content lives in the contracts, not in this document, so that there is exactly one place to update each:
- `contracts/question-bank.json` — 38 question definitions (`DISC_001`-`DISC_034`, `DISC_E01`-`DISC_E04`), each with field name, parent-facing wording, input type, show-when branch condition, required-when-shown flag, matching-use note, and allowed values where applicable. Full enumeration and branch-condition trace is in `REQUIREMENT_TRACEABILITY.md`.
- `contracts/taxonomy.json` — 10 base models (`B01`-`B10`, `B10` permanently `discovery_enabled: false`), 10 overlays (`O01`-`O10`), 12 possible supports (`S01`-`S12`), 18 opportunities (`OP01`-`OP18`), 20 review signals, plus explicit constraints (no provider IDs, no invented real schools, `B10` excluded regardless of score or unmet need).
- `contracts/rules.json` — 52 declarative rules, each with a stable ID, group, `when` condition, `score_effects`, `activate` block (overlays/supports/opportunities/reviews), `reason_template`, `reason_type`, and `status: PILOT_UNVALIDATED` (these are transparent pilot heuristics, not empirically validated placement criteria, and must be labeled as such everywhere they surface).
- `contracts/scoring-policy.json` — baseline 50 (internal sort only), multipliers (1.75 primary-goal / 1.5 top-priority / 1.15 secondary-goal / 1.0 default, never multiplied together), group aggregation rule, the two-group display gate, public label set, diversity/sorting rule, and postprocess rules (auto-added reviews for homeschool/remote/cost cases, K-4 opportunity remapping, MS-vs-HS opportunity horizon).
- `contracts/report-contract.json` — the public DTO shape (what a browser may ever receive) versus the internal engine-run record (what stays server-side), the `forbidden_in_public` field list, and the LLM output schema/validation note for the two AI-eligible slots.
- `contracts/legacy-aliases.json` — import-only mapping from historical/ambiguous IDs to canonical ones; retired ambiguous IDs are named explicitly and must never be re-minted.
- `contracts/content-library.json` — approved base-model card copy, CTA templates by scheduler mode, fallback/limited-information copy, and the explicit `forbidden_claims` list.
- `fixtures/golden-profiles.json` — 14 synthetic fixture cases (`FX01`-`FX14`) plus 9 metamorphic invariants; these are the acceptance bar for Phase 4, not proof of educational validity.

## 6. MVP scope boundary

**In scope for this build (Phases 1-9):** public marketing site; conditional Discovery questionnaire; the deterministic recommendation/scoring engine; the template-first Discovery Report; optional verified saving; consultation request/booking workflow (in `UNCONFIGURED`/`REQUEST_ONLY`/`LIVE_VERIFIED` modes as actually configured); a small advisor case workspace; first-party, privacy-preserving funnel analytics; an optional, tightly-scoped AI prose adapter for exactly two report fields (Phase 8, gated on explicit provider/data/budget approval).

**Explicitly out of scope for this build:** a school or LMS, grades, transcripts, an NCAA eligibility engine, a public provider directory or provider portal, payments, paid Blueprint authoring, tutoring delivery, a student-facing AI companion, and any activation path for `B10` (the future Mastery School).

## 7. Screen/route map (Specification 07, unchanged)

`/`, `/how-it-works`, `/pathways/[slug]` (athletes, homeschool, flexible-learning, academic-opportunities), `/for-partners`, `/discover`, `/discover/profile`, `/discover/report`, `/reports/[id]`, `/consultation`, `/consultation/confirmation`, `/sign-in`, `/family`, `/advisor`, `/advisor/cases/[id]`, `/admin`, `/privacy`, `/terms`. No public report URLs; no role-specific data in page source; no dynamic social-preview content containing child information; only approved public marketing pages are indexed.

## 8. Data objects (Specification 07, unchanged)

`GuardianUser`, `StudentPathwayRecord`, `GuardianStudentAccess` (explicit per-child links, never a broad shared-family shortcut), `DiscoverySession` (guest session owner + expiry), `ProfileRevision` (raw + effective answers, question version), `EngineRun` (internal findings + versions, server-only), `ReportSnapshot` (public content + hash), `ConsentEvent` (purpose/action/version/timestamp), `ConsultationRequest` (distinct from `Booking`), `Booking` (provider reference, actual time zone/state), `AdvisorAssignment`, `AdvisorNote`, `WorkflowEvent`, `AuditEvent`, `AggregateEvent`. Report content status (`PERSONALIZED`/`LIMITED_INFORMATION`/`ADVISOR_FIRST`), generation state (`TEMPLATE`/`AI_ASSISTED`/`FALLBACK`/`FAILED`), record persistence (`GUEST`/`VERIFIED_SAVED`), and consultation state (`NONE`/`REQUESTED`/`PENDING_VERIFICATION`/`BOOKED`/`CANCELLED`/`COMPLETED`/`NO_SHOW`) are tracked as separate enums, never collapsed into one.

This build implements only: guest session, profile revisions, engine runs, reports, guardian access, consent, consultation workflow, and staff notes. The full future `StudentPathwayRecord` (courses, mastery, interventions, opportunities, historical pathway changes) is a modeling target for the schema to anticipate, not something to build now.

## 9. Proposed minimal stack for Phase 1

Given the repository is greenfield (Section 1), the master prompt's default stack applies without any existing-framework conflict:

- **Framework:** Next.js, App Router, TypeScript.
- **Database:** PostgreSQL, accessed through a typed migration layer (e.g. Drizzle or Prisma migrate — final selection is a Phase 1 decision, not fixed here) with schema-validated inputs/outputs (e.g. Zod) at every server boundary.
- **Auth:** a supported, established provider (e.g. Auth.js/NextAuth or a managed provider) implementing verified single-use email sign-in; not bespoke. Provider selection is unconfirmed (Section 10 / `INTEGRATION_REGISTER.md`).
- **UI:** accessible component primitives + design tokens (WCAG 2.2 AA target), utility CSS.
- **Tests:** unit + integration tests for the engine/report/access-control modules; browser E2E for the funnel.
- **Hosting:** Vercel is the pack's proposed default; not yet connected or verified for this repository — unconfirmed.
- **Package manager / exact pinned versions:** not fixed by this document. Per the master prompt, current supported versions must be selected by checking official documentation and the actual repository at Phase 1 kickoff, not invented from memory here.
- **Architecture:** one modular application. No microservices, no vector database, no drag-and-drop rule editor. The recommendation engine and report assembler are framework-independent server modules; no UI component may contain a second scoring implementation.

Full integration-by-integration status (auth/database/email/scheduling/AI/deployment, each marked CONFIRMED or UNCONFIRMED, no secrets) is in `INTEGRATION_REGISTER.md`.

## 10. Decisions needed before coding vs. only before live launch

See `DECISION_LOG.md` for the complete, itemized list with dispositions. In summary:

**Needed before/at the start of coding (Phase 1):**
- Acceptance of Section 3.2 (items 7-16) as controlling.
- Resolution of Section 3.3 finding #1 (`ncaa_interest` canonical ID) before Phase 3, and findings #2-#5 before Phase 4.
- Confirmation this repository and branch are correct (done — Section 1).
- Auth provider, database/ORM pairing, and package manager selection (or explicit delegation to the Phase 1 implementer to choose and record).

**Needed only before a later feature or live launch (not blockers to Phase 1-9 development against synthetic/fixture data):**
- Legal operating entity, final brand, published privacy notice and terms, contact address.
- Which services/grades/markets are actually staffed; whether consultation is free, its duration, scheduling windows.
- Email/scheduler provider selection and approved data-processing terms.
- Guest/saved-record retention periods and deletion procedures.
- AI provider, data-handling terms, budget ceiling, and whether AI is included in the initial launch at all.
- Media usage rights, verified advisor credentials, any claimed affiliations.

No default legal, operational, or vendor choice is implied by this contract. Every feature gated on one of the above returns an honest "not yet available" state until the owner supplies it.
