import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentProfiles } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { PROFILE_MATRIX, ProfileGroup } from "@/lib/questionnaire-logic";
import { requireAdmin } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search")?.toLowerCase().trim() || "").slice(0, 100);
    const groupFilter = searchParams.get("group")?.toUpperCase() || ""; // A-I
    const laFilter = searchParams.get("la")?.toUpperCase() || ""; // T/S/R
    const eiFilter = searchParams.get("ei")?.toUpperCase() || ""; // T/S/R
    const sortBy = searchParams.get("sortBy") || "name"; // name, laScore, eiScore, completedAt

    // Fetch all respondents
    const allRespondents = await db
      .select({
        id: users.id,
        nama: users.nama,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "responden"))
      .orderBy(asc(users.id));

    // Fetch all profiles
    const allProfiles = await db.select().from(respondentProfiles);
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));

    // Combine data
    let combined = allRespondents.map((user) => {
      const p = profileMap.get(user.id);
      const isCompleted = Boolean(p?.isCompleted);
      const groupKey = (p?.profileGroup || "E") as ProfileGroup;
      const groupDef = PROFILE_MATRIX[groupKey] || PROFILE_MATRIX.E;

      return {
        userId: user.id,
        nama: user.nama,
        isCompleted,
        laRawScore: p ? p.laRawScore : null,
        laAvgScore: p ? Number(p.laAvgScore) : null,
        laCategory: p ? p.laCategory : null,
        eiRawScore: p ? p.eiRawScore : null,
        eiAvgScore: p ? Number(p.eiAvgScore) : null,
        eiCategory: p ? p.eiCategory : null,
        profileCode: p ? p.profileCode : null,
        profileLabel: p ? p.profileLabel : null,
        profileGroup: p ? p.profileGroup : null,
        profileGroupName: p ? groupDef.name : null,
        profileDescription: p ? groupDef.description : null,
        completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
      };
    });

    // Compute macro summary stats across all completed profiles
    const completedList = combined.filter((r) => r.isCompleted);
    const totalRespondents = combined.length;
    const completedCount = completedList.length;

    const groupDistribution: Record<string, number> = {
      A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0,
    };
    const laCatDistribution: Record<string, number> = { T: 0, S: 0, R: 0 };
    const eiCatDistribution: Record<string, number> = { T: 0, S: 0, R: 0 };

    let totalLaScore = 0;
    let totalEiScore = 0;

    completedList.forEach((r) => {
      if (r.profileGroup && groupDistribution[r.profileGroup] !== undefined) {
        groupDistribution[r.profileGroup]++;
      }
      if (r.laCategory && laCatDistribution[r.laCategory] !== undefined) {
        laCatDistribution[r.laCategory]++;
      }
      if (r.eiCategory && eiCatDistribution[r.eiCategory] !== undefined) {
        eiCatDistribution[r.eiCategory]++;
      }
      totalLaScore += r.laRawScore || 0;
      totalEiScore += r.eiRawScore || 0;
    });

    const laOverallAvg = completedCount > 0 ? Number((totalLaScore / completedCount).toFixed(2)) : 0;
    const eiOverallAvg = completedCount > 0 ? Number((totalEiScore / completedCount).toFixed(2)) : 0;

    // Apply Filters
    if (search) {
      combined = combined.filter((r) => r.nama.toLowerCase().includes(search));
    }
    if (groupFilter && groupDistribution[groupFilter] !== undefined) {
      combined = combined.filter((r) => r.profileGroup === groupFilter);
    }
    if (laFilter && ["T", "S", "R"].includes(laFilter)) {
      combined = combined.filter((r) => r.laCategory === laFilter);
    }
    if (eiFilter && ["T", "S", "R"].includes(eiFilter)) {
      combined = combined.filter((r) => r.eiCategory === eiFilter);
    }

    // Apply Sorting
    if (sortBy === "laScore") {
      combined.sort((a, b) => (b.laRawScore || 0) - (a.laRawScore || 0));
    } else if (sortBy === "eiScore") {
      combined.sort((a, b) => (b.eiRawScore || 0) - (a.eiRawScore || 0));
    } else if (sortBy === "completedAt") {
      combined.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
    } else {
      // Default natural order by ID/Name
      combined.sort((a, b) => a.userId - b.userId);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalRespondents,
        completedCount,
        pendingCount: totalRespondents - completedCount,
        laOverallAvg,
        eiOverallAvg,
        groupDistribution,
        laCatDistribution,
        eiCatDistribution,
      },
      respondents: combined,
    });
  } catch (error: any) {
    console.error("Error fetching admin respondent profiles:", error);
    return NextResponse.json(
      { error: "Gagal memuat data profil responden." },
      { status: 500 }
    );
  }
}
