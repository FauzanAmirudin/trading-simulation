import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { respondentProfiles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get("userId");

    if (!userIdParam) {
      return NextResponse.json({ error: "Parameter userId wajib diisi." }, { status: 400 });
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "userId tidak valid." }, { status: 400 });
    }

    // If session is present and user is not admin, prevent checking other users' status
    if (session && session.role !== "admin" && session.id !== userId) {
      return NextResponse.json(
        { error: "Akses ditolak: Anda hanya dapat memeriksa status akun Anda sendiri." },
        { status: 403 }
      );
    }

    // Combined single query with LEFT JOIN for optimal 1-hop DB performance
    const rows = await db
      .select({
        userId: users.id,
        role: users.role,
        isCompleted: respondentProfiles.isCompleted,
        completedAt: respondentProfiles.completedAt,
      })
      .from(users)
      .leftJoin(respondentProfiles, eq(users.id, respondentProfiles.userId))
      .where(eq(users.id, userId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    const row = rows[0];

    // Admin accounts bypass questionnaire
    if (row.role === "admin") {
      return NextResponse.json(
        {
          success: true,
          isCompleted: true,
          isAdmin: true,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
          },
        }
      );
    }

    const isCompleted = Boolean(row.isCompleted);
    return NextResponse.json(
      {
        success: true,
        isCompleted,
        completedAt: isCompleted ? row.completedAt : null,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=120, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: any) {
    console.error("Error checking questionnaire status:", error);
    return NextResponse.json(
      { error: "Gagal memeriksa status kuesioner" },
      { status: 500 }
    );
  }
}
