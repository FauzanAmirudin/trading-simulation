import { db } from "./index";
import { users, stocks } from "./schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const stockList = [
  { kode: "S-1", nama: "Saham S-1", harga: 10250 },
  { kode: "S-2", nama: "Saham S-2", harga: 5650 },
  { kode: "S-3", nama: "Saham S-3", harga: 7100 },
  { kode: "S-4", nama: "Saham S-4", harga: 5525 },
  { kode: "S-5", nama: "Saham S-5", harga: 2820 },
  { kode: "S-6", nama: "Saham S-6", harga: 3450 },
  { kode: "S-7", nama: "Saham S-7", harga: 12450 },
  { kode: "S-8", nama: "Saham S-8", harga: 6425 },
  { kode: "S-9", nama: "Saham S-9", harga: 1625 },
  { kode: "S-10", nama: "Saham S-10", harga: 2520 },
  { kode: "S-11", nama: "Saham S-11", harga: 3950 },
  { kode: "S-12", nama: "Saham S-12", harga: 2225 },
  { kode: "S-13", nama: "Saham S-13", harga: 10500 },
  { kode: "S-14", nama: "Saham S-14", harga: 5150 },
  { kode: "S-15", nama: "Saham S-15", harga: 2725 },
  { kode: "S-16", nama: "Saham S-16", harga: 3050 },
  { kode: "S-17", nama: "Saham S-17", harga: 28500 },
  { kode: "S-18", nama: "Saham S-18", harga: 2025 },
  { kode: "S-19", nama: "Saham S-19", harga: 2475 },
  { kode: "S-20", nama: "Saham S-20", harga: 1725 },
  { kode: "S-21", nama: "Saham S-21", harga: 1380 },
  { kode: "S-22", nama: "Saham S-22", harga: 5350 },
  { kode: "S-23", nama: "Saham S-23", harga: 23750 },
  { kode: "S-24", nama: "Saham S-24", harga: 1350 },
  { kode: "S-25", nama: "Saham S-25", harga: 450 },
  { kode: "S-26", nama: "Saham S-26", harga: 1190 },
  { kode: "S-27", nama: "Saham S-27", harga: 4150 },
  { kode: "S-28", nama: "Saham S-28", harga: 8050 },
  { kode: "S-29", nama: "Saham S-29", harga: 995 },
  { kode: "S-30", nama: "Saham S-30", harga: 1680 },
  { kode: "S-31", nama: "Saham S-31", harga: 82 },
  { kode: "S-32", nama: "Saham S-32", harga: 1950 },
  { kode: "S-33", nama: "Saham S-33", harga: 995 },
  { kode: "S-34", nama: "Saham S-34", harga: 755 },
  { kode: "S-35", nama: "Saham S-35", harga: 1250 },
  { kode: "S-36", nama: "Saham S-36", harga: 386 },
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
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
