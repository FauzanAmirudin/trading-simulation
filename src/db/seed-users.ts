import "dotenv/config";
import { db } from "./connect";
import { seedInitialPortfolios } from "./seed-portfolios";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedUsers(targetCount: number = 90) {
  console.log(`=======================================================`);
  console.log(`🚀 MEMERIKSA & MENAMBAH AKUN RESPONDEN HINGGA ${targetCount}`);
  console.log(`=======================================================`);

  const existingUsers = await db.select().from(users);
  const existingMap = new Set(existingUsers.map((u) => u.nama.toLowerCase()));

  const userHashed = await bcrypt.hash("password123", 12);
  const newRespondents: { nama: string; password: string; role: string; saldo: string }[] = [];

  // 1. Tambah responden1 s.d responden90 jika belum ada
  for (let i = 1; i <= targetCount; i++) {
    const username = `responden${i}`;
    if (!existingMap.has(username.toLowerCase())) {
      newRespondents.push({
        nama: username,
        password: userHashed,
        role: "responden",
        saldo: "100000000.00",
      });
    }
  }

  // 2. Tambah personal accounts jika belum ada
  const personalAccounts = [
    { nama: "Andi", password: "password" },
    { nama: "Budi", password: "password" },
    { nama: "Citra", password: "password" },
    { nama: "Doni", password: "password" },
  ];
  for (const a of personalAccounts) {
    if (!existingMap.has(a.nama.toLowerCase())) {
      const hashed = await bcrypt.hash(a.password, 12);
      newRespondents.push({
        nama: a.nama,
        password: hashed,
        role: "responden",
        saldo: "100000000.00",
      });
    }
  }

  if (newRespondents.length > 0) {
    console.log(`Menambahkan ${newRespondents.length} akun responden baru ke database...`);
    const chunkSize = 50;
    for (let i = 0; i < newRespondents.length; i += chunkSize) {
      await db.insert(users).values(newRespondents.slice(i, i + chunkSize));
    }
    console.log(`✓ ${newRespondents.length} akun responden baru berhasil ditambahkan!`);
  } else {
    console.log(`✓ Seluruh akun responden (1 s.d ${targetCount}) sudah ada.`);
  }

  // 3. Pastikan portofolio awal (10 lot/saham) teralokasi untuk seluruh responden
  console.log(`Memverifikasi alokasi portofolio awal (10 lot/saham)...`);
  await seedInitialPortfolios(10);

  const allRespondents = await db.select().from(users).where(eq(users.role, "responden"));
  console.log(`\nTotal akun responden saat ini: ${allRespondents.length}`);
  console.log(`Format Login -> Username: responden1 s.d responden${targetCount} | Password: password123`);
  console.log(`=======================================================\n`);
}

if (process.argv[1] && process.argv[1].includes("seed-users")) {
  seedUsers(90)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
