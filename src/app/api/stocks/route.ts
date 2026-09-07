import { db } from "@/db/connect";
import { stocks } from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const allStocks = await db.select().from(stocks);
    return NextResponse.json(
      { stocks: allStocks },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    return NextResponse.json({ stocks: [] }, { status: 500 });
  }
}
