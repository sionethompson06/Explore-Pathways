"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { getZonedParts, isValidIanaTimeZone } from "@/lib/consultation/timezone";
import { PLANNING_TIME_ZONE, PLANNING_TIME_ZONE_LABEL, PLANNING_CALL_DURATION_MINUTES } from "@/lib/consultation/scheduling-policy";
import {
  confirmBookingAction,
  refreshAvailableSlotsAction,
  type ConfirmBookingActionResult,
} from "../../../app/discover/consultation/schedule/actions";
import buttonStyles from "@/components/marketing/Button.module.css";
import styles from "./BookingCalendarView.module.css";

interface DayGroup {
  dateKey: string;
  monthLabel: string;
  showMonthLabel: boolean;
  weekdayShort: string;
  dayNum: number;
  slots: string[];
}

function buildDayGroups(slotsIso: string[]): DayGroup[] {
  const byDate = new Map<string, string[]>();
  for (const iso of slotsIso) {
    const parts = getZonedParts(new Date(iso), PLANNING_TIME_ZONE);
    const key = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    const arr = byDate.get(key) ?? [];
    arr.push(iso);
    byDate.set(key, arr);
  }
  const keys = Array.from(byDate.keys()).sort();
  let lastMonth = "";
  return keys.map((key) => {
    const sortedSlots = [...byDate.get(key)!].sort();
    const sample = new Date(sortedSlots[0]!);
    const monthLabel = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: PLANNING_TIME_ZONE,
    }).format(sample);
    const showMonthLabel = monthLabel !== lastMonth;
    lastMonth = monthLabel;
    const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: PLANNING_TIME_ZONE }).format(
      sample,
    );
    const parts = getZonedParts(sample, PLANNING_TIME_ZONE);
    return { dateKey: key, monthLabel, showMonthLabel, weekdayShort, dayNum: parts.day, slots: sortedSlots };
  });
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
  preferredCallFormat,
  onConfirm = confirmBookingAction,
  onRefresh = refreshAvailableSlotsAction,
  onConfirmed,
}: {
  initialSlotsIso: string[];
  preferredCallFormat: "VIDEO" | "PHONE";
  /** Defaults to the real server action; a demo caller supplies a synthetic, DB-free stand-in instead. */
  onConfirm?: (selectedStartIso: string, bookerTimeZone: string | null) => Promise<ConfirmBookingActionResult>;
  /** Defaults to the real server action; a demo caller supplies a synthetic, DB-free stand-in instead. */
  onRefresh?: () => Promise<{ slotsIso: string[] }>;
  /** Called after a successful `onConfirm` that (unlike the real action) does not itself navigate away. */
  onConfirmed?: () => void;
}) {
  const [slotsIso, setSlotsIso] = useState(initialSlotsIso);
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

  const dayGroups = useMemo(() => buildDayGroups(slotsIso), [slotsIso]);
  const selectedDayGroup = dayGroups.find((g) => g.dateKey === selectedDateKey) ?? null;

  const showLocalTime = Boolean(browserTimeZone && browserTimeZone !== PLANNING_TIME_ZONE);

  async function handleSelectDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setSelectedSlotIso(null);
    setError(null);
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
          {dayGroups.length === 0 ? (
            <p className={styles.emptyState}>No times are currently available. Please check back soon.</p>
          ) : (
            <div className={styles.dayList}>
              {dayGroups.map((group) => (
                <div key={group.dateKey}>
                  {group.showMonthLabel ? <p className={styles.monthLabel}>{group.monthLabel}</p> : null}
                  <button
                    type="button"
                    className={styles.dayButton}
                    aria-pressed={selectedDateKey === group.dateKey}
                    onClick={() => handleSelectDate(group.dateKey)}
                  >
                    <span className={styles.dayWeekday}>{group.weekdayShort}</span>
                    <span className={styles.dayNumber}>{group.dayNum}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.timePanel}>
          <h2 className={styles.panelHeading}>Available Times</h2>
          {!selectedDayGroup ? (
            <p className={styles.emptyState}>Select a day to see available times.</p>
          ) : (
            <div className={styles.timeList}>
              {selectedDayGroup.slots.map((iso) => (
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
