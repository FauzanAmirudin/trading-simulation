import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { transactionsHistory, orderBook, stocks, users, portfolios } from "@/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdStr = searchParams.get("userId");
    const roundIdStr = searchParams.get("roundId");

    if (!userIdStr) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const userId = parseInt(userIdStr);
    const roundId = roundIdStr && roundIdStr !== "all" ? parseInt(roundIdStr) : null;

    // Fetch user details for balance
    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const balance = Number(userRow.saldo);

    // Query 1: Transactions where user is the buyer (BID)
    const buyTxs = await db
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
      })
      .from(transactionsHistory)
      .innerJoin(stocks, eq(transactionsHistory.stockId, stocks.id))
      .innerJoin(orderBook, eq(transactionsHistory.orderBuyId, orderBook.id))
      .where(
        and(
          eq(orderBook.userId, userId),
          roundId ? eq(transactionsHistory.roundId, roundId) : undefined
        )
      );

    // Query 2: Transactions where user is the seller (ASK)
    const sellTxs = await db
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
      })
      .from(transactionsHistory)
      .innerJoin(stocks, eq(transactionsHistory.stockId, stocks.id))
      .innerJoin(orderBook, eq(transactionsHistory.orderSellId, orderBook.id))
      .where(
        and(
          eq(orderBook.userId, userId),
          roundId ? eq(transactionsHistory.roundId, roundId) : undefined
        )
      );

    // Merge transactions and map to unified format
    const history = [
      ...buyTxs.map(tx => ({
        id: tx.id,
        time: tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
        stock: tx.stockCode,
        tipe: "BID" as const,
        harga: Number(tx.harga),
        jumlah: tx.jumlah,
        total: Number(tx.total),
        createdAt: tx.createdAt,
      })),
      ...sellTxs.map(tx => ({
        id: tx.id,
        time: tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
        stock: tx.stockCode,
        tipe: "ASK" as const,
        harga: Number(tx.harga),
        jumlah: tx.jumlah,
        total: Number(tx.total),
        createdAt: tx.createdAt,
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate totals
    const totalBuy = history.filter(t => t.tipe === "BID").reduce((s, t) => s + t.total, 0);
    const totalSell = history.filter(t => t.tipe === "ASK").reduce((s, t) => s + t.total, 0);
    const netPnl = totalSell - totalBuy;

    // Fetch portfolio for value calculation
    const portfoliosList = await db
      .select({
        jumlahLot: portfolios.jumlahLot,
        basePrice: stocks.basePrice,
      })
      .from(portfolios)
      .innerJoin(stocks, eq(portfolios.stockId, stocks.id))
      .where(
        and(
          eq(portfolios.userId, userId)
        )
      );

    const portfolioValue = portfoliosList.reduce((s, p) => s + (p.jumlahLot * 100 * Number(p.basePrice)), 0);
    const totalValue = balance + portfolioValue;

    return NextResponse.json({
      balance,
      portfolioValue,
      totalValue,
      totalBuy,
      totalSell,
      netPnl,
      history,
    });
  } catch (error) {
    console.error("[Resume Responder] Error:", error);
    return NextResponse.json({ error: "Failed to load resume data" }, { status: 500 });
  }
}
