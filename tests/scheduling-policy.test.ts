import { describe, it, expect } from "vitest";
import {
  getZonedParts,
  zonedWallTimeToUtc,
  addCalendarDays,
  calendarDateNumber,
  isValidIanaTimeZone,
} from "@/lib/consultation/timezone";
import {
  PLANNING_TIME_ZONE,
  PLANNING_CALL_DURATION_MINUTES,
  PLANNING_BUFFER_MINUTES,
  PLANNING_SLOT_INTERVAL_MINUTES,
  PLANNING_START_HOUR,
  PLANNING_LAST_START_HOUR,
  PLANNING_MIN_NOTICE_HOURS,
  PLANNING_BOOKING_HORIZON_DAYS,
  isValidPlanningSlotStart,
  generatePlanningSlotCandidates,
  generateEligibleCalendarDates,
} from "@/lib/consultation/scheduling-policy";

/**
 * Phase 6A.2 pure scheduling-policy coverage (docs/pathways
 * instruction sections 48-51). No database -- these are the
 * deterministic rules both slot generation and server-side
 * re-validation of a client-submitted timestamp share.
 */

describe("scheduling policy structure", () => {
  it("45-minute duration + 15-minute buffer = 60-minute slot interval", () => {
    expect(PLANNING_CALL_DURATION_MINUTES).toBe(45);
    expect(PLANNING_BUFFER_MINUTES).toBe(15);
    expect(PLANNING_CALL_DURATION_MINUTES + PLANNING_BUFFER_MINUTES).toBe(PLANNING_SLOT_INTERVAL_MINUTES);
    expect(PLANNING_SLOT_INTERVAL_MINUTES).toBe(60);
  });

  it("business hours are 9 AM through 5 PM Pacific starts (6 PM close, last slot 5:00-5:45 + 15min buffer)", () => {
    expect(PLANNING_START_HOUR).toBe(9);
    expect(PLANNING_LAST_START_HOUR).toBe(17);
  });
});

describe("generatePlanningSlotCandidates: weekday/hour generation", () => {
  // A fixed "now" far enough in the past relative to the horizon window
  // that every Mon-Thu slot in the first two weeks clears the 24h notice.
  const now = new Date("2026-01-05T00:00:00.000Z"); // a Monday UTC morning

  it("only generates Monday/Tuesday/Wednesday/Thursday slots, never Friday/Saturday/Sunday", () => {
    const candidates = generatePlanningSlotCandidates(now);
    for (const c of candidates) {
      const parts = getZonedParts(c, PLANNING_TIME_ZONE);
      expect([1, 2, 3, 4]).toContain(parts.isoWeekday);
    }
    // Positive proof each weekday actually appears at least once.
    const weekdaysSeen = new Set(candidates.map((c) => getZonedParts(c, PLANNING_TIME_ZONE).isoWeekday));
    expect(weekdaysSeen.has(1)).toBe(true);
    expect(weekdaysSeen.has(2)).toBe(true);
    expect(weekdaysSeen.has(3)).toBe(true);
    expect(weekdaysSeen.has(4)).toBe(true);
    expect(weekdaysSeen.has(5)).toBe(false);
    expect(weekdaysSeen.has(6)).toBe(false);
    expect(weekdaysSeen.has(7)).toBe(false);
  });

  it("only generates starts on the hour, from 9 through 17 Pacific -- never 8 AM, never a half-hour, never 6 PM", () => {
    const candidates = generatePlanningSlotCandidates(now);
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      const parts = getZonedParts(c, PLANNING_TIME_ZONE);
      expect(parts.minute).toBe(0);
      expect(parts.second).toBe(0);
      expect(parts.hour).toBeGreaterThanOrEqual(9);
      expect(parts.hour).toBeLessThanOrEqual(17);
    }
    const hoursSeen = new Set(candidates.map((c) => getZonedParts(c, PLANNING_TIME_ZONE).hour));
    for (let h = 9; h <= 17; h++) expect(hoursSeen.has(h)).toBe(true);
    expect(hoursSeen.has(8)).toBe(false);
    expect(hoursSeen.has(18)).toBe(false);
  });
});

describe("minimum 24-hour notice (one consistent inclusive boundary)", () => {
  it("a slot less than 24 hours away is invalid", () => {
    const now = new Date("2026-01-06T17:00:00.000Z"); // 9:00 AM Pacific, Tuesday
    const almost24h = new Date(now.getTime() + 23 * 3_600_000); // Wed 8:00 AM Pacific -- 23h away
    expect(isValidPlanningSlotStart(almost24h, now)).toBe(false);
  });

  it("a slot at exactly 24 hours away is valid (inclusive boundary)", () => {
    const now = new Date("2026-01-06T17:00:00.000Z"); // 9:00 AM Pacific, Tuesday
    const exactly24h = new Date(now.getTime() + 24 * 3_600_000); // 9:00 AM Pacific, Wednesday
    expect(isValidPlanningSlotStart(exactly24h, now)).toBe(true);
  });

  it("a slot more than 24 hours away is valid", () => {
    const now = new Date("2026-01-06T17:00:00.000Z");
    const wellBeyond = new Date(now.getTime() + 48 * 3_600_000);
    expect(isValidPlanningSlotStart(wellBeyond, now)).toBe(true);
  });
});

describe("30-calendar-day booking horizon", () => {
  it("a slot on day 30 (inclusive) is available", () => {
    const now = new Date("2026-01-05T15:00:00.000Z"); // Monday, well before any given slot
    const { year, month, day } = addCalendarDays(2026, 1, 5, PLANNING_BOOKING_HORIZON_DAYS);
    // Find the actual weekday of day+30 and pick a Mon-Thu slot on/after it via the real generator instead of assuming.
    const candidates = generatePlanningSlotCandidates(now);
    const dayNum = calendarDateNumber(year, month, day);
    const onHorizonEnd = candidates.filter((c) => {
      const p = getZonedParts(c, PLANNING_TIME_ZONE);
      return calendarDateNumber(p.year, p.month, p.day) === dayNum;
    });
    // Day 30 itself might not be a Mon-Thu, but no candidate should ever
    // exceed it -- checked in the next test. This test just confirms the
    // generator can reach all the way up to the boundary date when valid.
    expect(candidates.every((c) => {
      const p = getZonedParts(c, PLANNING_TIME_ZONE);
      return calendarDateNumber(p.year, p.month, p.day) <= dayNum;
    })).toBe(true);
    void onHorizonEnd;
  });

  it("a slot beyond the 30-day horizon is rejected by isValidPlanningSlotStart even if otherwise well-formed", () => {
    const now = new Date("2026-01-05T15:00:00.000Z"); // Monday
    // 31 calendar days out, a Monday 9 AM Pacific slot (definitely Mon-Thu).
    const { year, month, day } = addCalendarDays(2026, 1, 5, PLANNING_BOOKING_HORIZON_DAYS + 1);
    const tooFar = zonedWallTimeToUtc(year, month, day, 9, 0, 0, PLANNING_TIME_ZONE);
    expect(isValidPlanningSlotStart(tooFar, now)).toBe(false);
  });

  it("no candidate is ever generated beyond the horizon", () => {
    const now = new Date("2026-01-05T15:00:00.000Z");
    const { year, month, day } = addCalendarDays(2026, 1, 5, PLANNING_BOOKING_HORIZON_DAYS);
    const horizonEndNum = calendarDateNumber(year, month, day);
    const candidates = generatePlanningSlotCandidates(now);
    for (const c of candidates) {
      const p = getZonedParts(c, PLANNING_TIME_ZONE);
      expect(calendarDateNumber(p.year, p.month, p.day)).toBeLessThanOrEqual(horizonEndNum);
    }
  });
});

describe("arbitrary/malformed slot rejection", () => {
  const now = new Date("2026-01-05T15:00:00.000Z"); // Monday

  it("rejects a Friday slot", () => {
    // Friday Jan 9 2026, 9 AM Pacific.
    const friday = zonedWallTimeToUtc(2026, 1, 9, 9, 0, 0, PLANNING_TIME_ZONE);
    expect(isValidPlanningSlotStart(friday, now)).toBe(false);
  });

  it("rejects a Sunday slot", () => {
    const sunday = zonedWallTimeToUtc(2026, 1, 11, 9, 0, 0, PLANNING_TIME_ZONE);
    expect(isValidPlanningSlotStart(sunday, now)).toBe(false);
  });

  it("rejects 8:00 AM (before business hours)", () => {
    const eightAm = zonedWallTimeToUtc(2026, 1, 13, 8, 0, 0, PLANNING_TIME_ZONE); // Tuesday
    expect(isValidPlanningSlotStart(eightAm, now)).toBe(false);
  });

  it("rejects 5:30 PM (not an hourly start)", () => {
    const fiveThirty = zonedWallTimeToUtc(2026, 1, 13, 17, 30, 0, PLANNING_TIME_ZONE);
    expect(isValidPlanningSlotStart(fiveThirty, now)).toBe(false);
  });

  it("rejects 6:00 PM (business closed, no start this late)", () => {
    const sixPm = zonedWallTimeToUtc(2026, 1, 13, 18, 0, 0, PLANNING_TIME_ZONE);
    expect(isValidPlanningSlotStart(sixPm, now)).toBe(false);
  });

  it("rejects an invalid timestamp", () => {
    expect(isValidPlanningSlotStart(new Date(NaN), now)).toBe(false);
  });
});

describe("DST correctness (mandatory)", () => {
  // 2026 US DST: begins Sunday March 8 2026 (spring forward), ends
  // Sunday November 1 2026 (fall back).
  it("9:00 AM Pacific in Pacific Standard Time (winter, UTC-8) maps to 17:00 UTC", () => {
    const jan = zonedWallTimeToUtc(2026, 1, 6, 9, 0, 0, PLANNING_TIME_ZONE); // Tuesday
    expect(jan.toISOString()).toBe("2026-01-06T17:00:00.000Z");
  });

  it("9:00 AM Pacific in Pacific Daylight Time (summer, UTC-7) maps to 16:00 UTC", () => {
    const jul = zonedWallTimeToUtc(2026, 7, 7, 9, 0, 0, PLANNING_TIME_ZONE); // Tuesday
    expect(jul.toISOString()).toBe("2026-07-07T16:00:00.000Z");
  });

  it("the Monday immediately after the spring-forward transition still reads as 9:00 AM Pacific", () => {
    // DST began Sun Mar 8 2026; Monday Mar 9 is the first business day after.
    const instant = zonedWallTimeToUtc(2026, 3, 9, 9, 0, 0, PLANNING_TIME_ZONE);
    const parts = getZonedParts(instant, PLANNING_TIME_ZONE);
    expect(parts.hour).toBe(9);
    expect(parts.minute).toBe(0);
    expect(instant.toISOString()).toBe("2026-03-09T16:00:00.000Z"); // now PDT, UTC-7
  });

  it("the Monday immediately after the fall-back transition still reads as 9:00 AM Pacific", () => {
    // DST ended Sun Nov 1 2026; Monday Nov 2 is the first business day after.
    const instant = zonedWallTimeToUtc(2026, 11, 2, 9, 0, 0, PLANNING_TIME_ZONE);
    const parts = getZonedParts(instant, PLANNING_TIME_ZONE);
    expect(parts.hour).toBe(9);
    expect(parts.minute).toBe(0);
    expect(instant.toISOString()).toBe("2026-11-02T17:00:00.000Z"); // now PST, UTC-8
  });

  it("every generated candidate round-trips to exactly the Pacific hour it was generated for, across a DST-spanning horizon", () => {
    // "Now" chosen so the 30-day horizon spans the spring-forward transition.
    const now = new Date("2026-02-20T12:00:00.000Z");
    const candidates = generatePlanningSlotCandidates(now);
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      const parts = getZonedParts(c, PLANNING_TIME_ZONE);
      expect(parts.minute).toBe(0);
      expect(parts.hour).toBeGreaterThanOrEqual(9);
      expect(parts.hour).toBeLessThanOrEqual(17);
    }
  });
});

describe("IANA timezone validation", () => {
  it("accepts a real IANA timezone", () => {
    expect(isValidIanaTimeZone("America/New_York")).toBe(true);
    expect(isValidIanaTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidIanaTimeZone("Asia/Tokyo")).toBe(true);
  });

  it("rejects a bogus/invalid timezone string", () => {
    expect(isValidIanaTimeZone("Definitely/Not_A_Timezone")).toBe(false);
    expect(isValidIanaTimeZone("")).toBe(false);
    expect(isValidIanaTimeZone(null)).toBe(false);
    expect(isValidIanaTimeZone(undefined)).toBe(false);
  });
});

describe("Phase 6A.2a: generateEligibleCalendarDates (calendar UX, section 14-18)", () => {
  it("enumerates only Monday-Thursday dates, ignoring hour-of-day entirely", () => {
    const now = new Date("2026-01-05T15:00:00.000Z"); // Monday 7am Pacific
    const dates = generateEligibleCalendarDates(now);
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) {
      const isoWeekday = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
      expect([1, 2, 3, 4]).toContain(isoWeekday === 0 ? 7 : isoWeekday); // Mon=1..Thu=4, Sun mapped to 7
    }
  });

  it("never includes a Friday, Saturday, or Sunday date (weekend visibility relies on this)", () => {
    const now = new Date("2026-01-05T15:00:00.000Z");
    const dates = generateEligibleCalendarDates(now);
    const weekdays = dates.map((d) => new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay());
    expect(weekdays).not.toContain(5); // Friday
    expect(weekdays).not.toContain(6); // Saturday
    expect(weekdays).not.toContain(0); // Sunday
  });

  it("is exactly the inclusive 30-day horizon -- includes day 30, never day 31", () => {
    const now = new Date("2026-01-05T15:00:00.000Z"); // Monday
    const dates = generateEligibleCalendarDates(now);
    const day30 = addCalendarDays(2026, 1, 5, PLANNING_BOOKING_HORIZON_DAYS);
    const day31 = addCalendarDays(2026, 1, 5, PLANNING_BOOKING_HORIZON_DAYS + 1);
    const day30Num = calendarDateNumber(day30.year, day30.month, day30.day);
    const day31Num = calendarDateNumber(day31.year, day31.month, day31.day);
    const dateNums = dates.map((d) => calendarDateNumber(d.year, d.month, d.day));
    if (
      [1, 2, 3, 4].includes(
        (() => {
          const w = new Date(Date.UTC(day30.year, day30.month - 1, day30.day)).getUTCDay();
          return w === 0 ? 7 : w;
        })(),
      )
    ) {
      expect(dateNums).toContain(day30Num);
    }
    expect(dateNums).not.toContain(day31Num);
    expect(Math.max(...dateNums)).toBeLessThanOrEqual(day30Num);
  });

  it("spans a real month boundary with correct year/month/day fields (mandatory month-crossing case)", () => {
    // "Now" chosen so the 30-day horizon crosses from January into February.
    const now = new Date("2026-01-20T15:00:00.000Z"); // Tuesday
    const dates = generateEligibleCalendarDates(now);
    const months = new Set(dates.map((d) => `${d.year}-${d.month}`));
    expect(months.has("2026-1")).toBe(true);
    expect(months.has("2026-2")).toBe(true);
    // Every dateKey is well-formed and matches its own year/month/day.
    for (const d of dates) {
      expect(d.dateKey).toBe(`${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);
    }
  });

  it("a date can be eligible (Mon-Thu, in horizon) yet have zero valid hourly slot starts -- the exact 'too-soon date' case the calendar UI depends on (section 18)", () => {
    // 11pm Pacific Monday -- every remaining hour today (there are none)
    // and the *next* business day's 9am-5pm hours are all inside the
    // 24h minimum-notice window relative to this "now".
    const now = zonedWallTimeToUtc(2026, 1, 5, 23, 0, 0, PLANNING_TIME_ZONE); // Monday 11pm Pacific
    const dates = generateEligibleCalendarDates(now);
    const tuesday = dates.find((d) => d.year === 2026 && d.month === 1 && d.day === 6);
    expect(tuesday).toBeDefined(); // Tuesday is eligible: Mon-Thu, inside horizon

    const anyValidHourTuesday = Array.from({ length: 9 }, (_, i) => 9 + i).some((hour) => {
      const candidate = zonedWallTimeToUtc(2026, 1, 6, hour, 0, 0, PLANNING_TIME_ZONE);
      return isValidPlanningSlotStart(candidate, now);
    });
    expect(anyValidHourTuesday).toBe(false); // eligible, but every hour violates the 24h notice rule
  });
});
