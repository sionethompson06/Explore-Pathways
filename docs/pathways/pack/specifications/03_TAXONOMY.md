# Specification 03 - Pathway Taxonomy, normalized
Use contracts/taxonomy.json. Base models B01-B10 are not interchangeable with overlays O01-O10, possible services S01-S12 or opportunities OP01-OP18. REV_* IDs identify review questions. Legacy SUP_/OPP_/P-series values require the explicit alias file; do not silently mint new IDs.

## Assembly
Candidate = one enabled generic base model + applicable interest overlays + possible support services + relevant opportunity exploration + review items.

An O01 student-athlete pathway is not a school. An OP04 dual-enrollment interest is not verified admission. A possible S01 advisor does not mean an advisor has been assigned or purchased.

B01 current school preserves the known current arrangement without assuming funding, modality, quality, schedule or eligibility. B04 is a broad category whose precise meaning depends on the actual jurisdiction and program. B08/B09 remain different planning configurations within the same family, rather than pretending they are separate state legal categories.

## Attributes and evidence
The earlier 0-5 generic model table is not a verified provider database. Do not publish it as fact or use it to establish a school's synchronous requirements, cost, accreditation, NCAA standing or availability. The pilot rule weights are explicit advisory heuristics used only to organize exploratory directions.

Keep unknown provider capabilities unknown. Future provider records will require source, effective dates, checked date, reviewer, states/grades, authority, instructional schedule, admissions, cost and status. They are not needed for model-level Discovery and must not be populated with invented providers.

## Limits
B10 is FUTURE_NOT_AVAILABLE and is excluded before scoring/display. No builder flag, empty result or sales preference may activate it in this version. Eventual activation requires a new approved specification, lawful operating readiness, covered grades/locations and a documented partner-first process.

Generic discovery availability is separate from actual Pathways advising coverage. A family can explore without being promised a service in every state. Use an availability/contact state where advising is not live.

## Parent labels
WORTH_EXPLORING; WORTH_EXPLORING_WITH_CONSIDERATIONS; MORE_INFORMATION_HELPFUL. Never present numerical fit, readiness, ability or family-value scores. Use up to two meaningful directions. A third card is deferred, not required.

---

## Provenance note (added at Phase 0 corrections, this repository)

This file is preserved verbatim from the originally supplied pack. Owner-authorized corrections to `contracts/taxonomy.json` (reachability status field per entry: ACTIVE / RESERVED / RETIRED / EXCLUDED, applied at Phase 0 corrections) are recorded in `contracts/CHANGELOG.md` and `docs/pathways/DECISION_LOG.md` DEC-C3/C4. B10 remains EXCLUDED throughout Discovery V1, which does not cancel the separately planned future school model (Model 3).
