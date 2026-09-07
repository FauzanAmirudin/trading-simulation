import { db } from "./index";
import { users, stocks, questions, portfolios } from "./schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { LA_QUESTIONS, EI_QUESTIONS } from "./seed-questionnaire";
import { seedInitialPortfolios } from "./seed-portfolios";

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

export async function initDatabase() {
  console.log("==========================================");
  console.log("🚀 STARTING DATABASE INITIALIZATION / SEED");
  console.log("==========================================");

  // 1. Seed Stocks (36 Saham)
  console.log("1. Checking stocks...");
  for (const s of stockList) {
    const existing = await db.select().from(stocks).where(eq(stocks.kodeSaham, s.kode)).limit(1);
    if (existing.length === 0) {
      await db.insert(stocks).values({
        kodeSaham: s.kode,
        namaSaham: s.nama,
        basePrice: s.harga.toString(),
      });
    }
  }
  console.log("✓ 36 Stocks verified/seeded.");

  // 2. Seed Admin User
  console.log("2. Checking Admin user...");
  const adminUser = await db.select().from(users).where(eq(users.nama, "Admin")).limit(1);
  if (adminUser.length === 0) {
    const hashed = await bcrypt.hash("admin", 12);
    await db.insert(users).values({
      nama: "Admin",
      password: hashed,
      role: "admin",
      saldo: "100000000.00",
    });
    console.log("✓ Admin user created (Admin / admin).");
  } else {
    console.log("✓ Admin user already exists.");
  }

  // 3. Seed Mass Respondents (responden1 - responden30)
  console.log("3. Checking mass respondents (responden1..30)...");
  const userHashed = await bcrypt.hash("password123", 12);
  for (let i = 1; i <= 30; i++) {
    const username = `responden${i}`;
    const existing = await db.select().from(users).where(eq(users.nama, username)).limit(1);
    if (existing.length === 0) {
      await db.insert(users).values({
        nama: username,
        password: userHashed,
        role: "responden",
        saldo: "100000000.00",
      });
    }
  }
  console.log("✓ 30 Mass respondents verified/seeded (responden1..30 / password123).");

  // 4. Seed Personal Named Respondents (Andi, Budi, Citra, Doni)
  console.log("4. Checking personal respondents (Andi, Budi, Citra, Doni)...");
  const personalAccounts = [
    { nama: "Andi", password: "password" },
    { nama: "Budi", password: "password" },
    { nama: "Citra", password: "password" },
    { nama: "Doni", password: "password" },
  ];
  for (const a of personalAccounts) {
    const existing = await db.select().from(users).where(eq(users.nama, a.nama)).limit(1);
    if (existing.length === 0) {
      const hashed = await bcrypt.hash(a.password, 12);
      await db.insert(users).values({
        nama: a.nama,
        password: hashed,
        role: "responden",
        saldo: "100000000.00",
      });
    }
  }
  console.log("✓ Personal respondents verified/seeded.");

  // 5. Seed Psychological Questionnaire (15 LA & 15 EI)
  console.log("5. Checking questionnaire questions (15 LA & 15 EI)...");
  for (let i = 0; i < LA_QUESTIONS.length; i++) {
    const orderNumber = i + 1;
    const text = LA_QUESTIONS[i];
    const existing = await db.select().from(questions)
      .where(and(eq(questions.instrument, "LA"), eq(questions.orderNumber, orderNumber)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(questions).values({
        instrument: "LA",
        orderNumber,
        questionText: text,
        isActive: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: "Sangat Tidak Setuju",
        scaleMaxLabel: "Sangat Setuju",
      });
    }
  }

  for (let i = 0; i < EI_QUESTIONS.length; i++) {
    const orderNumber = i + 1;
    const text = EI_QUESTIONS[i];
    const existing = await db.select().from(questions)
      .where(and(eq(questions.instrument, "EI"), eq(questions.orderNumber, orderNumber)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(questions).values({
        instrument: "EI",
        orderNumber,
        questionText: text,
        isActive: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: "Sangat Tidak Setuju",
        scaleMaxLabel: "Sangat Setuju",
      });
    }
  }
  console.log("✓ 30 Questionnaire questions verified/seeded.");

  // 6. Seed Initial Portfolios (10 lots per stock) for all respondents
  console.log("6. Verifying initial portfolios (10 lots/stock)...");
  await seedInitialPortfolios(10);
  console.log("✓ Initial portfolios verified for all respondents.");

  console.log("==========================================");
  console.log("✅ DATABASE INITIALIZATION COMPLETED SUCCESSFULLY");
  console.log("==========================================");
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Database initialization error:", err);
      process.exit(1);
    });
}
