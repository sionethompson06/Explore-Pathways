import type { AnswerValue, QuestionDescriptor } from "./types";

export interface OtherTextGateFailure {
  field: string;
  message: string;
}

/**
 * Shared Continue-gate for the Phase 3F "Other" inline free-text
 * sidecar (Phase 3F.1 fix 2): both the real DiscoveryQuestionnaire and
 * the demo DiscoveryDemoQuestionnaire call this same function from
 * their own handleContinue, rather than each hand-rolling its own copy
 * of the same rule. It only ever looks at the questions actually
 * rendered on the current stage, matching what the parent already
 * passes to QuestionField.
 *
 * This blocks navigation off the current stage; it does not replace
 * validateCompletedProfile's own server-authoritative REQUIRED check
 * at final Review/Submit (contracts/../validation.ts), which stays in
 * place as the ultimate source of truth if this client gate is ever
 * bypassed (e.g. a direct ?stage= navigation).
 */
export function findBlockingOtherTextFields(
  questions: readonly QuestionDescriptor[],
  parentValue: (field: string) => AnswerValue,
  otherTextValue: (field: string) => string | undefined,
): OtherTextGateFailure[] {
  const failures: OtherTextGateFailure[] = [];
  for (const question of questions) {
    if (!question.otherTextField) continue;
    const value = parentValue(question.field);
    if (!Array.isArray(value) || !value.includes("OTHER")) continue;
    const text = otherTextValue(question.otherTextField);
    if (!text || text.trim().length === 0) {
      failures.push({
        field: question.otherTextField,
        message: `Please add a short description for "Other" under "${question.wording}".`,
      });
    }
  }
  return failures;
}
