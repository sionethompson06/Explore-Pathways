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
