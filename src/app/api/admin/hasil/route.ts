import { NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, portfolios, stocks, transactionsHistory, orderBook } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Parallelize all 5 DB queries
    const [allRespondents, allStocks, allPortfolios, allTransactions, allOrders] = await Promise.all([
      db.select().from(users).where(eq(users.role, "responden")),
      db.select().from(stocks),
      db.select().from(portfolios),
      db.select().from(transactionsHistory).orderBy(transactionsHistory.createdAt),
      db.select({ id: orderBook.id, userId: orderBook.userId }).from(orderBook),
    ]);

    // Stock base price map for instant O(1) lookup
    const stockBasePrices = new Map<number, number>();
    let initialBasePortfolioValue = 0;
    for (const s of allStocks) {
      const base = Number(s.basePrice || 0);
      stockBasePrices.set(s.id, base);
      initialBasePortfolioValue += 10 * 100 * base;
    }
    const initialCapital = 100000000 + initialBasePortfolioValue;

    // Get last traded price per stock
    const lastPrices: Record<number, number> = {};
    for (const tx of allTransactions) {
      lastPrices[tx.stockId] = Number(tx.harga);
    }

    // Map order id to user id
    const orderUserMap: Record<number, number> = {};
    for (const o of allOrders) {
      orderUserMap[o.id] = o.userId;
    }

    // Transaction count per user
    const txCountPerUser: Record<number, number> = {};
    for (const tx of allTransactions) {
      const buyerId = orderUserMap[tx.orderBuyId];
      const sellerId = orderUserMap[tx.orderSellId];
      if (buyerId) txCountPerUser[buyerId] = (txCountPerUser[buyerId] || 0) + 1;
      if (sellerId && sellerId !== buyerId) txCountPerUser[sellerId] = (txCountPerUser[sellerId] || 0) + 1;
    }

    // Group portfolios by userId for O(1) access
    const userPortosMap = new Map<number, typeof allPortfolios>();
    for (const p of allPortfolios) {
      const list = userPortosMap.get(p.userId);
      if (list) {
        list.push(p);
      } else {
        userPortosMap.set(p.userId, [p]);
      }
    }

    // Build the results per user
    const results = allRespondents.map((user) => {
      const userKas = Number(user.saldo) || 0;
      const userPortos = userPortosMap.get(user.id) || [];

      let nilaiPortofolio = 0;
      for (const p of userPortos) {
        const lastPrice = lastPrices[p.stockId] ?? stockBasePrices.get(p.stockId) ?? 0;
        nilaiPortofolio += p.jumlahLot * 100 * lastPrice;
      }

      const totalKekayaan = userKas + nilaiPortofolio;
      const pnlAmount = totalKekayaan - initialCapital;
      const pnlPercent = initialCapital > 0 ? (pnlAmount / initialCapital) * 100 : 0;
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
        jumlahTransaksi,
      };
    });

    // Sort descending by totalKekayaan
    results.sort((a, b) => {
      if (b.totalKekayaan !== a.totalKekayaan) return b.totalKekayaan - a.totalKekayaan;
      if (b.pnlAmount !== a.pnlAmount) return b.pnlAmount - a.pnlAmount;
      if (b.kas !== a.kas) return b.kas - a.kas;
      if (b.jumlahTransaksi !== a.jumlahTransaksi) return b.jumlahTransaksi - a.jumlahTransaksi;
      return a.nama.localeCompare(b.nama);
    });

    // Assign rank
    results.forEach((r, idx) => {
      (r as any).rank = idx + 1;
    });

    return NextResponse.json(
      {
        top5: results.slice(0, 5),
        all: results,
        lastUpdated: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3, stale-while-revalidate=10",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching admin hasil:", error);
    return NextResponse.json({ error: "Gagal mengambil data hasil" }, { status: 500 });
  }
}

