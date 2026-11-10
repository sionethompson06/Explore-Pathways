import "server-only";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { engineRun, reportSnapshot } from "@/db/schema";
import { generateId } from "./ids";
import { isUniqueConstraintConflict } from "./db-conflict";
import { canonicalStringify, sha256Hex } from "@/lib/engine/hash";
import type { EngineEvaluation } from "@/lib/engine/types";
import type { DiscoveryReportDTO } from "@/lib/report/types";

/**
 * Phase 6A report-outcome persistence (docs/pathways instruction
 * sections 7-10). The production `/discover/report` route currently
 * recomputes the Phase 4 evaluation and the Phase 5 DTO on every
 * request but never saves either -- this closes that gap with the
 * exact idempotency pattern already proven in
 * src/server/discovery-draft.ts's submitDiscoveryProfile: a nested
 * transaction (SAVEPOINT) around the insert, a 23505-conflict catch
 * scoped to the specific unique index, and a re-select of the
 * already-existing row inside the same outer transaction -- never a
 * plain SELECT-then-INSERT, which would leave a check-then-act race
 * under concurrent/retried requests.
 *
 * ReportSnapshot is immutable historical evidence: this function never
 * UPDATEs an existing row. `publicContent` is set to exactly the
 * assembled DiscoveryReportDTO passed in -- the same object rendered
 * to the parent -- so no staff note, raw answer, or contact
 * information can ever end up here by construction (assembleDiscoveryReport
 * only ever produces the public DTO shape; this module does not
 * enrich it).
 */

const ENGINE_RUN_IDEMPOTENCY_CONSTRAINT = "engine_run_idempotency_unique_idx";
const REPORT_SNAPSHOT_IDEMPOTENCY_CONSTRAINT = "report_snapshot_idempotency_unique_idx";

export interface PersistedDiscoveryOutcome {
  engineRunId: string;
  reportSnapshotId: string;
}

export interface EnsurePersistedDiscoveryOutcomeParams {
  /** The completed ProfileRevision this evaluation/report were computed from. */
  profileRevisionId: string;
  /** The already-final Phase 4 evaluation -- never recomputed here. */
  evaluation: EngineEvaluation;
  /** The already-assembled Phase 5 public DTO -- persisted verbatim as ReportSnapshot.publicContent. */
  report: DiscoveryReportDTO;
}

/**
 * Idempotently persists this profile revision's engine run + report
 * snapshot, reusing an existing immutable pair when one already exists
 * under the same revision + contract versions + deterministic content
 * hash, rather than accumulating a duplicate on every report refresh.
 * A genuinely different content hash under the same revision (e.g. the
 * consultation capability changed from UNCONFIGURED to REQUEST_ONLY
 * between two requests) legitimately creates a new immutable snapshot
 * rather than mutating the old one.
 */
export async function ensurePersistedDiscoveryOutcome(
  db: Database,
  params: EnsurePersistedDiscoveryOutcomeParams,
): Promise<PersistedDiscoveryOutcome> {
  const { profileRevisionId, evaluation, report } = params;

  return db.transaction(async (tx) => {
    let engineRunId: string;
    const candidateRunId = generateId("erun");
    try {
      await tx.transaction(async (tx2) => {
        await tx2.insert(engineRun).values({
          id: candidateRunId,
          profileRevisionId,
          effectiveProfileHash: evaluation.effectiveProfileHash,
          triggeredRuleIds: evaluation.triggeredRuleIds,
          positiveGroupsByModel: evaluation.positiveGroupsByModel,
          scopedReviewSignals: evaluation.scopedReviewSignals,
          contributions: evaluation.contributions,
          internalSortScoreByModel: evaluation.internalSortScoreByModel,
          excludedCandidates: evaluation.excludedCandidates,
          displayGateReasons: evaluation.displayGateReasons,
          rulesVersion: evaluation.rulesVersion,
          taxonomyVersion: evaluation.taxonomyVersion,
          scoringPolicyVersion: evaluation.scoringPolicyVersion,
          contentVersion: evaluation.contentVersion,
        });
      });
      engineRunId = candidateRunId;
    } catch (err) {
      if (!isUniqueConstraintConflict(err, ENGINE_RUN_IDEMPOTENCY_CONSTRAINT)) throw err;
      const [existing] = await tx
        .select({ id: engineRun.id })
        .from(engineRun)
        .where(
          and(
            eq(engineRun.profileRevisionId, profileRevisionId),
            eq(engineRun.rulesVersion, evaluation.rulesVersion),
            eq(engineRun.taxonomyVersion, evaluation.taxonomyVersion),
            eq(engineRun.scoringPolicyVersion, evaluation.scoringPolicyVersion),
            eq(engineRun.contentVersion, evaluation.contentVersion),
          ),
        )
        .limit(1);
      if (!existing) throw err; // Constraint name matched but the row vanished -- do not fabricate a result.
      engineRunId = existing.id;
    }

    const contentHash = sha256Hex(canonicalStringify(report));
    let reportSnapshotId: string;
    const candidateSnapshotId = generateId("rsnap");
    try {
      await tx.transaction(async (tx2) => {
        await tx2.insert(reportSnapshot).values({
          id: candidateSnapshotId,
          engineRunId,
          profileRevisionId,
          contentStatus: report.contentStatus,
          generationState: "TEMPLATE",
          publicContent: report,
          contentHash,
        });
      });
      reportSnapshotId = candidateSnapshotId;
    } catch (err) {
      if (!isUniqueConstraintConflict(err, REPORT_SNAPSHOT_IDEMPOTENCY_CONSTRAINT)) throw err;
      const [existing] = await tx
        .select({ id: reportSnapshot.id })
        .from(reportSnapshot)
        .where(
          and(
            eq(reportSnapshot.profileRevisionId, profileRevisionId),
            eq(reportSnapshot.contentHash, contentHash),
          ),
        )
        .limit(1);
      if (!existing) throw err;
      reportSnapshotId = existing.id;
    }

    return { engineRunId, reportSnapshotId };
  });
}
