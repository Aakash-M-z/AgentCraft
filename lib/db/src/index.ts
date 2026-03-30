import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export * from "./schema";

// db and pool are only available when DATABASE_URL is set.
// The Express routes now use the in-memory store (src/lib/store.ts) instead,
// so these exports are kept for compatibility but won't be used.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;
