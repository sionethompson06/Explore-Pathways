# PHASE 4 PROMPT - Deterministic Recommendation and Evidence Engine
Implement the pure recommendation engine exactly from the accepted rulebook, taxonomy, scoring policy and normalization document. No AI, scraping, machine learning, new provider data or ad hoc scoring in this phase.

Accept effective typed answers and version identifiers. Derive only documented facts. Validate every rule target, signal, content reference and field. All rules use supported declarative operators; unknown or missing values must not become true.

Use single-largest priority multipliers, within-group strongest-positive/negative aggregation and caps as defined. Keep score internal. Use stable tie ordering. Display eligibility depends on at least two distinct supported dimensions, never the starting 50 points. Related flexibility answers must not be counted as separate evidence dimensions.

Assemble generic model + overlays + possible supports + opportunities + review items. Apply candidate-specific conflicts, grade filters and diversity only after evidence qualification. One or zero cards is valid. B10 future school is excluded before scoring; no automatic fallback.

Do not equate AHEAD with readiness, college interest with dual enrollment, general graduation concerns with missing credits, or model interest with legal eligibility. Current school with support must remain a possible positive direction when supported.

Return separate internal EngineRun and public-safe report input. Preserve exact reasons, input references and rule versions. Keep timeline/source/contact completely outside this function. Do not expose fit scores to the browser.

Acceptance: all golden fixture invariants; permutation of multi-select inputs does not change underlying results; name/email/timeline/lead-source changes do not change matches; stale hidden inputs do not count; unknowns handled; B10 never appears; no crash on no match; every displayed reason traceable; exact reproducibility with the same versions. Report educational validity as unvalidated pilot logic, not a proven algorithm.

## End-of-phase evidence and stop rule
Update the phase status and requirement traceability documents. Report: exact files changed; schema/migration changes; commands actually run and pass/fail output; tests not run; screenshots/routes when applicable; integration mode; security/privacy implications; remaining blockers; and the smallest next authorized step. Do not claim a screenshot, test, deployment or third-party integration succeeded without actual evidence. Commit only on the designated feature branch if authorized by the repository workflow. Do not merge, promote production, expose synthetic shortcuts as real services, or implement the next phase. Stop after this phase.
