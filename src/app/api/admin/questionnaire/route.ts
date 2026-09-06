import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { questions, questionnaireResponses } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

// ── GET all questions (with response statistics) ──
export async function GET(req: NextRequest) {
  try {
    const allQuestions = await db
      .select()
      .from(questions)
      .orderBy(asc(questions.instrument), asc(questions.orderNumber));

    // Get response count per question
    const responseCounts = await db
      .select({
        questionId: questionnaireResponses.questionId,
        count: sql<number>`count(*)::int`,
        avgScore: sql<number>`round(avg(${questionnaireResponses.score})::numeric, 2)::float`,
      })
      .from(questionnaireResponses)
      .groupBy(questionnaireResponses.questionId);

    const statsMap = new Map(responseCounts.map((r) => [r.questionId, r]));

    const enriched = allQuestions.map((q) => {
      const stat = statsMap.get(q.id);
      return {
        ...q,
        totalResponses: stat?.count || 0,
        averageScore: stat?.avgScore || 0,
      };
    });

    return NextResponse.json({
      success: true,
      questions: enriched,
    });
  } catch (error: any) {
    console.error("Error fetching admin questions:", error);
    return NextResponse.json({ error: "Gagal memuat daftar pertanyaan." }, { status: 500 });
  }
}

// ── POST create a new question ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instrument, questionText, orderNumber, isActive } = body;

    if (!instrument || !["LA", "EI"].includes(instrument)) {
      return NextResponse.json(
        { error: "Instrumen harus berupa 'LA' (Loss Aversion) atau 'EI' (Emotional Intelligence)." },
        { status: 400 }
      );
    }

    if (!questionText || typeof questionText !== "string" || questionText.trim().length === 0) {
      return NextResponse.json({ error: "Teks pertanyaan wajib diisi." }, { status: 400 });
    }

    const nextOrder = Number(orderNumber) || 1;

    const inserted = await db
      .insert(questions)
      .values({
        instrument,
        orderNumber: nextOrder,
        questionText: questionText.trim(),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: "Sangat Tidak Setuju",
        scaleMaxLabel: "Sangat Setuju",
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: "Pertanyaan baru berhasil ditambahkan.",
      question: inserted[0],
    });
  } catch (error: any) {
    console.error("Error creating question:", error);
    return NextResponse.json({ error: "Gagal menambahkan pertanyaan." }, { status: 500 });
  }
}

// ── PUT update an existing question ──
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, instrument, questionText, orderNumber, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "ID pertanyaan wajib disertakan." }, { status: 400 });
    }

    const existing = await db.select().from(questions).where(eq(questions.id, Number(id))).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Pertanyaan tidak ditemukan." }, { status: 404 });
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (instrument && ["LA", "EI"].includes(instrument)) {
      updates.instrument = instrument;
    }
    if (questionText !== undefined && typeof questionText === "string") {
      updates.questionText = questionText.trim();
    }
    if (orderNumber !== undefined) {
      updates.orderNumber = Number(orderNumber);
    }
    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive);
    }

    const updated = await db
      .update(questions)
      .set(updates)
      .where(eq(questions.id, Number(id)))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Pertanyaan berhasil diperbarui.",
      question: updated[0],
    });
  } catch (error: any) {
    console.error("Error updating question:", error);
    return NextResponse.json({ error: "Gagal memperbarui pertanyaan." }, { status: 500 });
  }
}

// ── DELETE delete a question ──
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json({ error: "ID pertanyaan wajib disertakan." }, { status: 400 });
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID pertanyaan tidak valid." }, { status: 400 });
    }

    // Check if responses exist for this question
    const responses = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questionnaireResponses)
      .where(eq(questionnaireResponses.questionId, id));

    if (responses[0]?.count > 0) {
      // Instead of hard delete, deactivate the question to preserve data integrity
      await db.update(questions).set({ isActive: false }).where(eq(questions.id, id));
      return NextResponse.json({
        success: true,
        message: "Pertanyaan telah dinonaktifkan karena telah memiliki riwayat jawaban responden.",
      });
    }

    await db.delete(questions).where(eq(questions.id, id));
    return NextResponse.json({
      success: true,
      message: "Pertanyaan berhasil dihapus.",
    });
  } catch (error: any) {
    console.error("Error deleting question:", error);
    return NextResponse.json({ error: "Gagal menghapus pertanyaan." }, { status: 500 });
  }
}
