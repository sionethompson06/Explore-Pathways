import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * A dedicated connection to TEST_DATABASE_URL, deliberately separate
 * from src/db/client.ts (which reads DATABASE_URL). A test run must
 * never be able to touch dev data even if misconfigured -- there is
 * no code path here that falls back to DATABASE_URL.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

/**
 * An explicitly partial local run (no TEST_DATABASE_URL set) is
 * allowed to skip the PostgreSQL-dependent suites honestly -- see
 * every describe.skipIf(!hasTestDatabase) block. That is a real,
 * visible "skipped" outcome, never reported as "passed."
 *
 * CI (or anyone who wants the same guarantee) sets
 * REQUIRE_TEST_DATABASE=true, which turns a missing TEST_DATABASE_URL
 * into a hard failure at module load -- before any test can be
 * silently skipped into a green run. An *unreachable* (as opposed to
 * merely unset) database is already a hard failure independent of
 * this flag: resetTestDatabase()'s connection attempt rejects and
 * fails the test, it does not skip.
 */
if (process.env.REQUIRE_TEST_DATABASE === "true" && !hasTestDatabase) {
  throw new Error(
    "REQUIRE_TEST_DATABASE=true but TEST_DATABASE_URL is not set. " +
      "This run is configured to require real PostgreSQL integration " +
      "coverage (e.g. CI) and must fail loudly rather than silently " +
      "skip the persistence/authorization test suites.",
  );
}

let pool: Pool | undefined;
export const testDb = TEST_DATABASE_URL
  ? drizzle(
      (pool = new Pool({ connectionString: TEST_DATABASE_URL })),
      { schema },
    )
  : undefined;

export async function closeTestDb() {
  await pool?.end();
}

/**
 * Wipes every application table between tests. Truncation order
 * matters only for readability here -- CASCADE handles FK order.
 * Never touches anything outside the tables this schema owns, and
 * never runs unless TEST_DATABASE_URL is actually set (asserted by
 * the caller via hasTestDatabase first).
 */
export async function resetTestDatabase() {
  if (!testDb) return;
  await testDb.execute(sql`
    TRUNCATE TABLE
      audit_event,
      aggregate_event,
      workflow_event,
      advisor_note,
      advisor_assignment,
      booking,
      consultation_request,
      consent_event,
      report_snapshot,
      engine_run,
      profile_revision,
      discovery_session,
      guardian_student_access,
      student_pathway_record,
      staff_role,
      verification,
      account,
      session,
      "user"
    RESTART IDENTITY CASCADE
  `);
}
