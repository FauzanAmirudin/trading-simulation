import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentProfiles, questionnaireResponses, questions, respondentBiodata, simulationEvaluations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { PROFILE_MATRIX, ProfileGroup } from "@/lib/questionnaire-logic";
import { requireAdmin } from "@/lib/auth-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "ID Responden tidak valid." },
        { status: 400 }
      );
    }

    // Fetch user, profile, biodata, all questions, user responses, and respondent list in parallel
    const [
      [user],
      [profile],
      [biodata],
      allQuestions,
      userResponses,
      allRespondents,
      evalRows,
    ] = await Promise.all([
      db
        .select({
          id: users.id,
          nama: users.nama,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId)),
      db
        .select()
        .from(respondentProfiles)
        .where(eq(respondentProfiles.userId, userId)),
      db
        .select()
        .from(respondentBiodata)
        .where(eq(respondentBiodata.userId, userId)),
      db
        .select()
        .from(questions)
        .orderBy(asc(questions.instrument), asc(questions.orderNumber)),
      db
        .select()
        .from(questionnaireResponses)
        .where(eq(questionnaireResponses.userId, userId)),
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "responden"))
        .orderBy(asc(users.id)),
      db
        .select()
        .from(simulationEvaluations)
        .where(eq(simulationEvaluations.userId, userId)),
    ]);
    const userEval = evalRows[0] || null;

    if (!user) {
      return NextResponse.json(
        { error: "Data responden tidak ditemukan." },
        { status: 404 }
      );
    }

    const isCompleted = Boolean(profile?.isCompleted);
    const groupKey = (profile?.profileGroup || "E") as ProfileGroup;
    const groupDef = PROFILE_MATRIX[groupKey] || PROFILE_MATRIX.E;

    // Combine Questions & Responses
    const responseMap = new Map(userResponses.map((r) => [r.questionId, r]));
    const combinedResponses = allQuestions.map((q) => {
      const resp = responseMap.get(q.id);
      return {
        id: resp?.id || null,
        questionId: q.id,
        instrument: q.instrument as "LA" | "EI",
        orderNumber: q.orderNumber,
        questionText: q.questionText,
        score: resp ? resp.score : null,
        scaleMin: q.scaleMin,
        scaleMax: q.scaleMax,
        scaleMinLabel: q.scaleMinLabel,
        scaleMaxLabel: q.scaleMaxLabel,
        createdAt: resp?.createdAt ? resp.createdAt.toISOString() : null,
      };
    });

    // Calculate Score Frequency Distribution
    const scoreFrequency: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const laScoreFrequency: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const eiScoreFrequency: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    let answeredCount = 0;

    combinedResponses.forEach((r) => {
      if (r.score !== null) {
        answeredCount++;
        if (scoreFrequency[r.score] !== undefined) scoreFrequency[r.score]++;
        if (r.instrument === "LA" && laScoreFrequency[r.score] !== undefined) {
          laScoreFrequency[r.score]++;
        }
        if (r.instrument === "EI" && eiScoreFrequency[r.score] !== undefined) {
          eiScoreFrequency[r.score]++;
        }
      }
    });

    // Determine Prev & Next Respondent for Navigation Pager
    const currentIndex = allRespondents.findIndex((r) => r.id === userId);
    const prevUserId = currentIndex > 0 ? allRespondents[currentIndex - 1].id : null;
    const nextUserId =
      currentIndex >= 0 && currentIndex < allRespondents.length - 1
        ? allRespondents[currentIndex + 1].id
        : null;


    // Calculate Ranks among completed profiles (1 = skor tertinggi dari atas ke bawah)
    const allCompletedProfiles = await db
      .select({
        userId: respondentProfiles.userId,
        laRawScore: respondentProfiles.laRawScore,
        eiRawScore: respondentProfiles.eiRawScore,
      })
      .from(respondentProfiles)
      .where(eq(respondentProfiles.isCompleted, true));

    const sortedLA = [...allCompletedProfiles].sort((a, b) => b.laRawScore - a.laRawScore || a.userId - b.userId);
    const laRankIndex = sortedLA.findIndex((p) => p.userId === userId);
    const laRank = laRankIndex >= 0 ? laRankIndex + 1 : null;

    const sortedEI = [...allCompletedProfiles].sort((a, b) => b.eiRawScore - a.eiRawScore || a.userId - b.userId);
    const eiRankIndex = sortedEI.findIndex((p) => p.userId === userId);
    const eiRank = eiRankIndex >= 0 ? eiRankIndex + 1 : null;

    return NextResponse.json({
      success: true,
      respondent: {
        userId: user.id,
        nama: user.nama,
        role: user.role,
        isCompleted,
        laRawScore: profile ? profile.laRawScore : null,
        laAvgScore: profile ? Number(profile.laAvgScore) : null,
        laRank,
        laCategory: profile ? profile.laCategory : null,
        eiRawScore: profile ? profile.eiRawScore : null,
        eiAvgScore: profile ? Number(profile.eiAvgScore) : null,
        eiRank,
        eiCategory: profile ? profile.eiCategory : null,
        totalCompletedUsers: allCompletedProfiles.length,
        profileCode: profile ? profile.profileCode : null,
        profileLabel: profile ? profile.profileLabel : null,
        profileGroup: profile ? profile.profileGroup : null,
        profileGroupName: profile ? groupDef.name : null,
        profileDescription: profile ? groupDef.description : null,
        completedAt: profile?.completedAt ? profile.completedAt.toISOString() : null,
        biodata: biodata
          ? {
              jenisKelamin: biodata.jenisKelamin,
              usia: biodata.usia,
              programStudi: biodata.programStudi,
              semester: biodata.semester,
              pernahInvestasiSaham: biodata.pernahInvestasiSaham,
              pernahPelatihanInvestasi: biodata.pernahPelatihanInvestasi,
              sumberPenghasilan: biodata.sumberPenghasilan,
              sumberPenghasilanLainnya: biodata.sumberPenghasilanLainnya,
              jurusanSma: biodata.jurusanSma,
              createdAt: biodata.createdAt ? biodata.createdAt.toISOString() : null,
            }
          : null,
        evaluation: userEval
          ? {
              isCompleted: Boolean(userEval.isCompleted),
              completedAt: userEval.completedAt ? userEval.completedAt.toISOString() : null,
              answers: userEval.answers,
              q1: userEval.q1,
              q2: userEval.q2,
              q3: userEval.q3,
              q4: userEval.q4,
              q5: userEval.q5,
              q6: userEval.q6,
              q7: userEval.q7,
              q8: userEval.q8,
              q9: userEval.q9,
              q10: userEval.q10,
            }
          : null,
      },
      stats: {
        totalQuestions: allQuestions.length,
        answeredCount,
        scoreFrequency,
        laScoreFrequency,
        eiScoreFrequency,
      },
      responses: combinedResponses,
      navigation: {
        prevUserId,
        nextUserId,
        currentIndex: currentIndex >= 0 ? currentIndex + 1 : 1,
        totalRespondents: allRespondents.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching respondent detail:", error);
    return NextResponse.json(
      { error: "Gagal memuat detail hasil pengisian kuesioner responden." },
      { status: 500 }
    );
  }
}
