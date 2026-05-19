import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const accounts = [
  { nama: "Andi", password: "password" },
  { nama: "Budi", password: "password" },
  { nama: "Citra", password: "password" },
];

async function createUsers() {
  for (const a of accounts) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.nama, a.nama))
      .limit(1);

    if (existing.length > 0) {
      console.log(`∼ User ${a.nama} already exists, skipped`);
      continue;
    }

    const hashed = await bcrypt.hash(a.password, 12);
    await db.insert(users).values({
      nama: a.nama,
      password: hashed,
      role: "responden",
    });
    console.log(`✓ User ${a.nama} created`);
  }
  console.log("Done!");
  process.exit(0);
}

createUsers().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
