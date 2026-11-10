"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { getPrincipal } from "@/server/principal";
import {
  createOrOpenBlueprint,
  saveBlueprintDraft,
  moveBlueprintToInternalReview,
  markBlueprintReadyForClient,
  createNewBlueprintRevision,
  getCurrentBlueprintRevision,
  listBlueprintBaseModelOptions,
  listBlueprintOverlayOptions,
  listBlueprintSupportOptions,
  listBlueprintOpportunityOptions,
  type BlueprintRevisionReason,
} from "@/server/blueprint";
import { generateId } from "@/server/ids";
import { sanitizeText } from "@/lib/discovery/validation";
import {
  CONTENT_SCHEMA_VERSION,
  PROVENANCE_VALUES,
  ACADEMIC_PLANNING_DOMAINS,
  SCHEDULE_LIFESTYLE_FACTORS,
  OPPORTUNITY_HORIZONS,
  SUPPORT_FRAMINGS,
  VERIFICATION_CATEGORIES,
  VERIFICATION_STATUSES,
  ACTION_OWNERS,
  ACTION_STATUSES,
  type BlueprintContent,
  type Provenance,
  type VerificationItem,
} from "@/lib/blueprint/content-schema";

/**
 * Phase 6E advisor Blueprint workspace actions. Plain
 * `<form action={...}>` submissions (no client JavaScript), mirroring
 * app/advisor/cases/[caseId]/actions.ts's own convention exactly.
 * Authorization is re-checked fully inside every src/server/blueprint.ts
 * function (active ADVISOR role AND active assignment to this exact
 * case, fresh from the database) -- this file never trusts anything
 * about the caller beyond their verified principal's userId/email.
 */

function getCaseIdOrNotFound(formData: FormData): string {
  const caseId = formData.get("pathwaysCaseId");
  if (typeof caseId !== "string" || caseId.length === 0) {
    redirect("/advisor/cases");
  }
  return caseId;
}

function getRevisionIdOrNotFound(formData: FormData, pathwaysCaseId: string): string {
  const revisionId = formData.get("revisionId");
  if (typeof revisionId !== "string" || revisionId.length === 0) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=REVISION_NOT_FOUND`);
  }
  return revisionId;
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

function lines(formData: FormData, name: string): string[] {
  const raw = formData.get(name);
  if (typeof raw !== "string") return [];
  return raw
    .split("\n")
    .map((v) => sanitizeText(v).trim())
    .filter((v) => v.length > 0);
}

function readProvenance(formData: FormData, name: string, fallback: Provenance): Provenance {
  const raw = formData.get(name);
  return typeof raw === "string" && (PROVENANCE_VALUES as readonly string[]).includes(raw) ? (raw as Provenance) : fallback;
}

function checkboxValuesAgainst(formData: FormData, name: string, known: ReadonlySet<string>): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string" && known.has(v));
}

function checkboxValuesFrom<T extends string>(formData: FormData, name: string, allowed: readonly T[]): T[] {
  const allowedSet = new Set<string>(allowed);
  return formData.getAll(name).filter((v): v is T => typeof v === "string" && allowedSet.has(v));
}

function buildVerificationItems(formData: FormData, existingItems: readonly VerificationItem[], verifiedByEmail: string): VerificationItem[] {
  const ids = formData.getAll("b09Id");
  const categories = formData.getAll("b09Category");
  const questions = formData.getAll("b09Question");
  const statuses = formData.getAll("b09Status");
  const owners = formData.getAll("b09Owner");
  const evidenceNotes = formData.getAll("b09EvidenceNote");

  const items: VerificationItem[] = [];
  for (let i = 0; i < questions.length; i++) {
    const questionRaw = questions[i];
    const question = typeof questionRaw === "string" ? sanitizeText(questionRaw).trim() : "";
    if (question.length === 0) continue;

    const existingIdRaw = ids[i];
    const existingId = typeof existingIdRaw === "string" && existingIdRaw.length > 0 ? existingIdRaw : undefined;
    const id = existingId ?? generateId("v");

    const categoryRaw = categories[i];
    const category =
      typeof categoryRaw === "string" && (VERIFICATION_CATEGORIES as readonly string[]).includes(categoryRaw)
        ? (categoryRaw as (typeof VERIFICATION_CATEGORIES)[number])
        : "OTHER";
    const statusRaw = statuses[i];
    const status =
      typeof statusRaw === "string" && (VERIFICATION_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof VERIFICATION_STATUSES)[number])
        : "OPEN";
    const ownerRaw = owners[i];
    const owner = typeof ownerRaw === "string" ? sanitizeText(ownerRaw).trim() || undefined : undefined;
    const evidenceNoteRaw = evidenceNotes[i];
    const evidenceNote = typeof evidenceNoteRaw === "string" ? sanitizeText(evidenceNoteRaw).trim() || undefined : undefined;

    let verifiedAt: string | undefined;
    let verifiedBy: string | undefined;
    if (status === "VERIFIED") {
      const existing = existingId ? existingItems.find((e) => e.id === existingId) : undefined;
      if (existing?.status === "VERIFIED" && existing.verifiedAt) {
        // Already verified, unchanged -- preserve the original deliberate verification's stamp, never bump it on an unrelated save.
        verifiedAt = existing.verifiedAt;
        verifiedBy = existing.verifiedBy;
      } else {
        // A genuinely new transition into VERIFIED -- stamp it now, from the authenticated advisor, never from client input.
        verifiedAt = new Date().toISOString();
        verifiedBy = verifiedByEmail;
      }
    }

    items.push({ id, category, question, status, owner, evidenceNote, verifiedAt, verifiedBy });
  }
  return items;
}

function readContent(formData: FormData, existing: BlueprintContent, advisorEmail: string): BlueprintContent {
  const baseModelIds = new Set(listBlueprintBaseModelOptions().map((o) => o.id));
  const overlayIds = new Set(listBlueprintOverlayOptions().map((o) => o.id));

  const considerations = SCHEDULE_LIFESTYLE_FACTORS.flatMap((factor) => {
    if (formData.get(`b06Factor_${factor}`) !== "on") return [];
    return [{ factor, notes: text(formData, `b06Notes_${factor}`) }];
  });

  const opportunityItems = listBlueprintOpportunityOptions().flatMap((opt) => {
    const horizonRaw = formData.get(`b07Horizon_${opt.id}`);
    if (typeof horizonRaw !== "string" || horizonRaw.length === 0) return [];
    if (!(OPPORTUNITY_HORIZONS as readonly string[]).includes(horizonRaw)) return [];
    return [
      {
        id: `op_${opt.id}`,
        opportunityId: opt.id,
        horizon: horizonRaw as (typeof OPPORTUNITY_HORIZONS)[number],
        notes: text(formData, `b07Notes_${opt.id}`),
      },
    ];
  });

  const supportItems = listBlueprintSupportOptions().flatMap((opt) => {
    const framingRaw = formData.get(`b08Framing_${opt.id}`);
    if (typeof framingRaw !== "string" || framingRaw.length === 0) return [];
    if (!(SUPPORT_FRAMINGS as readonly string[]).includes(framingRaw)) return [];
    return [
      {
        id: `sp_${opt.id}`,
        supportId: opt.id,
        framing: framingRaw as (typeof SUPPORT_FRAMINGS)[number],
        notes: text(formData, `b08Notes_${opt.id}`),
      },
    ];
  });

  const b10Texts = formData.getAll("b10Text");
  const b10Owners = formData.getAll("b10Owner");
  const b10Timings = formData.getAll("b10Timing");
  const b10Statuses = formData.getAll("b10Status");
  const b10Notes = formData.getAll("b10Notes");
  const actionItems = b10Texts.flatMap((raw, i) => {
    const t = typeof raw === "string" ? sanitizeText(raw).trim() : "";
    if (t.length === 0) return [];
    const ownerRaw = b10Owners[i];
    const owner = typeof ownerRaw === "string" && (ACTION_OWNERS as readonly string[]).includes(ownerRaw) ? (ownerRaw as (typeof ACTION_OWNERS)[number]) : "ADVISOR";
    const statusRaw = b10Statuses[i];
    const status = typeof statusRaw === "string" && (ACTION_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as (typeof ACTION_STATUSES)[number]) : "NOT_STARTED";
    const timingRaw = b10Timings[i];
    const timing = typeof timingRaw === "string" ? sanitizeText(timingRaw).trim() || undefined : undefined;
    const notesRaw = b10Notes[i];
    const notes = typeof notesRaw === "string" ? sanitizeText(notesRaw).trim() || undefined : undefined;
    return [{ id: `a${i + 1}`, text: t, owner, timing, status, notes }];
  });

  function readRoadmapBucket(prefix: string) {
    const texts = formData.getAll(`${prefix}Text`);
    const statuses = formData.getAll(`${prefix}Status`);
    return texts.flatMap((raw, i) => {
      const t = typeof raw === "string" ? sanitizeText(raw).trim() : "";
      if (t.length === 0) return [];
      const statusRaw = statuses[i];
      const status = typeof statusRaw === "string" && (ACTION_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as (typeof ACTION_STATUSES)[number]) : "NOT_STARTED";
      return [{ id: `${prefix}${i + 1}`, text: t, status }];
    });
  }

  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    b01: {
      sectionId: "B01_STUDENT_SNAPSHOT",
      provenance: readProvenance(formData, "b01Provenance", "DISCOVERY_DERIVED"),
      studentDisplayName: text(formData, "b01StudentDisplayName"),
      grade: text(formData, "b01Grade"),
      gradeBand: text(formData, "b01GradeBand"),
      currentEducationalContext: text(formData, "b01CurrentEducationalContext"),
      statedGoals: text(formData, "b01StatedGoals"),
      strengthsInterests: text(formData, "b01StrengthsInterests"),
      importantLearningContext: text(formData, "b01ImportantLearningContext"),
      scheduleLifestyleFactors: text(formData, "b01ScheduleLifestyleFactors"),
    },
    b02: {
      sectionId: "B02_FAMILY_GOALS",
      provenance: readProvenance(formData, "b02Provenance", "PARENT_REPORTED"),
      reasonForSeekingPathways: text(formData, "b02ReasonForSeekingPathways"),
      confirmedPrimaryGoal: text(formData, "b02ConfirmedPrimaryGoal"),
      majorPriorities: lines(formData, "b02MajorPriorities"),
      desiredChange: text(formData, "b02DesiredChange"),
      nonNegotiables: lines(formData, "b02NonNegotiables"),
      longerTermAspirations: text(formData, "b02LongerTermAspirations"),
    },
    b03: {
      sectionId: "B03_CURRENT_EDUCATIONAL_SITUATION",
      provenance: readProvenance(formData, "b03Provenance", "PARENT_REPORTED"),
      currentArrangement: text(formData, "b03CurrentArrangement"),
      whatIsWorking: text(formData, "b03WhatIsWorking"),
      whatFamilyWantsToChange: text(formData, "b03WhatFamilyWantsToChange"),
      academicConcerns: text(formData, "b03AcademicConcerns"),
      supportContext: text(formData, "b03SupportContext"),
      operationalConstraints: text(formData, "b03OperationalConstraints"),
      unresolvedFacts: lines(formData, "b03UnresolvedFacts"),
    },
    b04: {
      sectionId: "B04_RECOMMENDED_EDUCATIONAL_STRATEGY",
      provenance: readProvenance(formData, "b04Provenance", "RECOMMENDATION"),
      recommendedModelIds: checkboxValuesAgainst(formData, "b04RecommendedModelIds", baseModelIds),
      overlayIds: checkboxValuesAgainst(formData, "b04OverlayIds", overlayIds),
      supportApproach: text(formData, "b04SupportApproach"),
      alignmentRationale: text(formData, "b04AlignmentRationale"),
      tradeoffs: text(formData, "b04Tradeoffs"),
      risksConsiderations: text(formData, "b04RisksConsiderations"),
      conditionsRequiringVerification: text(formData, "b04ConditionsRequiringVerification"),
    },
    b05: {
      sectionId: "B05_ACADEMIC_PLANNING",
      provenance: readProvenance(formData, "b05Provenance", "RECOMMENDATION"),
      domains: checkboxValuesFrom(formData, "b05Domains", ACADEMIC_PLANNING_DOMAINS),
      narrative: text(formData, "b05Narrative"),
    },
    b06: {
      sectionId: "B06_SCHEDULE_LIFESTYLE_PLAN",
      provenance: readProvenance(formData, "b06Provenance", "PARENT_REPORTED"),
      considerations,
      narrative: text(formData, "b06Narrative"),
    },
    b07: { sectionId: "B07_OPPORTUNITIES_TO_EXPLORE", items: opportunityItems },
    b08: { sectionId: "B08_SUPPORT_PLAN", items: supportItems },
    b09: { sectionId: "B09_VERIFICATION_ITEMS", items: buildVerificationItems(formData, existing.b09.items, advisorEmail) },
    b10: { sectionId: "B10_ACTION_PLAN", items: actionItems },
    b11: {
      sectionId: "B11_ROADMAP",
      days0to30: readRoadmapBucket("b11_0_"),
      days31to60: readRoadmapBucket("b11_1_"),
      days61to90: readRoadmapBucket("b11_2_"),
    },
    b12: {
      sectionId: "B12_ADVISOR_PROFESSIONAL_SUMMARY",
      provenance: "RECOMMENDATION",
      summary: text(formData, "b12Summary"),
    },
  };
}

export async function createOrOpenBlueprintAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=NOT_AUTHORIZED`);

  const result = await createOrOpenBlueprint(db, { pathwaysCaseId, advisorUserId: principal.userId });
  if (!result.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=${result.reason}`);
  }
  redirect(`/advisor/cases/${pathwaysCaseId}/blueprint`);
}

async function loadExistingContentOrNotFound(pathwaysCaseId: string): Promise<BlueprintContent> {
  const current = await getCurrentBlueprintRevision(db, pathwaysCaseId);
  if (!current) redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=REVISION_NOT_FOUND`);
  return current.content;
}

export async function saveBlueprintDraftAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const revisionId = getRevisionIdOrNotFound(formData, pathwaysCaseId);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=NOT_AUTHORIZED`);

  const existing = await loadExistingContentOrNotFound(pathwaysCaseId);
  const content = readContent(formData, existing, principal.email);

  const result = await saveBlueprintDraft(db, {
    pathwaysCaseId,
    revisionId,
    advisorUserId: principal.userId,
    expectedVersion: readExpectedVersion(formData),
    content,
  });
  if (!result.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=${result.reason}`);
  }
  redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?success=DRAFT_SAVED`);
}

export async function moveBlueprintToInternalReviewAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const revisionId = getRevisionIdOrNotFound(formData, pathwaysCaseId);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=NOT_AUTHORIZED`);

  const existing = await loadExistingContentOrNotFound(pathwaysCaseId);
  const content = readContent(formData, existing, principal.email);

  const saveResult = await saveBlueprintDraft(db, {
    pathwaysCaseId,
    revisionId,
    advisorUserId: principal.userId,
    expectedVersion: readExpectedVersion(formData),
    content,
  });
  if (!saveResult.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=${saveResult.reason}`);
  }

  const result = await moveBlueprintToInternalReview(db, { pathwaysCaseId, revisionId, advisorUserId: principal.userId });
  if (!result.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=${result.reason}`);
  }
  redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?success=MOVED_TO_REVIEW`);
}

export async function markBlueprintReadyForClientAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const revisionId = getRevisionIdOrNotFound(formData, pathwaysCaseId);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=NOT_AUTHORIZED`);

  const existing = await loadExistingContentOrNotFound(pathwaysCaseId);
  const content = readContent(formData, existing, principal.email);

  const saveResult = await saveBlueprintDraft(db, {
    pathwaysCaseId,
    revisionId,
    advisorUserId: principal.userId,
    expectedVersion: readExpectedVersion(formData),
    content,
  });
  if (!saveResult.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=${saveResult.reason}`);
  }

  const result = await markBlueprintReadyForClient(db, { pathwaysCaseId, revisionId, advisorUserId: principal.userId });
  if (!result.ok) {
    if (result.reason === "INCOMPLETE") {
      redirect(
        `/advisor/cases/${pathwaysCaseId}/blueprint?error=INCOMPLETE&issues=${encodeURIComponent((result.issues ?? []).join("; "))}`,
      );
    }
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=${result.reason}`);
  }
  redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?success=READY_FOR_CLIENT`);
}

const VALID_REVISION_REASONS: readonly string[] = ["FAMILY_UPDATE", "NEW_VERIFICATION", "EDUCATIONAL_PLAN_CHANGE", "CORRECTION", "OTHER"];

export async function createNewBlueprintRevisionAction(formData: FormData): Promise<void> {
  const pathwaysCaseId = getCaseIdOrNotFound(formData);
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=NOT_AUTHORIZED`);

  const rawReason = formData.get("revisionReason");
  const revisionReason =
    typeof rawReason === "string" && VALID_REVISION_REASONS.includes(rawReason) ? (rawReason as BlueprintRevisionReason) : undefined;
  if (!revisionReason) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=REASON_REQUIRED`);
  }

  const revisionReasonOther = text(formData, "revisionReasonOther");
  const result = await createNewBlueprintRevision(db, {
    pathwaysCaseId,
    advisorUserId: principal.userId,
    revisionReason,
    ...(revisionReasonOther !== undefined ? { revisionReasonOther } : {}),
  });
  if (!result.ok) {
    redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?error=${result.reason}`);
  }
  redirect(`/advisor/cases/${pathwaysCaseId}/blueprint?success=NEW_REVISION_CREATED`);
}
