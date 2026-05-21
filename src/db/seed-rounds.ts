import { db } from "./index";
import { rounds } from "./schema";
import { eq } from "drizzle-orm";

async function seedRounds() {
  console.log("Seeding 12 rounds...");

  for (let i = 1; i <= 12; i++) {
    const period = Math.ceil(i / 4) as 1 | 2 | 3;
    const existing = await db
      .select()
      .from(rounds)
      .where(eq(rounds.roundNumber, i))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(rounds).values({
        roundNumber: i,
        period,
        status: "pending",
        subSessionStatus: "PENDING",
        activeSubSession: 1,
      });
      console.log(`  Round ${i} created (Period ${period})`);
    } else {
      console.log(`  Round ${i} already exists`);
    }
  }

  const all = await db.select().from(rounds);
  console.log(`\nTotal rounds in DB: ${all.length}`);
  console.log("Done!");
  process.exit(0);
}

seedRounds().catch((err) => {
  console.error("Failed to seed rounds:", err);
  process.exit(1);
});
