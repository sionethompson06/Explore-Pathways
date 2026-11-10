"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { getPrincipal } from "@/server/principal";
import {
  savePlanningCallDraft,
  completePlanningCall,
  type PlanningCallContentInput,
  type PlanningCallAttendance,
  type PlanningCallOutcome,
} from "@/server/planning-call";

/**
 * Phase 6D advisor Planning Call Workspace actions. Plain
 * `<form action={...}>` submissions (no client JavaScript) -- the
 * mutation result is communicated back via a redirect query param, the
 * same convention app/admin/cases/[caseId]/actions.ts already
 * established. Authorization is re-checked fully inside
 * savePlanningCallDraft/completePlanningCall (active ADVISOR role AND
 * active assignment to this exact case, fresh from the database) --
 * this file never trusts anything about the caller beyond their
 * verified principal's userId.
 */

function getCaseIdOrNotFound(formData: FormData): string {
  const caseId = formData.get("pathwaysCaseId");
  if (typeof caseId !== "string" || caseId.length === 0) {
    redirect("/advisor/cases");
  }
  return caseId;
}

function readStringField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function readListField(formData: FormData, name: string): string[] | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  return value.split("\n");
}

function readCheckboxListField(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string");
}

const VALID_ATTENDANCE_VALUES: readonly string[] = ["ATTENDED", "NO_SHOW", "CANCELLED", "RESCHEDULE_NEEDED"];
const VALID_OUTCOME_VALUES: readonly string[] = [
  "CONTINUE_TO_BLUEPRINT",
  "NEEDS_INFORMATION",
  "FOLLOW_UP",
  "NOT_CURRENT_SERVICE_FIT",
  "FAMILY_NOT_PROCEEDING",
];
const VALID_SERVICE_FITS = ["GOOD_FIT", "POSSIBLE_FIT", "NOT_CURRENT_FIT", "UNDETERMINED"] as const;
function readServiceFit(formData: FormData): PlanningCallContentInput["serviceFit"] {
  const raw = readStringField(formData, "serviceFit");
  return (VALID_SERVICE_FITS as readonly string[]).includes(raw ?? "")
    ? (raw as PlanningCallContentInput["serviceFit"])
    : undefined;
}

function readContent(formData: FormData): PlanningCallContentInput {
  return {
    familyMainGoal: readStringField(formData, "familyMainGoal"),
    currentEducationalSituation: readStringField(formData, "currentEducationalSituation"),
    studentStrengths: readStringField(formData, "studentStrengths"),
    learningNeedsSupport: readStringField(formData, "learningNeedsSupport"),
    scheduleLifestyleRequirements: readStringField(formData, "scheduleLifestyleRequirements"),
    academicPlanningNotes: readStringField(formData, "academicPlanningNotes"),
    pathwaysDiscussed: readCheckboxListField(formData, "pathwaysDiscussed"),
    advisorAssessment: readStringField(formData, "advisorAssessment"),
    recommendedNextAction: readStringField(formData, "recommendedNextAction"),
    primaryGoalConfirmed: formData.get("primaryGoalConfirmed") === "on",
    currentModelConfirmed: formData.get("currentModelConfirmed") === "on",
    priorityQuestions: readListField(formData, "priorityQuestions"),
    verificationNeeded: readListField(formData, "verificationNeeded"),
    verifiedFacts: readListField(formData, "verifiedFacts"),
    serviceFit: readServiceFit(formData),
    followUpRequired: formData.get("followUpRequired") === "on",
  };
}

function readExpectedVersion(formData: FormData): number {
  const raw = formData.get("expectedVersion");
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function savePlanningCallDraftAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) {
    redirect(`/advisor/cases/${pathwaysCaseId}?error=NOT_AUTHORIZED`);
  }

  const result = await savePlanningCallDraft(db, {
    pathwaysCaseId,
    advisorUserId: principal.userId,
    expectedVersion: readExpectedVersion(formData),
    content: readContent(formData),
  });

  if (!result.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}?error=${result.reason}`);
  }
  redirect(`/advisor/cases/${pathwaysCaseId}?success=DRAFT_SAVED`);
}

export async function completePlanningCallAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) {
    redirect(`/advisor/cases/${pathwaysCaseId}?error=NOT_AUTHORIZED`);
  }

  const rawAttendance = readStringField(formData, "attendance");
  const rawOutcome = readStringField(formData, "outcome");
  const attendance = rawAttendance && VALID_ATTENDANCE_VALUES.includes(rawAttendance)
    ? (rawAttendance as PlanningCallAttendance)
    : undefined;
  const outcome = rawOutcome && VALID_OUTCOME_VALUES.includes(rawOutcome)
    ? (rawOutcome as PlanningCallOutcome)
    : undefined;
  if (!attendance) {
    redirect(`/advisor/cases/${pathwaysCaseId}?error=ATTENDANCE_REQUIRED`);
  }
  if (!outcome) {
    redirect(`/advisor/cases/${pathwaysCaseId}?error=OUTCOME_REQUIRED`);
  }

  const result = await completePlanningCall(db, {
    pathwaysCaseId,
    advisorUserId: principal.userId,
    expectedVersion: readExpectedVersion(formData),
    attendance,
    outcome,
    content: readContent(formData),
  });

  if (!result.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}?error=${result.reason}`);
  }
  redirect(`/advisor/cases/${pathwaysCaseId}?success=COMPLETED`);
}
