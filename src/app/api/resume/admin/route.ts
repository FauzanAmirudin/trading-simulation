import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { transactionsHistory, orderBook, stocks, users } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const roundIdParam = searchParams.get("roundId");

    // 1. Fetch total participants count
    const [participantsCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "responden"));
    const participantsCount = Number(participantsCountRow?.count) || 0;

    // 2. Fetch user and order mappings in memory for maximum performance
    const allUsers = await db.select({ id: users.id, nama: users.nama }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.nama]));

    const allOrders = await db.select({ id: orderBook.id, userId: orderBook.userId }).from(orderBook);
    const orderUserMap = Object.fromEntries(allOrders.map((o) => [o.id, o.userId]));

    // 3. Build query with optional roundId filtering
    let baseQuery = db
      .select({
        id: transactionsHistory.id,
        roundId: transactionsHistory.roundId,
        stockId: transactionsHistory.stockId,
        stockCode: stocks.kodeSaham,
        harga: transactionsHistory.harga,
        jumlah: transactionsHistory.jumlah,
        total: transactionsHistory.total,
        subSession: transactionsHistory.subSession,
        activeIntervention: transactionsHistory.activeIntervention,
        createdAt: transactionsHistory.createdAt,
        orderBuyId: transactionsHistory.orderBuyId,
        orderSellId: transactionsHistory.orderSellId,
      })
      .from(transactionsHistory)
      .innerJoin(stocks, eq(transactionsHistory.stockId, stocks.id));

    const roundIdNum = roundIdParam ? Number(roundIdParam) : null;
    const txs = roundIdNum !== null && !isNaN(roundIdNum)
      ? await baseQuery
          .where(eq(transactionsHistory.roundId, roundIdNum))
          .orderBy(desc(transactionsHistory.createdAt))
      : await baseQuery.orderBy(desc(transactionsHistory.createdAt));

    // Map to response format and format time in 24h WIB
    let transactions = txs.map((t) => {
      const buyerId = orderUserMap[t.orderBuyId];
      const sellerId = orderUserMap[t.orderSellId];
      const buyerName = buyerId ? userMap[buyerId] || `User #${buyerId}` : "Unknown";
      const sellerName = sellerId ? userMap[sellerId] || `User #${sellerId}` : "Unknown";

      return {
        id: t.id,
        time: t.createdAt
          ? new Date(t.createdAt)
              .toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZone: "Asia/Jakarta",
              })
              .replace(/:/g, ".") + " WIB"
          : "",
        timeObj: t.createdAt ? new Date(t.createdAt) : null,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
        buyer: buyerName,
        seller: sellerName,
        stock: t.stockCode,
        harga: Number(t.harga),
        jumlah: t.jumlah,
        total: Number(t.total),
        intervention: t.activeIntervention || "NONE",
        roundId: t.roundId,
      };
    });

    if (dateParam && dateParam !== "ALL") {
      const matchesDate = (d: Date | string | null | undefined, targetDateStr: string): boolean => {
        if (!d || !targetDateStr) return false;
        const dateObj = typeof d === "string" ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return false;
        const wib = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(dateObj);
        return wib === targetDateStr;
      };

      transactions = transactions.filter((t) => {
        return matchesDate(t.timeObj, dateParam) || matchesDate(t.createdAt, dateParam);
      });
    }

    // Calculate aggregated metrics
    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce((s, t) => s + t.total, 0);
    const avgTransactionValue =
      totalTransactions > 0 ? Math.round(totalVolume / totalTransactions) : 0;

    return NextResponse.json({
      participantsCount,
      totalTransactionsCount: totalTransactions,
      totalVolume,
      avgTransactionValue,
      transactions,
    });
  } catch (error) {
    console.error("[Resume Admin] Error:", error);
    return NextResponse.json({ error: "Failed to load admin resume data" }, { status: 500 });
  }
}
