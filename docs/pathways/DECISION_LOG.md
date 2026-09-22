# Pathways Discovery App — Decision Log

Version: 0.1.0-phase0-candidate
Companion to `IMPLEMENTATION_CONTRACT.md`. Each row is one decision point. **Status** is one of `ACCEPTED` (already reflected in the pack's normalized specs/contracts, no further owner input required to build against it), `PROPOSED` (the pack itself flags this as needing explicit owner sign-off before it controls implementation), or `UNRESOLVED` (an open question this Phase 0 audit surfaced that the pack does not answer). **Blocks** indicates what this decision gates — nothing, Phase 1, Phase 3, Phase 4, or live launch.

## A. Decisions carried from the latest owner direction (ACCEPTED)

| ID | Decision | Source | Blocks |
|---|---|---|---|
| DEC-A1 | K-12 supported; grades 5-12 marketing emphasis; ELEMENTARY/MIDDLE/HIGH_SCHOOL/UNDETERMINED grade bands | Spec 01, Spec 06 §1 | Nothing |
| DEC-A2 | No mandatory email/account wall for the guest Discovery Report | Spec 05, Spec 06 §2 | Nothing |
| DEC-A3 | Public fit labels limited to WORTH_EXPLORING / WORTH_EXPLORING_WITH_CONSIDERATIONS / MORE_INFORMATION_HELPFUL; no percentages, no "Strong Potential Fit" | Spec 04, Spec 06 §3 | Nothing |
| DEC-A4 | No live Pathways school, no automatic B10 fallback, no named provider, no assured local eligibility in Discovery V1 | Spec 01, 03, 04; Spec 06 §4 | Nothing |
| DEC-A5 | AI limited to two writing slots (R01 summary, R02 insight); never chooses pathways; report fully functional with zero AI keys | Spec 05, 08 (prompt); Spec 06 §5 | Nothing |
| DEC-A6 | Provider/business/legal facts require explicit configuration/approval before assertion; mockups are visual reference only, never a source of copyable claims | Spec 06 §6; prompts/03 | Nothing |

## B. Builder-review corrections proposed in Specification 06 (PROPOSED — owner acceptance requested)

| ID | Decision | Already implemented in contracts? | Blocks |
|---|---|---|---|
| DEC-B1 | Add DISC_031 (school-change preference), DISC_032 (unavailable times), DISC_033 (delivery interest), DISC_034 (subject advancement interest), DISC_E04 (real adult availability) | Yes — all five present in `question-bank.json` | Phase 3 |
| DEC-B2 | Optional nickname/display name (DISC_001) and optional ZIP (part of DISC_004) | Yes | Phase 3 |
| DEC-B3 | Canonical IDs only; legacy P-series/SUP_/OPP_/ambiguous S09 are import-only aliases | Yes — `legacy-aliases.json` | Phase 1 (schema), Phase 4 |
| DEC-B4 | Capped, grouped scoring; two-group display gate; no score-only public threshold | Yes — `scoring-policy.json` | Phase 4 |
| DEC-B5 | No unasked inferences (travel frequency, math-ahead, afternoon-unavailable, supervision level) | Yes — Spec 02 "Normalization used by rules" section is explicit about what does *not* get inferred | Phase 3, Phase 4 |
| DEC-B6 | Graduation concern ≠ missing credits; college desire ≠ AP/dual-enrollment readiness; credit review from grade 9 | Yes — reflected in `rules.json` (`HS_001`-`HS_004`) and fixtures `FX05`/`FX10` | Phase 4 |
| DEC-B7 | No blanket "private-online is superior" or "hybrid = both live-online and on-campus" assumption | Yes — Spec 03/04 prose; no rule encodes such a ranking | Phase 4 |
| DEC-B8 | Rule engine / content library / reported learning preferences kept distinct; no "learning styles" diagnostic language | Yes — Spec 06 §14; content library uses hedged template language | Phase 5 |
| DEC-B9 | Report storage/versioning subordinate to an approved retention/deletion policy | Partially — architecture anticipates this (`ReportSnapshot`, retention-governed `ProfileRevision`); actual retention *period* is a launch decision (see Section D) | Phase 1 (schema), launch (values) |
| DEC-B10 | Advisory/sales workflow architecturally independent of educational rank | Yes — Spec 04 "Independent lead workflow"; engine input contract excludes lead fields entirely | Phase 1, Phase 4, Phase 7 |

**Requested owner action:** one confirmation that DEC-B1 through DEC-B10 are accepted as currently drafted in the contracts closes this entire section. No re-drafting is proposed here; these are already-written content being surfaced for sign-off, per Specification 06's own instruction that Phase 0 must not apply them silently.

## C. New findings from this Phase 0 audit (UNRESOLVED)

These came from manually cross-checking all 52 rules against all 38 questions and the full taxonomy (10 base models, 10 overlays, 12 supports, 18 opportunities, 20 review signals). Full explanation is in `IMPLEMENTATION_CONTRACT.md` §3.3; this table is the tracking record.

| ID | Finding | Recommended resolution | Blocks |
|---|---|---|---|
| DEC-C1 | `ncaa_interest` (read by rule `ATH_004`, supplied in fixture `FX04`) has no canonical question ID in the 38-entry registry; it exists only as prose ("DISC_020 follow-up") in Spec 02 | Owner/engineering choice: (a) mint a formal ID (e.g. `DISC_020A`) with full wording/branch/allowed-values, or (b) document it explicitly as a structural sub-field of `DISC_020` in the question-bank schema. Either works; the pack must pick one. | Phase 3 (questionnaire), Phase 4 (engine validation) |
| DEC-C2 | `DISC_022` offers `RESEARCH` as a selectable advancement interest; no rule maps it to `OP06` ("Research and independent projects") or anywhere else. A parent who picks it gets no acknowledgment. | Add a rule (pattern-consistent with `ADV_001`-`ADV_004`) mapping `advancement_interests contains RESEARCH` → activate `OP06`, review `REV_ADVANCEMENT_READINESS`. | Phase 4 |
| DEC-C3 | Six opportunities are unreachable by any of the 52 rules: `OP06` (Research), `OP07` (Internship), `OP09` (Industry-credential), `OP12` (Entrepreneurship), `OP13` (STEM enrichment), `OP15` (Travel-related learning) | Either add activating rules for each (some have no corresponding question input yet either — e.g. no question currently captures "entrepreneurship" or "internship" interest, so this may require new question(s) too), or explicitly mark these as reserved/not-yet-active in `taxonomy.json` so Phase 4's validator doesn't expect them to be reachable. | Phase 4 |
| DEC-C4 | Two supports are unreachable: `S01` (Pathways advising), `S08` (College planning) | Confirm whether `S01` is intentionally an always-offered baseline service outside the rule-gated mechanism (plausible, since advising is the product's universal next step) rather than a gap. `S08` has no rule despite `DISC_023` (`college_intent`) being an obvious candidate trigger — recommend adding one. | Phase 4 |
| DEC-C5 | Two review signals have no documented trigger anywhere: `REV_AGE_GRADE_CONTEXT`, `REV_SERVICE_AVAILABILITY` | Most likely mappings (inferred by this audit, not stated in the pack): `REV_AGE_GRADE_CONTEXT` → emit when `grade_band = UNDETERMINED`; `REV_SERVICE_AVAILABILITY` → emit when advising/consultation is not live for the family's stated location. Needs explicit confirmation, not assumption, before Phase 4 encodes it. | Phase 4 |
| DEC-C6 | Rules `HOME_003` and `PAR_002` are logically redundant (`PAR_002`'s condition is a strict superset of `HOME_003`'s; both produce identical score effects on B08/B09). Not a scoring bug — group aggregation already takes only one most-negative value — but a report-layer duplication risk (two differently-worded reasons for one underlying fact). | Deduplicate at the reason-message layer in Phase 4/5, or retire `HOME_003` in favor of `PAR_002` alone. Either is a content change, not an architecture change. | Phase 4, Phase 5 |
| DEC-C7 (advisory only, not a blocker) | Rule density is uneven: `cost` and `context` groups each have exactly one contributing rule, versus three or more in most other groups. Given the two-group display gate, a family whose only strong signal is affordability or environment-concern alone will rarely clear the gate on that basis alone. | No action required to proceed; flagged for Phase 4 rule-authoring awareness and for the "one/zero cards is valid" expectation to be explained accordingly in QA. | None (informational) |

## D. Decisions needed only before live launch (not blockers to Phases 1-9 against synthetic data)

| ID | Decision | Owner input needed |
|---|---|---|
| DEC-D1 | Legal operating entity, final brand, published privacy notice/terms, contact address | Owner/legal |
| DEC-D2 | Which services/grades/markets are actually staffed; consultation price (if any), duration, scheduling windows | Owner/operations |
| DEC-D3 | Auth/email/scheduler provider selection and approved data-processing terms | Owner + engineering |
| DEC-D4 | Guest/saved-record retention periods, deletion procedure, backup/log handling | Owner + engineering |
| DEC-D5 | AI provider selection, data-handling approval, cost ceiling, whether AI ships at initial launch at all | Owner |
| DEC-D6 | Media usage rights, verified advisor credentials, any claimed affiliations | Owner |

Until each of these is supplied, the corresponding feature returns an honest unavailable/request state. None is invented or defaulted anywhere in this contract.

## E. Decision needed now to unblock Phase 1 specifically

| ID | Decision | Notes |
|---|---|---|
| DEC-E1 | Confirm database/ORM pairing (e.g. Postgres + Drizzle vs. Postgres + Prisma) and auth provider (e.g. Auth.js vs. a managed provider) | Repository is greenfield (no existing selection to preserve). Recommendation in `IMPLEMENTATION_CONTRACT.md` §9 is to let the Phase 1 implementer choose a current, officially-supported pairing and record the exact pinned versions in `INTEGRATION_REGISTER.md`, rather than fixing version numbers in this document from memory. Owner may instead specify a preference now if one exists. |
