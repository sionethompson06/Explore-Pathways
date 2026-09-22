# Pathways Discovery App — Decision Log

Version: 0.2.0-phase0-corrected
Owner reviewed and authorized this log's 0.1.0-phase0-candidate revision. DEC-B1 through DEC-B10 are now **ACCEPTED** by explicit owner authorization. DEC-C1 through DEC-C7 are now **RESOLVED** per the owner's specific instructions, implemented in `contracts/` (see `contracts/CHANGELOG.md` for the exact diff) and traced in `docs/pathways/REQUIREMENT_TRACEABILITY.md`. Phase 1 application implementation is authorized and in progress.
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

## B. Builder-review corrections proposed in Specification 06 (ACCEPTED — owner authorization received)

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

**Owner action:** received. Accepted as written, subject to the clarifications in the owner's authorization message, none of which altered DEC-B1-B10's substance (the clarifications applied to DEC-C1-C7 instead). Closed.

## C. New findings from this Phase 0 audit (RESOLVED per owner instruction)

These came from manually cross-checking all 52 rules against all 38 questions and the full taxonomy (10 base models, 10 overlays, 12 supports, 18 opportunities, 20 review signals). Full explanation is in `IMPLEMENTATION_CONTRACT.md` §3.3; this table is the tracking record.

| ID | Finding | Owner-directed resolution | Implemented at | Status |
|---|---|---|---|---|
| DEC-C1 | `ncaa_interest` had no canonical question ID. | Formal question `DISC_020A` added exactly per owner's specified wording, values, labels, and show-when (grade MIDDLE/HS AND athletics branch active AND `college_athletics_interest` DEFINITELY/POSSIBLY; never K-4). Explicit-UNKNOWN-vs-hidden distinction formalized as a `global_rules` entry. | `contracts/question-bank.json` | RESOLVED |
| DEC-C2 | `RESEARCH` advancement interest had no rule. | New rule `ADV_007`: `advancement_interests contains RESEARCH` (MIDDLE/HS) → overlay `O02`, opportunity `OP06`, review `REV_ADVANCEMENT_READINESS`. Empty `score_effects` per instruction not to change base-model scores. Age-appropriateness already satisfied because K-4's DISC_022 value subset excludes RESEARCH entirely. | `contracts/rules.json`, `contracts/question-bank.json` | RESOLVED |
| DEC-C3 | Six opportunities unreachable. | `OP06` made reachable via `ADV_007`. `OP07`, `OP09`, `OP12`, `OP13`, `OP15` explicitly marked `RESERVED` in `taxonomy.json` (kept, described, forbidden from display, exempted from reachability-check failure) rather than given fabricated triggers, since no question currently captures their underlying interest. | `contracts/taxonomy.json` | RESOLVED |
| DEC-C4 | `S01`, `S08` unreachable. | `S01` marked `BASELINE` (potential service category, not rule-gated; actual availability comes from service configuration, never implies an assigned/purchased advisor). New signal-only rule `ADV_008`: `college_intent in [DEFINITELY, PROBABLY]` (MIDDLE/HS) → support `S08`. Empty `score_effects`; never K-4 (branch already excludes it). | `contracts/rules.json`, `contracts/taxonomy.json` | RESOLVED |
| DEC-C5 | `REV_AGE_GRADE_CONTEXT`, `REV_SERVICE_AVAILABILITY` had no trigger. | New rule `GRADE_001`: `grade_band = UNDETERMINED` → `REV_AGE_GRADE_CONTEXT` (empty `score_effects`; neutral clarification need, never a risk score or presumption of retention/acceleration/disability/eligibility). `REV_SERVICE_AVAILABILITY` explicitly documented as **outside** the rules engine by design — an operational/service-configuration concern resolved by the Phase 6 consultation adapter, affecting only the report CTA, never educational scoring or candidate display. | `contracts/rules.json`, `contracts/taxonomy.json` | RESOLVED |
| DEC-C6 | `HOME_003`/`PAR_002` redundant. | `HOME_003` marked `RETIRED` with `replacement_rule_id: PAR_002` and a `retired_reason` documenting the direct comparison confirming retirement changes no score and removes no unique behavior (kept in the file, not deleted, for historical explainability; Phase 4 engine must skip RETIRED rules). `PAR_002` given `dedup_key: HOME_MANAGEMENT_TRADEOFF` for report-layer deduplication. | `contracts/rules.json` | RESOLVED |
| DEC-C7 | Thin `cost`/`context` groups. | Display gate left unchanged, exactly as instructed — no artificial score contributions added. Three regression fixtures added instead: `FX15_AFFORDABILITY_ONLY`, `FX16_ENVIRONMENT_ONLY`, `FX17_MOSTLY_UNKNOWN`, each asserting that a zero/minimal-card, `LIMITED_INFORMATION` outcome is valid and correct. | `fixtures/golden-profiles.json` | RESOLVED |

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

## E. Phase 1 stack (RESOLVED — owner-approved)

| ID | Decision | Status |
|---|---|---|
| DEC-E1 | Next.js App Router + TypeScript + PostgreSQL + Drizzle (schema/migrations) + Better Auth (authentication groundwork, email-link, live sending disabled) + Zod (runtime validation) + pnpm with a committed lockfile. Current mutually-compatible stable releases only; no beta/canary/RC pins. | RESOLVED — exact installed versions recorded in `INTEGRATION_REGISTER.md` once installed. |
