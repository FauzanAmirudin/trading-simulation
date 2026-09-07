import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connStr = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/trading_simulasi";

const pool = new Pool({
  connectionString: connStr,
});

export const db = drizzle({ client: pool, schema });
