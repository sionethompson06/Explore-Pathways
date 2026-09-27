import "server-only";
import type { Database } from "@/db/client";
import { loadLatestCompletedRevision } from "./discovery-draft";
import { getConsultationCapability } from "./consultation-capability";
import { ensurePersistedDiscoveryOutcome } from "./report-persistence";
import { validateCompletedProfile } from "@/lib/discovery/validation";
import { loadContracts } from "@/lib/contracts/loader";
import { evaluateDiscoveryProfile } from "@/lib/engine/evaluate";
import { assembleDiscoveryReport } from "@/lib/report/assemble";
import { buildReportProfileContext } from "@/lib/report/profile-context";
import type { DiscoveryReportDTO } from "@/lib/report/types";

export interface ReportOutcome {
  revisionId: string;
  engineRunId: string;
  reportSnapshotId: string;
  report: DiscoveryReportDTO;
}

/**
 * The single place that recomputes the Phase 4 evaluation, assembles
 * the Phase 5 DTO, and idempotently persists the Phase 6A
 * EngineRun/ReportSnapshot pair for a session's latest completed
 * Discovery revision. Reused by both the production report route and
 * the consultation contact flow (docs/pathways instruction section 64:
 * "missing ReportSnapshot attempts safe server-side ensure/persist
 * from owned completed revision if possible") so there is exactly one
 * implementation of this pipeline, never two competing ones. Returns
 * null only when this session has no completed profile revision at
 * all -- callers decide the honest redirect/empty-state for that case
 * themselves, matching each route's own existing behavior.
 */
export async function ensureReportOutcomeForSession(
  db: Database,
  sessionId: string,
): Promise<ReportOutcome | null> {
  const revision = await loadLatestCompletedRevision(db, sessionId);
  if (!revision) return null;

  const validation = validateCompletedProfile(revision.rawAnswers);
  if (!validation.ok || !validation.effective) {
    // A stored completed revision should always still validate under the
    // current contracts; if it somehow doesn't (contract/version drift),
    // fail loudly rather than fabricate a generic recommendation.
    throw new Error("Stored completed Discovery profile no longer validates against the current contracts.");
  }

  const contracts = loadContracts();
  const evaluation = evaluateDiscoveryProfile(validation.effective, contracts);

  const profile = buildReportProfileContext({
    rawAnswers: revision.rawAnswers as Record<string, unknown>,
    profileRevisionId: revision.revisionId,
    gradeBand: evaluation.derivedFacts.grade_band,
  });

  const capability = getConsultationCapability();
  const report = assembleDiscoveryReport(
    {
      profile,
      engine: evaluation,
      operational: { consultationState: capability.state, saveAvailable: false },
    },
    contracts,
    revision.createdAt.toISOString(),
  );

  const persisted = await ensurePersistedDiscoveryOutcome(db, {
    profileRevisionId: revision.revisionId,
    evaluation,
    report,
  });

  return { revisionId: revision.revisionId, ...persisted, report };
}
