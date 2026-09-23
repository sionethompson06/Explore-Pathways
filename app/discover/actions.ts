"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { GUEST_SESSION_COOKIE_NAME, guestSessionCookieOptions } from "@/server/session";
import { mapMarketingInterestToHint, resumeOrStartDiscoverySession } from "@/server/discovery-draft";

/**
 * The one place Discovery is "started" (Phase 3 instruction §7): a
 * state-changing Server Action (never a bare GET), which creates or
 * resumes the guest session, sets the HttpOnly cookie, and redirects
 * to the questionnaire. The homepage/marketing `?interest=` value is
 * read here and converted to a canonical DISC_006 preselection hint
 * -- never trusted or written as if it were already a saved answer.
 */
export async function startDiscoveryAction(formData: FormData): Promise<void> {
  const rawInterest = formData.get("interest");
  const interestHint = mapMarketingInterestToHint(
    typeof rawInterest === "string" ? rawInterest : undefined,
  );

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;

  const { token, isNew } = await resumeOrStartDiscoverySession(db, existingToken, interestHint);
  if (isNew) {
    cookieStore.set(GUEST_SESSION_COOKIE_NAME, token, guestSessionCookieOptions());
  }

  redirect("/discover/profile");
}
