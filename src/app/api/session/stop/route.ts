import { db } from "@/db/connect";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const [closed] = await db
      .update(sessions)
      .set({ status: "closed", endTime: new Date() })
      .where(eq(sessions.status, "active"))
      .returning();

    return NextResponse.json({ session: closed || null });
  } catch (error) {
    console.error("Session stop error:", error);
    return NextResponse.json({ error: "Gagal menghentikan sesi" }, { status: 500 });
  }
}
