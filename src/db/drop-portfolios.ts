import "dotenv/config";
import { db } from "./connect";
import { sql } from "drizzle-orm";

async function drop() {
  try {
    await db.execute(sql`DROP TABLE portfolios CASCADE;`);
    console.log("Table dropped successfully.");
  } catch (err) {
    console.error("Failed to drop:", err);
  }
  process.exit(0);
}
drop();
