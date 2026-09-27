"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseConsultationContactForm } from "@/lib/consultation/validation";
import { DEFAULT_CALL_FORMAT } from "@/lib/consultation/constants";
import type { ConsultationContactActionState } from "@/lib/consultation/action-state";

/**
 * Phase 6A contact-form submission (docs/pathways instruction sections
 * 20-27). The database/session/domain modules are imported
 * dynamically inside the action for the same reason
 * app/discover/actions.ts documents: a static top-level import would
 * make the whole /discover/consultation subtree fail to render
 * whenever the database is misconfigured or unreachable, rather than
 * just this action's own execution failing.
 *
 * This file exports only this one async function -- a `"use server"`
 * file may export other plain values, but importing one of those from
 * a Client Component silently yields `undefined` at runtime; the
 * shared state type/initial value live in
 * src/lib/consultation/action-state.ts instead (see its doc comment).
 */
export async function submitConsultationContactAction(
  _prevState: ConsultationContactActionState,
  formData: FormData,
): Promise<ConsultationContactActionState> {
  const values = {
    guardianName: String(formData.get("guardianName") ?? ""),
    email: String(formData.get("email") ?? ""),
    mobilePhone: String(formData.get("mobilePhone") ?? ""),
    preferredCallFormat: String(formData.get("preferredCallFormat") ?? DEFAULT_CALL_FORMAT),
  };

  const parsed = parseConsultationContactForm(formData);
  if (!parsed.ok) {
    const errors: ConsultationContactActionState["errors"] = {};
    for (const e of parsed.errors) errors[e.field] = e.message;
    return { errors, values };
  }

  const [{ GUEST_SESSION_COOKIE_NAME }, { loadDraftByToken }, { db }, { submitConsultationContact }] =
    await Promise.all([
      import("@/server/session"),
      import("@/server/discovery-draft"),
      import("@/db/client"),
      import("@/server/consultation"),
    ]);

  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/discover");

  const draft = await loadDraftByToken(db, token);
  if (!draft) redirect("/discover");

  const result = await submitConsultationContact(db, draft.sessionId, parsed.data);
  if (!result.ok) {
    if (result.reason === "NO_COMPLETED_PROFILE") redirect("/discover/profile");
    redirect("/discover");
  }

  redirect("/discover/consultation/schedule");
}
