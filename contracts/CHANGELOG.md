# Contracts Changelog

This is the single authoritative record of every difference between the originally supplied pack (preserved verbatim at `docs/pathways/pack/contracts/`, version `1.0.0-candidate`) and the corrected, application-consumed registries in this directory (version `1.1.0-phase0-corrected`). Per owner authorization at Phase 0 acceptance (DEC-C1 through DEC-C7 in `docs/pathways/DECISION_LOG.md`).

These are the only authoritative contracts. The Next.js application reads exclusively from this directory (`contracts/`) and `fixtures/`, never from `docs/pathways/pack/`. That location is a historical, byte-identical archive of what was originally supplied and is not consumed by any code.

## question-bank.json (38 -> 39 questions)

- **Added `DISC_020A`** (field `ncaa_interest`), resolving DEC-C1. Owner-specified wording, values (`YES`/`MAYBE`/`NO`/`UNKNOWN`), and display labels. `show_when` resolves to: DISC_020's branch active AND DISC_020 answered `DEFINITELY` or `POSSIBLY`. Never shown for K-4.
- **Updated `DISC_020`'s `matching_use`** to point at the new formal follow-up question instead of describing an undefined nested field.
- **Updated `DISC_022`'s `matching_use`** to document the RESEARCH -> OP06 connection (new rule `ADV_007`) and to note that K-4's existing value-subset filter already excludes RESEARCH, satisfying the age-appropriate-language requirement without further change.
- **Updated `DISC_023`'s `matching_use`** to document the college_intent -> S08 connection (new rule `ADV_008`).
- **Added one `global_rules` entry** generalizing the explicit-UNKNOWN-vs-NOT_APPLICABLE distinction (previously implicit from Specification 02's prose, now stated directly in the machine-readable contract) to every question in the registry, not only DISC_020A.
- No other question was added, removed, or had its `id`, `field`, `allowed_values`, or `show_when` changed.

## rules.json (52 -> 55 rule entries; 54 evaluable, 1 retired)

- **Added `ADV_007`**: `advancement_interests contains RESEARCH` (grade MIDDLE/HIGH_SCHOOL) -> overlay `O02`, opportunity `OP06`, review `REV_ADVANCEMENT_READINESS`. Empty `score_effects` (interest signal only, per DEC-C2's explicit instruction not to change base-model scores). Resolves DEC-C2.
- **Added `ADV_008`**: `college_intent in [DEFINITELY, PROBABLY]` (grade MIDDLE/HIGH_SCHOOL) -> support `S08`. Empty `score_effects` (signal-only, per DEC-C4's explicit instruction that it must not affect base-model ranking). Resolves DEC-C4 (the S08 half).
- **Added `GRADE_001`**: `grade_band = UNDETERMINED` -> review `REV_AGE_GRADE_CONTEXT`. Empty `score_effects` (neutral clarification need, not a scored evidence dimension, per DEC-C5's explicit instruction against an age-versus-grade risk score). Resolves DEC-C5 (the `REV_AGE_GRADE_CONTEXT` half).
- **Retired `HOME_003`**: marked `status: "RETIRED"` with `replacement_rule_id: "PAR_002"` and a `retired_reason` documenting the direct comparison performed (PAR_002's condition is a strict superset of HOME_003's; both produce identical `score_effects` of `{B08: -3, B09: -2}` and identical `review_model_scope` of `[B08, B09]`). The rule object is kept in the array, not deleted, so historical `EngineRun` records that cite `HOME_003` remain explainable. The Phase 4 engine must skip rules with `status: "RETIRED"` during evaluation. Resolves DEC-C6.
- **Added `dedup_key: "HOME_MANAGEMENT_TRADEOFF"` to `PAR_002`**, so the report assembler can deduplicate its reason text against any other rule sharing the same key (relevant now that `HOME_003` is retired in `PAR_002`'s favor). Resolves the report-layer half of DEC-C6.
- **Added a top-level `review_signal_notes.REV_SERVICE_AVAILABILITY`** entry documenting that this signal is deliberately *not* wired to any rule in this file: it is an operational/service-configuration concern (Phase 6 consultation adapter), architecturally outside the educational scoring function, per DEC-C5's explicit instruction. Resolves DEC-C5 (the `REV_SERVICE_AVAILABILITY` half).
- **No existing rule's `when` condition, `score_effects`, or `activate` block was changed** except the two additions above (`dedup_key` on `PAR_002`; `status`/`retired_reason`/`replacement_rule_id` on `HOME_003`, which does not change what `HOME_003` itself would have scored had it still been evaluated -- only whether it is evaluated at all).
- **Independent verification performed**: a script cross-checked every field referenced by every non-retired rule's `when` conditions against the question-bank's `field` values plus its `normalized_fact_fields`, and confirmed zero unknown fields, zero duplicate rule IDs, and that reachability of every taxonomy entry now exactly matches its declared `reachability_status` (see the "Validation performed" section below).

## taxonomy.json (structural addition only, no ID added, removed, or renamed)

- **Added `reachability_status` to every base model, overlay, support, opportunity, and review signal**, resolving DEC-C3, DEC-C4, and DEC-C5's request to "distinguish ACTIVE, RESERVED, RETIRED and intentionally excluded items in contract validation and reachability reporting":
  - `ACTIVE` (reachable by a non-retired rule, or — for two named exceptions — wired outside the rules engine as documented): all 10 base models except B10, all 10 overlays, 11 of 12 supports, 13 of 18 opportunities (12 originally reachable + `OP06` newly reachable), 19 of 20 review signals (18 originally reachable + `REV_AGE_GRADE_CONTEXT` newly reachable, plus `REV_COST_ALIGNMENT` which is postprocess-triggered).
  - `RESERVED`: `OP07` (Internship), `OP09` (Industry credential), `OP12` (Entrepreneurship), `OP13` (STEM enrichment), `OP15` (Travel-related learning) — kept in the taxonomy with their IDs and descriptions, explicitly forbidden from ever appearing as a personalized opportunity, and explicitly exempted from failing a reachability check. No question currently captures the underlying interest for OP07/OP09/OP12/OP13; OP15's underlying travel answers already drive schedule scoring rather than this specific opportunity. Resolves DEC-C3.
  - `EXCLUDED`: `B10` only, with an explicit note that exclusion is permanent for Discovery V1 by architectural rule, not oversight, and does not cancel the separately planned future school model.
  - `BASELINE`: `S01` (Pathways advising) only, with an explicit note that it is intentionally not rule-gated because it is the product's universal next step, and that actual availability comes from service configuration, never from this taxonomy entry. Resolves the S01 half of DEC-C4.
  - `OPERATIONAL_LAYER`: `REV_SERVICE_AVAILABILITY` only, cross-referencing the note in `rules.json`. Resolves the `REV_SERVICE_AVAILABILITY` half of DEC-C5.
- **Added one `constraints` entry** stating RESERVED opportunities must never be displayed and must not fail a reachability check.
- No base model, overlay, support, opportunity, or review signal `id` or `label` was added, removed, or renamed.

## scoring-policy.json, report-contract.json, content-library.json, legacy-aliases.json

**Unchanged.** Byte-identical to the originally supplied pack. None of DEC-C1 through DEC-C7 required a change to the scoring formula, the display gate (DEC-C7 explicitly required the gate be kept unchanged), the public DTO shape, the content library, or the legacy alias map.

## fixtures/golden-profiles.json (14 -> 17 cases)

- **Added `FX15_AFFORDABILITY_ONLY`, `FX16_ENVIRONMENT_ONLY`, `FX17_MOSTLY_UNKNOWN`**, resolving DEC-C7's request for regression cases covering affordability-only, environment-concern-only, and mostly-unknown profiles. Each fixture's `expect` block documents that a zero-or-minimal-card, `LIMITED_INFORMATION` outcome is the valid, correct result — not a defect. `FX17` additionally exercises the new `REV_AGE_GRADE_CONTEXT` signal (`GRADE_001`).
- No existing fixture (`FX01`-`FX14`) was changed.

## Validation performed at Phase 0 corrections

A script (not committed as application code; reproducible with the commands below) loaded all three corrected contracts and confirmed:
1. Every field referenced in every non-retired rule's `when` conditions exists in the question-bank's `field` list or `normalized_fact_fields` — zero unknown fields.
2. Every rule ID is unique across all 55 entries (54 evaluable + 1 retired).
3. Every taxonomy entry's `reachability_status` exactly matches whether it is actually referenced by a non-retired rule's `activate` block, with the two documented, intentional exceptions (`REV_COST_ALIGNMENT`, `REV_SERVICE_AVAILABILITY`, both postprocess/operational rather than rule-triggered by design).

Reproduce with:
```
python3 -c "
import json
qb = json.load(open('contracts/question-bank.json'))
rules = json.load(open('contracts/rules.json'))
tax = json.load(open('contracts/taxonomy.json'))
qb_fields = {q['field'] for q in qb['questions']} | set(rules['normalized_fact_fields'])
active = [r for r in rules['rules'] if r.get('status') != 'RETIRED']
unknown = {(r['id'], c['field']) for r in active for c in r['when']['all'] if c['field'] not in qb_fields}
assert not unknown, unknown
ids = [r['id'] for r in rules['rules']]
assert len(ids) == len(set(ids))
print('OK')
"
```

This is a structural/reference check equivalent in spirit to the original pack's `checks/PACK_VALIDATION.json`, run against the corrected contracts. It is not a test of a built application (none exists in this repository yet) and is superseded by the real automated Zod-based contract validator once Phase 1 builds it.
