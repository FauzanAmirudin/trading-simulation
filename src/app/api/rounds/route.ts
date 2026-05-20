import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { rounds, roundStocks, stocks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/rounds — list all 12 rounds with their stocks
export async function GET() {
  try {
    const allRounds = await db
      .select()
      .from(rounds)
      .orderBy(rounds.roundNumber);

    const roundsWithStocks = await Promise.all(
      allRounds.map(async (round) => {
        const stockRows = await db
          .select({
            id: stocks.id,
            kodeSaham: stocks.kodeSaham,
            namaSaham: stocks.namaSaham,
            basePrice: stocks.basePrice,
            slot: roundStocks.slot,
          })
          .from(roundStocks)
          .innerJoin(stocks, eq(roundStocks.stockId, stocks.id))
          .where(eq(roundStocks.roundId, round.id))
          .orderBy(roundStocks.slot);

        return {
          ...round,
          stocks: stockRows,
        };
      })
    );

    return NextResponse.json({ rounds: roundsWithStocks });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load rounds" }, { status: 500 });
  }
}

// POST /api/rounds — create/seed all 12 rounds
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rounds: roundConfigs } = body;

    if (!roundConfigs || !Array.isArray(roundConfigs)) {
      return NextResponse.json({ error: "Invalid rounds data" }, { status: 400 });
    }

    // Delete existing rounds and reassign
    const existing = await db.select().from(rounds);
    if (existing.length > 0) {
      for (const r of existing) {
        await db.delete(roundStocks).where(eq(roundStocks.roundId, r.id));
        await db.delete(rounds).where(eq(rounds.id, r.id));
      }
    }

    // Insert new rounds with stocks
    for (const config of roundConfigs) {
      const { roundNumber, period, status, stockIds } = config;

      const [newRound] = await db
        .insert(rounds)
        .values({
          roundNumber,
          period,
          status: status || "pending",
          subSessionStatus: "PENDING",
          activeSubSession: 1,
        })
        .returning();

      if (stockIds && Array.isArray(stockIds)) {
        for (let i = 0; i < stockIds.length; i++) {
          await db.insert(roundStocks).values({
            roundId: newRound.id,
            stockId: stockIds[i],
            slot: i + 1,
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: `${roundConfigs.length} rounds created` });
  } catch (error) {
    console.error("[Rounds] Error:", error);
    return NextResponse.json({ error: "Failed to create rounds" }, { status: 500 });
  }
}