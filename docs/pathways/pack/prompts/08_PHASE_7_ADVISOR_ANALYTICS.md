# PHASE 7 PROMPT - Advisor Workspace and First-Party Funnel Measurement
Build a small operational workspace, not a general-purpose CRM. Access is restricted to server-provisioned staff. Advisors see only their assigned, appropriately handed-off cases; anonymous unsaved drafts are not visible as leads.

Case view: declared goals/priorities; effective profile; exact report version seen by parent; suggested discussion agenda; unknowns/tradeoffs; actual consultation status; notes; next action. Label parent-reported data and unverified suggestions. Do not imply a professional assessment occurred before consultation.

Allow explicit workflow transitions: REQUESTED, BOOKED, COMPLETED, NEEDS_INFORMATION, FOLLOW_UP, NOT_CURRENT_SERVICE_FIT. Keep reasons factual; inability to pay is not a student-quality score. Record advisor corrections as attributed notes/revisions, not silent edits to the original report.

Admin view: integration readiness, content/rule versions, authorized staff assignments, aggregate funnel stages, appointment attendance, service-fit confirmation and report-correction counts. Do not build bulk student export or arbitrary rule editing. Content stays version-controlled; no unreviewed changes to algorithm through an admin text field.

Track minimal allowlisted first-party events with definitions/denominators. No raw answers, free text, child names, email, exact location, tokens or full URLs in analytics. Do not install ad pixels/session replay on private flows. Make small-cell reporting non-identifying. Keep acquisition source and timeline separate from the engine.

Acceptance: advisor A cannot access advisor B's case; nonstaff cannot reach APIs; exposed public payload contains no staff data; notes and status updates audited; snapshot retained; booking/attendance not conflated; anonymized aggregate metrics reconcile against fixtures; no unrequested automated outreach or marketing exports.

## End-of-phase evidence and stop rule
Update the phase status and requirement traceability documents. Report: exact files changed; schema/migration changes; commands actually run and pass/fail output; tests not run; screenshots/routes when applicable; integration mode; security/privacy implications; remaining blockers; and the smallest next authorized step. Do not claim a screenshot, test, deployment or third-party integration succeeded without actual evidence. Commit only on the designated feature branch if authorized by the repository workflow. Do not merge, promote production, expose synthetic shortcuts as real services, or implement the next phase. Stop after this phase.
