import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { transactionsHistory, orderBook, stocks, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    // 1. Fetch total participants count
    const [participantsCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "responden"));
    const participantsCount = Number(participantsCountRow?.count) || 0;

    // 2. Fetch all transaction history with detailed buyer and seller names
    // We join orderBook for buy order to get buyer, and orderBook for sell order to get seller.
    // To do this simply and cleanly, we first select the transactions and then fetch user details, 
    // or run queries to fetch and join them.
    // In Drizzle, joining the same table twice requires aliases. To avoid aliasedTable import complexity, 
    // we can query the transactions first, then perform in-memory mapping using user names fetched in a single query!
    // This is extremely clean, highly performant, and completely avoids complex multiple-join compile issues.
    
    const allUsers = await db.select({ id: users.id, nama: users.nama }).from(users);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.nama]));

    const allOrders = await db.select({ id: orderBook.id, userId: orderBook.userId }).from(orderBook);
    const orderUserMap = Object.fromEntries(allOrders.map(o => [o.id, o.userId]));

    const txs = await db
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
      .innerJoin(stocks, eq(transactionsHistory.stockId, stocks.id))
      .orderBy(transactionsHistory.createdAt);

    // Map to response format and filter by date
    let transactions = txs.map(t => {
      const buyerId = orderUserMap[t.orderBuyId];
      const sellerId = orderUserMap[t.orderSellId];
      const buyerName = buyerId ? (userMap[buyerId] || `User #${buyerId}`) : "Unknown";
      const sellerName = sellerId ? (userMap[sellerId] || `User #${sellerId}`) : "Unknown";

      return {
        id: t.id,
        time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
        timeObj: t.createdAt ? new Date(t.createdAt) : null,
        buyer: buyerName,
        seller: sellerName,
        stock: t.stockCode,
        harga: Number(t.harga),
        jumlah: t.jumlah,
        total: Number(t.total),
        intervention: t.activeIntervention || "NONE",
        roundId: t.roundId,
      };
    }).reverse(); // Latest first

    if (dateParam) {
      transactions = transactions.filter(t => {
        if (!t.timeObj) return false;
        const wibDate = t.timeObj.toISOString().split("T")[0];
        return wibDate === dateParam;
      });
    }

    // Calculate aggregated metrics
    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce((s, t) => s + t.total, 0);
    const avgTransactionValue = totalTransactions > 0 ? Math.round(totalVolume / totalTransactions) : 0;

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
