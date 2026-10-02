import "server-only";
import { env } from "@/env";
import type { ConsultationState } from "@/lib/report/types";

/**
 * Phase 6A.2 refactor (docs/pathways instruction sections 6-7): the
 * single source of truth for "is real planning-call scheduling
 * actually available right now," now distinguishing WHICH provider
 * without leaking that distinction into the frozen Phase 5 report
 * contract. `state` is exactly the public `ConsultationState` the
 * report route/CTA resolver already understand (never LIVE_VERIFIED --
 * that requires a verified provider integration not implemented in
 * any phase so far; see env.ts's own production-refusal guard, which
 * this function does not weaken or duplicate). `provider` is a
 * separate, internal-only detail: which concrete scheduling mechanism
 * backs that state, consulted only by the consultation/booking server
 * code (never by the report assembler).
 *
 * - SCHEDULER_MODE=INTERNAL -> REQUEST_ONLY / INTERNAL / no URL.
 *   Pathways' own native booking calendar; no Google URL is read or
 *   required.
 * - SCHEDULER_MODE=REQUEST_ONLY + a valid GOOGLE_APPOINTMENT_SCHEDULE_URL
 *   -> REQUEST_ONLY / GOOGLE_EXTERNAL / that URL. The Phase 6A dormant
 *   legacy external-handoff path, preserved but not preferred.
 * - Anything else -> UNCONFIGURED / NONE / no URL.
 */
export type SchedulerProvider = "INTERNAL" | "GOOGLE_EXTERNAL" | "NONE";

export interface ConsultationCapability {
  state: Exclude<ConsultationState, "LIVE_VERIFIED">;
  provider: SchedulerProvider;
  scheduleUrl: string | null;
}

export function getConsultationCapability(): ConsultationCapability {
  if (env.SCHEDULER_MODE === "INTERNAL") {
    return { state: "REQUEST_ONLY", provider: "INTERNAL", scheduleUrl: null };
  }
  if (env.SCHEDULER_MODE === "REQUEST_ONLY" && env.GOOGLE_APPOINTMENT_SCHEDULE_URL) {
    return {
      state: "REQUEST_ONLY",
      provider: "GOOGLE_EXTERNAL",
      scheduleUrl: env.GOOGLE_APPOINTMENT_SCHEDULE_URL,
    };
  }
  return { state: "UNCONFIGURED", provider: "NONE", scheduleUrl: null };
}
