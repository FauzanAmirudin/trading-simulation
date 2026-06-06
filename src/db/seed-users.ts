import { db } from "./index";
import { users } from "./schema";
import bcrypt from "bcryptjs";

async function seedUsers() {
  console.log("Seeding respondent users...");

  // Cek apakah sudah ada user selain admin
  const existingUsers = await db.query.users.findMany({
    where: (users, { eq }) => eq(users.role, "responden")
  });

  if (existingUsers.length > 0) {
    console.log(`Sudah ada ${existingUsers.length} akun responden. Melewati proses pembuatan akun...`);
    process.exit(0);
  }

  // Password default untuk semua responden: password123
  const userHashed = await bcrypt.hash("password123", 12);
  const respondents = [];

  // Buat 30 akun responden
  for (let i = 1; i <= 30; i++) {
    respondents.push({
      nama: `Responden ${i}`,
      password: userHashed,
      role: "responden",
      saldo: "100000000.00",
    });
  }

  await db.insert(users).values(respondents);
  console.log("30 Akun responden berhasil dibuat!");
  console.log("Format Login -> Username: Responden 1 (sampai 30) | Password: password123");
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
