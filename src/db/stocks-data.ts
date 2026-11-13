import { db } from "./connect";
import { stocks, portfolios, users } from "./schema";
import { eq, sql } from "drizzle-orm";

export type StockMasterItem = {
  kode: string;
  nama: string;
  t1: number; // Harga t-1 (Acuan Utama / Base Price)
  t2: number; // Harga t-2
  t3: number; // Harga t-3
  isTrial: boolean;
};

// 36 Saham Utama (S-1 s/d S-36) — Sumber: Daftar harga.xlsx
export const MAIN_STOCKS: StockMasterItem[] = [
  { kode: "S-1",  nama: "Saham S-1",  t1: 10850, t2: 10925, t3: 10975, isTrial: false },
  { kode: "S-2",  nama: "Saham S-2",  t1: 1880,  t2: 1845,  t3: 1855,  isTrial: false },
  { kode: "S-3",  nama: "Saham S-3",  t1: 2510,  t2: 2510,  t3: 2520,  isTrial: false },
  { kode: "S-4",  nama: "Saham S-4",  t1: 1480,  t2: 1490,  t3: 1475,  isTrial: false },
  { kode: "S-5",  nama: "Saham S-5",  t1: 5000,  t2: 5225,  t3: 5475,  isTrial: false },
  { kode: "S-6",  nama: "Saham S-6",  t1: 1410,  t2: 1430,  t3: 1465,  isTrial: false },
  { kode: "S-7",  nama: "Saham S-7",  t1: 4050,  t2: 4020,  t3: 4100,  isTrial: false },
  { kode: "S-8",  nama: "Saham S-8",  t1: 6325,  t2: 6325,  t3: 6600,  isTrial: false },
  { kode: "S-9",  nama: "Saham S-9",  t1: 6050,  t2: 6425,  t3: 6450,  isTrial: false },
  { kode: "S-10", nama: "Saham S-10", t1: 3770,  t2: 3870,  t3: 3830,  isTrial: false },
  { kode: "S-11", nama: "Saham S-11", t1: 3070,  t2: 3160,  t3: 3240,  isTrial: false },
  { kode: "S-12", nama: "Saham S-12", t1: 1400,  t2: 1490,  t3: 1415,  isTrial: false },
  { kode: "S-13", nama: "Saham S-13", t1: 4500,  t2: 4630,  t3: 4750,  isTrial: false },
  { kode: "S-14", nama: "Saham S-14", t1: 2020,  t2: 2190,  t3: 2260,  isTrial: false },
  { kode: "S-15", nama: "Saham S-15", t1: 216,   t2: 230,   t3: 240,   isTrial: false },
  { kode: "S-16", nama: "Saham S-16", t1: 4140,  t2: 4290,  t3: 4390,  isTrial: false },
  { kode: "S-17", nama: "Saham S-17", t1: 1315,  t2: 1400,  t3: 1510,  isTrial: false },
  { kode: "S-18", nama: "Saham S-18", t1: 486,   t2: 515,   t3: 550,   isTrial: false },
  { kode: "S-19", nama: "Saham S-19", t1: 850,   t2: 870,   t3: 905,   isTrial: false },
  { kode: "S-20", nama: "Saham S-20", t1: 945,   t2: 925,   t3: 860,   isTrial: false },
  { kode: "S-21", nama: "Saham S-21", t1: 3070,  t2: 3140,  t3: 3170,  isTrial: false },
  { kode: "S-22", nama: "Saham S-22", t1: 1930,  t2: 1940,  t3: 1945,  isTrial: false },
  { kode: "S-23", nama: "Saham S-23", t1: 2930,  t2: 3010,  t3: 3040,  isTrial: false },
  { kode: "S-24", nama: "Saham S-24", t1: 6825,  t2: 7075,  t3: 7100,  isTrial: false },
  { kode: "S-25", nama: "Saham S-25", t1: 6700,  t2: 6700,  t3: 6875,  isTrial: false },
  { kode: "S-26", nama: "Saham S-26", t1: 6900,  t2: 6975,  t3: 7025,  isTrial: false },
  { kode: "S-27", nama: "Saham S-27", t1: 9775,  t2: 9925,  t3: 9825,  isTrial: false },
  { kode: "S-28", nama: "Saham S-28", t1: 1970,  t2: 1955,  t3: 1985,  isTrial: false },
  { kode: "S-29", nama: "Saham S-29", t1: 26400, t2: 26750, t3: 26800, isTrial: false },
  { kode: "S-30", nama: "Saham S-30", t1: 2630,  t2: 2680,  t3: 2600,  isTrial: false },
  { kode: "S-31", nama: "Saham S-31", t1: 875,   t2: 910,   t3: 940,   isTrial: false },
  { kode: "S-32", nama: "Saham S-32", t1: 1285,  t2: 1305,  t3: 1310,  isTrial: false },
  { kode: "S-33", nama: "Saham S-33", t1: 660,   t2: 675,   t3: 705,   isTrial: false },
  { kode: "S-34", nama: "Saham S-34", t1: 3380,  t2: 3380,  t3: 3400,  isTrial: false },
  { kode: "S-35", nama: "Saham S-35", t1: 1725,  t2: 1800,  t3: 1700,  isTrial: false },
  { kode: "S-36", nama: "Saham S-36", t1: 2900,  t2: 2960,  t3: 3000,  isTrial: false },
];

// 12 Saham Uji Coba (AA s/d DC, 4 Sesi × 3 Saham) — Sumber: Daftar harga.xlsx
export const TRIAL_STOCKS: StockMasterItem[] = [
  { kode: "AA", nama: "Saham AA", t1: 8100,  t2: 8300,  t3: 8300,  isTrial: true },
  { kode: "AB", nama: "Saham AB", t1: 42,    t2: 41,    t3: 41,    isTrial: true },
  { kode: "AC", nama: "Saham AC", t1: 2600,  t2: 2600,  t3: 2600,  isTrial: true },
  { kode: "BA", nama: "Saham BA", t1: 3030,  t2: 3090,  t3: 3080,  isTrial: true },
  { kode: "BB", nama: "Saham BB", t1: 390,   t2: 397,   t3: 394,   isTrial: true },
  { kode: "BC", nama: "Saham BC", t1: 74,    t2: 77,    t3: 77,    isTrial: true },
  { kode: "CA", nama: "Saham CA", t1: 97,    t2: 100,   t3: 98,    isTrial: true },
  { kode: "CB", nama: "Saham CB", t1: 51,    t2: 56,    t3: 53,    isTrial: true },
  { kode: "CC", nama: "Saham CC", t1: 17250, t2: 17550, t3: 16675, isTrial: true },
  { kode: "DA", nama: "Saham DA", t1: 181,   t2: 189,   t3: 194,   isTrial: true },
  { kode: "DB", nama: "Saham DB", t1: 8275,  t2: 8400,  t3: 8800,  isTrial: true },
  { kode: "DC", nama: "Saham DC", t1: 210,   t2: 210,   t3: 212,   isTrial: true },
];

export const ALL_STOCKS_MASTER: StockMasterItem[] = [...MAIN_STOCKS, ...TRIAL_STOCKS];

export async function ensureStocksSchemaAndSync(updatePortfolioAvgIfUntraded = true) {
  // 1. Auto-migrate schema columns safely
  await db.execute(sql`
    ALTER TABLE stocks ADD COLUMN IF NOT EXISTS price_t2 numeric(15, 2);
    ALTER TABLE stocks ADD COLUMN IF NOT EXISTS price_t3 numeric(15, 2);
    ALTER TABLE stocks ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false NOT NULL;
  `);

  // 2. Upsert all 48 stocks (36 main + 12 trial)
  for (const s of ALL_STOCKS_MASTER) {
    await db
      .insert(stocks)
      .values({
        kodeSaham: s.kode,
        namaSaham: s.nama,
        basePrice: s.t1.toString(),
        priceT2: s.t2.toString(),
        priceT3: s.t3.toString(),
        isTrial: s.isTrial,
      })
      .onConflictDoUpdate({
        target: stocks.kodeSaham,
        set: {
          namaSaham: s.nama,
          basePrice: s.t1.toString(),
          priceT2: s.t2.toString(),
          priceT3: s.t3.toString(),
          isTrial: s.isTrial,
        },
      });
  }

  // 3. Seed missing portfolios for all respondents (10 lots for new trial stocks)
  const allUsers = await db.select().from(users).where(eq(users.role, "responden"));
  const allStocks = await db.select().from(stocks);
  const toInsert = allUsers.flatMap((u) =>
    allStocks.map((st) => ({
      userId: u.id,
      stockId: st.id,
      jumlahLot: 10,
      averagePrice: String(st.basePrice),
    }))
  );
  if (toInsert.length > 0) {
    const chunkSize = 300;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      await db.insert(portfolios).values(toInsert.slice(i, i + chunkSize)).onConflictDoNothing();
    }
  }

  // 4. Sync average_price on untouched initial 10-lot portfolios to match updated base_price
  if (updatePortfolioAvgIfUntraded) {
    await db.execute(sql`
      UPDATE portfolios
      SET average_price = stocks.base_price
      FROM stocks
      WHERE portfolios.stock_id = stocks.id
        AND portfolios.jumlah_lot = 10
    `);
  }
}
