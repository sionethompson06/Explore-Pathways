# PHASE 3 PROMPT - Conditional Discovery Profile
Implement the registry-driven questionnaire using Specification 02 and question-bank.json. The same schema and branch definitions must power frontend validation, server validation and tests.

Build Student -> Goals -> Learning -> Schedule -> appropriate optional branches -> Family preferences -> Review. Apply K-4, grades 5-8, grades 9-12 and undetermined paths. Do not ask every family all 38 questions or promise a completion time not measured.

Implement visible adaptive progress, back/edit, server-backed guest draft, refresh resume within valid session, error recovery, exclusive NONE/UNKNOWN choices, up-to-three priorities and optional nickname/ZIP. Render friendly text rather than enum names. Preserve user agency: no inferred default answer or hidden high-interest selection.

Apply explicit inputs for school-change intent, unavailable times, delivery interest, subject challenge and adult availability. Do not substitute a preferred morning schedule for afternoon unavailability. Do not treat parent involvement preference as actual supervision.

When grade or interests change, excluded child-branch answers must no longer affect the active profile. Server recomputes effective answers and grade band. Raw free text is optional, sanitized, limited and excluded from matching/AI/analytics. Do not add medical, school-record or financial-document uploads.

Submit an idempotent validated profile revision. No hard email gate. Do not calculate recommendations in UI components or send lead details to advertising tools.

Acceptance: automated K-2 homeschool, grade-4 support, grade-7 athlete, grade-10 credit, undecided grade, unknown location and branch-change cases; refresh/back behavior; hidden answers neutralized; input validation bypass tests; no child answers in URLs/localStorage/logs; valid UNKNOWN selections can complete; blank required selections cannot.

## End-of-phase evidence and stop rule
Update the phase status and requirement traceability documents. Report: exact files changed; schema/migration changes; commands actually run and pass/fail output; tests not run; screenshots/routes when applicable; integration mode; security/privacy implications; remaining blockers; and the smallest next authorized step. Do not claim a screenshot, test, deployment or third-party integration succeeded without actual evidence. Commit only on the designated feature branch if authorized by the repository workflow. Do not merge, promote production, expose synthetic shortcuts as real services, or implement the next phase. Stop after this phase.
