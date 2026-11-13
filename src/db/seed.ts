import { db } from "./index";
import { users } from "./schema";
import { ensureStocksSchemaAndSync } from "./stocks-data";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  await ensureStocksSchemaAndSync();
  console.log("48 stocks (36 main + 12 trial) synced with t-1, t-2, t-3 prices.");

  const existingAdmin = await db.select().from(users).where(eq(users.nama, "Admin")).limit(1);
  if (existingAdmin.length === 0) {
    const hashed = await bcrypt.hash("admin", 12);
    await db.insert(users).values({
      nama: "Admin",
      password: hashed,
      role: "admin",
      saldo: "100000000.00",
    });
    console.log("Admin user created.");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
