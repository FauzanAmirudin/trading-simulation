import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { simulationEvaluations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  EVALUATION_QUESTIONS,
  getEvaluationOptionLabel,
} from "@/lib/evaluation-questions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, answers } = body;

    if (!userId || !answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Data pengiriman evaluasi tidak lengkap." },
        { status: 400 }
      );
    }

    const uId = parseInt(userId, 10);
    if (isNaN(uId)) {
      return NextResponse.json(
        { error: "ID Responden tidak valid." },
        { status: 400 }
      );
    }

    // Verify user exists and is a respondent
    const [user] = await db
      .select({ id: users.id, nama: users.nama, role: users.role })
      .from(users)
      .where(eq(users.id, uId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Responden tidak ditemukan." },
        { status: 404 }
      );
    }

    // Validate that all 10 questions are answered (1..10) with values 1..5
    const missingQuestions: number[] = [];
    const formattedAnswers: Record<
      string,
      { orderNumber: number; questionText: string; score: number; label: string }
    > = {};

    const values: Record<string, number> = {};

    for (const q of EVALUATION_QUESTIONS) {
      const val = answers[q.id] ?? answers[q.orderNumber];
      if (val === undefined || val === null || typeof val !== "number" || val < 1 || val > 5) {
        missingQuestions.push(q.orderNumber);
      } else {
        const score = Math.round(val);
        values[`q${q.orderNumber}`] = score;
        formattedAnswers[String(q.orderNumber)] = {
          orderNumber: q.orderNumber,
          questionText: q.questionText,
          score,
          label: getEvaluationOptionLabel(score),
        };
      }
    }

    if (missingQuestions.length > 0) {
      return NextResponse.json(
        {
          error: `Semua 10 pertanyaan evaluasi wajib diisi! Pertanyaan yang belum diisi: nomor ${missingQuestions.join(", ")}.`,
          missingQuestions,
        },
        { status: 400 }
      );
    }

    // Upsert evaluation record
    const [existing] = await db
      .select({ id: simulationEvaluations.id })
      .from(simulationEvaluations)
      .where(eq(simulationEvaluations.userId, uId))
      .limit(1);

    const now = new Date();

    if (existing) {
      await db
        .update(simulationEvaluations)
        .set({
          q1: values.q1,
          q2: values.q2,
          q3: values.q3,
          q4: values.q4,
          q5: values.q5,
          q6: values.q6,
          q7: values.q7,
          q8: values.q8,
          q9: values.q9,
          q10: values.q10,
          answers: formattedAnswers,
          isCompleted: true,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(simulationEvaluations.id, existing.id));
    } else {
      await db.insert(simulationEvaluations).values({
        userId: uId,
        q1: values.q1,
        q2: values.q2,
        q3: values.q3,
        q4: values.q4,
        q5: values.q5,
        q6: values.q6,
        q7: values.q7,
        q8: values.q8,
        q9: values.q9,
        q10: values.q10,
        answers: formattedAnswers,
        isCompleted: true,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Evaluasi simulasi perdagangan saham berhasil disimpan.",
    });
  } catch (error: any) {
    console.error("Error submitting simulation evaluation:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server saat menyimpan evaluasi." },
      { status: 500 }
    );
  }
}
