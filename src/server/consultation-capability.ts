import "server-only";
import { env } from "@/env";
import type { ConsultationState } from "@/lib/report/types";

/**
 * Phase 6A single source of truth for "is real planning-call
 * scheduling actually available right now." Never LIVE_VERIFIED --
 * that state requires a verified provider integration (webhook/API
 * confirmation) not implemented in this phase; see env.ts's own
 * production-refuses-LIVE_VERIFIED guard, which this function does
 * not weaken or duplicate.
 *
 * REQUEST_ONLY requires BOTH SCHEDULER_MODE===REQUEST_ONLY AND a
 * valid, server-configured Google Appointment Schedule URL -- setting
 * only one of the two never activates scheduling. Every caller
 * (report route, /discover/consultation, /discover/consultation/schedule/go)
 * must go through this function rather than re-reading
 * process.env/SCHEDULER_MODE itself, so the activation rule lives in
 * exactly one place.
 */
export function getConsultationCapability(): {
  state: Exclude<ConsultationState, "LIVE_VERIFIED">;
  scheduleUrl: string | null;
} {
  if (env.SCHEDULER_MODE === "REQUEST_ONLY" && env.GOOGLE_APPOINTMENT_SCHEDULE_URL) {
    return { state: "REQUEST_ONLY", scheduleUrl: env.GOOGLE_APPOINTMENT_SCHEDULE_URL };
  }
  return { state: "UNCONFIGURED", scheduleUrl: null };
}
