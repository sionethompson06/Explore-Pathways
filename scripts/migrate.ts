import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Applies committed migrations from drizzle/ to whatever database
 * DATABASE_URL currently points at. Per the Phase 1 contract, this
 * script is only ever run against a local/test database in this
 * phase -- there is no production database, credential, or
 * deployment target yet. It refuses to run if NODE_ENV=production,
 * as an extra guardrail on top of that operational fact.
 *
 * Reads process.env directly, the same convention
 * scripts/test-db-setup.ts already uses, rather than importing
 * `@/env`: this is a standalone Node CLI tool run via `tsx`, outside
 * the Next.js bundler that makes the app's own `import "server-only"`
 * modules (env.ts, db/client.ts) safe to import -- under plain Node,
 * `server-only`'s guard throws unconditionally, so a script must never
 * import those modules directly.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. See .env.example for the required shape.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to run scripts/migrate.ts with NODE_ENV=production. " +
        "No production database exists for this application yet.",
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.info(`Applying migrations to ${maskConnectionString(databaseUrl)} ...`);
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
