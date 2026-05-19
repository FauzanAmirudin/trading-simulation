import { db } from "@/db/connect";
import { sessions, sessionStocks, stocks } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const allSessions = await db
      .select()
      .from(sessions)
      .orderBy(asc(sessions.putaranKe));

    const schedule = await Promise.all(
      allSessions.map(async (s) => {
        const stockRows = await db
          .select({
            id: stocks.id,
            kodeSaham: stocks.kodeSaham,
            namaSaham: stocks.namaSaham,
            basePrice: stocks.basePrice,
          })
          .from(sessionStocks)
          .innerJoin(stocks, eq(sessionStocks.stockId, stocks.id))
          .where(eq(sessionStocks.sessionId, s.id));

        return {
          id: s.id,
          putaranKe: s.putaranKe,
          periodeKe: s.periodeKe,
          status: s.status,
          startTime: s.startTime,
          endTime: s.endTime,
          stocks: stockRows,
        };
      })
    );

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("Schedule error:", error);
    return NextResponse.json({ schedule: [] }, { status: 500 });
  }
}
