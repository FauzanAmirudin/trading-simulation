import { db } from "@/db/connect";
import { sessions, sessionStocks, stocks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [active] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.status, "active"))
      .limit(1);

    if (!active) {
      return NextResponse.json({ session: null, stocks: [] });
    }

    const rows = await db
      .select({
        id: stocks.id,
        kodeSaham: stocks.kodeSaham,
        namaSaham: stocks.namaSaham,
        basePrice: stocks.basePrice,
      })
      .from(sessionStocks)
      .innerJoin(stocks, eq(sessionStocks.stockId, stocks.id))
      .where(eq(sessionStocks.sessionId, active.id));

    return NextResponse.json({
      session: {
        id: active.id,
        putaranKe: active.putaranKe,
        periodeKe: active.periodeKe,
        status: active.status,
        startTime: active.startTime,
        endTime: active.endTime,
      },
      stocks: rows,
    });
  } catch {
    return NextResponse.json({ session: null, stocks: [] }, { status: 500 });
  }
}
