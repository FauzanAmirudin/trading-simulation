import { db } from "./index";
import { users, stocks, sessions } from "./schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const stockList = [
  { kode: "BBCA", nama: "Bank Central Asia Tbk.", harga: 10250 },
  { kode: "BBRI", nama: "Bank Rakyat Indonesia Tbk.", harga: 5650 },
  { kode: "BMRI", nama: "Bank Mandiri Tbk.", harga: 7100 },
  { kode: "BBNI", nama: "Bank Negara Indonesia Tbk.", harga: 5525 },
  { kode: "BRIS", nama: "Bank Syariah Indonesia Tbk.", harga: 2820 },
  { kode: "UNVR", nama: "Unilever Indonesia Tbk.", harga: 3450 },
  { kode: "ICBP", nama: "Indofood CBP Sukses Makmur Tbk.", harga: 12450 },
  { kode: "INDF", nama: "Indofood Sukses Makmur Tbk.", harga: 6425 },
  { kode: "KLBF", nama: "Kalbe Farma Tbk.", harga: 1625 },
  { kode: "MYOR", nama: "Mayora Indah Tbk.", harga: 2520 },
  { kode: "TLKM", nama: "Telkom Indonesia Tbk.", harga: 3950 },
  { kode: "EXCL", nama: "XL Axiata Tbk.", harga: 2225 },
  { kode: "ISAT", nama: "Indosat Ooredoo Hutchison Tbk.", harga: 10500 },
  { kode: "JSMR", nama: "Jasa Marga Tbk.", harga: 5150 },
  { kode: "ADRO", nama: "Adaro Energy Indonesia Tbk.", harga: 2725 },
  { kode: "PTBA", nama: "Bukit Asam Tbk.", harga: 3050 },
  { kode: "ITMG", nama: "Indo Tambangraya Megah Tbk.", harga: 28500 },
  { kode: "ANTM", nama: "Aneka Tambang Tbk.", harga: 2025 },
  { kode: "MDKA", nama: "Merdeka Copper Gold Tbk.", harga: 2475 },
  { kode: "PGAS", nama: "Perusahaan Gas Negara Tbk.", harga: 1725 },
  { kode: "MEDC", nama: "Medco Energi Internasional Tbk.", harga: 1380 },
  { kode: "ASII", nama: "Astra International Tbk.", harga: 5350 },
  { kode: "UNTR", nama: "United Tractors Tbk.", harga: 23750 },
  { kode: "CTRA", nama: "Ciputra Development Tbk.", harga: 1350 },
  { kode: "PWON", nama: "Pakuwon Jati Tbk.", harga: 450 },
  { kode: "BSDE", nama: "Bumi Serpong Damai Tbk.", harga: 1190 },
  { kode: "SMGR", nama: "Semen Indonesia Tbk.", harga: 4150 },
  { kode: "INTP", nama: "Indocement Tunggal Prakarsa Tbk.", harga: 8050 },
  { kode: "ACES", nama: "Ace Hardware Indonesia Tbk.", harga: 995 },
  { kode: "MAPI", nama: "Mitra Adiperkasa Tbk.", harga: 1680 },
  { kode: "GOTO", nama: "GoTo Gojek Tokopedia Tbk.", harga: 82 },
  { kode: "BIRD", nama: "Blue Bird Tbk.", harga: 1950 },
  { kode: "ASSA", nama: "Adi Sarana Armada Tbk.", harga: 995 },
  { kode: "SIDO", nama: "Industri Jamu dan Farmasi Sido Tbk.", harga: 755 },
  { kode: "KAEF", nama: "Kimia Farma Tbk.", harga: 1250 },
  { kode: "SMBR", nama: "Semen Baturaja Tbk.", harga: 386 },
];

async function seed() {
  console.log("Seeding database...");

  const existingStocks = await db.select().from(stocks).limit(1);
  if (existingStocks.length > 0) {
    console.log("Data already seeded, skipping...");
    process.exit(0);
  }

  for (const s of stockList) {
    await db.insert(stocks).values({
      kodeSaham: s.kode,
      namaSaham: s.nama,
      basePrice: s.harga.toString(),
    });
    process.stdout.write(".");
  }
  console.log(`\n${stockList.length} stocks inserted.`);

  const hashed = await bcrypt.hash("admin", 12);
  await db.insert(users).values({
    nama: "Admin",
    password: hashed,
    role: "admin",
    saldo: "100000000.00",
  });

  console.log("Admin user created.");

  await db.insert(sessions).values({
    putaranKe: 1,
    status: "pending",
  });

  console.log("Initial session created.");
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
