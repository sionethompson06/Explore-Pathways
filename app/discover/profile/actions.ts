"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FieldErrorView } from "@/components/discovery/types";

/**
 * Every action here resolves the acting session from the HttpOnly
 * cookie via a real database lookup (loadDraftByToken ->
 * getGuestSessionByToken) -- never from a client-supplied session id
 * or row id, per Specification 07 "raw IDs and random UUIDs are not
 * authorization." Returns null (never a distinguishing error) for a
 * missing or expired session, exactly like every other lookup in this
 * codebase.
 *
 * The database/session modules are imported dynamically inside each
 * function -- see app/discover/actions.ts's doc comment for why a
 * static top-level import here would make /discover/profile itself
 * fail to render (rather than just this action's own execution
 * failing, caught by app/discover/error.tsx) whenever the database is
 * misconfigured or unreachable.
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

export interface SaveAnswerActionResult {
  ok: boolean;
  errors: FieldErrorView[];
}

export async function saveAnswerAction(
  patch: Record<string, unknown>,
): Promise<SaveAnswerActionResult> {
  const sessionId = await resolveSessionId();
  if (!sessionId) {
    return {
      ok: false,
      errors: [{ field: "session", message: "Your Discovery session is no longer available." }],
    };
  }
  const [{ saveDraftPatch }, { db }] = await Promise.all([
    import("@/server/discovery-draft"),
    import("@/db/client"),
  ]);
  const result = await saveDraftPatch(db, sessionId, patch);
  return {
    ok: result.ok,
    errors: result.errors.map((e) => ({ field: e.field, message: e.message })),
  };
}

export interface SubmitProfileActionResult {
  ok: boolean;
  errors: FieldErrorView[];
}

export async function submitProfileAction(): Promise<SubmitProfileActionResult> {
  const sessionId = await resolveSessionId();
  if (!sessionId) {
    return {
      ok: false,
      errors: [{ field: "session", message: "Your Discovery session is no longer available." }],
    };
  }
  const [{ submitDiscoveryProfile }, { db }] = await Promise.all([
    import("@/server/discovery-draft"),
    import("@/db/client"),
  ]);
  const result = await submitDiscoveryProfile(db, sessionId);
  if (!result.ok) {
    return {
      ok: false,
      errors: (result.errors ?? []).map((e) => ({ field: e.field, message: e.message })),
    };
  }
  redirect("/discover/report");
}

export async function reopenForEditingAction(): Promise<void> {
  const sessionId = await resolveSessionId();
  if (sessionId) {
    const [{ reopenForEditing }, { db }] = await Promise.all([
      import("@/server/discovery-draft"),
      import("@/db/client"),
    ]);
    await reopenForEditing(db, sessionId);
  }
  redirect("/discover/profile?stage=REVIEW");
}
