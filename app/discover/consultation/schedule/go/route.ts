import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Phase 6A Google scheduler handoff (docs/pathways instruction section
 * 30). Resolves the session from the HttpOnly cookie, verifies
 * SCHEDULER_MODE/capability and a real server-configured Google URL,
 * transitions REQUESTED -> PENDING_VERIFICATION, appends the
 * WorkflowEvent, and redirects to that server-configured URL only.
 * Never reads or honors any redirect target from a query string, form
 * field, header, or client script -- the destination always comes
 * from getConsultationCapability(), never from this request.
 */
export async function GET() {
  const [{ GUEST_SESSION_COOKIE_NAME }, { loadDraftByToken }, { db }, { handOffToGoogleScheduler }] =
    await Promise.all([
      import("@/server/session"),
      import("@/server/discovery-draft"),
      import("@/db/client"),
      import("@/server/consultation"),
    ]);

  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/discover");
  }

  const draft = await loadDraftByToken(db, token);
  if (!draft) {
    redirect("/discover");
  }

  const result = await handOffToGoogleScheduler(db, draft.sessionId);
  if (!result.ok) {
    if (result.reason === "SCHEDULING_UNAVAILABLE") {
      redirect("/discover/report");
    }
    redirect("/discover/consultation");
  }

  redirect(result.scheduleUrl);
}
