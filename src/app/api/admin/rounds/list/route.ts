import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { rounds, transactionsHistory, predictions, orderBook } from "@/db/schema";
import { sql, desc } from "drizzle-orm";

function matchesDate(d: Date | string | null | undefined, targetDateStr: string): boolean {
  if (!d || !targetDateStr) return false;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return false;

  // Strict Asia/Jakarta (WIB) date formatting (YYYY-MM-DD)
  const wibDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);

  return wibDate === targetDateStr;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // optional YYYY-MM-DD or "ALL"

    // Fetch all rounds with descending order by ID
    const allRounds = await db
      .select({
        id: rounds.id,
        roundNumber: rounds.roundNumber,
        period: rounds.period,
        sessionGroup: rounds.sessionGroup,
        roundIndex: rounds.roundIndex,
        status: rounds.status,
        subSessionStatus: rounds.subSessionStatus,
        activeIntervention: rounds.activeIntervention,
        startTime: rounds.startTime,
        endTime: rounds.endTime,
        createdAt: rounds.createdAt,
      })
      .from(rounds)
      .orderBy(desc(rounds.id));

    // Get trade counts grouped by roundId
    const tradeCounts = await db
      .select({
        roundId: transactionsHistory.roundId,
        count: sql<number>`count(*)::int`,
      })
      .from(transactionsHistory)
      .groupBy(transactionsHistory.roundId);

    const tradeCountMap = Object.fromEntries(
      tradeCounts.map((tc) => [tc.roundId, tc.count])
    );

    // Get prediction counts grouped by roundId
    const predCounts = await db
      .select({
        roundId: predictions.roundId,
        count: sql<number>`count(*)::int`,
      })
      .from(predictions)
      .groupBy(predictions.roundId);

    const predCountMap = Object.fromEntries(
      predCounts.map((pc) => [pc.roundId, pc.count])
    );

    // Get order counts grouped by roundId
    const orderCounts = await db
      .select({
        roundId: orderBook.roundId,
        count: sql<number>`count(*)::int`,
      })
      .from(orderBook)
      .groupBy(orderBook.roundId);

    const orderCountMap = Object.fromEntries(
      orderCounts.map((oc) => [oc.roundId, oc.count])
    );

    let filteredRounds = allRounds;
    if (dateParam && dateParam !== "ALL") {
      filteredRounds = allRounds.filter((r) => {
        const roundTime = r.startTime ?? r.createdAt;
        return matchesDate(roundTime, dateParam);
      });
    }

    const result = filteredRounds.map((r) => ({
      ...r,
      tradeCount: tradeCountMap[r.id] || 0,
      predictionCount: predCountMap[r.id] || 0,
      orderCount: orderCountMap[r.id] || 0,
    }));

    return NextResponse.json({ rounds: result });
  } catch (err: any) {
    console.error("Error listing rounds:", err);
    return NextResponse.json(
      { error: "Gagal mengambil daftar ronde: " + err.message },
      { status: 500 }
    );
  }
}
