# PHASE 6 PROMPT - Verified Saving, Consultation and Parent Continuity
Implement optional verified report persistence and the approved consultation integration. Preserve full guest report access. Apply the shared authorization layer and privacy requirements.

Allow parent first name/email for save, optional phone only when choosing a contact route that needs it. Use the approved authentication provider's verified email flow. Email entry alone must never attach or merge a report into an existing account. Associate only a report owned by the active guest/account context after verification. Prevent replay, account enumeration and cross-report access.

Separate delivery request, email marketing opt-in and any SMS consent in versioned records. No default opt-in. Marketing unsubscribe does not cancel a requested consultation. Neutral email subject; no child needs/grades in previews. Expiring single-use access follows a supported authentication flow and exchanges tokens into a session without leaking them to logs/referrers.

Provide /family with authorized saved reports and one next step, not a full LMS. Model one guardian's explicit access to each child separately; do not share automatically with a referral partner or another same-email-looking account.

Scheduler adapter modes: UNCONFIGURED, REQUEST_ONLY, LIVE_VERIFIED. A request is not a booking. Verify actual appointment state through supported API/webhook, signature/replay/idempotency checks, correct time zones, conflicts, cancellation and reschedule events. Do not trust a browser redirect as appointment confirmation. Never invent times, advisor names, response speed or price.

After verified booking, report CTA becomes Prepare for your conversation. Report/profile context is available to the assigned advisor only after an appropriately disclosed/requested handoff. No payments, school enrollment or documents.

Acceptance: save without marketing; report without email; email verification; expired/replayed links; two-parent isolation; spoofed webhook rejection; duplicate events; scheduler unavailable; real versus request-only messages; save/booking without data loss; no external messages sent in demo/test mode. Document live credentials/operational decisions still missing.

## End-of-phase evidence and stop rule
Update the phase status and requirement traceability documents. Report: exact files changed; schema/migration changes; commands actually run and pass/fail output; tests not run; screenshots/routes when applicable; integration mode; security/privacy implications; remaining blockers; and the smallest next authorized step. Do not claim a screenshot, test, deployment or third-party integration succeeded without actual evidence. Commit only on the designated feature branch if authorized by the repository workflow. Do not merge, promote production, expose synthetic shortcuts as real services, or implement the next phase. Stop after this phase.
