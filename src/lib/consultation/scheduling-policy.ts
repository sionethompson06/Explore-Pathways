import { PLANNING_CALL_DURATION_MINUTES } from "./constants";
import {
  addCalendarDays,
  calendarDateNumber,
  getZonedParts,
  zonedWallTimeToUtc,
} from "./timezone";

/**
 * Phase 6A.2 shared scheduling-policy source of truth (docs/pathways
 * instruction section 8). Every number governing Pathways planning-call
 * availability lives here exactly once -- never duplicated across
 * UI/server/tests. `PLANNING_CALL_DURATION_MINUTES` is re-exported from
 * its original Phase 6A home (src/lib/consultation/constants.ts) rather
 * than redefined, so existing importers keep working unchanged.
 */

export { PLANNING_CALL_DURATION_MINUTES };

/** IANA timezone that always governs business-hour validity, regardless of the parent's browser timezone. */
export const PLANNING_TIME_ZONE = "America/Los_Angeles";
/** Display label for the above -- never "PST"/"PDT" (correct term varies by date; "Pacific Time" is always accurate). */
export const PLANNING_TIME_ZONE_LABEL = "Pacific";

/** ISO weekdays (Monday=1 ... Sunday=7) the planning call is offered on: Monday-Thursday only. */
export const PLANNING_AVAILABLE_ISO_WEEKDAYS: readonly number[] = [1, 2, 3, 4];

export const PLANNING_START_HOUR = 9; // 9:00 AM Pacific
export const PLANNING_END_HOUR = 18; // 6:00 PM Pacific (business closes; last buffer ends here)
export const PLANNING_LAST_START_HOUR = 17; // 5:00 PM Pacific (last bookable start)

export const PLANNING_BUFFER_MINUTES = 15;
export const PLANNING_SLOT_INTERVAL_MINUTES = 60;

export const PLANNING_MIN_NOTICE_HOURS = 24;
export const PLANNING_BOOKING_HORIZON_DAYS = 30;

/** The single scheduling resource Phase 6A.2 offers -- see section 43 on why this stays a plain string key rather than a real "resource" concept yet. */
export const PLANNING_RESOURCE_KEY = "PATHWAYS_PLANNING";

const MS_PER_HOUR = 3_600_000;

/**
 * The authoritative predicate for "is this exact UTC instant a valid
 * Pathways planning-call slot start, right now" -- the single rule
 * both slot generation and server-side re-validation of a
 * client-submitted timestamp go through (section 18: client state is
 * never authoritative). Deliberately does NOT check whether the slot
 * is already booked -- that requires a database read and lives in
 * src/server/booking.ts, which calls this first as a pure pre-filter.
 */
export function isValidPlanningSlotStart(candidateUtc: Date, nowUtc: Date): boolean {
  if (Number.isNaN(candidateUtc.getTime())) return false;

  const parts = getZonedParts(candidateUtc, PLANNING_TIME_ZONE);
  if (parts.minute !== 0 || parts.second !== 0) return false;
  if (!PLANNING_AVAILABLE_ISO_WEEKDAYS.includes(parts.isoWeekday)) return false;
  if (parts.hour < PLANNING_START_HOUR || parts.hour > PLANNING_LAST_START_HOUR) return false;

  // Minimum advance notice: inclusive at exactly 24 hours -- a slot
  // exactly 24h00m00s from now is the earliest valid slot; anything
  // less is rejected. This one rule is used consistently everywhere
  // (never a stricter ">" check in one place and ">=" in another).
  if (candidateUtc.getTime() < nowUtc.getTime() + PLANNING_MIN_NOTICE_HOURS * MS_PER_HOUR) return false;

  const nowParts = getZonedParts(nowUtc, PLANNING_TIME_ZONE);
  const horizonEnd = addCalendarDays(nowParts.year, nowParts.month, nowParts.day, PLANNING_BOOKING_HORIZON_DAYS);
  const candidateDateNum = calendarDateNumber(parts.year, parts.month, parts.day);
  const horizonEndDateNum = calendarDateNumber(horizonEnd.year, horizonEnd.month, horizonEnd.day);
  // Calendar-date comparison only (never millisecond arithmetic across
  // the horizon window, which could drift by up to an hour across a
  // DST transition inside the window) -- inclusive of the horizon end date.
  if (candidateDateNum > horizonEndDateNum) return false;

  return true;
}

/**
 * Enumerates every valid Pathways planning-call slot start (as
 * absolute UTC instants) across the full booking horizon, relative to
 * `nowUtc`. Pure and deterministic -- callers needing "actually
 * available" slots (i.e. also not already booked) filter this list
 * further against persisted Bookings (src/server/booking.ts).
 */
export function generatePlanningSlotCandidates(nowUtc: Date): Date[] {
  const nowParts = getZonedParts(nowUtc, PLANNING_TIME_ZONE);
  const candidates: Date[] = [];

  for (let dayOffset = 0; dayOffset <= PLANNING_BOOKING_HORIZON_DAYS; dayOffset++) {
    const { year, month, day } = addCalendarDays(nowParts.year, nowParts.month, nowParts.day, dayOffset);
    const isoWeekday = calendarIsoWeekday(year, month, day);
    if (!PLANNING_AVAILABLE_ISO_WEEKDAYS.includes(isoWeekday)) continue;

    for (let hour = PLANNING_START_HOUR; hour <= PLANNING_LAST_START_HOUR; hour++) {
      const candidate = zonedWallTimeToUtc(year, month, day, hour, 0, 0, PLANNING_TIME_ZONE);
      if (isValidPlanningSlotStart(candidate, nowUtc)) candidates.push(candidate);
    }
  }

  return candidates;
}

/** ISO weekday (Monday=1...Sunday=7) of a plain calendar date -- pure Y/M/D arithmetic, no timezone/DST involved. */
function calendarIsoWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay;
}
