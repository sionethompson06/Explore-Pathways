# Acceptance matrix to turn into application tests
Fixtures are synthetic business-rule tests. They are not evidence of educational effectiveness.

## Unit and contract
All enums, branch IDs, rules, content IDs and effect targets validate. No unknown value equals NO. Same input/version -> same result. Zero/one/two-card outcomes work. Scores and reason codes agree. Scope reviews to affected models. No B10. Unsupported predicates fail validation, not open-ended eval.

## Integration
One profile submit -> one stored revision/run/snapshot for a given idempotency context. Resubmission and concurrent clicks do not create duplicate emails/bookings. Authenticated saving verifies email and ownership. Parent and advisor access is tested with distinct accounts. Private HTML, RSC payloads, API responses and caches contain only authorized DTOs. Hidden branch answers never influence the next report.

## Report and content
R01-R07 all intentional; unknowns do not get padded with invented insight. Every claim traceable. No percent fit, fake provider, school enrollment, credits, hours saved, guaranteed NCAA outcomes or fake social proof. Elementary report remains elementary. Interest is not mastery/readiness. Actual state availability remains unknown until verified. Paid service scope clear. Parent sees useful value without marketing opt-in.

## Browser
Home -> questionnaire -> review -> report -> optional save -> consultation. Test phone widths, tablet, desktop, 320-pixel reflow, zoom, keyboard/focus, screen-reader labels, back/reload, slow network, error/retry, expired session, long text, multiple children in separate sessions. Visual reference must not be used as one large image. Report text cannot bleed outside cards.

## Operational
Email unconfigured/bounce; scheduler request-only/unconfigured/verified, time zone, daylight saving, cancellation, signed duplicate webhook; AI timeout/refusal/wrong meaning; privacy cleanup; delete request; demonstration flags blocked in production; live collection disabled until notices/retention/service approval. A link click never proves a confirmed booking.

## Human acceptance
At least one authorized education/service reviewer checks representative reports. Parent comprehension review checks whether the preliminary nature and next step are understood. Record actual feedback; do not mark human review passed because an automated tool generated a plausible report.
