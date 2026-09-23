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

/** Every field name the canonical registry defines -- used to reject unknown fields at every validation boundary. */
export const KNOWN_FIELDS: ReadonlySet<string> = new Set(QUESTIONS.map((q) => q.field));
