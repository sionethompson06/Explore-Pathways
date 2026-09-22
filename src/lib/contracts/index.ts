export {
  loadContracts,
  loadQuestionBank,
  loadTaxonomy,
  loadRules,
  loadScoringPolicy,
  loadReportContract,
  loadLegacyAliases,
  loadContentLibrary,
  fixturePaths,
  type LoadedContracts,
} from "./loader";

export { validateContracts, type ValidationResult, type ValidationIssue } from "./validate";

export type {
  QuestionBank,
  Question,
  Taxonomy,
  BaseModel,
  RulesFile,
  Rule,
  RuleCondition,
  ScoringPolicy,
  ReportContract,
  LegacyAliases,
  ContentLibrary,
} from "./schemas";

import { loadContracts } from "./loader";
import { validateContracts, type ValidationResult } from "./validate";
import type { LoadedContracts } from "./loader";

/**
 * Convenience entry point: load every contract and validate
 * referential integrity in one call. Throws if any file fails schema
 * validation (loadContracts' job); returns a ValidationResult
 * (ok: false with errors, never throws) if referential integrity
 * fails, since a caller may want to log/report rather than crash.
 */
export function loadAndValidateContracts(): {
  contracts: LoadedContracts;
  validation: ValidationResult;
} {
  const contracts = loadContracts();
  const validation = validateContracts(contracts);
  return { contracts, validation };
}
