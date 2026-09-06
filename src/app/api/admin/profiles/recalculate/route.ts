import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { respondentProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computePopulationTerciles, RespondentScoreInput } from "@/lib/questionnaire-logic";
import { requireAdmin } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    // 1. Fetch all completed profiles
    const completedProfiles = await db
      .select()
      .from(respondentProfiles)
      .where(eq(respondentProfiles.isCompleted, true));

    if (completedProfiles.length === 0) {
      return NextResponse.json(
        { error: "Belum ada data responden yang menyelesaikan kuesioner untuk dikalkulasi ulang." },
        { status: 400 }
      );
    }

    // 2. Prepare inputs for population tercile algorithm
    const inputs: RespondentScoreInput[] = completedProfiles.map((p) => ({
      userId: p.userId,
      laRawScore: p.laRawScore,
      eiRawScore: p.eiRawScore,
      laItemCount: 15,
      eiItemCount: 15,
    }));

    // 3. Compute tercile distribution
    const results = computePopulationTerciles(inputs);

    // 4. Update each profile atomically in database transaction
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const res of results) {
        await tx
          .update(respondentProfiles)
          .set({
            laCategory: res.laCategory,
            laAvgScore: res.laAvgScore.toString(),
            eiCategory: res.eiCategory,
            eiAvgScore: res.eiAvgScore.toString(),
            profileCode: res.profileCode,
            profileLabel: res.profileLabel,
            profileGroup: res.profileGroup,
            updatedAt: now,
          })
          .where(eq(respondentProfiles.userId, res.userId));
      }
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil mengkalkulasi ulang pengelompokan Tercile untuk ${results.length} responden.`,
      updatedCount: results.length,
    });
  } catch (error: any) {
    console.error("Error recalculating population terciles:", error);
    return NextResponse.json(
      { error: "Gagal melakukan kalkulasi ulang pengelompokan Tercile." },
      { status: 500 }
    );
  }
}
