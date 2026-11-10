import { z } from "zod";
import { loadTaxonomy } from "@/lib/contracts/loader";

/**
 * Phase 6E -- the Student Success Blueprint's structured content
 * contract (docs/pathways PHASE6E_BLUEPRINT_AUTHORING.md). A single,
 * version-tagged, strictly-validated JSON document stored on
 * `blueprintRevision.content` (jsonb). Every object schema is
 * `.strict()` (section 9 requirement 6: reject unknown/unapproved
 * structures); taxonomy-referencing fields are validated against the
 * EXISTING, unmodified `contracts/taxonomy.json` via `loadTaxonomy()`
 * -- never a free-form replacement model (sections 15, 18, 19).
 *
 * Stable section IDs (section 11) are literal discriminants on each
 * section object, independent of whatever UI heading text is shown --
 * a future PDF/AI/migration/analytics consumer reads `sectionId`,
 * never a translated label.
 */

export const CONTENT_SCHEMA_VERSION = "1.0.0";

export const PROVENANCE_VALUES = [
  "PARENT_REPORTED",
  "DISCOVERY_DERIVED",
  "ADVISOR_OBSERVATION",
  "VERIFIED",
  "RECOMMENDATION",
  "NEEDS_VERIFICATION",
] as const;
const provenanceSchema = z.enum(PROVENANCE_VALUES);
export type Provenance = (typeof PROVENANCE_VALUES)[number];

function knownTaxonomyIds(kind: "base_models" | "overlays" | "supports" | "opportunities"): Set<string> {
  const taxonomy = loadTaxonomy();
  return new Set(taxonomy[kind].map((entry) => entry.id));
}

const longText = z.string().max(4000);
const shortText = z.string().max(400);
const itemId = z.string().min(1).max(60);

// ---------------------------------------------------------------------------
// B01 -- Student Snapshot
// ---------------------------------------------------------------------------

export const b01Schema = z
  .object({
    sectionId: z.literal("B01_STUDENT_SNAPSHOT"),
    provenance: provenanceSchema.default("DISCOVERY_DERIVED"),
    studentDisplayName: shortText.optional(),
    grade: shortText.optional(),
    gradeBand: shortText.optional(),
    currentEducationalContext: longText.optional(),
    statedGoals: longText.optional(),
    strengthsInterests: longText.optional(),
    importantLearningContext: longText.optional(),
    scheduleLifestyleFactors: longText.optional(),
  })
  .strict();
export type B01StudentSnapshot = z.infer<typeof b01Schema>;

// ---------------------------------------------------------------------------
// B02 -- Family Goals & Priorities
// ---------------------------------------------------------------------------

export const b02Schema = z
  .object({
    sectionId: z.literal("B02_FAMILY_GOALS"),
    provenance: provenanceSchema.default("PARENT_REPORTED"),
    reasonForSeekingPathways: longText.optional(),
    confirmedPrimaryGoal: longText.optional(),
    majorPriorities: z.array(shortText).max(20).default([]),
    desiredChange: longText.optional(),
    nonNegotiables: z.array(shortText).max(20).default([]),
    longerTermAspirations: longText.optional(),
  })
  .strict();
export type B02FamilyGoals = z.infer<typeof b02Schema>;

// ---------------------------------------------------------------------------
// B03 -- Current Educational Situation
// ---------------------------------------------------------------------------

export const b03Schema = z
  .object({
    sectionId: z.literal("B03_CURRENT_EDUCATIONAL_SITUATION"),
    provenance: provenanceSchema.default("PARENT_REPORTED"),
    currentArrangement: longText.optional(),
    whatIsWorking: longText.optional(),
    whatFamilyWantsToChange: longText.optional(),
    academicConcerns: longText.optional(),
    supportContext: longText.optional(),
    operationalConstraints: longText.optional(),
    unresolvedFacts: z.array(shortText).max(20).default([]),
  })
  .strict();
export type B03CurrentSituation = z.infer<typeof b03Schema>;

// ---------------------------------------------------------------------------
// B04 -- Recommended Educational Strategy (core professional strategy)
// ---------------------------------------------------------------------------

export const b04Schema = z
  .object({
    sectionId: z.literal("B04_RECOMMENDED_EDUCATIONAL_STRATEGY"),
    provenance: provenanceSchema.default("RECOMMENDATION"),
    recommendedModelIds: z.array(z.string()).max(10).default([]),
    overlayIds: z.array(z.string()).max(10).default([]),
    supportApproach: longText.optional(),
    alignmentRationale: longText.optional(),
    tradeoffs: longText.optional(),
    risksConsiderations: longText.optional(),
    conditionsRequiringVerification: longText.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const knownModels = knownTaxonomyIds("base_models");
    for (const id of value.recommendedModelIds) {
      if (!knownModels.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown base_model id: ${id}`, path: ["recommendedModelIds"] });
      }
    }
    const knownOverlays = knownTaxonomyIds("overlays");
    for (const id of value.overlayIds) {
      if (!knownOverlays.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown overlay id: ${id}`, path: ["overlayIds"] });
      }
    }
  });
export type B04Strategy = z.infer<typeof b04Schema>;

// ---------------------------------------------------------------------------
// B05 -- Academic Planning
// ---------------------------------------------------------------------------

export const ACADEMIC_PLANNING_DOMAINS = [
  "FOUNDATIONAL_SUPPORT",
  "ACADEMIC_INTERVENTION",
  "ENRICHMENT",
  "PACING",
  "ACCELERATION_EXPLORATION",
  "SUBJECT_SPECIFIC_ADVANCEMENT",
  "GRADUATION_PLANNING",
  "CREDIT_REVIEW",
  "COLLEGE_PREPARATION",
  "DUAL_ENROLLMENT_EXPLORATION",
  "CTE_CAREER_EXPLORATION",
] as const;
const academicPlanningDomainSchema = z.enum(ACADEMIC_PLANNING_DOMAINS);

export const b05Schema = z
  .object({
    sectionId: z.literal("B05_ACADEMIC_PLANNING"),
    provenance: provenanceSchema.default("RECOMMENDATION"),
    domains: z.array(academicPlanningDomainSchema).max(11).default([]),
    narrative: longText.optional(),
  })
  .strict();
export type B05AcademicPlanning = z.infer<typeof b05Schema>;

// ---------------------------------------------------------------------------
// B06 -- Schedule & Lifestyle Plan
// ---------------------------------------------------------------------------

export const SCHEDULE_LIFESTYLE_FACTORS = [
  "ATHLETICS",
  "PERFORMING_ARTS",
  "TRAVEL",
  "EMPLOYMENT",
  "FAMILY_COMMITMENTS",
  "DESIRED_FLEXIBILITY",
  "SYNCHRONOUS_INSTRUCTION",
  "UNAVAILABLE_TIME_WINDOWS",
  "ADULT_AVAILABILITY",
  "SUPERVISION_NEEDS",
  "INDEPENDENT_LEARNING_ABILITY",
] as const;
const scheduleLifestyleFactorSchema = z.enum(SCHEDULE_LIFESTYLE_FACTORS);

export const b06Schema = z
  .object({
    sectionId: z.literal("B06_SCHEDULE_LIFESTYLE_PLAN"),
    provenance: provenanceSchema.default("PARENT_REPORTED"),
    considerations: z
      .array(
        z
          .object({ factor: scheduleLifestyleFactorSchema, notes: shortText.optional() })
          .strict(),
      )
      .max(11)
      .default([]),
    narrative: longText.optional(),
  })
  .strict();
export type B06SchedulePlan = z.infer<typeof b06Schema>;

// ---------------------------------------------------------------------------
// B07 -- Opportunities to Explore (references contracts/taxonomy.json's
// `opportunities` registry -- never a free-form replacement list)
// ---------------------------------------------------------------------------

export const OPPORTUNITY_HORIZONS = ["EXPLORE_NOW", "NEXT_REVIEW", "LONGER_TERM", "NOT_CURRENTLY_APPLICABLE"] as const;
const opportunityHorizonSchema = z.enum(OPPORTUNITY_HORIZONS);

const opportunityItemSchema = z
  .object({
    id: itemId,
    opportunityId: z.string(),
    horizon: opportunityHorizonSchema,
    notes: shortText.optional(),
  })
  .strict();

export const b07Schema = z
  .object({
    sectionId: z.literal("B07_OPPORTUNITIES_TO_EXPLORE"),
    items: z.array(opportunityItemSchema).max(30).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const known = knownTaxonomyIds("opportunities");
    value.items.forEach((item, i) => {
      if (!known.has(item.opportunityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown opportunity id: ${item.opportunityId}`,
          path: ["items", i, "opportunityId"],
        });
      }
    });
  });
export type B07Opportunities = z.infer<typeof b07Schema>;

// ---------------------------------------------------------------------------
// B08 -- Support Plan (references contracts/taxonomy.json's `supports`
// registry)
// ---------------------------------------------------------------------------

export const SUPPORT_FRAMINGS = ["RECOMMENDED", "POSSIBLE", "WORTH_EXPLORING"] as const;
const supportFramingSchema = z.enum(SUPPORT_FRAMINGS);

const supportItemSchema = z
  .object({
    id: itemId,
    supportId: z.string(),
    framing: supportFramingSchema,
    notes: shortText.optional(),
  })
  .strict();

export const b08Schema = z
  .object({
    sectionId: z.literal("B08_SUPPORT_PLAN"),
    items: z.array(supportItemSchema).max(30).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const known = knownTaxonomyIds("supports");
    value.items.forEach((item, i) => {
      if (!known.has(item.supportId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown support id: ${item.supportId}`,
          path: ["items", i, "supportId"],
        });
      }
    });
  });
export type B08SupportPlan = z.infer<typeof b08Schema>;

// ---------------------------------------------------------------------------
// B09 -- Verification Items (section 20: essential; never auto-VERIFIED)
// ---------------------------------------------------------------------------

export const VERIFICATION_CATEGORIES = [
  "TRANSCRIPT_REVIEW",
  "CREDITS",
  "GRADUATION_REQUIREMENTS",
  "SCHOOL_OF_RECORD_REQUIREMENTS",
  "PROVIDER_AVAILABILITY",
  "RESIDENCY",
  "ACCREDITATION",
  "NCAA_REQUIREMENTS",
  "COLLEGE_COURSE_ELIGIBILITY",
  "TUITION_COST",
  "INSTRUCTIONAL_SCHEDULE",
  "SUPPORT_AVAILABILITY",
  "COURSE_ACCEPTANCE",
  "ADMISSIONS",
  "OTHER",
] as const;
const verificationCategorySchema = z.enum(VERIFICATION_CATEGORIES);

export const VERIFICATION_STATUSES = ["OPEN", "IN_PROGRESS", "VERIFIED", "NOT_APPLICABLE"] as const;
const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);

const verificationItemSchema = z
  .object({
    id: itemId,
    category: verificationCategorySchema,
    question: shortText,
    status: verificationStatusSchema,
    owner: shortText.optional(),
    evidenceNote: shortText.optional(),
    verifiedAt: z.string().datetime().optional(),
    verifiedBy: shortText.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Section 40: VERIFIED must come from a deliberate verification
    // action, never a bare status flip -- require the evidence trail
    // that only a real verification action would have populated.
    if (value.status === "VERIFIED" && !value.verifiedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A VERIFIED item must carry a verifiedAt timestamp from a deliberate verification action",
        path: ["verifiedAt"],
      });
    }
  });

export const b09Schema = z
  .object({
    sectionId: z.literal("B09_VERIFICATION_ITEMS"),
    items: z.array(verificationItemSchema).max(40).default([]),
  })
  .strict();
export type B09VerificationItems = z.infer<typeof b09Schema>;
export type VerificationItem = z.infer<typeof verificationItemSchema>;

// ---------------------------------------------------------------------------
// B10 -- Action Plan
// ---------------------------------------------------------------------------

export const ACTION_OWNERS = ["FAMILY", "PATHWAYS", "ADVISOR", "SCHOOL_OF_RECORD", "PROVIDER", "OTHER"] as const;
const actionOwnerSchema = z.enum(ACTION_OWNERS);

export const ACTION_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"] as const;
const actionStatusSchema = z.enum(ACTION_STATUSES);

const actionItemSchema = z
  .object({
    id: itemId,
    text: shortText,
    owner: actionOwnerSchema,
    timing: shortText.optional(),
    status: actionStatusSchema,
    notes: shortText.optional(),
  })
  .strict();

export const b10Schema = z
  .object({
    sectionId: z.literal("B10_ACTION_PLAN"),
    items: z.array(actionItemSchema).max(40).default([]),
  })
  .strict();
export type B10ActionPlan = z.infer<typeof b10Schema>;
export type ActionItem = z.infer<typeof actionItemSchema>;

// ---------------------------------------------------------------------------
// B11 -- 30/60/90-Day Roadmap
// ---------------------------------------------------------------------------

const roadmapItemSchema = z
  .object({
    id: itemId,
    text: shortText,
    status: actionStatusSchema,
  })
  .strict();

export const b11Schema = z
  .object({
    sectionId: z.literal("B11_ROADMAP"),
    days0to30: z.array(roadmapItemSchema).max(20).default([]),
    days31to60: z.array(roadmapItemSchema).max(20).default([]),
    days61to90: z.array(roadmapItemSchema).max(20).default([]),
  })
  .strict();
export type B11Roadmap = z.infer<typeof b11Schema>;
export type RoadmapItem = z.infer<typeof roadmapItemSchema>;

// ---------------------------------------------------------------------------
// B12 -- Advisor Professional Summary
// ---------------------------------------------------------------------------

export const b12Schema = z
  .object({
    sectionId: z.literal("B12_ADVISOR_PROFESSIONAL_SUMMARY"),
    provenance: z.literal("RECOMMENDATION").default("RECOMMENDATION"),
    summary: longText.optional(),
  })
  .strict();
export type B12AdvisorSummary = z.infer<typeof b12Schema>;

// ---------------------------------------------------------------------------
// The full content document
// ---------------------------------------------------------------------------

export const blueprintContentSchema = z
  .object({
    schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
    b01: b01Schema,
    b02: b02Schema,
    b03: b03Schema,
    b04: b04Schema,
    b05: b05Schema,
    b06: b06Schema,
    b07: b07Schema,
    b08: b08Schema,
    b09: b09Schema,
    b10: b10Schema,
    b11: b11Schema,
    b12: b12Schema,
  })
  .strict();
export type BlueprintContent = z.infer<typeof blueprintContentSchema>;

/** The empty, schema-valid starting document for a brand-new revision. */
export function emptyBlueprintContent(): BlueprintContent {
  return blueprintContentSchema.parse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    b01: { sectionId: "B01_STUDENT_SNAPSHOT" },
    b02: { sectionId: "B02_FAMILY_GOALS" },
    b03: { sectionId: "B03_CURRENT_EDUCATIONAL_SITUATION" },
    b04: { sectionId: "B04_RECOMMENDED_EDUCATIONAL_STRATEGY" },
    b05: { sectionId: "B05_ACADEMIC_PLANNING" },
    b06: { sectionId: "B06_SCHEDULE_LIFESTYLE_PLAN" },
    b07: { sectionId: "B07_OPPORTUNITIES_TO_EXPLORE" },
    b08: { sectionId: "B08_SUPPORT_PLAN" },
    b09: { sectionId: "B09_VERIFICATION_ITEMS" },
    b10: { sectionId: "B10_ACTION_PLAN" },
    b11: { sectionId: "B11_ROADMAP" },
    b12: { sectionId: "B12_ADVISOR_PROFESSIONAL_SUMMARY" },
  });
}

/**
 * Validates an arbitrary value against the content contract. Throws
 * (via Zod) on any unknown key, invalid enum, or invalid taxonomy
 * reference -- there is no partial/lenient parse path. Called on every
 * write (section 9 requirement 3).
 */
export function parseBlueprintContent(value: unknown): BlueprintContent {
  return blueprintContentSchema.parse(value);
}

/**
 * Section 30: READY_FOR_CLIENT completeness gate. Deliberately does
 * NOT require every optional section to contain text -- only the five
 * sections the instruction names as required, each checked for
 * MEANINGFUL (non-whitespace) content, never merely "the key exists."
 */
export function completenessIssues(content: BlueprintContent): string[] {
  const issues: string[] = [];
  const hasText = (s: string | undefined) => Boolean(s && s.trim().length > 0);

  if (!hasText(content.b01.statedGoals) && !hasText(content.b01.currentEducationalContext)) {
    issues.push("B01 Student Snapshot needs at least stated goals or current educational context.");
  }
  if (!hasText(content.b02.confirmedPrimaryGoal)) {
    issues.push("B02 Family Goals & Priorities needs a confirmed primary goal.");
  }
  if (content.b04.recommendedModelIds.length === 0) {
    issues.push("B04 Recommended Educational Strategy needs at least one recommended pathway.");
  }
  if (!hasText(content.b04.alignmentRationale)) {
    issues.push("B04 Recommended Educational Strategy needs an alignment rationale.");
  }
  if (content.b10.items.length === 0) {
    issues.push("B10 Action Plan needs at least one action item.");
  }
  if (!hasText(content.b12.summary)) {
    issues.push("B12 Advisor Professional Summary needs a summary.");
  }
  return issues;
}

export function isContentComplete(content: BlueprintContent): boolean {
  return completenessIssues(content).length === 0;
}
