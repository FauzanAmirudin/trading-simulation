import { db } from "@/db/connect";
import { sessions, sessionStocks, stocks } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    let body: { sessionId?: number } = {};
    try { body = await request.json(); } catch { /* empty body OK */ }
    const { sessionId } = body;

    // Close any existing active session
    await db
      .update(sessions)
      .set({ status: "closed", endTime: new Date() })
      .where(eq(sessions.status, "active"));

    // Find target session
    let target;
    if (sessionId) {
      const [s] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);
      target = s;
    } else {
      const [s] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.status, "pending"))
        .orderBy(asc(sessions.putaranKe))
        .limit(1);
      target = s;
    }

    if (!target) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 400 });
    }

    if (target.status !== "pending") {
      return NextResponse.json({ error: "Hanya sesi dengan status Menunggu yang bisa dimulai" }, { status: 400 });
    }

    // Activate it
    const [session] = await db
      .update(sessions)
      .set({ status: "active", startTime: new Date() })
      .where(eq(sessions.id, target.id))
      .returning();

    // Get its stocks
    const stockRows = await db
      .select({
        id: stocks.id,
        kodeSaham: stocks.kodeSaham,
        namaSaham: stocks.namaSaham,
        basePrice: stocks.basePrice,
      })
      .from(sessionStocks)
      .innerJoin(stocks, eq(sessionStocks.stockId, stocks.id))
      .where(eq(sessionStocks.sessionId, session.id));

    return NextResponse.json({ session, stocks: stockRows });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json({ error: "Gagal memulai sesi" }, { status: 500 });
  }
}
