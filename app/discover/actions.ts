"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mapMarketingInterestToHint } from "@/lib/discovery/marketing-hint";

/**
 * The one place Discovery is "started" (Phase 3 instruction §7): a
 * state-changing Server Action (never a bare GET), which creates or
 * resumes the guest session, sets the HttpOnly cookie, and redirects
 * to the questionnaire. The homepage/marketing `?interest=` value is
 * read here and converted to a canonical DISC_006 preselection hint
 * -- never trusted or written as if it were already a saved answer.
 *
 * The database/session modules are imported dynamically, inside this
 * function, rather than at module scope (Phase 3B/3C). Next.js
 * eagerly evaluates a page's entire static import graph -- including
 * a "use server" action module referenced by a form -- merely to
 * RENDER the page, before the action is ever invoked. Since
 * src/db/client.ts and src/server/session.ts both ultimately import
 * src/env.ts, which validates (and, per DEC-G7, can refuse to start)
 * at module-evaluation time, a static top-level import here would
 * make /discover itself fail to render whenever the database is
 * misconfigured or unreachable -- not just this action's own
 * execution, which is the only place that failure should actually
 * surface (and is already handled gracefully by app/discover/error.tsx).
 */
export async function startDiscoveryAction(formData: FormData): Promise<void> {
  const rawInterest = formData.get("interest");
  const interestHint = mapMarketingInterestToHint(
    typeof rawInterest === "string" ? rawInterest : undefined,
  );

  const [{ db }, { GUEST_SESSION_COOKIE_NAME, guestSessionCookieOptions }, { resumeOrStartDiscoverySession }] =
    await Promise.all([
      import("@/db/client"),
      import("@/server/session"),
      import("@/server/discovery-draft"),
    ]);

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;

  const { token, isNew } = await resumeOrStartDiscoverySession(db, existingToken, interestHint);
  if (isNew) {
    cookieStore.set(GUEST_SESSION_COOKIE_NAME, token, guestSessionCookieOptions());
  }

  redirect("/discover/profile");
}
