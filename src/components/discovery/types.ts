/**
 * Plain, JSON-serializable shapes passed from the Server Component
 * (app/discover/profile/page.tsx) down to the Client Component
 * (DiscoveryQuestionnaire). No `server-only` import anywhere in this
 * file, and nothing here imports contracts/registry/branching
 * directly -- those stay server-side; the client only ever receives
 * already-resolved, already-labeled data (Phase 3 instruction §48).
 */

export type QuestionInputType =
  | "short_text"
  | "single"
  | "multi"
  | "integer_or_unknown"
  | "location"
  | "single_from_previous";

export interface OptionDescriptor {
  value: string;
  label: string;
  /** Phase 3E: a short clarifying line shown under this specific option (e.g. DISC_031's STAY_CURRENT/OPEN_TO_CHANGE/SEEKING_CHANGE). */
  helper?: string;
}

export interface QuestionDescriptor {
  id: string;
  field: string;
  wording: string;
  inputType: QuestionInputType;
  required: boolean;
  options?: OptionDescriptor[];
  maxSelections?: number;
  textMaxLength?: number;
  /** For "location" only: the list of state/territory options. */
  locationStates?: OptionDescriptor[];
  /** Phase 3E: a short, reassuring line shown under the question wording, before its options. */
  helperText?: string;
}

export type AnswerValue =
  | string
  | string[]
  | number
  | { state: string; zip?: string | undefined }
  | undefined;

export interface StageProgressView {
  id: string;
  label: string;
  total: number;
  answered: number;
  complete: boolean;
}

export interface FieldErrorView {
  field: string;
  message: string;
}

/** One reviewable, answered question for the Review stage -- already labeled, already filtered to active/answered only. */
export interface ReviewItem {
  field: string;
  wording: string;
  valueLabel: string;
}

export interface ReviewSection {
  stageId: string;
  stageLabel: string;
  items: ReviewItem[];
}
