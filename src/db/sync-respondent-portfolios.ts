import { db } from "./index";
import { users, stocks, portfolios } from "./schema";
import { eq, sql } from "drizzle-orm";

export async function syncRespondentPortfolios() {
  console.log("[Sync] Checking and synchronizing respondent portfolios (10 lots per stock)...");

  const respondents = await db.select().from(users).where(eq(users.role, "responden"));
  const allStocks = await db.select().from(stocks);

  console.log(`[Sync] Found ${respondents.length} respondents and ${allStocks.length} stocks.`);

  if (respondents.length === 0 || allStocks.length === 0) {
    console.log("[Sync] No respondents or stocks found.");
    return;
  }

  // 1. Insert missing stock portfolios for each respondent
  const toInsert = respondents.flatMap((user) =>
    allStocks.map((stock) => ({
      userId: user.id,
      stockId: stock.id,
      jumlahLot: 10,
      averagePrice: String(stock.basePrice),
    }))
  );

  if (toInsert.length > 0) {
    await db.insert(portfolios).values(toInsert).onConflictDoNothing();
  }

  // 2. If any respondent has 0 lots, restore to 10 lots
  const updated = await db.execute(sql`
    UPDATE portfolios 
    SET jumlah_lot = 10, average_price = stocks.base_price 
    FROM stocks, users
    WHERE portfolios.stock_id = stocks.id 
      AND portfolios.user_id = users.id 
      AND users.role = 'responden'
      AND portfolios.jumlah_lot = 0;
  `);

  console.log("[Sync] Synchronization completed successfully.");

  // 3. Verify total lots per respondent
  const summary = await db.execute(sql`
    SELECT u.id, u.nama, u.role, count(p.id) as total_stocks, sum(p.jumlah_lot) as total_lots
    FROM users u
    LEFT JOIN portfolios p ON u.id = p.user_id
    WHERE u.role = 'responden'
    GROUP BY u.id, u.nama, u.role
    ORDER BY u.id;
  `);

  console.log("[Sync] Respondent Portfolios Summary:", (summary as any).rows);
}

if (process.argv[1] && process.argv[1].endsWith("sync-respondent-portfolios.ts")) {
  syncRespondentPortfolios()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Sync] Error:", err);
      process.exit(1);
    });
}
