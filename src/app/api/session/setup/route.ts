import { db } from "@/db/connect";
import { sessions, sessionStocks, stocks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(sessions);
    if (Number(existing[0].count) >= 12) {
      return NextResponse.json({ message: "Sesi sudah tersedia", count: Number(existing[0].count) });
    }

    await db.delete(sessionStocks);
    await db.delete(sessions);

    const allStocks = await db.select().from(stocks);
    const shuffled = [...allStocks].sort(() => Math.random() - 0.5);

    for (let overall = 1; overall <= 12; overall++) {
      const periode = Math.ceil(overall / 4);
      const [session] = await db.insert(sessions).values({
        putaranKe: overall,
        periodeKe: periode,
        status: "pending",
      }).returning();

      const startIdx = (overall - 1) * 3;
      const sessionStockIds = shuffled.slice(startIdx, startIdx + 3);

      for (const s of sessionStockIds) {
        await db.insert(sessionStocks).values({
          sessionId: session.id,
          stockId: s.id,
        });
      }
    }

    return NextResponse.json({ message: "12 sesi berhasil dibuat" });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Gagal setup sesi" }, { status: 500 });
  }
}
