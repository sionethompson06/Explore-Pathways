import type { Question } from "@/lib/contracts/schemas";

/**
 * Shared types for the Discovery domain module (Phase 3). Framework
 * independent -- no Next.js, no React, no database import here. The
 * same types back the frontend flow, server validation, normalization
 * and tests, per Specification 02's "the same schema and branch
 * definitions must power frontend validation, server validation and
 * tests."
 */

export type { Question };

export type GradeBand = "ELEMENTARY" | "MIDDLE" | "HIGH_SCHOOL" | "UNDETERMINED";

/**
 * Every branch name this build implements, verbatim from the Phase 3
 * instruction and Specification 02's branch registry. `ALL` is not a
 * real predicate (every question tagged `ALL` is always active) but
 * is listed for completeness/documentation.
 */
export type BranchName =
  | "ALL"
  | "MULTIPLE_DISCOVERY_REASONS"
  | "PRIMARY_REASON_UNCLEAR"
  | "FLEXIBILITY_SOMEWHAT_OR_HIGHER"
  | "ATHLETICS_INTEREST"
  | "ATHLETICS_INTEREST_AND_MIDDLE_OR_HS"
  | "ATHLETICS_INTEREST_AND_MIDDLE_OR_HS_AND_COLLEGE_ATHLETICS_DEFINITELY_OR_POSSIBLY"
  | "GRADE_PLANNING_REASON_AND_MIDDLE_OR_HS"
  | "ADVANCEMENT_INTEREST_OR_REPORTED_AHEAD_OR_MIXED"
  | "HIGH_SCHOOL_OR_MIDDLE_WITH_ADVANCEMENT_INTEREST"
  | "HIGH_SCHOOL"
  | "HIGH_SCHOOL_AND_GRADUATION_OR_CREDIT_CONCERN"
  | "ELEMENTARY_AND_SUPPORT_PRIORITIES_NOT_ALREADY_KNOWN"
  /**
   * Phase 3E additions -- see docs/pathways/DISCOVERY_CALIBRATION_SPEC_V2.md.
   * HOME_OR_REMOTE_SUPPORT_CONTEXT replaces the retired
   * ELEMENTARY_OR_HOME_BASED_INTEREST_WITH_SUPPORT_NEED (which
   * incorrectly asked every elementary family about daytime home
   * supervision regardless of whether home/remote learning was even
   * being considered); SCHEDULE_CONSTRAINT_CONTEXT replaces the
   * retired FLEXIBILITY_VERY_OR_ESSENTIAL as DISC_032's own branch.
   */
  | "AGE_CONTEXT_USEFUL"
  | "HOME_OR_REMOTE_SUPPORT_CONTEXT"
  | "SCHEDULE_CONSTRAINT_CONTEXT";

/**
 * Raw answers exactly as the parent entered them, keyed by the
 * question-bank `field` name (never the DISC id -- ids are for
 * question identity/tracing, fields are the storage keys, matching
 * `contracts/question-bank.json`). A value may exist here for a
 * question that is no longer active (a "hidden" answer) -- that is
 * expected and must never be silently deleted from raw storage (it
 * only stops being *effective*; see Specification 02 "State and
 * validation").
 *
 * short_text -> string
 * single / single_from_previous -> string (one allowed_value, or "UNKNOWN")
 * multi -> string[] (allowed_values, possibly empty)
 * integer_or_unknown -> number | "UNKNOWN"
 * location -> { state: string; zip?: string }
 */
export type RawAnswerValue =
  | string
  | string[]
  | number
  | { state: string; zip?: string | undefined }
  | undefined;

export type RawAnswers = Record<string, RawAnswerValue>;

/**
 * Phase 3E normalized facts (docs/pathways/DISCOVERY_CALIBRATION_SPEC_V2.md
 * sections 4/6/8/10/11): deterministic, conservative tiers derived from
 * valid active evidence, never a public score and never Phase 4 scoring
 * output. UNKNOWN means the evidence needed to derive a real tier is not
 * yet active/answered -- it is not itself a tier of need/demand.
 */
export type SupportStructureNeed = "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
export type ScheduleFlexibilityNeed = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" | "UNKNOWN";
export type AthleticScheduleDemand = "LIGHT" | "MODERATE" | "SUBSTANTIAL" | "HIGHLY_CONSTRAINED" | "UNKNOWN";
export type FamilyManagementPreference =
  | "HIGH_FAMILY_INVOLVEMENT"
  | "SHARED_RESPONSIBILITY"
  | "LIGHT_FAMILY_MANAGEMENT"
  | "PROGRAM_LED"
  | "UNKNOWN";

/**
 * Independent interest flags derived from DISC_022 (advancement_interests,
 * already legacy-normalized) plus DISC_034 (subject_advancement_interests)
 * for subject_challenge. Deliberately NOT mutually exclusive -- a student
 * may have both a credit-recovery need (a separate field entirely) and
 * one or more advancement interests true at the same time.
 */
export interface AdvancementOpportunityFlags {
  subject_challenge: boolean;
  advanced_coursework: boolean;
  early_high_school_coursework: boolean;
  college_level_learning: boolean;
  research_projects: boolean;
  career_cte: boolean;
  work_based_learning: boolean;
  industry_credentials: boolean;
  entrepreneurship: boolean;
  accelerated_graduation: boolean;
}

/** Facts derived from raw + branch state, never consequential recommendation output (Phase 4 owns that). */
export interface DerivedFacts {
  grade_band: GradeBand;
  athletics_interest: boolean;
  homeschool_interest: boolean;
  home_or_online_interest: boolean;
  frequent_travel: boolean;
  foundation_concern: boolean;
  supplemental_need: boolean;
  /** Mirrors DISC_020A's effective value when active; NOT_APPLICABLE otherwise. */
  ncaa_interest: string;
  /** Phase 3E additions -- see the type docs above for each. */
  support_structure_need: SupportStructureNeed;
  schedule_flexibility_need: ScheduleFlexibilityNeed;
  athletic_schedule_demand: AthleticScheduleDemand;
  family_management_preference: FamilyManagementPreference;
  advancement_opportunities: AdvancementOpportunityFlags;
}

/**
 * The server-recomputed, submission-ready profile: only active
 * question fields (inactive/hidden fields are entirely absent, never
 * null) plus the `derived` facts block. This -- never `RawAnswers` --
 * is what a future recommendation engine, AI, report or export may
 * read (Specification 02: "raw answers ... never read by the engine
 * directly").
 */
export interface EffectiveAnswers {
  answers: Record<string, RawAnswerValue>;
  derived: DerivedFacts;
}

export interface FieldValidationError {
  /** The question-bank field name (e.g. "current_grade"), not the DISC id. */
  field: string;
  questionId: string;
  code:
    | "REQUIRED"
    | "INVALID_VALUE"
    | "TOO_MANY_SELECTIONS"
    | "TEXT_TOO_LONG"
    | "INVALID_SHAPE"
    | "NOT_ACTIVE"
    | "UNKNOWN_FIELD";
  message: string;
}

export interface DraftValidationResult {
  ok: boolean;
  errors: FieldValidationError[];
}

export interface CompletedProfileValidationResult {
  ok: boolean;
  errors: FieldValidationError[];
  effective?: EffectiveAnswers;
}

/** One parent-facing stage. Presentation grouping only -- never redefines a DISC id's meaning. */
export type StageId =
  | "STUDENT"
  | "GOALS"
  | "LEARNING"
  | "SCHEDULE"
  | "ATHLETICS"
  | "PLANNING"
  | "FAMILY"
  | "REVIEW";
