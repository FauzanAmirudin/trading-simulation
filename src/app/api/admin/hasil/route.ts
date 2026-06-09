import { NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, portfolios, stocks, transactionsHistory, orderBook } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const allRespondents = await db.select().from(users).where(eq(users.role, "responden"));
    const allStocks = await db.select().from(stocks);
    const allPortfolios = await db.select().from(portfolios);
    const allTransactions = await db.select().from(transactionsHistory).orderBy(transactionsHistory.createdAt);
    const allOrders = await db.select().from(orderBook);

    // Get last traded price per stock
    const lastPrices: Record<number, number> = {};
    for (const tx of allTransactions) {
      lastPrices[tx.stockId] = Number(tx.harga);
    }

    // Map order id to user id
    const orderUserMap = Object.fromEntries(allOrders.map(o => [o.id, o.userId]));

    // Transaction count per user
    const txCountPerUser: Record<number, number> = {};
    for (const tx of allTransactions) {
      const buyerId = orderUserMap[tx.orderBuyId];
      const sellerId = orderUserMap[tx.orderSellId];
      if (buyerId) txCountPerUser[buyerId] = (txCountPerUser[buyerId] || 0) + 1;
      if (sellerId) txCountPerUser[sellerId] = (txCountPerUser[sellerId] || 0) + 1;
    }

    // Calculate initial base portfolio value (36 stocks * 10 lots * 100 shares * basePrice)
    const initialBasePortfolioValue = allStocks.reduce((sum, stock) => {
      return sum + (10 * 100 * Number(stock.basePrice));
    }, 0);
    const initialCapital = 100000000 + initialBasePortfolioValue;

    // Build the results per user
    const results = allRespondents.map((user) => {
      const userKas = Number(user.saldo);
      const userPortos = allPortfolios.filter(p => p.userId === user.id);
      
      let nilaiPortofolio = 0;
      for (const p of userPortos) {
        const lastPrice = lastPrices[p.stockId] || Number(allStocks.find(s => s.id === p.stockId)?.basePrice || 0);
        nilaiPortofolio += p.jumlahLot * 100 * lastPrice;
      }

      const totalKekayaan = userKas + nilaiPortofolio;
      const pnlAmount = totalKekayaan - initialCapital;
      const pnlPercent = (pnlAmount / initialCapital) * 100;
      const jumlahTransaksi = txCountPerUser[user.id] || 0;

      return {
        userId: user.id,
        nama: user.nama,
        kas: userKas,
        nilaiPortofolio,
        totalKekayaan,
        initialCapital,
        pnlAmount,
        pnlPercent,
        jumlahTransaksi
      };
    });

    // Sort descending by totalKekayaan
    results.sort((a, b) => b.totalKekayaan - a.totalKekayaan);

    // Assign rank
    results.forEach((r, idx) => {
      (r as any).rank = idx + 1;
    });

    return NextResponse.json({
      top5: results.slice(0, 5),
      all: results,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error fetching admin hasil:", error);
    return NextResponse.json({ error: "Gagal mengambil data hasil" }, { status: 500 });
  }
}
