"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { getPrincipal } from "@/server/principal";
import { assignAdvisorToCase, unassignAdvisorFromCase } from "@/server/advisor-assignment";

/**
 * Phase 6C admin assignment actions (sections 7-9). Plain `<form
 * action={...}>` submissions (no client-side JavaScript, no
 * `useActionState`) -- the mutation result is communicated back via a
 * redirect query param the detail page reads and renders as an
 * accessible status/error message. Authorization is re-checked fully
 * inside assignAdvisorToCase/unassignAdvisorFromCase (ADMIN role,
 * fresh from the database) -- this file never trusts anything about
 * the caller beyond their verified principal's userId.
 */

function getCaseIdOrNotFound(formData: FormData): string {
  const caseId = formData.get("pathwaysCaseId");
  if (typeof caseId !== "string" || caseId.length === 0) {
    redirect("/admin/cases");
  }
  return caseId;
}

export async function assignAdvisorAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) {
    redirect(`/admin/cases/${pathwaysCaseId}?error=NOT_AUTHORIZED`);
  }

  const advisorUserId = String(formData.get("advisorUserId") ?? "");
  if (!advisorUserId) {
    redirect(`/admin/cases/${pathwaysCaseId}?error=NO_ADVISOR_SELECTED`);
  }

  const result = await assignAdvisorToCase(db, {
    pathwaysCaseId,
    advisorUserId,
    assignedByUserId: principal.userId,
  });

  if (!result.ok) {
    redirect(`/admin/cases/${pathwaysCaseId}?error=${result.reason}`);
  }

  revalidatePath(`/admin/cases/${pathwaysCaseId}`);
  revalidatePath("/admin/cases");
  redirect(`/admin/cases/${pathwaysCaseId}?success=${result.action}`);
}

export async function unassignAdvisorAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) {
    redirect(`/admin/cases/${pathwaysCaseId}?error=NOT_AUTHORIZED`);
  }

  const result = await unassignAdvisorFromCase(db, {
    pathwaysCaseId,
    actorUserId: principal.userId,
  });

  if (!result.ok) {
    redirect(`/admin/cases/${pathwaysCaseId}?error=${result.reason}`);
  }

  revalidatePath(`/admin/cases/${pathwaysCaseId}`);
  revalidatePath("/admin/cases");
  redirect(
    `/admin/cases/${pathwaysCaseId}?success=${result.unassigned ? "UNASSIGNED" : "ALREADY_UNASSIGNED"}`,
  );
}
