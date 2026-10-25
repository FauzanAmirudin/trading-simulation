import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { questions, questionnaireResponses, respondentProfiles, respondentBiodata, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { classifyByStandardCutoff, getProfileByCategories, computePopulationTerciles } from "@/lib/questionnaire-logic";
import { getSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    const body = await req.json();
    const { userId, responses, biodata } = body;

    if (!userId || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: "Format data tidak valid. userId dan responses diperlukan." },
        { status: 400 }
      );
    }

    const uid = parseInt(userId, 10);
    if (isNaN(uid)) {
      return NextResponse.json({ error: "userId tidak valid." }, { status: 400 });
    }

    // If session is present and user is not admin, ensure they can only submit for themselves
    if (session && session.role !== "admin" && session.id !== uid) {
      return NextResponse.json(
        { error: "Akses ditolak: Anda hanya dapat mengirimkan jawaban untuk akun Anda sendiri." },
        { status: 403 }
      );
    }

    // Check user
    const userList = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (userList.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    // Validate Biodata (8 butir dari instrumen penelitian)
    let validatedBiodata: any = null;
    if (biodata && typeof biodata === "object") {
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

      validatedBiodata = {
        jenisKelamin,
        usia: parsedUsia,
        programStudi: programStudi.trim(),
        semester: parsedSemester,
        pernahInvestasiSaham,
        pernahPelatihanInvestasi,
        sumberPenghasilan,
        sumberPenghasilanLainnya: sumberPenghasilan === "Lainnya" ? sumberPenghasilanLainnya.trim() : null,
        jurusanSma,
      };
    } else {
      // If biodata not in payload, check if already saved in DB
      const existingBiodata = await db
        .select()
        .from(respondentBiodata)
        .where(eq(respondentBiodata.userId, uid))
        .limit(1);

      if (existingBiodata.length === 0) {
        return NextResponse.json(
          { error: "Biodata responden wajib diisi terlebih dahulu sebelum mengirimkan jawaban." },
          { status: 400 }
        );
      }
    }

    // Check if questionnaire already completed (Prevent Re-submission)
    const existingProfile = await db
      .select()
      .from(respondentProfiles)
      .where(eq(respondentProfiles.userId, uid))
      .limit(1);

    if (existingProfile.length > 0 && existingProfile[0].isCompleted) {
      return NextResponse.json(
        { error: "Kuesioner sudah pernah diselesaikan dan tidak dapat diubah kembali." },
        { status: 409 }
      );
    }

    // Fetch all active questions from DB
    const activeQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.isActive, true));

    if (activeQuestions.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada pertanyaan kuesioner yang aktif." },
        { status: 400 }
      );
    }

    const questionMap = new Map(activeQuestions.map((q) => [q.id, q]));

    // Validate that each response corresponds to an active question and has a valid score (1-5)
    const responseMap = new Map<number, number>();
    for (const item of responses) {
      const qId = Number(item.questionId);
      const score = Number(item.score);

      if (!questionMap.has(qId)) {
        return NextResponse.json(
          { error: `Pertanyaan dengan ID ${qId} tidak valid atau tidak aktif.` },
          { status: 400 }
        );
      }

      if (isNaN(score) || score < 1 || score > 5 || !Number.isInteger(score)) {
        return NextResponse.json(
          { error: `Nilai jawaban untuk butir pertanyaan ${qId} harus bernilai antara 1 sampai 5.` },
          { status: 400 }
        );
      }

      responseMap.set(qId, score);
    }

    // Ensure all active questions have been answered
    const missingQuestionIds = activeQuestions
      .filter((q) => !responseMap.has(q.id))
      .map((q) => `${q.instrument} Q${q.orderNumber}`);

    if (missingQuestionIds.length > 0) {
      return NextResponse.json(
        {
          error: `Terdapat pertanyaan yang belum diisi: ${missingQuestionIds.slice(0, 5).join(", ")}${
            missingQuestionIds.length > 5 ? "..." : ""
          }`,
        },
        { status: 400 }
      );
    }

    // Calculate separate raw and average scores for LA and EI
    let laRaw = 0;
    let laCount = 0;
    let eiRaw = 0;
    let eiCount = 0;

    for (const q of activeQuestions) {
      const score = responseMap.get(q.id)!;
      if (q.instrument === "LA") {
        laRaw += score;
        laCount++;
      } else if (q.instrument === "EI") {
        eiRaw += score;
        eiCount++;
      }
    }

    const laAvg = laCount > 0 ? Number((laRaw / laCount).toFixed(2)) : 0;
    const eiAvg = eiCount > 0 ? Number((eiRaw / eiCount).toFixed(2)) : 0;

    // Determine initial categories and 9-group combination (Independently)
    const laCat = classifyByStandardCutoff(laRaw, laCount);
    const eiCat = classifyByStandardCutoff(eiRaw, eiCount);
    const profileDef = getProfileByCategories(laCat, eiCat);

    // Save responses and profile atomically inside database transaction
    const now = new Date();
    await db.transaction(async (tx) => {
      // 0. Upsert Biodata Responden jika disertakan
      if (validatedBiodata) {
        const existingBio = await tx
          .select()
          .from(respondentBiodata)
          .where(eq(respondentBiodata.userId, uid))
          .limit(1);

        if (existingBio.length === 0) {
          await tx.insert(respondentBiodata).values({
            userId: uid,
            ...validatedBiodata,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await tx
            .update(respondentBiodata)
            .set({
              ...validatedBiodata,
              updatedAt: now,
            })
            .where(eq(respondentBiodata.userId, uid));
        }
      }

      // 1. Delete previous responses if any
      await tx.delete(questionnaireResponses).where(eq(questionnaireResponses.userId, uid));

      // 2. Insert all responses
      const rawInserts = activeQuestions.map((q) => ({
        userId: uid,
        questionId: q.id,
        instrument: q.instrument,
        score: responseMap.get(q.id)!,
      }));
      await tx.insert(questionnaireResponses).values(rawInserts);

      // 3. Upsert into respondent_profiles for this user
      if (existingProfile.length === 0) {
        await tx.insert(respondentProfiles).values({
          userId: uid,
          laRawScore: laRaw,
          laAvgScore: laAvg.toString(),
          laCategory: laCat,
          eiRawScore: eiRaw,
          eiAvgScore: eiAvg.toString(),
          eiCategory: eiCat,
          profileCode: profileDef.code,
          profileLabel: profileDef.label,
          profileGroup: profileDef.group,
          isCompleted: true,
          completedAt: now,
        });
      } else {
        await tx
          .update(respondentProfiles)
          .set({
            laRawScore: laRaw,
            laAvgScore: laAvg.toString(),
            laCategory: laCat,
            eiRawScore: eiRaw,
            eiAvgScore: eiAvg.toString(),
            eiCategory: eiCat,
            profileCode: profileDef.code,
            profileLabel: profileDef.label,
            profileGroup: profileDef.group,
            isCompleted: true,
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(respondentProfiles.userId, uid));
      }

      // 4. Kalkulasi Ulang Population Terciles Otomatis untuk seluruh responden yang selesai
      // Mengurutkan dari atas ke bawah dan membagi secara seimbang (33.3% per kelompok)
      const allCompletedProfiles = await tx
        .select()
        .from(respondentProfiles)
        .where(eq(respondentProfiles.isCompleted, true));

      const inputs = allCompletedProfiles.map((p) => ({
        userId: p.userId,
        laRawScore: p.userId === uid ? laRaw : p.laRawScore,
        eiRawScore: p.userId === uid ? eiRaw : p.eiRawScore,
        laItemCount: 15,
        eiItemCount: 15,
      }));

      const tercileResults = computePopulationTerciles(inputs);

      for (const res of tercileResults) {
        await tx
          .update(respondentProfiles)
          .set({
            laCategory: res.laCategory,
            laAvgScore: res.laAvgScore.toString(),
            eiCategory: res.eiCategory,
            eiAvgScore: res.eiAvgScore.toString(),
            profileCode: res.profileCode,
            profileLabel: res.profileLabel,
            profileGroup: res.profileGroup,
            updatedAt: now,
          })
          .where(eq(respondentProfiles.userId, res.userId));
      }
    });

    // Return sterile success confirmation to respondent (NO score / profile leakage)
    return NextResponse.json({
      success: true,
      message: "Kuesioner profil berhasil diselesaikan. Terima kasih atas partisipasi Anda!",
    });
  } catch (error: any) {
    console.error("Error submitting questionnaire:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server saat memproses jawaban kuesioner." },
      { status: 500 }
    );
  }
}
