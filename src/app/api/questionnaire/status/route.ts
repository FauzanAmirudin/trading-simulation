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

    // Check user exists
    const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userList.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    const user = userList[0];

    // Admin accounts bypass questionnaire
    if (user.role === "admin") {
      return NextResponse.json({
        success: true,
        isCompleted: true,
        isAdmin: true,
      });
    }

    // Check respondent profile
    const profile = await db
      .select({
        isCompleted: respondentProfiles.isCompleted,
        completedAt: respondentProfiles.completedAt,
      })
      .from(respondentProfiles)
      .where(eq(respondentProfiles.userId, userId))
      .limit(1);

    if (profile.length === 0 || !profile[0].isCompleted) {
      return NextResponse.json({
        success: true,
        isCompleted: false,
        completedAt: null,
      });
    }

    return NextResponse.json({
      success: true,
      isCompleted: true,
      completedAt: profile[0].completedAt,
    });
  } catch (error: any) {
    console.error("Error checking questionnaire status:", error);
    return NextResponse.json(
      { error: "Gagal memeriksa status kuesioner" },
      { status: 500 }
    );
  }
}
