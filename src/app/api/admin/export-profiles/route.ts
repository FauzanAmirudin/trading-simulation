import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { generateProfilesWorkbook } from "@/lib/exports/profiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const targetUserIdParam = searchParams.get("userId");
    const targetUserId = targetUserIdParam ? parseInt(targetUserIdParam, 10) : null;

    const result = await generateProfilesWorkbook(targetUserId);
    if (!result) {
      return NextResponse.json({ error: "Tidak ada data responden." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error exporting respondent profiles to Excel:", error);
    const message = error instanceof Error ? error.message : "Gagal mengekspor data profil responden ke Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
