# PHASE 1 PROMPT - Foundation, Contracts and Safe Persistence
Proceed only after Phase 0's implementation contract is accepted. Apply the master context and accepted resolutions.

Initialize or extend the actual approved stack without replacing a functioning framework. Establish typed modules for discovery, rules, reports, identity/access, consultation, integrations and analytics. Convert JSON contracts to validated typed inputs; no runtime eval or arbitrary rule execution.

Implement the minimal relational schema: users/guardian access; student pathway record; protected expiring guest sessions; profile revisions; engine runs; report snapshots; consent events; consultation requests/bookings; advisor assignments/notes; minimal audit/workflow events. Do not implement courses, payments, transcripts or provider enrollment.

Separate guest, verified-parent, assigned-advisor and admin policies. Enforce server-side, object-level access in a shared data-access layer for every operation. Public DTOs must exclude internal scores, sensitive comments and staff notes. Add private/no-store behavior to private response paths. Do not rely on route hiding or random IDs.

Create environment validation, .env.example with placeholders only, migration/seed procedure, tests, CI and health checks. Prototype mode uses fictional records with outgoing email/bookings/AI disabled. Production must refuse demo-auth/bypass flags. Rate limits, bounded input sizes, CSRF handling and guest expiration belong in the foundation.

Use a supported authentication library/provider when approved. If unconfigured, do not expose an unsecured staff area; document the activation blocker. Never make all users administrators for convenience.

Acceptance: type-check/lint/build where available; migrations tested against a nonproduction database; canonical registry validation; guest A/B and parent A/B access-denial tests; no secrets/client leakage; sensitive responses not shared-cached; missing integrations fail honestly. No real child information collected in this phase.

## End-of-phase evidence and stop rule
Update the phase status and requirement traceability documents. Report: exact files changed; schema/migration changes; commands actually run and pass/fail output; tests not run; screenshots/routes when applicable; integration mode; security/privacy implications; remaining blockers; and the smallest next authorized step. Do not claim a screenshot, test, deployment or third-party integration succeeded without actual evidence. Commit only on the designated feature branch if authorized by the repository workflow. Do not merge, promote production, expose synthetic shortcuts as real services, or implement the next phase. Stop after this phase.
