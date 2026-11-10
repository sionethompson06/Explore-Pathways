/**
 * Phase 6A.2 DST-safe timezone conversion primitives (docs/pathways
 * instruction sections 9-10). Uses only the platform's built-in
 * `Intl.DateTimeFormat` (Node's ICU has full IANA timezone data) --
 * never naive manual UTC-offset arithmetic, never a hardcoded DST
 * rule table, and no added dependency. Safe to import from either
 * server or client code (pure functions, no I/O).
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  /** ISO weekday: Monday=1 ... Sunday=7. */
  isoWeekday: number;
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Reads the wall-clock date/time (and ISO weekday) a UTC instant corresponds to in the given IANA timeZone. */
export function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const raw = partsFormatter(timeZone)
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  const isoWeekday = WEEKDAY_TO_ISO[raw.weekday ?? ""];
  if (isoWeekday === undefined) {
    throw new Error(`Unrecognized weekday token from Intl.DateTimeFormat: ${raw.weekday}`);
  }
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour: Number(raw.hour),
    minute: Number(raw.minute),
    second: Number(raw.second),
    isoWeekday,
  };
}

/**
 * The UTC-to-local offset (in ms) implied by formatting `instant` in
 * `timeZone`: the difference between "the wall-clock digits, read as
 * if they were UTC" and the true UTC instant. Used only as a
 * fixed-point iteration step inside zonedWallTimeToUtc -- never
 * exposed as a general-purpose "get the offset" utility, since raw
 * UTC-offset arithmetic is exactly what this module avoids doing
 * directly on wall-clock values.
 */
function offsetImpliedByFormatting(instant: Date, timeZone: string): number {
  const raw = partsFormatter(timeZone)
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  const asUtc = Date.UTC(
    Number(raw.year),
    Number(raw.month) - 1,
    Number(raw.day),
    Number(raw.hour),
    Number(raw.minute),
    Number(raw.second),
  );
  return asUtc - instant.getTime();
}

/**
 * Converts a wall-clock date/time in `timeZone` (e.g. "9:00 AM on
 * October 6, 2026 in America/Los_Angeles") to the absolute UTC instant
 * it represents. DST-safe: derives the correct offset by asking the
 * platform's own IANA timezone database what a given instant looks
 * like in that zone, iterating twice to converge on the correct
 * offset (handles the rare case where the initial guess lands on the
 * wrong side of a DST transition).
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = offsetImpliedByFormatting(new Date(wallAsUtcMs), timeZone);
  let instantMs = wallAsUtcMs - offset;
  // Second iteration: re-derive the offset from the refined instant,
  // in case the first guess crossed a DST boundary.
  offset = offsetImpliedByFormatting(new Date(instantMs), timeZone);
  instantMs = wallAsUtcMs - offset;
  return new Date(instantMs);
}

/** Adds `deltaDays` to a plain calendar date, in pure calendar arithmetic (no timezone/DST involved -- Y/M/D digits only). */
export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Numeric YYYYMMDD for simple, unambiguous calendar-date comparison. */
export function calendarDateNumber(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

/**
 * Validates that `timeZone` is a real IANA timezone name recognized by
 * this server's own Intl implementation -- never trusts a
 * browser-supplied string merely because it parses as non-empty
 * (section 19/58). Never infers a timezone from IP/geolocation.
 */
export function isValidIanaTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
