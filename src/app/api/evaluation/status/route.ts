import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { simulationEvaluations, experimentalConfig, rounds } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get("userId");

    if (!userIdParam) {
      return NextResponse.json(
        { error: "User ID wajib disertakan." },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "User ID tidak valid." },
        { status: 400 }
      );
    }

    // 1. Check if user already submitted evaluation
    const [evalRecord] = await db
      .select()
      .from(simulationEvaluations)
      .where(eq(simulationEvaluations.userId, userId))
      .limit(1);

    // 2. Check if the trading simulation has ended (Period 3 Session 4 completed)
    let isSimulationEnded = false;

    // Check config
    const [cfg] = await db
      .select()
      .from(experimentalConfig)
      .where(eq(experimentalConfig.key, "period_3_completed_sessions"))
      .limit(1);

    if (cfg && cfg.content) {
      try {
        const completedSessions: number[] = JSON.parse(cfg.content);
        // Session 4 has sessionIdx = 3
        if (completedSessions.includes(3)) {
          isSimulationEnded = true;
        }
      } catch {
        // ignore parse error
      }
    }

    // Secondary check: closed final round in period 3 sessionGroup 4 (roundIndex 1 is the 2nd and final round of Session 4)
    if (!isSimulationEnded) {
      const [closedRound] = await db
        .select({ id: rounds.id })
        .from(rounds)
        .where(
          and(
            eq(rounds.period, 3),
            eq(rounds.sessionGroup, 4),
            eq(rounds.roundIndex, 1),
            eq(rounds.status, "closed")
          )
        )
        .limit(1);

      if (closedRound) {
        isSimulationEnded = true;
      }
    }

    return NextResponse.json(
      {
        success: true,
        isSimulationEnded,
        isCompleted: Boolean(evalRecord?.isCompleted),
        completedAt: evalRecord?.completedAt || null,
        evaluation: evalRecord
          ? {
              q1: evalRecord.q1,
              q2: evalRecord.q2,
              q3: evalRecord.q3,
              q4: evalRecord.q4,
              q5: evalRecord.q5,
              q6: evalRecord.q6,
              q7: evalRecord.q7,
              q8: evalRecord.q8,
              q9: evalRecord.q9,
              q10: evalRecord.q10,
            }
          : null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error checking evaluation status:", error);
    return NextResponse.json(
      { error: "Gagal memeriksa status evaluasi simulasi." },
      { status: 500 }
    );
  }
}
