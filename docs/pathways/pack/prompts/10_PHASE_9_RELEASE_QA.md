# PHASE 9 PROMPT - Release Candidate QA and Controlled Launch
Audit the full authorized implementation against the canonical contract, traceability matrix and fixtures. This is a verification/fix phase, not permission for new functionality. Run the actual project commands and report exact results.

Cover type/lint/build, schema and migration checks, engine determinism, branch changes, unknown values, report quality, save/verification, guest expiration, guardian/advisor/admin isolation, secret leakage, private caches, rate limits, input limits, malicious requests, webhook spoofing/replay/idempotency, appointment time zones, consent and deletion/retention execution. Check that logs, email, analytics and browser source do not expose sensitive records or internal scores.

Run browser tests/screenshots for key pages at mobile/tablet/desktop, 320-pixel reflow, zoom, keyboard navigation, focus visibility, errors, loading, reduced motion and reasonable screen-reader interaction. Automated accessibility tools are necessary but not sufficient. Record untested manual items honestly.

Verify there is no fake operational school, provider, testimonial, affiliation, advisor, timetable, eligibility, guarantee, appointment or delivery success. Review representative reports with an education/service owner and collect parent comprehension feedback when authorized. Do not mark human review complete without it.

Check approved operating entity, privacy/terms, retention, service coverage, media rights, actual advisor staffing, consultation scope, email sender and vendor configurations. Keep live collection or booking disabled where approvals are missing. Demonstrate deletion in primary data and document applicable backup/log handling.

Prepare RELEASE_REPORT.md, known issues with severity, schema backup/rollback steps, integration register, monitoring plan and specific launch checklist. Do not describe 'all tests passed' when tests were skipped. Promote production only on an explicit owner instruction identifying the deployment target and candidate. Stop with a go/no-go recommendation supported by evidence, not an unrequested launch.

## End-of-phase evidence and stop rule
Update the phase status and requirement traceability documents. Report: exact files changed; schema/migration changes; commands actually run and pass/fail output; tests not run; screenshots/routes when applicable; integration mode; security/privacy implications; remaining blockers; and the smallest next authorized step. Do not claim a screenshot, test, deployment or third-party integration succeeded without actual evidence. Commit only on the designated feature branch if authorized by the repository workflow. Do not merge, promote production, expose synthetic shortcuts as real services, or implement the next phase. Stop after this phase.
