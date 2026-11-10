import "server-only";
import { loadQuestionBank } from "@/lib/contracts/loader";
import type { Question } from "./types";

/**
 * The one place the canonical question bank is loaded for the
 * Discovery domain. Reuses the existing Phase 1 Zod-validated loader
 * (`src/lib/contracts/loader.ts`) rather than re-reading or
 * re-validating `contracts/question-bank.json` a second way -- per
 * the Phase 3 instruction "do not create a second question registry
 * inside React components," this file is the only place `.questions`
 * is iterated for UI/branching/validation purposes.
 */

const questionBank = loadQuestionBank();

export const QUESTION_BANK_VERSION = questionBank.version;
export const QUESTIONS: readonly Question[] = questionBank.questions;
export const GLOBAL_RULES: readonly string[] = questionBank.global_rules;

const byId = new Map<string, Question>(QUESTIONS.map((q) => [q.id, q]));
const byField = new Map<string, Question>(QUESTIONS.map((q) => [q.field, q]));

export function getQuestionById(id: string): Question | undefined {
  return byId.get(id);
}

export function getQuestionByField(field: string): Question | undefined {
  return byField.get(field);
}

export function requireQuestionById(id: string): Question {
  const question = byId.get(id);
  if (!question) {
    throw new Error(`Unknown canonical question id "${id}" -- not present in question-bank.json.`);
  }
  return question;
}

/**
 * Phase 3F: sidecar "Other" free-text field name -> its parent
 * Question, for the small set of questions broad enough to need one
 * (see `other_text_field` in schemas.ts). Not a second question
 * registry -- these field names are never in `QUESTIONS` themselves,
 * only declared on their parent's own record.
 */
const otherTextFieldToParent = new Map<string, Question>(
  QUESTIONS.filter((q) => q.other_text_field).map((q) => [q.other_text_field!, q]),
);

export function getParentQuestionForOtherTextField(field: string): Question | undefined {
  return otherTextFieldToParent.get(field);
}

export const OTHER_TEXT_FIELDS: ReadonlySet<string> = new Set(otherTextFieldToParent.keys());

/** Every field name the canonical registry defines, plus every declared "Other" sidecar field -- used to reject unknown fields at every validation boundary. */
export const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  ...QUESTIONS.map((q) => q.field),
  ...otherTextFieldToParent.keys(),
]);
