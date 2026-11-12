import { NextRequest, NextResponse } from "next/server";
import { generateResumeWorkbook } from "@/lib/exports/resume";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const roundIds = searchParams.get("roundIds");
    const excludedRoundIds = searchParams.get("excludedRoundIds");
    const onlyCompleted = searchParams.get("onlyCompleted");
    const period = searchParams.get("period");
    const session = searchParams.get("session");

    const result = await generateResumeWorkbook({
      date,
      roundIds,
      excludedRoundIds,
      onlyCompleted,
      period,
      session,
    });

    if (!result) {
      return NextResponse.json({ error: "Tidak ada data responden." }, { status: 404 });
    }

    const uint8 = new Uint8Array(result.buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(uint8.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Export Excel Admin] Error:", error);
    return NextResponse.json({ error: "Gagal men-generate file Excel." }, { status: 500 });
  }
}
