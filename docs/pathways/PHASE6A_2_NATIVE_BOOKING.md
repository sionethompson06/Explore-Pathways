# Phase 6A.2 — Native Pathways Booking Calendar

## Business objective

Phase 6A built the first real client-acquisition funnel, but the actual appointment-selection step still handed the parent off to an external Google Calendar Appointment Schedule — a provider this repository never had a real URL configured for, and one Pathways could not itself confirm a booking against. Phase 6A.2 replaces that external dependency with a simple, secure, branded, Pathways-native booking calendar for the free planning call: **Discovery → Personalized Discovery Report → "Schedule My Free Pathways Planning Call" → Contact Information → Pathways Booking Calendar → Select a Day → Select an Available Time → Confirm → Pathways Booking Created → consultation status `BOOKED` → Pathways Confirmation Screen** — entirely inside the Pathways application. No Google account, and no Google Appointment Schedule, is required for `SCHEDULER_MODE=INTERNAL`.

## Owner-locked availability policy

- Availability: **Monday–Thursday only** (Friday/Saturday/Sunday unavailable).
- Timezone: `America/Los_Angeles` (displayed as "Pacific").
- Business hours: **9:00 AM–6:00 PM Pacific**.
- Call duration: **45 minutes**; post-call buffer: **15 minutes** — together, exactly a 60-minute slot interval.
- Valid start times: **9:00 AM through 5:00 PM, on the hour** (9 values/day). The last appointment is 5:00–5:45 PM; the buffer runs 5:45–6:00 PM.
- Minimum advance notice: **24 hours** (inclusive at exactly 24h00m00s).
- Booking horizon: **30 calendar days**.
- Cost: **free**. Format: **Video preferred, Phone available** (already captured at the Phase 6A contact step — never re-asked).
- No parent choice of advisor. No daily cap beyond the hourly grid. No holiday/blocked-time admin UI yet — that is explicitly Phase 6B.

Every one of these numbers lives exactly once, in `src/lib/consultation/scheduling-policy.ts` (`PLANNING_TIME_ZONE`, `PLANNING_AVAILABLE_ISO_WEEKDAYS`, `PLANNING_START_HOUR`, `PLANNING_END_HOUR`, `PLANNING_LAST_START_HOUR`, `PLANNING_BUFFER_MINUTES`, `PLANNING_SLOT_INTERVAL_MINUTES`, `PLANNING_MIN_NOTICE_HOURS`, `PLANNING_BOOKING_HORIZON_DAYS`, `PLANNING_RESOURCE_KEY`), which re-exports the existing `PLANNING_CALL_DURATION_MINUTES` from its Phase 6A home (`src/lib/consultation/constants.ts`) rather than redefining it. No UI, server action, or test file duplicates one of these numbers as a separate literal.

## Timezone correctness without a new dependency

All business-hour math is always evaluated in `America/Los_Angeles`; the browser/viewer's timezone is used only for a secondary, informational display line, never to decide what counts as a valid slot. `src/lib/consultation/timezone.ts` implements DST-safe wall-clock↔UTC conversion using only the platform's own `Intl.DateTimeFormat` (no added dependency, no manual UTC-offset table):

- `zonedWallTimeToUtc(y, m, d, h, mi, s, timeZone)` finds the UTC instant for a given wall-clock time in a given IANA zone via a fixed-point iteration: guess the instant assuming the wall-clock digits were already UTC, read back what that instant actually says in the target zone via `Intl.DateTimeFormat`, derive the zone's current offset from the difference, and correct the guess — repeated once more to handle the rare DST-boundary case where the first correction lands on the wrong side of a transition.
- `getZonedParts(instant, timeZone)` reads wall-clock year/month/day/hour/minute/second and ISO weekday (Monday=1…Sunday=7) back out of a UTC instant for a given zone.
- `addCalendarDays`/`calendarDateNumber` do pure calendar-date (Y/M/D) arithmetic for the 30-day horizon boundary, deliberately avoiding raw millisecond arithmetic across that window — a plain `instant + 30*86400000` comparison can drift by an hour across a DST transition inside the window; comparing `calendarDateNumber` (`YYYYMMDD` as an integer) never can.
- `isValidIanaTimeZone(tz)` validates a candidate timezone string by trying to construct an `Intl.DateTimeFormat` with it.

This was verified directly against the real 2026 US DST transition dates before any test was written (Jan 6 2026 9 AM Pacific → 17:00 UTC, PST/UTC-8; Jul 7 2026 9 AM Pacific → 16:00 UTC, PDT/UTC-7; Mar 9 2026 — the Monday after spring-forward — 9 AM Pacific → 16:00 UTC; Nov 2 2026 — the Monday after fall-back — 9 AM Pacific → 17:00 UTC), and is covered by mandatory regression tests in `tests/scheduling-policy.test.ts` asserting all four cases plus a full round-trip across a DST-spanning 30-day horizon window. No calendar-UI library and no pinned date/time dependency were needed or added.

## Scheduler mode: adding INTERNAL without touching the frozen report contract

`SCHEDULER_MODE` (`src/env.ts`) now accepts `UNCONFIGURED | INTERNAL | REQUEST_ONLY | LIVE_VERIFIED` (`LIVE_VERIFIED` remains fully unimplemented and refused in production by the pre-existing, unweakened guard). Critically, **INTERNAL does not change the public, frozen Phase 5 `ReportDTO` consultation-state contract**: `getConsultationCapability()` (`src/server/consultation-capability.ts`) still resolves INTERNAL to the exact same public `state: "REQUEST_ONLY"` the Google-handoff path already used, so the existing report CTA ("Schedule My Free Pathways Planning Call" → `/discover/consultation`) is completely unchanged by this phase. A new, separate `provider` field (`"INTERNAL" | "GOOGLE_EXTERNAL" | "NONE"`) tracks which concrete scheduling mechanism is actually active, without ever being forced into the frozen report contract:

```
SCHEDULER_MODE=INTERNAL                                    → { state: "REQUEST_ONLY", provider: "INTERNAL",       scheduleUrl: null }
SCHEDULER_MODE=REQUEST_ONLY + valid GOOGLE_APPOINTMENT_SCHEDULE_URL → { state: "REQUEST_ONLY", provider: "GOOGLE_EXTERNAL", scheduleUrl: <configured URL> }
otherwise                                                   → { state: "UNCONFIGURED", provider: "NONE",          scheduleUrl: null }
```

`getConsultationCapability()` remains the single honest source of truth callers read from — no other code checks `SCHEDULER_MODE`/`GOOGLE_APPOINTMENT_SCHEDULE_URL` directly. The one caller that needed a `.provider` check (`handOffToGoogleScheduler()` in `src/server/consultation.ts`, which must never activate for `provider="INTERNAL"` even though INTERNAL's capability also carries `state="REQUEST_ONLY"`) was updated from a `state`-only guard to a `provider !== "GOOGLE_EXTERNAL"` guard.

## Google Appointment Scheduling: preserved as a dormant legacy option

Phase 6A's Google groundwork is not deleted. `/discover/consultation/schedule/go` (the server-controlled external handoff route) is untouched and still works exactly as before for `provider="GOOGLE_EXTERNAL"`. When `provider="INTERNAL"`, the real booking UI never calls that route at all — the schedule page branches purely on `capability.provider`, and the non-INTERNAL branch's markup is byte-identical to the original Phase 6A implementation (preserving its existing Playwright coverage unmodified). No Google URL was invented or configured for INTERNAL mode, and no external network call to Google occurs anywhere in the INTERNAL code path.

## The booking domain: extending, not duplicating, the existing table

The existing `booking` table (`src/db/schema/consultation.ts`, created in Phase 6A groundwork but never populated by any code path until now) gained four new, nullable/defaulted, backward-compatible columns rather than a parallel "Appointment" table:

- `source` — a new `booking_source` enum (`INTERNAL` | `EXTERNAL`), `NOT NULL DEFAULT 'EXTERNAL'`. The default is safe specifically because no code path had ever inserted a `Booking` row before this phase — there are no pre-existing rows whose `source` this default could misrepresent.
- `resourceKey` (nullable `text`) — the abstract scheduling resource this booking occupies. V1 uses exactly one value, `PLANNING_RESOURCE_KEY = "PATHWAYS_PLANNING"` — the parent chooses a *time*, never an advisor. The column is a plain string key, not a foreign key into an advisor/resource table, specifically so a future phase can introduce advisor-specific or multi-capacity resources without changing the parent-facing booking object's shape at all.
- `durationMinutes` (nullable `integer`) — persisted per-row (currently always 45) rather than assumed from the shared constant, so a future duration change can never silently reinterpret a historical booking.
- `bookerTimeZone` (nullable `text`) — the validated viewer-facing IANA timezone, display-only, never authoritative for business-hour validity.

An internal booking populates `source="INTERNAL"`, `resourceKey="PATHWAYS_PLANNING"`, `durationMinutes=45`, `scheduledAt`=the absolute UTC start instant, `timeZone="America/Los_Angeles"`, `bookerTimeZone`=the validated viewer timezone (or `"America/Los_Angeles"` if invalid/absent), and `providerReference=null`. No raw payment, card, or account data of any kind is stored anywhere in this table.

## Database-enforced uniqueness — never a SELECT-then-INSERT race

Two new partial unique indexes, added in an additive, backward-compatible migration (`drizzle/0003_lumpy_mysterio.sql`):

- `booking_active_per_request_unique_idx` — a unique index on `(consultation_request_id) WHERE cancelled_at IS NULL`. One *active* Booking per `ConsultationRequest`; a historical cancelled row never blocks a fresh one.
- `booking_resource_slot_unique_idx` — a unique index on `(resource_key, scheduled_at) WHERE resource_key IS NOT NULL AND scheduled_at IS NOT NULL AND cancelled_at IS NULL`. Two active bookings can never occupy the same resource at the same instant.

This is deliberately a database constraint, not an application-level lock or a "check availability, then insert" sequence — the latter is a real, exploitable race between two families clicking the same slot within milliseconds of each other. `createInternalBooking()` (`src/server/booking.ts`) inserts inside a nested `tx.transaction()` (a Postgres `SAVEPOINT`), catches the specific `23505` unique-violation on each of these two constraint names (`src/server/db-conflict.ts`'s `isUniqueConstraintConflict()`, the same pattern already proven in `src/server/discovery-draft.ts`), and re-selects inside the same outer transaction rather than ever trusting a prior read. On a `booking_resource_slot_unique_idx` conflict the caller gets back `SLOT_TAKEN` (never a raw SQL error, never a corrupted partial state); on a `booking_active_per_request_unique_idx` conflict, the caller gets back the request's one true existing active booking (idempotent retry — see below).

**Verified under real concurrent PostgreSQL**, not merely asserted: `tests/booking.test.ts`'s mandatory "double-booking race" test fires two genuinely concurrent `createInternalBooking()` calls (`Promise.all`, two independent sessions/consultation requests) at the identical slot, and asserts exactly one succeeds, the other receives `SLOT_TAKEN`, exactly one active `Booking` row exists at that slot afterward, and exactly one of the two `ConsultationRequest`s ever reaches `BOOKED` — the losing request's status is never touched. This passed on its first run.

## The parent-facing conflict experience

When a browser confirms a slot that a database constraint has just rejected, the calendar UI shows the exact required copy — **"That time was just reserved by another family. Please choose another available time."** — refreshes the available-times list from the server (never a stale client cache), and never surfaces a generic error page or raw SQL detail. No `ConsultationRequest` status change and no `WorkflowEvent` are ever written for a rejected attempt. This exact UX (two independent browser contexts racing the identical first-offered slot) is covered end-to-end in `tests/e2e-internal/booking-internal.spec.ts`.

## Idempotency: a double-click never creates a duplicate

Retrying (a double-click, a network retry) against a request that already has an active `Booking` is idempotent: `createInternalBooking()` first checks for an existing active booking and returns it unchanged (never inserting a second row, never appending a duplicate `WorkflowEvent`) before attempting any insert at all; a genuine race that lands on the `booking_active_per_request_unique_idx` conflict path re-selects and returns the same existing row for the same reason. Covered by both a concurrent (`Promise.all`) and a subsequent sequential retry assertion in `tests/booking.test.ts`.

## Server-side slot generation and re-validation — client state is never authoritative

`generatePlanningSlotCandidates(nowUtc)` (`src/lib/consultation/scheduling-policy.ts`) enumerates every exact-hour UTC instant across the 30-day horizon that satisfies Monday–Thursday, 9 AM–5 PM Pacific starts, and the 24-hour minimum-notice/30-day-horizon boundaries — the single authoritative predicate, `isValidPlanningSlotStart()`, is shared unchanged between candidate generation and re-validation of anything a client submits. `getAvailableSlotsForSession()` (`src/server/booking.ts`) further filters that list against currently active `PATHWAYS_PLANNING` bookings before returning it to the browser.

The browser may submit a `selectedStartIso` and an optional `bookerTimeZone` — nothing else. `createInternalBooking()` independently recomputes every one of: parseable timestamp, exact-minute/second, correct ISO weekday, correct business hour, the 24-hour notice boundary, the 30-day horizon, request ownership (from the session cookie, never a client-supplied id), the absence of an already-active booking, and that the slot is not already taken — before ever touching the database. `tests/booking.test.ts`'s "arbitrary slot rejection" test posts a Friday, a Sunday, 8 AM, 5:30 PM, 6 PM, a slot inside the 24-hour window, and a slot beyond the 30-day horizon directly (bypassing the UI entirely) and confirms every one is rejected as `INVALID_SLOT` with zero `Booking` rows created.

## Browser timezone: display only, detected safely, never a request

`Intl.DateTimeFormat().resolvedOptions().timeZone` is read once, client-side, purely for display — never sent as a location permission request, never resolved via IP geolocation. To avoid a server/client hydration mismatch (the server has no browser to ask), `BookingCalendarView` reads this value via `useSyncExternalStore` with a server snapshot that is always `null`, rather than `useEffect` + `setState` (which would cause an extra client-only render pass and trip this repository's `react-hooks/set-state-in-effect` lint rule). If the viewer's browser timezone is invalid or unavailable, both client and server independently fall back to `America/Los_Angeles`. When the viewer's timezone differs from Pacific, the UI shows the viewer's local time first, Pacific time second ("4:00 PM – 4:45 PM your time" / "9:00 AM – 9:45 AM Pacific"); when it matches Pacific, only the Pacific line is shown. Raw UTC is never displayed anywhere.

## The schedule and confirmation pages

`/discover/consultation/schedule` still requires the same valid guest session, completed Discovery, and active `ConsultationRequest` as Phase 6A — no public consultation/student/booking id ever appears in its URL. For `provider="INTERNAL"` it renders the real native calendar (`BookingCalendarView`): a "Select a Day" list and an "Available Times" grid (stacked on mobile, two columns at ≥900px — no third-party calendar UI library), a summary card ("Pathways Planning Call" / full date / viewer-local time when applicable / Pacific time / duration+format), and a "Confirm Planning Call" button. Header copy is exactly: saved notice "Your information is saved."; H1 "Choose a Time for Your Pathways Planning Call"; Free/45 minutes/Video preferred/Phone available; body "Select a day and time that works for your family." — Google is never mentioned in INTERNAL mode. Revisiting this route with an already-active `BOOKED` consultation redirects straight to `/discover/consultation/confirmed` instead of ever offering a second calendar.

`/discover/consultation/confirmed` requires the same authorized guest session plus an active `BOOKED` consultation with an active `Booking` (redirecting safely back to `/discover/consultation/schedule` otherwise — it never fabricates a confirmation). It shows H1 "Your Pathways Planning Call Is Reserved", the date/time (viewer-local when applicable, Pacific always), 45 minutes, and the selected call format, followed by "Your Pathways advisor will review your Discovery before the call." and then either "Connection details will be provided before your appointment." (Video) or "Pathways will use the phone number you provided for this planning request." (Phone) — and never a claim that an email confirmation was sent, a Google Meet link was created, an advisor was assigned, or an account was created, because none of those things happen.

## Booking transaction and status transitions

`createInternalBooking()` allows a fresh internal booking from `REQUESTED` and, for backward compatibility with the legacy external-handoff path, from `PENDING_VERIFICATION` — both transition directly to `BOOKED` with `WorkflowEvent.reason="INTERNAL_BOOKING_CONFIRMED"` and the true prior status recorded as `fromStatus`. `PENDING_VERIFICATION` itself is never produced by an internal booking — a successful internal reservation moves directly to `BOOKED`, since Pathways itself created the booking rather than merely redirecting to an external page. An already-`BOOKED` request with an active booking returns/shows the existing booking rather than creating another. `COMPLETED`/`NO_SHOW`/`CANCELLED` are rejected honestly as `NOT_BOOKABLE` — rescheduling is explicitly out of scope for this phase. Every one of these transitions, plus the "no false audit event" guarantee, is covered in `tests/booking.test.ts`.

The booking does not assign an advisor — `advisorAssignment` is completely untouched by this phase, and a freshly `BOOKED` appointment is expected to show "Advisor: Unassigned" until Phase 6B's staff workflow exists.

## What is deliberately not built yet

- No confirmation email, calendar invite, or SMS (`EMAIL_MODE` remains `UNCONFIGURED`) — the on-screen confirmation page is the sole authoritative record of the reservation.
- No generated video-conference link — "Video" is a preferred call *format* only, exactly as it was in Phase 6A; no Meet/Zoom room is created.
- No admin blocked-time/holiday/vacation editor, no advisor-specific availability, no rescheduling UI, no Admin/Advisor workspace, no case-management interface — all explicitly Phase 6B.
- No AI/LLM, no provider matching, no Blueprint Preview, no pricing/payment workflow, no parent account creation, no Google OAuth/Calendar API/Meet generation. Phase 4's decision engine and Phase 5's report content/design are byte-unchanged.

## Privacy

No parent name, email, phone, Discovery answer, or student identifier ever appears in a booking URL or in the public available-slots response (which contains only appointment start timestamps and business/Pacific display context). Nothing scheduling-related is ever written to `localStorage`/`sessionStorage`, logged to the console, or sent to a third-party analytics/session-replay tool. No location permission is ever requested.

## Phase 6B handoff readiness

A Phase 6A.2 case remains fully queryable without reconstructing state from browser data: `ConsultationRequest → ConsultationContact → ProfileRevision → exact ReportSnapshot → active Booking → ordered WorkflowEvent history → AdvisorAssignment (currently none)`. Phase 6B's staff workspace can show Student/Parent/Contact/Discovery/Report/the `BOOKED` appointment/call format/appointment timezone/"Advisor: Unassigned"/activity history entirely from already-persisted rows.

## Phase 6A.2a addendum — transaction integrity + calendar UX

A narrowly-scoped acceptance cleanup on top of 6A.2, made after owner review, before the phase was frozen. Availability hours, duration, buffer, notice window, booking horizon, resource semantics, Discovery/Report content, and Phase 4 engine behavior are all unchanged.

### The transaction-status race, closed

`createInternalBooking()` previously resolved and validated the `ConsultationRequest`'s status *before* opening the database transaction that inserts the `Booking` and transitions that same status to `BOOKED`. Between that read and the transaction's writes, another process (a legacy Google handoff, a future admin cancellation) could change the request's status -- and the booking transaction, trusting its stale in-memory copy, could still insert a `Booking` and overwrite a genuinely different current status back to `BOOKED`.

The fix moves the status check *inside* the same transaction, behind a `SELECT ... FOR UPDATE` row lock on that exact `ConsultationRequest` row: a concurrent status-changing transaction against the same row either already committed (and its result is what this transaction reads) or is blocked until this transaction commits or rolls back (and will then see this one) -- there is no window in which either side can observe or leave behind a stale value. Which `ConsultationRequest` a session owns is still resolved once, outside the transaction (a session cannot switch which request it owns mid-call); only that request's *status* is ever re-read and locked fresh. **Mandatory regression test** (`tests/booking.test.ts`, "Phase 6A.2a: transactional status race guard"): a real, separately-held PostgreSQL transaction transitions a request to `CANCELLED` and is deliberately kept open (uncommitted) while a concurrent `createInternalBooking()` call is in flight against the same request; the booking call's own `FOR UPDATE` read genuinely blocks until the cancel transaction commits, then correctly sees `CANCELLED` and rejects with `NOT_BOOKABLE` -- zero `Booking` rows created, the request's status never overwritten, no false `BOOKED` `WorkflowEvent`. Passed on first run.

### Unique-conflict idempotency, made index-order-independent

A same-consultation double submission (a double-click, a retry) can, depending on exact timing and Postgres's own execution plan, trip *either* of the two unique indexes (`booking_active_per_request_unique_idx` or `booking_resource_slot_unique_idx`) first. The prior code branched on which specific constraint name the conflict reported, treating each differently -- correctness for the same-request case depended on that ordering.

The resolution rule is now identical regardless of which of the two names is reported: on any conflict against either index, first check whether *this* `ConsultationRequest` already has an active `Booking`. If it does, return that existing booking (`alreadyBooked: true`) -- unconditionally, before ever asking which constraint fired. Only when this request genuinely has no active booking of its own does a conflict mean the resource/slot is held by a *different* consultation, and only then is `SLOT_TAKEN` returned. This single rule covers every case: a genuine same-request race is resolved by the transactional `FOR UPDATE` status recheck above before an insert is even attempted (the loser simply observes the winner's already-`BOOKED` status and returns its booking); the unique-index catch remains as a defense-in-depth backstop for any conflict that still reaches the insert. Verified in `tests/booking.test.ts` with three real-PostgreSQL cases: (A) same consultation, same slot, concurrent -- both resolve to the identical booking; (B) same consultation, different slots, concurrent -- exactly one active booking, the loser resolves to the winner's booking rather than `SLOT_TAKEN`, exactly one `BOOKED` `WorkflowEvent`; (C) different consultations, same slot -- exactly one succeeds, the other gets `SLOT_TAKEN`, the losing consultation stays unbooked. All three passed on first run.

### Compact monthly calendar, replacing the long date list

The original `BookingCalendarView` rendered every available date as one long vertical list -- on mobile this pushed "Available Times" below potentially 20+ stacked date rows. It is replaced with a conventional seven-column month grid (no third-party calendar library): a month-label header with bounded "previous"/"next" navigation, a non-interactive weekday-abbreviation row, and one native `<button>` per calendar day.

**Server-safe booking-window metadata**, not just a flat slot list: `getAvailableSlotsForSession()` now also returns `windowStartIso` -- the server's own authoritative "now," the single anchor the calendar needs. From it, the client independently regenerates the *complete* set of eligible calendar dates via a new pure, isomorphic function, `generateEligibleCalendarDates()` (`src/lib/consultation/scheduling-policy.ts`): every Monday-Thursday date within the 30-day horizon, deliberately computed **without** reference to which individual hourly slots still happen to be open. Intersecting that eligible-date set against the actual available-slots list is what lets the calendar tell apart three distinct reasons a date might be unselectable -- "not a business day," "outside the horizon," and "a real, in-window business day with zero slots left" (fully booked, or every remaining hour now violates the 24-hour notice rule) -- without ever having derived the whole visible calendar solely from the flat slot list, which cannot represent that last case at all.

**Disabled-date semantics**: every date cell in the displayed month renders (weekends, past dates, and exhausted business days are never hidden), but only a date that is both eligible *and* still has at least one open slot is enabled. Every date button carries a real accessible name ("Monday, October 5" -- computed at noon Pacific on that calendar date, immune to the viewer's own browser timezone shifting the label), `aria-pressed` for the selected state, and the native `disabled` attribute (not a styling-only affordance) for an unselectable one -- never a color-only distinction, and never a `role="grid"`/`gridcell` construction (plain buttons, per the owner's explicit preference for simplicity over a pseudo-spreadsheet). Month navigation is bounded to the actual horizon (computed from the real eligible-date set, not hardcoded to "one month either side"), so "previous"/"next" disable themselves the moment they would leave the bookable window.

**Verified against real PostgreSQL and a live rendered calendar** (`tests/scheduling-policy.test.ts`, `tests/e2e-internal/calendar-ux.spec.ts`): eligible-date generation is Mon-Thu-only and inclusive of the horizon's exact last day, never its 31st; a fixed-`now` case proves a date can be eligible yet have zero valid hourly slot starts (the too-soon-date case, deliberately tested at the pure-function level with a pinned clock, since a live server's real wall-clock time cannot be pinned from an end-to-end test); a real month-crossing horizon produces correctly labeled dates in both months; the rendered calendar shows a genuine 7-column grid (never the old long list) with "Available Times" reachable without scrolling past a month of individual date rows; every visible Friday/Saturday/Sunday date is present and disabled, never omitted; **the mandatory fully-booked-date case** -- every remaining slot for one real day is booked out via parallel independent sessions, and a brand-new family's fresh page load still shows that exact date, still disabled, offering no times for it -- passed on first run.

**Owner action:** none required. Availability policy, duration/buffer/notice/horizon, resource semantics, Discovery, and the Phase 4/5 report engine/content are unchanged; no schema migration was needed for this addendum; no merge to main occurred.
