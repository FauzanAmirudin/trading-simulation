import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { respondentBiodata, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    const body = await req.json();
    const { userId, biodata } = body;

    if (!userId || !biodata || typeof biodata !== "object") {
      return NextResponse.json(
        { error: "Format data tidak valid. userId dan biodata diperlukan." },
        { status: 400 }
      );
    }

    const uid = parseInt(userId, 10);
    if (isNaN(uid)) {
      return NextResponse.json({ error: "userId tidak valid." }, { status: 400 });
    }

    // Access authorization
    if (session && session.role !== "admin" && session.id !== uid) {
      return NextResponse.json(
        { error: "Akses ditolak: Anda hanya dapat menyimpan biodata untuk akun Anda sendiri." },
        { status: 403 }
      );
    }

    // Check user exists
    const userList = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (userList.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    // Validate 8 questions
    const {
      jenisKelamin,
      usia,
      programStudi,
      semester,
      pernahInvestasiSaham,
      pernahPelatihanInvestasi,
      sumberPenghasilan,
      sumberPenghasilanLainnya,
      jurusanSma,
    } = biodata;

    if (!jenisKelamin || !["Laki-laki", "Perempuan"].includes(jenisKelamin)) {
      return NextResponse.json({ error: "Pilihan Jenis Kelamin wajib diisi (Laki-laki atau Perempuan)." }, { status: 400 });
    }

    const parsedUsia = parseInt(usia, 10);
    if (isNaN(parsedUsia) || parsedUsia < 10 || parsedUsia > 100) {
      return NextResponse.json({ error: "Usia harus berupa angka usia yang valid (tahun)." }, { status: 400 });
    }

    if (!programStudi || typeof programStudi !== "string" || !programStudi.trim()) {
      return NextResponse.json({ error: "Program Studi / Jurusan kuliah wajib diisi." }, { status: 400 });
    }

    const parsedSemester = parseInt(semester, 10);
    if (isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 20) {
      return NextResponse.json({ error: "Semester saat ini harus berupa angka yang valid." }, { status: 400 });
    }

    if (!pernahInvestasiSaham || !["Ya", "Tidak"].includes(pernahInvestasiSaham)) {
      return NextResponse.json({ error: "Pertanyaan riwayat investasi di pasar saham wajib dijawab." }, { status: 400 });
    }

    if (!pernahPelatihanInvestasi || !["Ya", "Tidak"].includes(pernahPelatihanInvestasi)) {
      return NextResponse.json({ error: "Pertanyaan mata kuliah/pelatihan investasi wajib dijawab." }, { status: 400 });
    }

    if (!sumberPenghasilan || !["Orang tua", "Beasiswa", "Pekerjaan sampingan", "Lainnya"].includes(sumberPenghasilan)) {
      return NextResponse.json({ error: "Sumber penghasilan utama wajib dipilih." }, { status: 400 });
    }

    if (sumberPenghasilan === "Lainnya" && (!sumberPenghasilanLainnya || !sumberPenghasilanLainnya.trim())) {
      return NextResponse.json({ error: "Harap sebutkan rincian sumber penghasilan lainnya." }, { status: 400 });
    }

    if (!jurusanSma || !["IPA", "IPS", "Bahasa/lain-lain"].includes(jurusanSma)) {
      return NextResponse.json({ error: "Jurusan sewaktu SMA wajib dipilih." }, { status: 400 });
    }

    const now = new Date();
    const existing = await db
      .select()
      .from(respondentBiodata)
      .where(eq(respondentBiodata.userId, uid))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(respondentBiodata).values({
        userId: uid,
        jenisKelamin,
        usia: parsedUsia,
        programStudi: programStudi.trim(),
        semester: parsedSemester,
        pernahInvestasiSaham,
        pernahPelatihanInvestasi,
        sumberPenghasilan,
        sumberPenghasilanLainnya: sumberPenghasilan === "Lainnya" ? sumberPenghasilanLainnya.trim() : null,
        jurusanSma,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db
        .update(respondentBiodata)
        .set({
          jenisKelamin,
          usia: parsedUsia,
          programStudi: programStudi.trim(),
          semester: parsedSemester,
          pernahInvestasiSaham,
          pernahPelatihanInvestasi,
          sumberPenghasilan,
          sumberPenghasilanLainnya: sumberPenghasilan === "Lainnya" ? sumberPenghasilanLainnya.trim() : null,
          jurusanSma,
          updatedAt: now,
        })
        .where(eq(respondentBiodata.userId, uid));
    }

    return NextResponse.json({
      success: true,
      message: "Biodata responden berhasil disimpan.",
    });
  } catch (error: any) {
    console.error("Error saving respondent biodata:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server saat menyimpan biodata responden." },
      { status: 500 }
    );
  }
}
