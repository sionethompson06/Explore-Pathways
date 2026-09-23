"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { GUEST_SESSION_COOKIE_NAME } from "@/server/session";
import {
  loadDraftByToken,
  reopenForEditing,
  saveDraftPatch,
  submitDiscoveryProfile,
} from "@/server/discovery-draft";
import type { FieldErrorView } from "@/components/discovery/types";

/**
 * Every action here resolves the acting session from the HttpOnly
 * cookie via a real database lookup (loadDraftByToken ->
 * getGuestSessionByToken) -- never from a client-supplied session id
 * or row id, per Specification 07 "raw IDs and random UUIDs are not
 * authorization." Returns null (never a distinguishing error) for a
 * missing or expired session, exactly like every other lookup in this
 * codebase.
 */
async function resolveSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
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
    await reopenForEditing(db, sessionId);
  }
  redirect("/discover/profile?stage=REVIEW");
}
