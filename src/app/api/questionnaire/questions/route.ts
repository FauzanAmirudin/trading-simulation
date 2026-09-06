import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { questions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const activeQuestions = await db
      .select({
        id: questions.id,
        instrument: questions.instrument,
        orderNumber: questions.orderNumber,
        questionText: questions.questionText,
        scaleMin: questions.scaleMin,
        scaleMax: questions.scaleMax,
        scaleMinLabel: questions.scaleMinLabel,
        scaleMaxLabel: questions.scaleMaxLabel,
      })
      .from(questions)
      .where(eq(questions.isActive, true))
      .orderBy(asc(questions.orderNumber));

    const la = activeQuestions.filter((q) => q.instrument === "LA");
    const ei = activeQuestions.filter((q) => q.instrument === "EI");

    return NextResponse.json({
      success: true,
      totalCount: activeQuestions.length,
      la,
      ei,
    });
  } catch (error: any) {
    console.error("Error fetching questionnaire questions:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar pertanyaan kuesioner" },
      { status: 500 }
    );
  }
}
