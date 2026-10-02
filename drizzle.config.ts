import { defineConfig } from "drizzle-kit";

/**
 * Requires DATABASE_URL to be set (see .env.example). Generated
 * migrations are committed under drizzle/ and reviewed before being
 * applied -- drizzle-kit never applies a migration by itself; see
 * scripts/migrate.ts for the actual apply step, which only ever
 * targets a local/test database in this phase.
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
