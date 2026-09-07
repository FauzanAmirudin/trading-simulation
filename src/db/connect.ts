import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connStr = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/trading_simulasi";

declare global {
  // eslint-disable-next-line no-var
  var __db_pool__: Pool | undefined;
}

const pool =
  globalThis.__db_pool__ ||
  new Pool({
    connectionString: connStr,
    max: 25,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__db_pool__ = pool;
}

export const db = drizzle({ client: pool, schema });

