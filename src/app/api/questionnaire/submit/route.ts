import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { questions, questionnaireResponses, respondentProfiles, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { classifyByStandardCutoff, getProfileByCategories } from "@/lib/questionnaire-logic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, responses } = body;

    if (!userId || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: "Format data tidak valid. userId dan responses diperlukan." },
        { status: 400 }
      );
    }

    const uid = parseInt(userId, 10);
    if (isNaN(uid)) {
      return NextResponse.json({ error: "userId tidak valid." }, { status: 400 });
    }

    // Check user
    const userList = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (userList.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    // Fetch all active questions from DB
    const activeQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.isActive, true));

    if (activeQuestions.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada pertanyaan kuesioner yang aktif." },
        { status: 400 }
      );
    }

    const questionMap = new Map(activeQuestions.map((q) => [q.id, q]));

    // Validate that each response corresponds to an active question and has a valid score (1-5)
    const responseMap = new Map<number, number>();
    for (const item of responses) {
      const qId = Number(item.questionId);
      const score = Number(item.score);

      if (!questionMap.has(qId)) {
        return NextResponse.json(
          { error: `Pertanyaan dengan ID ${qId} tidak valid atau tidak aktif.` },
          { status: 400 }
        );
      }

      if (isNaN(score) || score < 1 || score > 5 || !Number.isInteger(score)) {
        return NextResponse.json(
          { error: `Nilai jawaban untuk butir pertanyaan ${qId} harus bernilai antara 1 sampai 5.` },
          { status: 400 }
        );
      }

      responseMap.set(qId, score);
    }

    // Ensure all active questions have been answered
    const missingQuestionIds = activeQuestions
      .filter((q) => !responseMap.has(q.id))
      .map((q) => `${q.instrument} Q${q.orderNumber}`);

    if (missingQuestionIds.length > 0) {
      return NextResponse.json(
        {
          error: `Terdapat pertanyaan yang belum diisi: ${missingQuestionIds.slice(0, 5).join(", ")}${
            missingQuestionIds.length > 5 ? "..." : ""
          }`,
        },
        { status: 400 }
      );
    }

    // Save/Upsert raw responses into questionnaire_responses
    // 1. Delete previous responses if any to ensure clean fresh set
    await db.delete(questionnaireResponses).where(eq(questionnaireResponses.userId, uid));

    // 2. Insert all responses
    const rawInserts = activeQuestions.map((q) => ({
      userId: uid,
      questionId: q.id,
      instrument: q.instrument,
      score: responseMap.get(q.id)!,
    }));

    await db.insert(questionnaireResponses).values(rawInserts);

    // 3. Calculate separate raw and average scores for LA and EI
    let laRaw = 0;
    let laCount = 0;
    let eiRaw = 0;
    let eiCount = 0;

    for (const q of activeQuestions) {
      const score = responseMap.get(q.id)!;
      if (q.instrument === "LA") {
        laRaw += score;
        laCount++;
      } else if (q.instrument === "EI") {
        eiRaw += score;
        eiCount++;
      }
    }

    const laAvg = laCount > 0 ? Number((laRaw / laCount).toFixed(2)) : 0;
    const eiAvg = eiCount > 0 ? Number((eiRaw / eiCount).toFixed(2)) : 0;

    // 4. Determine initial categories and 9-group combination (Independently)
    const laCat = classifyByStandardCutoff(laRaw, laCount);
    const eiCat = classifyByStandardCutoff(eiRaw, eiCount);
    const profileDef = getProfileByCategories(laCat, eiCat);

    // 5. Upsert into respondent_profiles
    const existingProfile = await db
      .select()
      .from(respondentProfiles)
      .where(eq(respondentProfiles.userId, uid))
      .limit(1);

    const now = new Date();
    if (existingProfile.length === 0) {
      await db.insert(respondentProfiles).values({
        userId: uid,
        laRawScore: laRaw,
        laAvgScore: laAvg.toString(),
        laCategory: laCat,
        eiRawScore: eiRaw,
        eiAvgScore: eiAvg.toString(),
        eiCategory: eiCat,
        profileCode: profileDef.code,
        profileLabel: profileDef.label,
        profileGroup: profileDef.group,
        isCompleted: true,
        completedAt: now,
      });
    } else {
      await db
        .update(respondentProfiles)
        .set({
          laRawScore: laRaw,
          laAvgScore: laAvg.toString(),
          laCategory: laCat,
          eiRawScore: eiRaw,
          eiAvgScore: eiAvg.toString(),
          eiCategory: eiCat,
          profileCode: profileDef.code,
          profileLabel: profileDef.label,
          profileGroup: profileDef.group,
          isCompleted: true,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(respondentProfiles.userId, uid));
    }

    // 6. Return sterile success confirmation to respondent (NO score / profile leakage)
    return NextResponse.json({
      success: true,
      message: "Kuesioner profil berhasil diselesaikan. Terima kasih atas partisipasi Anda!",
    });
  } catch (error: any) {
    console.error("Error submitting questionnaire:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server saat memproses jawaban kuesioner." },
      { status: 500 }
    );
  }
}
