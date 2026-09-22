import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Applies migrations to the dedicated test database
 * (TEST_DATABASE_URL, separate from DATABASE_URL so a test run can
 * never touch dev data). Run before `pnpm test` when integration
 * tests need real PostgreSQL. Local/test use only.
 */
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests that need real " +
        "PostgreSQL cannot run without it; see .env.example.",
    );
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.info("Applying migrations to the test database ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("Test database ready.");

  await pool.end();
}

main().catch((error: unknown) => {
  console.error("Test database setup failed:", error);
  process.exitCode = 1;
});
