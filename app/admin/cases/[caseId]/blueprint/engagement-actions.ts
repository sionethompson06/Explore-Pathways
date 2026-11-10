"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { getPrincipal } from "@/server/principal";
import {
  recordFamilyDecision,
  parseDollarsToCents,
  type FamilyDecision,
  type ServiceArrangement,
  type PaymentStructure,
} from "@/server/service-engagement";
import { sanitizeText } from "@/lib/discovery/validation";

/**
 * Phase 6F admin "Continue With Pathways" action. Identical shape to
 * the advisor route's own engagement-actions.ts, redirecting back to
 * the admin route instead. Section 15 is the first place in this
 * codebase an ADMIN gets a genuine write path (not merely read-only
 * operational visibility) -- authorization is still re-checked fully
 * inside recordFamilyDecision (an active ADMIN role AND an active
 * assignment to this exact case, the same boundary every other
 * case-scoped write in this codebase uses, no bypass).
 */

const VALID_FAMILY_DECISIONS: readonly string[] = [
  "CONTINUE_WITH_PATHWAYS",
  "BLUEPRINT_ONLY",
  "FOLLOW_UP_NEEDED",
  "NOT_PROCEEDING",
];
const VALID_SERVICE_ARRANGEMENTS: readonly string[] = ["ONGOING_PATHWAYS_CONSULTING", "CUSTOM_ENGAGEMENT"];
const VALID_PAYMENT_STRUCTURES: readonly string[] = ["ONE_TIME", "MONTHLY", "INSTALLMENTS", "CUSTOM", "WAIVED", "PENDING"];

function getCaseIdOrNotFound(formData: FormData): string {
  const caseId = formData.get("pathwaysCaseId");
  if (typeof caseId !== "string" || caseId.length === 0) {
    redirect("/admin/cases");
  }
  return caseId;
}

function readExpectedVersion(formData: FormData): number {
  const raw = formData.get("expectedVersion");
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(formData: FormData, name: string): string | undefined {
  const raw = formData.get(name);
  if (typeof raw !== "string") return undefined;
  const sanitized = sanitizeText(raw).trim();
  return sanitized.length > 0 ? sanitized : undefined;
}

function rawString(formData: FormData, name: string): string | undefined {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw : undefined;
}

export async function confirmServiceEngagementActionAdmin(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) redirect(`/admin/cases/${pathwaysCaseId}/blueprint?error=NOT_AUTHORIZED`);

  const rawDecision = formData.get("familyDecision");
  const familyDecision =
    typeof rawDecision === "string" && VALID_FAMILY_DECISIONS.includes(rawDecision) ? (rawDecision as FamilyDecision) : undefined;
  if (!familyDecision) {
    redirect(`/admin/cases/${pathwaysCaseId}/blueprint?error=FAMILY_DECISION_REQUIRED`);
  }

  const rawArrangement = formData.get("serviceArrangement");
  const serviceArrangement =
    typeof rawArrangement === "string" && VALID_SERVICE_ARRANGEMENTS.includes(rawArrangement)
      ? (rawArrangement as ServiceArrangement)
      : undefined;

  const rawPaymentStructure = formData.get("paymentStructure");
  const paymentStructure =
    typeof rawPaymentStructure === "string" && VALID_PAYMENT_STRUCTURES.includes(rawPaymentStructure)
      ? (rawPaymentStructure as PaymentStructure)
      : undefined;

  let agreedTotalAmountCents: number | undefined;
  let paymentAmountCents: number | undefined;
  let installmentCount: number | undefined;
  if (paymentStructure === "ONE_TIME") {
    agreedTotalAmountCents = parseDollarsToCents(rawString(formData, "oneTimeAmount"));
  } else if (paymentStructure === "MONTHLY") {
    paymentAmountCents = parseDollarsToCents(rawString(formData, "monthlyAmount"));
  } else if (paymentStructure === "INSTALLMENTS") {
    paymentAmountCents = parseDollarsToCents(rawString(formData, "installmentAmount"));
    const rawCount = formData.get("installmentCount");
    const parsedCount = typeof rawCount === "string" ? Number.parseInt(rawCount, 10) : NaN;
    installmentCount = Number.isFinite(parsedCount) ? parsedCount : undefined;
  }

  const result = await recordFamilyDecision(db, {
    pathwaysCaseId,
    actorUserId: principal.userId,
    expectedVersion: readExpectedVersion(formData),
    familyDecision,
    serviceArrangement,
    serviceArrangementDescription: text(formData, "serviceArrangementDescription"),
    paymentStructure,
    agreedTotalAmountCents,
    paymentAmountCents,
    installmentCount,
    firstPaymentDate: text(formData, "firstPaymentDate"),
    termsNote: text(formData, "termsNote"),
    paymentMethodNote: text(formData, "paymentMethodNote"),
    paymentHandledExternally: formData.get("paymentHandledExternally") === "on",
    followUpNote: text(formData, "followUpNote"),
    followUpDate: text(formData, "followUpDate"),
    notProceedingReason: text(formData, "notProceedingReason"),
  });

  if (!result.ok) {
    if (result.reason === "INVALID_CONTENT" && result.issues) {
      redirect(
        `/admin/cases/${pathwaysCaseId}/blueprint?error=${result.reason}&issues=${encodeURIComponent(result.issues.join("; "))}`,
      );
    }
    redirect(`/admin/cases/${pathwaysCaseId}/blueprint?error=${result.reason}`);
  }
  redirect(`/admin/cases/${pathwaysCaseId}/blueprint?success=ENGAGEMENT_CONFIRMED`);
}
