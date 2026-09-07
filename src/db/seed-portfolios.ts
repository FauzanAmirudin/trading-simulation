import { db } from "./index";
import { users, stocks, portfolios } from "./schema";
import { eq } from "drizzle-orm";

export async function seedInitialPortfolios(initialLot: number = 10) {
  const allUsers = await db.select().from(users).where(eq(users.role, "responden"));
  const allStocks = await db.select().from(stocks);
  const toInsert = allUsers.flatMap((user) =>
    allStocks.map((stock) => ({
      userId: user.id,
      stockId: stock.id,
      jumlahLot: initialLot,
      averagePrice: String(stock.basePrice),
    }))
  );
  if (toInsert.length > 0) {
    await db.insert(portfolios).values(toInsert).onConflictDoNothing();
  }
  console.log(
    `[DB] Portfolios seeded: ${allUsers.length} users × ${allStocks.length} stocks × ${initialLot} lot`
  );
}

if (process.argv[1] && process.argv[1].endsWith("seed-portfolios.ts")) {
  seedInitialPortfolios()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
