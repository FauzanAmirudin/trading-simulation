import { NextResponse } from "next/server";
import { EXPERIMENTAL_MATRIX } from "@/lib/experimental-matrix";

export async function GET() {
  return NextResponse.json({
    matrix: EXPERIMENTAL_MATRIX,
    summary: {
      totalRounds: 12,
      totalPeriods: 3,
      roundsPerPeriod: 4,
      sessionsPerRound: 4,
      interventionTypes: ["NONE", "BERITA_BAIK", "BERITA_BURUK", "TMNP_1", "TMNP_2"],
    },
  });
}