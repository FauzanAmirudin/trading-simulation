import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { generateEvaluationWorkbook } from "@/lib/exports/evaluation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const targetUserIdParam = searchParams.get("userId");
    const targetUserId = targetUserIdParam ? parseInt(targetUserIdParam, 10) : null;

    const result = await generateEvaluationWorkbook(targetUserId);
    if (!result) {
      return NextResponse.json(
        { error: "Belum ada responden yang mengisi kuesioner evaluasi untuk diekspor." },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error exporting evaluation data to Excel:", error);
    const message = error instanceof Error ? error.message : "Gagal mengekspor data evaluasi ke Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
