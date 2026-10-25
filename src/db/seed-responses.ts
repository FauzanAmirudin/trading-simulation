import "dotenv/config";
import { db } from "./connect";
import {
  users,
  questions,
  questionnaireResponses,
  respondentProfiles,
  respondentBiodata,
} from "./schema";
import { eq, asc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import {
  classifyByStandardCutoff,
  getProfileByCategories,
  CategoryType,
  ProfileGroup,
  PROFILE_MATRIX,
} from "../lib/questionnaire-logic";
import { seedQuestionnaires } from "./seed-questionnaire";

/**
 * Generate 15 Likert scores (1-5) strictly landing within target category:
 * - 'T' (Tinggi): Mean 3.80 - 4.60 (Total: 57 - 69)
 * - 'S' (Sedang): Mean 2.80 - 3.45 (Total: 42 - 52)
 * - 'R' (Rendah): Mean 1.60 - 2.40 (Total: 24 - 36)
 */
function generate15ScoresForCategory(cat: CategoryType): { scores: number[]; sum: number } {
  let targetTotal: number;
  if (cat === "T") {
    targetTotal = 58 + Math.floor(Math.random() * 11); // 58 .. 68
  } else if (cat === "S") {
    targetTotal = 43 + Math.floor(Math.random() * 9); // 43 .. 51
  } else {
    targetTotal = 25 + Math.floor(Math.random() * 11); // 25 .. 35
  }

  // Start with balanced initial base scores
  const scores: number[] = new Array(15).fill(Math.floor(targetTotal / 15));
  let currentSum = scores.reduce((a, b) => a + b, 0);

  // Distribute remainder
  while (currentSum < targetTotal) {
    const idx = Math.floor(Math.random() * 15);
    if (scores[idx] < 5) {
      scores[idx]++;
      currentSum++;
    }
  }
  while (currentSum > targetTotal) {
    const idx = Math.floor(Math.random() * 15);
    if (scores[idx] > 1) {
      scores[idx]--;
      currentSum--;
    }
  }

  // Natural jitter: swap between items to avoid uniform numbers
  for (let j = 0; j < 30; j++) {
    const i1 = Math.floor(Math.random() * 15);
    const i2 = Math.floor(Math.random() * 15);
    if (scores[i1] < 5 && scores[i2] > 1) {
      scores[i1]++;
      scores[i2]--;
    }
  }

  const sum = scores.reduce((a, b) => a + b, 0);
  const verifiedCat = classifyByStandardCutoff(sum, 15);

  // Fallback safety
  if (verifiedCat !== cat) {
    return generate15ScoresForCategory(cat);
  }

  return { scores, sum };
}

export async function seedRespondents1To90() {
  console.log("======================================================================");
  console.log("🌱 MEMULAI SEED BIODATA, PROFIL PSIKOLOGIS & RESUME (RESPONDEN 1-90)");
  console.log("======================================================================");

  // 1. Pastikan butir pertanyaan LA dan EI (30 item) tersedia di database
  let allQuestions = await db
    .select()
    .from(questions)
    .orderBy(asc(questions.instrument), asc(questions.orderNumber));

  if (allQuestions.length < 30) {
    console.log("⚠️ Butir pertanyaan belum lengkap. Menjalankan seedQuestionnaires()...");
    await seedQuestionnaires();
    allQuestions = await db
      .select()
      .from(questions)
      .orderBy(asc(questions.instrument), asc(questions.orderNumber));
  }

  const laQuestions = allQuestions.filter((q) => q.instrument === "LA");
  const eiQuestions = allQuestions.filter((q) => q.instrument === "EI");

  console.log(`✓ Instrumen pertanyaan dimuat: ${laQuestions.length} LA, ${eiQuestions.length} EI`);

  // 2. Pastikan akun responden1 s.d responden90 ada di tabel users
  const existingUsers = await db.select().from(users);
  const userMap = new Map<string, typeof existingUsers[0]>();
  existingUsers.forEach((u) => userMap.set(u.nama.toLowerCase(), u));

  const passwordHash = await bcrypt.hash("password123", 12);
  const missingUsers: { nama: string; password: string; role: string; saldo: string }[] = [];

  for (let i = 1; i <= 90; i++) {
    const uname = `responden${i}`;
    if (!userMap.has(uname.toLowerCase())) {
      missingUsers.push({
        nama: uname,
        password: passwordHash,
        role: "responden",
        saldo: "100000000.00",
      });
    }
  }

  if (missingUsers.length > 0) {
    console.log(`Menambahkan ${missingUsers.length} akun responden baru ke tabel users...`);
    const chunkSize = 50;
    for (let i = 0; i < missingUsers.length; i += chunkSize) {
      await db.insert(users).values(missingUsers.slice(i, i + chunkSize));
    }
  }

  // Reload seluruh akun responden1 s.d responden90
  const refreshedUsers = await db.select().from(users).where(eq(users.role, "responden"));
  const targetRespondents = refreshedUsers
    .filter((u) => /^responden([1-9][0-9]?|90)$/i.test(u.nama))
    .sort((a, b) => {
      const numA = parseInt(a.nama.replace(/\D/g, ""), 10);
      const numB = parseInt(b.nama.replace(/\D/g, ""), 10);
      return numA - numB;
    });

  console.log(`✓ Teridentifikasi ${targetRespondents.length} akun responden (responden1 s.d responden90)`);

  if (targetRespondents.length < 90) {
    throw new Error(`Jumlah responden terdeteksi (${targetRespondents.length}) kurang dari 90!`);
  }

  // 3. Distribusi Seimbang 9 Kelompok (10 responden per kelompok A s.d I)
  // Kelompok A s.d I:
  // A: LA(T)+EI(T) -> 1..10
  // B: LA(T)+EI(S) -> 11..20
  // C: LA(T)+EI(R) -> 21..30
  // D: LA(S)+EI(T) -> 31..40
  // E: LA(S)+EI(S) -> 41..50
  // F: LA(S)+EI(R) -> 51..60
  // G: LA(R)+EI(T) -> 61..70
  // H: LA(R)+EI(S) -> 71..80
  // I: LA(R)+EI(R) -> 81..90
  const groupAssignments: { group: ProfileGroup; laCat: CategoryType; eiCat: CategoryType }[] = [
    { group: "A", laCat: "T", eiCat: "T" },
    { group: "B", laCat: "T", eiCat: "S" },
    { group: "C", laCat: "T", eiCat: "R" },
    { group: "D", laCat: "S", eiCat: "T" },
    { group: "E", laCat: "S", eiCat: "S" },
    { group: "F", laCat: "S", eiCat: "R" },
    { group: "G", laCat: "R", eiCat: "T" },
    { group: "H", laCat: "R", eiCat: "S" },
    { group: "I", laCat: "R", eiCat: "R" },
  ];

  // SQL Collector untuk ekspor file .sql
  const sqlStatements: string[] = [
    "-- ====================================================================",
    "-- SEED DATA: BIODATA, PROFIL PSIKOLOGIS, & JAWABAN (RESPONDEN 1 - 90)",
    `-- Dihasilkan otomatis pada: ${new Date().toISOString()}`,
    "-- ====================================================================\n",
  ];

  console.log("Sedang memproses input data biodata, jawaban instrumen, dan profil psikologis...");

  let processedCount = 0;

  for (let idx = 0; idx < 90; idx++) {
    const respondentNum = idx + 1;
    const user = targetRespondents[idx];
    const groupIdx = Math.floor(idx / 10); // 0..8
    const groupDef = groupAssignments[groupIdx];

    // ── A. BIODATA DEMOGRAFIS ──
    const prodis = ["Manajemen", "Akuntansi", "Ekonomi Pembangunan"];
    const prodi = prodis[idx % 3];
    const gender = respondentNum % 2 === 1 ? "Laki-laki" : "Perempuan";
    const usia = 19 + ((respondentNum * 7) % 5); // 19, 20, 21, 22, 23
    const semester = [4, 6, 8][(respondentNum + 1) % 3];
    const pernahSaham = respondentNum % 3 === 0 ? "Ya" : "Tidak";
    const pernahPelatihan = respondentNum % 2 === 0 ? "Ya" : "Tidak";
    const sumberP = ["Orang tua", "Beasiswa", "Pekerjaan sampingan", "Lainnya"][idx % 4];
    const sumberLain = sumberP === "Lainnya" ? "Usaha online / Freelance" : null;
    const jurusanSma = ["IPA", "IPS", "IPA", "IPS", "Bahasa/lain-lain"][idx % 5];

    // Upsert Biodata
    await db
      .insert(respondentBiodata)
      .values({
        userId: user.id,
        jenisKelamin: gender,
        usia,
        programStudi: prodi,
        semester,
        pernahInvestasiSaham: pernahSaham,
        pernahPelatihanInvestasi: pernahPelatihan,
        sumberPenghasilan: sumberP,
        sumberPenghasilanLainnya: sumberLain,
        jurusanSma,
      })
      .onConflictDoUpdate({
        target: respondentBiodata.userId,
        set: {
          jenisKelamin: gender,
          usia,
          programStudi: prodi,
          semester,
          pernahInvestasiSaham: pernahSaham,
          pernahPelatihanInvestasi: pernahPelatihan,
          sumberPenghasilan: sumberP,
          sumberPenghasilanLainnya: sumberLain,
          jurusanSma,
          updatedAt: new Date(),
        },
      });

    sqlStatements.push(
      `INSERT INTO respondent_biodata (user_id, jenis_kelamin, usia, program_studi, semester, pernah_investasi_saham, pernah_pelatihan_investasi, sumber_penghasilan, sumber_penghasilan_lainnya, jurusan_sma, created_at, updated_at) ` +
        `VALUES (${user.id}, '${gender}', ${usia}, '${prodi}', ${semester}, '${pernahSaham}', '${pernahPelatihan}', '${sumberP}', ${sumberLain ? `'${sumberLain}'` : "NULL"}, '${jurusanSma}', NOW(), NOW()) ` +
        `ON CONFLICT (user_id) DO UPDATE SET jenis_kelamin = EXCLUDED.jenis_kelamin, usia = EXCLUDED.usia, program_studi = EXCLUDED.program_studi, semester = EXCLUDED.semester, pernah_investasi_saham = EXCLUDED.pernah_investasi_saham, pernah_pelatihan_investasi = EXCLUDED.pernah_pelatihan_investasi, sumber_penghasilan = EXCLUDED.sumber_penghasilan, sumber_penghasilan_lainnya = EXCLUDED.sumber_penghasilan_lainnya, jurusan_sma = EXCLUDED.jurusan_sma, updated_at = NOW();`
    );

    // ── B. JAWABAN KUESIONER LA & EI (15 BUTIR MASING-MASING) ──
    const laRes = generate15ScoresForCategory(groupDef.laCat);
    const eiRes = generate15ScoresForCategory(groupDef.eiCat);

    // Hapus respons lama
    await db
      .delete(questionnaireResponses)
      .where(eq(questionnaireResponses.userId, user.id));

    sqlStatements.push(`DELETE FROM questionnaire_responses WHERE user_id = ${user.id};`);

    const responsesToInsert: {
      userId: number;
      questionId: number;
      instrument: "LA" | "EI";
      score: number;
    }[] = [];

    laQuestions.forEach((q, qIdx) => {
      const score = laRes.scores[qIdx];
      responsesToInsert.push({
        userId: user.id,
        questionId: q.id,
        instrument: "LA",
        score,
      });
      sqlStatements.push(
        `INSERT INTO questionnaire_responses (user_id, question_id, instrument, score, created_at) VALUES (${user.id}, ${q.id}, 'LA', ${score}, NOW()) ON CONFLICT (user_id, question_id) DO UPDATE SET score = EXCLUDED.score;`
      );
    });

    eiQuestions.forEach((q, qIdx) => {
      const score = eiRes.scores[qIdx];
      responsesToInsert.push({
        userId: user.id,
        questionId: q.id,
        instrument: "EI",
        score,
      });
      sqlStatements.push(
        `INSERT INTO questionnaire_responses (user_id, question_id, instrument, score, created_at) VALUES (${user.id}, ${q.id}, 'EI', ${score}, NOW()) ON CONFLICT (user_id, question_id) DO UPDATE SET score = EXCLUDED.score;`
      );
    });

    await db.insert(questionnaireResponses).values(responsesToInsert);

    // ── C. RESUME & PROFIL PSIKOLOGIS ──
    const laAvg = Number((laRes.sum / 15).toFixed(2));
    const eiAvg = Number((eiRes.sum / 15).toFixed(2));
    const profileDef = getProfileByCategories(groupDef.laCat, groupDef.eiCat);

    const completedAt = new Date(Date.now() - (90 - idx) * 1000 * 60 * 12); // Waktu bertahap

    await db
      .insert(respondentProfiles)
      .values({
        userId: user.id,
        laRawScore: laRes.sum,
        laAvgScore: laAvg.toString(),
        laCategory: groupDef.laCat,
        eiRawScore: eiRes.sum,
        eiAvgScore: eiAvg.toString(),
        eiCategory: groupDef.eiCat,
        profileCode: profileDef.code,
        profileLabel: profileDef.label,
        profileGroup: profileDef.group,
        isCompleted: true,
        completedAt,
      })
      .onConflictDoUpdate({
        target: respondentProfiles.userId,
        set: {
          laRawScore: laRes.sum,
          laAvgScore: laAvg.toString(),
          laCategory: groupDef.laCat,
          eiRawScore: eiRes.sum,
          eiAvgScore: eiAvg.toString(),
          eiCategory: groupDef.eiCat,
          profileCode: profileDef.code,
          profileLabel: profileDef.label,
          profileGroup: profileDef.group,
          isCompleted: true,
          completedAt,
          updatedAt: new Date(),
        },
      });

    sqlStatements.push(
      `INSERT INTO respondent_profiles (user_id, la_raw_score, la_avg_score, la_category, ei_raw_score, ei_avg_score, ei_category, profile_code, profile_label, profile_group, is_completed, completed_at, created_at, updated_at) ` +
        `VALUES (${user.id}, ${laRes.sum}, '${laAvg.toFixed(2)}', '${groupDef.laCat}', ${eiRes.sum}, '${eiAvg.toFixed(2)}', '${groupDef.eiCat}', '${profileDef.code}', '${profileDef.label}', '${profileDef.group}', true, '${completedAt.toISOString()}', NOW(), NOW()) ` +
        `ON CONFLICT (user_id) DO UPDATE SET la_raw_score = EXCLUDED.la_raw_score, la_avg_score = EXCLUDED.la_avg_score, la_category = EXCLUDED.la_category, ei_raw_score = EXCLUDED.ei_raw_score, ei_avg_score = EXCLUDED.ei_avg_score, ei_category = EXCLUDED.ei_category, profile_code = EXCLUDED.profile_code, profile_label = EXCLUDED.profile_label, profile_group = EXCLUDED.profile_group, is_completed = true, completed_at = EXCLUDED.completed_at, updated_at = NOW();`
    );

    processedCount++;
  }

  // 4. Simpan file SQL siap pakai untuk eksekusi langsung di VPS
  const sqlFilePath = path.join(process.cwd(), "drizzle", "seed_respondents_1_to_90.sql");
  fs.writeFileSync(sqlFilePath, sqlStatements.join("\n"), "utf-8");

  console.log("======================================================================");
  console.log(`✅ BERHASIL MENGINPUT DATA UNTUK ${processedCount} RESPONDEN (responden1 - responden90)`);
  console.log(`✓ 90 Data Biodata Responden tersimpan di 'respondent_biodata'`);
  console.log(`✓ 2.700 Jawaban Butir Kuesioner (15 LA + 15 EI x 90) tersimpan di 'questionnaire_responses'`);
  console.log(`✓ 90 Profil & Resume Psikologis (Kelompok A s.d I seimbang) tersimpan di 'respondent_profiles'`);
  console.log(`✓ File SQL eksekusi langsung tersimpan di: drizzle/seed_respondents_1_to_90.sql`);
  console.log("======================================================================");
}

if (process.argv[1] && process.argv[1].includes("seed-responses")) {
  seedRespondents1To90()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error seeding respondent responses:", err);
      process.exit(1);
    });
}
