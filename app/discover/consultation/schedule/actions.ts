"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Phase 6A.2 native booking server actions. Both resolve the acting
 * session from the HttpOnly cookie -- never from a client-supplied
 * consultation/booking id (docs/pathways instruction section 27/32).
 * Database/session modules are imported dynamically for the same
 * reason app/discover/actions.ts documents.
 */

async function resolveSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const [{ GUEST_SESSION_COOKIE_NAME }, { loadDraftByToken }, { db }] = await Promise.all([
    import("@/server/session"),
    import("@/server/discovery-draft"),
    import("@/db/client"),
  ]);
  const token = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const draft = await loadDraftByToken(db, token);
  return draft?.sessionId ?? null;
}

export interface RefreshSlotsActionResult {
  slotsIso: string[];
  windowStartIso: string;
}

/** Re-fetches genuinely available slots -- used after a SLOT_TAKEN conflict to refresh the calendar without a full page reload. */
export async function refreshAvailableSlotsAction(): Promise<RefreshSlotsActionResult> {
  const fallback = { slotsIso: [], windowStartIso: new Date().toISOString() };
  const sessionId = await resolveSessionId();
  if (!sessionId) return fallback;

  const [{ getAvailableSlotsForSession }, { db }] = await Promise.all([
    import("@/server/booking"),
    import("@/db/client"),
  ]);
  const result = await getAvailableSlotsForSession(db, sessionId);
  if (!result.ok || result.alreadyBooked) return fallback;
  return { slotsIso: result.slots.map((s) => s.toISOString()), windowStartIso: result.windowStartIso };
}

export type ConfirmBookingActionResult =
  | { ok: true }
  | { ok: false; code: "SLOT_TAKEN" | "INVALID_SLOT" | "UNAVAILABLE" };

/**
 * Confirms the parent's selected slot (section 27/29). Never accepts a
 * student/consultation/report/booking id from the browser -- only the
 * candidate start timestamp and an optional display-only browser
 * timezone, both re-validated entirely server-side.
 */
export async function confirmBookingAction(
  selectedStartIso: string,
  bookerTimeZone: string | null,
): Promise<ConfirmBookingActionResult> {
  const sessionId = await resolveSessionId();
  if (!sessionId) redirect("/discover");

  const [{ createInternalBooking }, { db }] = await Promise.all([
    import("@/server/booking"),
    import("@/db/client"),
  ]);
  const result = await createInternalBooking(db, sessionId, { selectedStartIso, bookerTimeZone });

  if (!result.ok) {
    if (result.reason === "SLOT_TAKEN") return { ok: false, code: "SLOT_TAKEN" };
    if (result.reason === "INVALID_SLOT") return { ok: false, code: "INVALID_SLOT" };
    return { ok: false, code: "UNAVAILABLE" };
  }

  redirect("/discover/consultation/confirmed");
}
