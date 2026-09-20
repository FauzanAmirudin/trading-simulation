import "dotenv/config";
import { db } from "./connect";
import { users, stocks, portfolios } from "./schema";
import { eq, sql } from "drizzle-orm";

export async function resetExperiment() {
  console.log("=======================================================");
  console.log("⚠️  MEMULAI PROSES RESET TOTAL RIWAYAT EKSPERIMEN ⚠️");
  console.log("=======================================================");

  // 1. Truncate semua tabel transaksi, order, prediksi, ronde, kuesioner, dan portofolio
  console.log("1. Mengosongkan data riwayat transaksi, ronde, prediksi & kuesioner...");
  await db.execute(sql`
    TRUNCATE TABLE 
      transactions_history,
      order_book,
      predictions,
      round_stocks,
      rounds,
      session_stocks,
      sessions,
      questionnaire_responses,
      respondent_profiles,
      portfolios
    RESTART IDENTITY CASCADE;
  `);
  console.log("✓ Seluruh tabel riwayat berhasil dikosongkan.");

  // 2. Reset Saldo Kas Seluruh Responden ke Rp 100.000.000,00
  console.log("2. Mereset saldo kas seluruh responden ke Rp 100.000.000,00...");
  await db.execute(sql`
    UPDATE users 
    SET saldo = '100000000.00' 
    WHERE role = 'responden';
  `);
  console.log("✓ Saldo kas responden berhasil direset.");

  // 3. Reset Portofolio Awal (10 lot per saham untuk seluruh 36 saham)
  console.log("3. Mengalokasikan 10 lot per saham untuk setiap responden...");
  const allRespondents = await db
    .select({ id: users.id, nama: users.nama })
    .from(users)
    .where(eq(users.role, "responden"));

  const allStocks = await db
    .select({ id: stocks.id, kodeSaham: stocks.kodeSaham, basePrice: stocks.basePrice })
    .from(stocks);

  const initialPortfolios = allRespondents.flatMap((user) =>
    allStocks.map((stock) => ({
      userId: user.id,
      stockId: stock.id,
      jumlahLot: 10,
      averagePrice: String(stock.basePrice),
    }))
  );

  if (initialPortfolios.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < initialPortfolios.length; i += chunkSize) {
      const chunk = initialPortfolios.slice(i, i + chunkSize);
      await db.insert(portfolios).values(chunk);
    }
  }
  console.log(`✓ ${initialPortfolios.length} baris portofolio berhasil dialokasikan (${allRespondents.length} responden × ${allStocks.length} saham × 10 lot).`);

  // 4. Verifikasi Status Akhir
  console.log("\n=======================================================");
  console.log("🔍 HASIL AUDIT SETELAH RESET");
  console.log("=======================================================");

  const txRes = await db.execute(sql`SELECT count(*)::int as c FROM transactions_history`);
  const obRes = await db.execute(sql`SELECT count(*)::int as c FROM order_book`);
  const predRes = await db.execute(sql`SELECT count(*)::int as c FROM predictions`);
  const roundRes = await db.execute(sql`SELECT count(*)::int as c FROM rounds`);
  const profRes = await db.execute(sql`SELECT count(*)::int as c FROM respondent_profiles`);
  const qsRespRes = await db.execute(sql`SELECT count(*)::int as c FROM questionnaire_responses`);
  const portoRes = await db.execute(sql`SELECT count(*)::int as c FROM portfolios`);
  const cashRes = await db.execute(sql`SELECT sum(saldo)::numeric as s FROM users WHERE role = 'responden'`);

  const txCount = (txRes as any).rows?.[0]?.c ?? 0;
  const obCount = (obRes as any).rows?.[0]?.c ?? 0;
  const predCount = (predRes as any).rows?.[0]?.c ?? 0;
  const roundCount = (roundRes as any).rows?.[0]?.c ?? 0;
  const profCount = (profRes as any).rows?.[0]?.c ?? 0;
  const qsRespCount = (qsRespRes as any).rows?.[0]?.c ?? 0;
  const portoCount = (portoRes as any).rows?.[0]?.c ?? 0;
  const totalCash = (cashRes as any).rows?.[0]?.s ?? 0;

  console.log(`- Transaksi History      : ${txCount} baris (BERSIH)`);
  console.log(`- Order Book             : ${obCount} baris (BERSIH)`);
  console.log(`- Prediksi Harga         : ${predCount} baris (BERSIH)`);
  console.log(`- Ronde Aktif/Riwayat    : ${roundCount} baris (BERSIH)`);
  console.log(`- Profil Kuesioner       : ${profCount} responden (BERSIH -> User akan diarahkan isi kuesioner)`);
  console.log(`- Jawaban Kuesioner      : ${qsRespCount} baris (BERSIH)`);
  console.log(`- Total Portofolio Lot   : ${portoCount} baris (10 lot per saham per responden)`);
  console.log(`- Total Saldo Kas        : Rp ${Number(totalCash).toLocaleString("id-ID")} (${allRespondents.length} responden × Rp 100.000.000)`);
  console.log("=======================================================");
  console.log("✅ RESET EKSPERIMEN BERHASIL SEMPURNA");
  console.log("=======================================================\n");
}

if (process.argv[1] && process.argv[1].includes("reset-experiment")) {
  resetExperiment()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Gagal reset eksperimen:", err);
      process.exit(1);
    });
}
