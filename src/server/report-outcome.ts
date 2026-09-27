import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { reportSnapshot } from "@/db/schema";
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
 * Discovery revision. Called unconditionally by the production report
 * route on every render (it always shows the current, freshest
 * outcome). The consultation flow instead calls this only as a
 * fallback, via resolveReportOutcomeForConsultation below, when no
 * ReportSnapshot has been persisted for the revision yet at all
 * (docs/pathways instruction section 64: "missing ReportSnapshot
 * attempts safe server-side ensure/persist from owned completed
 * revision if possible") -- so there is exactly one implementation of
 * this pipeline, never two competing ones. Returns null only when this
 * session has no completed profile revision at all -- callers decide
 * the honest redirect/empty-state for that case themselves, matching
 * each route's own existing behavior.
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

/**
 * Phase 6A.1: looks up the most recently persisted ReportSnapshot
 * already associated with this exact ProfileRevision, without
 * recomputing or re-persisting anything. Never accepts a
 * browser-supplied snapshot/revision id -- `profileRevisionId` here is
 * always one already resolved server-side from the guest session
 * (see resolveReportOutcomeForConsultation below). Returns null when
 * no snapshot has ever been persisted for this revision yet.
 */
export async function getLatestPersistedReportSnapshotForRevision(
  db: Database,
  profileRevisionId: string,
): Promise<ReportOutcome | null> {
  const [snapshot] = await db
    .select()
    .from(reportSnapshot)
    .where(eq(reportSnapshot.profileRevisionId, profileRevisionId))
    .orderBy(desc(reportSnapshot.createdAt))
    .limit(1);
  if (!snapshot) return null;

  return {
    revisionId: profileRevisionId,
    engineRunId: snapshot.engineRunId,
    reportSnapshotId: snapshot.id,
    report: snapshot.publicContent as DiscoveryReportDTO,
  };
}

/**
 * The Phase 6A.1 conversion-source resolution rule: the consultation
 * flow (contact page display and contact submission alike) must
 * reference the report the parent actually already saw, not silently
 * recompute a possibly-different one. Resolves this session's own
 * latest completed revision, prefers an already-persisted
 * ReportSnapshot for it (the strongest server-side evidence of what
 * was actually displayed by the report route), and only falls back to
 * the full evaluate/assemble/persist pipeline when no snapshot exists
 * yet at all (e.g. a parent who navigated straight to
 * /discover/consultation without visiting /discover/report first).
 * Never duplicates report-assembly logic -- the fallback delegates
 * entirely to the existing ensureReportOutcomeForSession.
 */
export async function resolveReportOutcomeForConsultation(
  db: Database,
  sessionId: string,
): Promise<ReportOutcome | null> {
  const revision = await loadLatestCompletedRevision(db, sessionId);
  if (!revision) return null;

  const existing = await getLatestPersistedReportSnapshotForRevision(db, revision.revisionId);
  if (existing) return existing;

  return ensureReportOutcomeForSession(db, sessionId);
}
