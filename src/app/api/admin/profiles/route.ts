import { NextRequest, NextResponse } from "next/server";
import { db, ensureQuestionnaireSchema } from "@/db/connect";
import { users, respondentProfiles, respondentBiodata } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { PROFILE_MATRIX, ProfileGroup, computeTercileCutoffs } from "@/lib/questionnaire-logic";
import { requireAdmin } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    await ensureQuestionnaireSchema();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search")?.toLowerCase().trim() || "").slice(0, 100);
    const groupFilter = searchParams.get("group")?.toUpperCase() || ""; // A-I
    const laFilter = searchParams.get("la")?.toUpperCase() || ""; // T/S/R
    const eiFilter = searchParams.get("ei")?.toUpperCase() || ""; // T/S/R
    const sortBy = searchParams.get("sortBy") || "name"; // name, laScore, eiScore, laRank, eiRank, completedAt, group

    // Fetch all respondents, profiles, and biodata in parallel
    const [allRespondents, allProfiles, allBiodata] = await Promise.all([
      db
        .select({
          id: users.id,
          nama: users.nama,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.role, "responden"))
        .orderBy(asc(users.id)),
      db.select().from(respondentProfiles).catch(() => []),
      db.select().from(respondentBiodata).catch(() => []),
    ]);
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));
    const biodataMap = new Map(allBiodata.map((b) => [b.userId, b]));

    // Compute Ranks (1 = skor tertinggi, diurutkan dari atas ke bawah) untuk responden yang selesai
    const completedProfiles = allProfiles.filter((p) => p.isCompleted);
    const sortedByLA = [...completedProfiles].sort((a, b) => {
      if (b.laRawScore !== a.laRawScore) return b.laRawScore - a.laRawScore;
      return a.userId - b.userId;
    });
    const laRankMap = new Map<number, number>();
    sortedByLA.forEach((p, idx) => laRankMap.set(p.userId, idx + 1));

    const sortedByEI = [...completedProfiles].sort((a, b) => {
      if (b.eiRawScore !== a.eiRawScore) return b.eiRawScore - a.eiRawScore;
      return a.userId - b.userId;
    });
    const eiRankMap = new Map<number, number>();
    sortedByEI.forEach((p, idx) => eiRankMap.set(p.userId, idx + 1));

    // Combine data
    let combined = allRespondents.map((user) => {
      const p = profileMap.get(user.id);
      const b = biodataMap.get(user.id);
      const isCompleted = Boolean(p?.isCompleted);
      const groupKey = (p?.profileGroup || "E") as ProfileGroup;
      const groupDef = PROFILE_MATRIX[groupKey] || PROFILE_MATRIX.E;

      return {
        userId: user.id,
        nama: user.nama,
        isCompleted,
        hasBiodata: Boolean(b),
        biodata: b
          ? {
              jenisKelamin: b.jenisKelamin,
              usia: b.usia,
              programStudi: b.programStudi,
              semester: b.semester,
              pernahInvestasiSaham: b.pernahInvestasiSaham,
              pernahPelatihanInvestasi: b.pernahPelatihanInvestasi,
              sumberPenghasilan: b.sumberPenghasilan,
              sumberPenghasilanLainnya: b.sumberPenghasilanLainnya,
              jurusanSma: b.jurusanSma,
            }
          : null,
        laRawScore: p ? p.laRawScore : null,
        laAvgScore: p ? Number(p.laAvgScore) : null,
        laRank: isCompleted ? laRankMap.get(user.id) || null : null,
        laCategory: p ? p.laCategory : null,
        eiRawScore: p ? p.eiRawScore : null,
        eiAvgScore: p ? Number(p.eiAvgScore) : null,
        eiRank: isCompleted ? eiRankMap.get(user.id) || null : null,
        eiCategory: p ? p.eiCategory : null,
        profileCode: p ? p.profileCode : null,
        profileLabel: p ? p.profileLabel : null,
        profileGroup: p ? p.profileGroup : null,
        profileGroupName: p ? groupDef.name : null,
        profileDescription: p ? groupDef.description : null,
        completedAt: p?.completedAt ? new Date(p.completedAt).toISOString() : null,
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

    // Hitung ambang batas Tercile
    const categorizedForStats = completedList.map((r) => ({
      userId: r.userId,
      laRawScore: r.laRawScore || 0,
      laAvgScore: r.laAvgScore || 0,
      laRank: r.laRank || 1,
      laCategory: (r.laCategory || "S") as any,
      eiRawScore: r.eiRawScore || 0,
      eiAvgScore: r.eiAvgScore || 0,
      eiRank: r.eiRank || 1,
      eiCategory: (r.eiCategory || "S") as any,
      profileCode: r.profileCode || "LASEIS",
      profileLabel: r.profileLabel || "LA(S)+EI(S)",
      profileGroup: (r.profileGroup || "E") as ProfileGroup,
    }));

    const laTercileCutoff = computeTercileCutoffs(categorizedForStats, "LA");
    const eiTercileCutoff = computeTercileCutoffs(categorizedForStats, "EI");

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

    // Apply Sorting (Berdasarkan nilai per user dari atas ke bawah)
    if (sortBy === "laScore" || sortBy === "laRank") {
      combined.sort((a, b) => (b.laRawScore || 0) - (a.laRawScore || 0));
    } else if (sortBy === "eiScore" || sortBy === "eiRank") {
      combined.sort((a, b) => (b.eiRawScore || 0) - (a.eiRawScore || 0));
    } else if (sortBy === "group") {
      combined.sort((a, b) => (a.profileGroup || "Z").localeCompare(b.profileGroup || "Z"));
    } else if (sortBy === "completedAt") {
      combined.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
    } else {
      // Default natural order by respondent name (e.g. responden1 to responden90)
      combined.sort((a, b) => {
        const numA = parseInt(a.nama.replace(/\D/g, ""), 10);
        const numB = parseInt(b.nama.replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.userId - b.userId;
      });
    }

    return NextResponse.json(
      {
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
          laTercileCutoff,
          eiTercileCutoff,
        },
        respondents: combined,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3, stale-while-revalidate=15",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching admin respondent profiles:", error);
    return NextResponse.json(
      { error: "Gagal memuat data profil responden." },
      { status: 500 }
    );
  }
}
