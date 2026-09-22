import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodType } from "zod";
import {
  questionBankSchema,
  taxonomySchema,
  rulesFileSchema,
  scoringPolicySchema,
  reportContractSchema,
  legacyAliasesSchema,
  contentLibrarySchema,
  type QuestionBank,
  type Taxonomy,
  type RulesFile,
  type ScoringPolicy,
  type ReportContract,
  type LegacyAliases,
  type ContentLibrary,
} from "./schemas";

/**
 * The single authoritative location for the canonical registries.
 * See docs/pathways/IMPLEMENTATION_CONTRACT.md section 5: this is the
 * only directory application code reads; docs/pathways/pack/contracts
 * is a historical archive, never imported.
 */
const CONTRACTS_DIR = join(process.cwd(), "contracts");
const FIXTURES_DIR = join(process.cwd(), "fixtures");

class ContractLoadError extends Error {
  constructor(fileName: string, cause: unknown) {
    const detail =
      cause instanceof Error ? cause.message : String(cause);
    super(
      `Failed to load or validate contract file "${fileName}": ${detail}`,
    );
    this.name = "ContractLoadError";
  }
}

function loadJson<T>(dir: string, fileName: string, schema: ZodType<T>): T {
  const path = join(dir, fileName);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (cause) {
    throw new ContractLoadError(fileName, cause);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new ContractLoadError(fileName, cause);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ContractLoadError(fileName, result.error);
  }
  return result.data;
}

export function loadQuestionBank(): QuestionBank {
  return loadJson(CONTRACTS_DIR, "question-bank.json", questionBankSchema);
}

export function loadTaxonomy(): Taxonomy {
  return loadJson(CONTRACTS_DIR, "taxonomy.json", taxonomySchema);
}

export function loadRules(): RulesFile {
  return loadJson(CONTRACTS_DIR, "rules.json", rulesFileSchema);
}

export function loadScoringPolicy(): ScoringPolicy {
  return loadJson(
    CONTRACTS_DIR,
    "scoring-policy.json",
    scoringPolicySchema,
  );
}

export function loadReportContract(): ReportContract {
  return loadJson(
    CONTRACTS_DIR,
    "report-contract.json",
    reportContractSchema,
  );
}

export function loadLegacyAliases(): LegacyAliases {
  return loadJson(
    CONTRACTS_DIR,
    "legacy-aliases.json",
    legacyAliasesSchema,
  );
}

export function loadContentLibrary(): ContentLibrary {
  return loadJson(
    CONTRACTS_DIR,
    "content-library.json",
    contentLibrarySchema,
  );
}

/** Fixture file paths are exposed, not auto-loaded, since only tests consume them. */
export const fixturePaths = {
  goldenProfiles: join(FIXTURES_DIR, "golden-profiles.json"),
  qaMatrix: join(FIXTURES_DIR, "QA_MATRIX.md"),
};

export interface LoadedContracts {
  questionBank: QuestionBank;
  taxonomy: Taxonomy;
  rules: RulesFile;
  scoringPolicy: ScoringPolicy;
  reportContract: ReportContract;
  legacyAliases: LegacyAliases;
  contentLibrary: ContentLibrary;
}

/**
 * Loads and schema-validates every canonical registry. Throws on any
 * missing file or shape violation -- there is no partial/fallback
 * load. Referential integrity (do IDs actually cross-reference
 * correctly) is a separate step; see validate.ts.
 */
export function loadContracts(): LoadedContracts {
  return {
    questionBank: loadQuestionBank(),
    taxonomy: loadTaxonomy(),
    rules: loadRules(),
    scoringPolicy: loadScoringPolicy(),
    reportContract: loadReportContract(),
    legacyAliases: loadLegacyAliases(),
    contentLibrary: loadContentLibrary(),
  };
}
