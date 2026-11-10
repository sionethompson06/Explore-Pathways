"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { getZonedParts, isValidIanaTimeZone, zonedWallTimeToUtc } from "@/lib/consultation/timezone";
import {
  PLANNING_TIME_ZONE,
  PLANNING_TIME_ZONE_LABEL,
  PLANNING_CALL_DURATION_MINUTES,
  generateEligibleCalendarDates,
} from "@/lib/consultation/scheduling-policy";
import {
  confirmBookingAction,
  refreshAvailableSlotsAction,
  type ConfirmBookingActionResult,
} from "../../../app/discover/consultation/schedule/actions";
import buttonStyles from "@/components/marketing/Button.module.css";
import styles from "./BookingCalendarView.module.css";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKeyOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function dateKeyFromIso(iso: string): string {
  const parts = getZonedParts(new Date(iso), PLANNING_TIME_ZONE);
  return dateKeyOf(parts.year, parts.month, parts.day);
}

interface YearMonth {
  year: number;
  month: number;
}

function monthKeyOf({ year, month }: YearMonth): string {
  return `${year}-${pad2(month)}`;
}

function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  let nextMonth = month + delta;
  let nextYear = year;
  if (nextMonth < 1) {
    nextMonth = 12;
    nextYear -= 1;
  } else if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
}

/** Noon Pacific on the given calendar date -- a safe representative instant for formatting labels, immune to the viewer's own browser timezone shifting the calendar date. */
function noonPacificInstant(year: number, month: number, day: number): Date {
  return zonedWallTimeToUtc(year, month, day, 12, 0, 0, PLANNING_TIME_ZONE);
}

function formatMonthLabel(ym: YearMonth): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: PLANNING_TIME_ZONE }).format(
    noonPacificInstant(ym.year, ym.month, 1),
  );
}

/** "Monday, October 5" -- the accessible name for a date button (section 11). */
function formatDateAccessibleLabel(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: PLANNING_TIME_ZONE,
  }).format(noonPacificInstant(year, month, day));
}

interface MonthCell {
  key: string;
  day: number | null;
  dateKey: string | null;
}

/** A 7-wide grid of cells for the given month -- leading/trailing blanks pad to full weeks (section 10). */
function buildMonthCells(ym: YearMonth): MonthCell[] {
  const firstWeekday = new Date(Date.UTC(ym.year, ym.month - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  const totalDays = new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();

  const cells: MonthCell[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ key: `lead-${i}`, day: null, dateKey: null });
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ key: dateKeyOf(ym.year, ym.month, day), day, dateKey: dateKeyOf(ym.year, ym.month, day) });
  }
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ key: `trail-${i}`, day: null, dateKey: null });
    }
  }
  return cells;
}

function formatTimeInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

function formatFullDateInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// Browser timezone never changes mid-session, so there is nothing to
// subscribe to -- this store only exists to read a client-only value
// (section 19-20) without a server/client hydration mismatch, which
// useEffect+setState cannot do without an extra render pass.
function subscribeToNothing() {
  return () => {};
}

function getBrowserTimeZoneSnapshot(): string | null {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidIanaTimeZone(detected) ? detected : null;
  } catch {
    return null;
  }
}

function getServerTimeZoneSnapshot(): string | null {
  return null;
}

export function BookingCalendarView({
  initialSlotsIso,
  windowStartIso,
  preferredCallFormat,
  onConfirm = confirmBookingAction,
  onRefresh = refreshAvailableSlotsAction,
  onConfirmed,
}: {
  initialSlotsIso: string[];
  /** The server's authoritative "now" reference (section 14) -- lets the calendar know the full eligible-date window independent of which individual slots still happen to be open. */
  windowStartIso: string;
  preferredCallFormat: "VIDEO" | "PHONE";
  /** Defaults to the real server action; a demo caller supplies a synthetic, DB-free stand-in instead. */
  onConfirm?: (selectedStartIso: string, bookerTimeZone: string | null) => Promise<ConfirmBookingActionResult>;
  /** Defaults to the real server action; a demo caller supplies a synthetic, DB-free stand-in instead. */
  onRefresh?: () => Promise<{ slotsIso: string[]; windowStartIso: string }>;
  /** Called after a successful `onConfirm` that (unlike the real action) does not itself navigate away. */
  onConfirmed?: () => void;
}) {
  const [slotsIso, setSlotsIso] = useState(initialSlotsIso);
  const [windowStart, setWindowStart] = useState(windowStartIso);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  // Server snapshot is always null (the server has no browser to ask),
  // so the first client render matches SSR exactly -- React then syncs
  // to the real client snapshot itself, no hydration mismatch (section
  // 19-20).
  const browserTimeZone = useSyncExternalStore(
    subscribeToNothing,
    getBrowserTimeZoneSnapshot,
    getServerTimeZoneSnapshot,
  );

  const eligibleDates = useMemo(() => generateEligibleCalendarDates(new Date(windowStart)), [windowStart]);
  const eligibleDateKeys = useMemo(() => new Set(eligibleDates.map((d) => d.dateKey)), [eligibleDates]);

  const initialVisibleMonth = useMemo<YearMonth>(() => {
    const parts = getZonedParts(new Date(windowStartIso), PLANNING_TIME_ZONE);
    return { year: parts.year, month: parts.month };
    // Only ever re-derive this from the ORIGINAL windowStartIso prop --
    // a mid-session refresh must never silently jump the parent back to
    // whatever month they started on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [visibleMonth, setVisibleMonth] = useState<YearMonth>(initialVisibleMonth);

  const sortedEligibleMonthKeys = useMemo(() => {
    const keys = new Set(eligibleDates.map((d) => monthKeyOf({ year: d.year, month: d.month })));
    return Array.from(keys).sort();
  }, [eligibleDates]);
  const fallbackMonthKey = monthKeyOf(initialVisibleMonth);
  const minMonthKey = sortedEligibleMonthKeys[0] ?? fallbackMonthKey;
  const maxMonthKey = sortedEligibleMonthKeys[sortedEligibleMonthKeys.length - 1] ?? fallbackMonthKey;
  const currentMonthKey = monthKeyOf(visibleMonth);
  const canGoPrev = currentMonthKey > minMonthKey;
  const canGoNext = currentMonthKey < maxMonthKey;

  const slotsByDateKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slotsIso) {
      const key = dateKeyFromIso(iso);
      const arr = map.get(key) ?? [];
      arr.push(iso);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort();
    return map;
  }, [slotsIso]);

  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const selectedDaySlots = selectedDateKey ? (slotsByDateKey.get(selectedDateKey) ?? []) : [];

  const showLocalTime = Boolean(browserTimeZone && browserTimeZone !== PLANNING_TIME_ZONE);

  function handleSelectDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setSelectedSlotIso(null);
    setError(null);
  }

  function handlePrevMonth() {
    if (canGoPrev) setVisibleMonth((ym) => shiftMonth(ym, -1));
  }

  function handleNextMonth() {
    if (canGoNext) setVisibleMonth((ym) => shiftMonth(ym, 1));
  }

  async function handleConfirm() {
    if (!selectedSlotIso) return;
    setIsPending(true);
    setError(null);
    try {
      const result = await onConfirm(selectedSlotIso, browserTimeZone);
      if (!result.ok) {
        if (result.code === "SLOT_TAKEN") {
          setError("That time was just reserved by another family. Please choose another available time.");
          setSelectedSlotIso(null);
          const refreshed = await onRefresh();
          setSlotsIso(refreshed.slotsIso);
          setWindowStart(refreshed.windowStartIso);
          // If the previously-selected date has no slots left at all
          // after the refresh, its calendar cell is now disabled --
          // clear the stale selection rather than leave a disabled date
          // showing as "selected" (section 20).
          const stillHasSlots = selectedDateKey
            ? refreshed.slotsIso.some((iso) => dateKeyFromIso(iso) === selectedDateKey)
            : false;
          if (!stillHasSlots) setSelectedDateKey(null);
        } else {
          setError("That time is no longer available. Please choose another time.");
          setSelectedSlotIso(null);
        }
        setIsPending(false);
      } else {
        // The real server action redirects on success and never reaches
        // here; a demo caller's synthetic onConfirm does return, so it
        // supplies onConfirmed to advance to its own fake-confirmation step.
        onConfirmed?.();
      }
    } catch {
      setError("That time is no longer available. Please choose another time.");
      setIsPending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.dayPanel}>
          <h2 className={styles.panelHeading}>Select a Day</h2>
          {eligibleDates.length === 0 ? (
            <p className={styles.emptyState}>No times are currently available. Please check back soon.</p>
          ) : (
            <div className={styles.calendar}>
              <div className={styles.monthNavRow}>
                <button
                  type="button"
                  className={styles.monthNavButton}
                  disabled={!canGoPrev}
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <p className={styles.monthLabel}>{formatMonthLabel(visibleMonth)}</p>
                <button
                  type="button"
                  className={styles.monthNavButton}
                  disabled={!canGoNext}
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className={styles.weekdayHeader} aria-hidden="true">
                {WEEKDAY_HEADERS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              <div className={styles.calendarGrid}>
                {monthCells.map((cell) => {
                  if (cell.day === null || cell.dateKey === null) {
                    return <div key={cell.key} className={styles.blankCell} aria-hidden="true" />;
                  }
                  const eligible = eligibleDateKeys.has(cell.dateKey);
                  const hasSlots = (slotsByDateKey.get(cell.dateKey)?.length ?? 0) > 0;
                  const selectable = eligible && hasSlots;
                  const [y, m, d] = cell.dateKey.split("-").map(Number) as [number, number, number];
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={styles.dateButton}
                      disabled={!selectable}
                      aria-pressed={selectedDateKey === cell.dateKey}
                      aria-label={formatDateAccessibleLabel(y, m, d)}
                      onClick={() => handleSelectDate(cell.dateKey!)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={styles.timePanel}>
          <h2 className={styles.panelHeading}>Available Times</h2>
          {!selectedDateKey ? (
            <p className={styles.emptyState}>Select a day to see available times.</p>
          ) : selectedDaySlots.length === 0 ? (
            <p className={styles.emptyState}>No times are currently available for that day.</p>
          ) : (
            <div className={styles.timeList}>
              {selectedDaySlots.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  className={styles.timeButton}
                  aria-pressed={selectedSlotIso === iso}
                  onClick={() => setSelectedSlotIso(iso)}
                  data-slot-iso={iso}
                >
                  {formatTimeInZone(iso, PLANNING_TIME_ZONE)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSlotIso ? (
        <div className={styles.summaryCard} role="status">
          <p className={styles.summaryTitle}>Pathways Planning Call</p>
          <p className={styles.summaryDate}>{formatFullDateInZone(selectedSlotIso, PLANNING_TIME_ZONE)}</p>
          {showLocalTime ? (
            <p className={styles.summaryTime}>
              {formatTimeInZone(selectedSlotIso, browserTimeZone!)} –{" "}
              {formatTimeInZone(addMinutesIso(selectedSlotIso, PLANNING_CALL_DURATION_MINUTES), browserTimeZone!)}{" "}
              your time
            </p>
          ) : null}
          <p className={styles.summaryTimeSecondary}>
            {formatTimeInZone(selectedSlotIso, PLANNING_TIME_ZONE)} –{" "}
            {formatTimeInZone(addMinutesIso(selectedSlotIso, PLANNING_CALL_DURATION_MINUTES), PLANNING_TIME_ZONE)}{" "}
            {PLANNING_TIME_ZONE_LABEL}
          </p>
          <p className={styles.summaryMeta}>
            {PLANNING_CALL_DURATION_MINUTES} minutes · {preferredCallFormat === "VIDEO" ? "Video" : "Phone"}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.confirmButton}`}
        disabled={!selectedSlotIso || isPending}
        onClick={handleConfirm}
      >
        {isPending ? "Confirming…" : "Confirm Planning Call"}
      </button>
    </div>
  );
}
