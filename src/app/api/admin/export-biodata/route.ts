import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { generateBiodataWorkbook } from "@/lib/exports/biodata";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    const result = await generateBiodataWorkbook();
    if (!result) {
      return NextResponse.json(
        { error: "Belum ada responden yang mengisi kuesioner biodata untuk diekspor." },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: unknown) {
    console.error("Error exporting biodata to Excel:", error);
    const message = error instanceof Error ? error.message : "Gagal mengekspor data biodata responden ke Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
