import { NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { nama, password } = await req.json();

    if (!nama || !password) {
      return NextResponse.json(
        { message: "Nama dan password wajib diisi" },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.nama, nama.trim()),
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { message: "Akun tidak ditemukan" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { message: "Password salah" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: { id: user.id, nama: user.nama, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
