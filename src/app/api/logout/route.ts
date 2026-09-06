import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-server";

export async function POST() {
  const res = NextResponse.json({ success: true, message: "Berhasil logout" });
  clearSessionCookie(res);
  return res;
}
