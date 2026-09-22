import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "@/env";

/**
 * Applies committed migrations from drizzle/ to whatever database
 * DATABASE_URL currently points at. Per the Phase 1 contract, this
 * script is only ever run against a local/test database in this
 * phase -- there is no production database, credential, or
 * deployment target yet. It refuses to run if NODE_ENV=production,
 * as an extra guardrail on top of that operational fact.
 */
async function main() {
  if (env.isProduction) {
    throw new Error(
      "Refusing to run scripts/migrate.ts with NODE_ENV=production. " +
        "No production database exists for this application yet.",
    );
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  console.info(`Applying migrations to ${maskConnectionString(env.DATABASE_URL)} ...`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("Migrations applied successfully.");

  await pool.end();
}

function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable connection string)";
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
