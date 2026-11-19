import { db } from "./connect";
import { users, respondentProfiles } from "./schema";
import { eq } from "drizzle-orm";
import { computePopulationTerciles, RespondentScoreInput, ProfileGroup } from "../lib/questionnaire-logic";
import { isDemoUsername } from "../lib/demo-users";

export async function recalculateBalancedProfiles() {
  console.log("=======================================================");
  console.log("⚖️  KALKULASI ULANG BALANCED HIERARCHICAL TERCILES");
  console.log("=======================================================");

  // 1. Ambil seluruh profil resmi yang sudah completed
  const allProfiles = await db
    .select({
      id: respondentProfiles.id,
      userId: respondentProfiles.userId,
      userName: users.nama,
      laRawScore: respondentProfiles.laRawScore,
      eiRawScore: respondentProfiles.eiRawScore,
      oldLaCategory: respondentProfiles.laCategory,
      oldEiCategory: respondentProfiles.eiCategory,
      oldGroup: respondentProfiles.profileGroup,
    })
    .from(respondentProfiles)
    .innerJoin(users, eq(respondentProfiles.userId, users.id))
    .where(eq(respondentProfiles.isCompleted, true));

  const officialProfiles = allProfiles.filter((p) => !isDemoUsername(p.userName));
  console.log(`✓ Terdeteksi ${officialProfiles.length} profil responden resmi yang telah completed.`);

  if (officialProfiles.length === 0) {
    console.log("ℹ️ Belum ada profil responden yang selesai untuk dikalkulasi.");
    return;
  }

  // Hitung distribusi lama
  const oldDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 };
  officialProfiles.forEach((p) => {
    if (oldDist[p.oldGroup] !== undefined) oldDist[p.oldGroup]++;
  });
  console.log("Distribusi Kelompok Sebelum Kalkulasi:", oldDist);

  // 2. Siapkan input untuk algoritma Balanced Hierarchical Terciles
  const inputs: RespondentScoreInput[] = officialProfiles.map((p) => ({
    userId: p.userId,
    laRawScore: p.laRawScore,
    eiRawScore: p.eiRawScore,
    laItemCount: 15,
    eiItemCount: 15,
  }));

  // 3. Eksekusi kalkulasi seimbang
  const newResults = computePopulationTerciles(inputs);

  // 4. Update data profil di database (Hanya memperbarui kategori dan kelompok, RAW DATA AMAN 100%)
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const res of newResults) {
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

  // Hitung distribusi baru
  const newDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 };
  const laCatCounts: Record<string, number> = { T: 0, S: 0, R: 0 };
  const eiCatCounts: Record<string, number> = { T: 0, S: 0, R: 0 };

  newResults.forEach((r) => {
    newDist[r.profileGroup]++;
    laCatCounts[r.laCategory]++;
    eiCatCounts[r.eiCategory]++;
  });

  console.log("\nDistribusi Kelompok Sesudah Kalkulasi Seimbang:", newDist);
  console.log("Distribusi Kategori LA (T/S/R):", laCatCounts);
  console.log("Distribusi Kategori EI (T/S/R):", eiCatCounts);
  console.log("\n✅ Berhasil memperbarui seluruh profil responden menjadi terbagi rata!");
  console.log("🔒 Seluruh data mentah (skor per butir, biodata, orderbook) 100% UTUH dan AMAN.");
  console.log("=======================================================\n");
}

if (require.main === module) {
  recalculateBalancedProfiles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Gagal melakukan kalkulasi:", err);
      process.exit(1);
    });
}
