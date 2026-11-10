# REPAIR-ONLY PROMPT
Review the latest phase output against the master context, accepted implementation contract and that phase's acceptance criteria. This authorizes corrections only, not a new phase.

Identify each failed or untested requirement with evidence. Fix the smallest necessary scope without unrelated redesign, library replacement, business-rule change, weakened security, disabled tests or altered expected answers to make failures disappear. When requirements conflict, surface the exact conflict rather than silently choose.

Rerun targeted tests and relevant regression tests. Check screenshots after visual changes. Preserve existing working functionality. Update traceability and known issues. Report what changed, commands/results, what remains blocked and whether the phase now passes. Do not proceed, merge or launch automatically.

## End-of-phase evidence and stop rule
Update the phase status and requirement traceability documents. Report: exact files changed; schema/migration changes; commands actually run and pass/fail output; tests not run; screenshots/routes when applicable; integration mode; security/privacy implications; remaining blockers; and the smallest next authorized step. Do not claim a screenshot, test, deployment or third-party integration succeeded without actual evidence. Commit only on the designated feature branch if authorized by the repository workflow. Do not merge, promote production, expose synthetic shortcuts as real services, or implement the next phase. Stop after this phase.
