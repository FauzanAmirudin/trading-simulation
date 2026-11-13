import { db } from "./index";
import { users, questions } from "./schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { LA_QUESTIONS, EI_QUESTIONS } from "./seed-questionnaire";
import { seedInitialPortfolios } from "./seed-portfolios";
import { ensureStocksSchemaAndSync } from "./stocks-data";


export async function initDatabase() {
  console.log("==========================================");
  console.log("🚀 STARTING DATABASE INITIALIZATION / SEED");
  console.log("==========================================");

  // 1. Seed & Sync Stocks (36 Utama + 12 Uji Coba dengan Harga t-1, t-2, t-3)
  console.log("1. Checking & syncing 48 stocks...");
  await ensureStocksSchemaAndSync();
  console.log("✓ 36 Main Stocks + 12 Trial Stocks verified/synced.");

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

  // 3. Seed Mass Respondents (responden1 - responden100)
  console.log("3. Checking mass respondents (responden1..100)...");
  const userHashed = await bcrypt.hash("password123", 12);
  for (let i = 1; i <= 100; i++) {
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
  console.log("✓ 100 Mass respondents verified/seeded (responden1..100 / password123).");

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
