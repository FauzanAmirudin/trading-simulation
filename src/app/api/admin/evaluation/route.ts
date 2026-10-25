import { NextRequest, NextResponse } from "next/server";
import { db, ensureQuestionnaireSchema } from "@/db/connect";
import { users, simulationEvaluations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-server";
import {
  EVALUATION_QUESTIONS,
  EVALUATION_LIKERT_OPTIONS,
  getEvaluationOptionLabel,
} from "@/lib/evaluation-questions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    await ensureQuestionnaireSchema();

    const [allRespondents, allEvaluations] = await Promise.all([
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
      db.select().from(simulationEvaluations).catch(() => []),
    ]);

    const evalMap = new Map(allEvaluations.map((e) => [e.userId, e]));
    const totalRegistered = allRespondents.length;
    const completedCount = allEvaluations.length;
    const pendingCount = Math.max(0, totalRegistered - completedCount);
    const completionRate =
      totalRegistered > 0
        ? Number(((completedCount / totalRegistered) * 100).toFixed(1))
        : 0;

    // Calculate distribution & averages for each question (1..10)
    const questionStats = EVALUATION_QUESTIONS.map((q) => {
      const qKey = `q${q.orderNumber}` as keyof typeof allEvaluations[0];
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      let totalAnswered = 0;

      allEvaluations.forEach((e) => {
        const val = e[qKey] as number;
        if (typeof val === "number" && val >= 1 && val <= 5) {
          counts[val] = (counts[val] || 0) + 1;
          sum += val;
          totalAnswered++;
        }
      });

      const average = totalAnswered > 0 ? Number((sum / totalAnswered).toFixed(2)) : 0;

      const distribution = EVALUATION_LIKERT_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        short: opt.short,
        count: counts[opt.value] || 0,
        percentage:
          totalAnswered > 0
            ? Number((((counts[opt.value] || 0) / totalAnswered) * 100).toFixed(1))
            : 0,
      }));

      return {
        id: q.id,
        orderNumber: q.orderNumber,
        questionText: q.questionText,
        average,
        totalAnswered,
        distribution,
      };
    });

    // Respondent list with their individual answers
    const respondentList = allRespondents.map((u) => {
      const ev = evalMap.get(u.id);
      return {
        userId: u.id,
        nama: u.nama,
        isCompleted: Boolean(ev?.isCompleted),
        completedAt: ev?.completedAt
          ? (ev.completedAt instanceof Date
              ? ev.completedAt.toISOString()
              : new Date(ev.completedAt).toISOString())
          : null,
        answers: ev
          ? {
              q1: { score: ev.q1, label: getEvaluationOptionLabel(ev.q1) },
              q2: { score: ev.q2, label: getEvaluationOptionLabel(ev.q2) },
              q3: { score: ev.q3, label: getEvaluationOptionLabel(ev.q3) },
              q4: { score: ev.q4, label: getEvaluationOptionLabel(ev.q4) },
              q5: { score: ev.q5, label: getEvaluationOptionLabel(ev.q5) },
              q6: { score: ev.q6, label: getEvaluationOptionLabel(ev.q6) },
              q7: { score: ev.q7, label: getEvaluationOptionLabel(ev.q7) },
              q8: { score: ev.q8, label: getEvaluationOptionLabel(ev.q8) },
              q9: { score: ev.q9, label: getEvaluationOptionLabel(ev.q9) },
              q10: { score: ev.q10, label: getEvaluationOptionLabel(ev.q10) },
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalRegistered,
        completedCount,
        pendingCount,
        completionRate,
        questions: questionStats,
      },
      respondents: respondentList,
    });
  } catch (error: any) {
    console.error("Error fetching admin evaluation data:", error);
    return NextResponse.json(
      { error: "Gagal memuat data evaluasi simulasi responden." },
      { status: 500 }
    );
  }
}
