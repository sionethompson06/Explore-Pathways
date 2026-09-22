import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * A single shared connection pool for the whole process. Phase 1 only
 * ever points this at a local/test PostgreSQL instance (see
 * docs/pathways/INTEGRATION_REGISTER.md) -- there is no production
 * deployment in this phase.
 */
const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
