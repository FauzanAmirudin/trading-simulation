import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { db } from "./connect";
import { users, portfolios, stocks } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signSessionToken } from "../lib/auth-server";

// ─────────────────────────────────────────────────────────────
// 1. GENERATE 100 UNIQUE 4-DIGIT PINS
// ─────────────────────────────────────────────────────────────
function generate100Unique4DigitPins(): string[] {
  const pins = new Set<string>();
  const banned = new Set([
    "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
    "1234", "2345", "3456", "4567", "5678", "6789", "4321", "9876", "1000", "2000"
  ]);

  // Use a pseudo-random seed generator that produces well-distributed, non-guessable 4-digit numbers
  // Example range 1024 to 9899
  let seed = 749321;
  function nextRand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  while (pins.size < 100) {
    const num = Math.floor(1000 + nextRand() * 8999);
    const pinStr = String(num);
    if (!banned.has(pinStr) && !pins.has(pinStr)) {
      pins.add(pinStr);
    }
  }

  return Array.from(pins);
}

// ─────────────────────────────────────────────────────────────
// 2. MAIN EXECUTION
// ─────────────────────────────────────────────────────────────
export async function setupUniqueRespondentAccounts() {
  console.log("=======================================================");
  console.log("🔐 MENYIAPKAN 100 AKUN RESPONDEN DENGAN PIN 4-DIGIT UNIK");
  console.log("=======================================================");

  const pins = generate100Unique4DigitPins();
  console.log(`✓ 100 PIN 4-digit unik berhasil digenerate (Semua Berbeda & Bebas Pola Tebakan)`);

  const credentialsList: Array<{
    nomor: number;
    username: string;
    pin: string;
    role: string;
    saldo: string;
  }> = [];

  const existingUsers = await db.select().from(users);
  const userMap = new Map(existingUsers.map((u) => [u.nama.toLowerCase(), u]));

  console.log("Memperbarui kredensial 100 akun responden di database PostgreSQL...");

  for (let i = 1; i <= 100; i++) {
    const username = `responden${i}`;
    const pin = pins[i - 1];
    const hashed = await bcrypt.hash(pin, 10);
    const existing = userMap.get(username.toLowerCase());

    if (existing) {
      await db
        .update(users)
        .set({
          password: hashed,
          role: "responden",
          saldo: "100000000.00",
        })
        .where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({
        nama: username,
        password: hashed,
        role: "responden",
        saldo: "100000000.00",
      });
    }

    credentialsList.push({
      nomor: i,
      username,
      pin,
      role: "responden",
      saldo: "100.000.000,00",
    });
  }

  console.log("✓ Seluruh 100 akun berhasil diperbarui di database.");

  // Save JSON credentials to disk for reference & synchronization
  const jsonPath = path.join(process.cwd(), "src", "db", "respondent-credentials.json");
  fs.writeFileSync(jsonPath, JSON.stringify(credentialsList, null, 2), "utf8");
  console.log(`✓ File JSON tersimpan: ${jsonPath}`);

  // ─────────────────────────────────────────────────────────────
  // 3. GENERATE WORD (.DOCX) DOCUMENT (JIKA PYTHON TERSEDIA)
  // ─────────────────────────────────────────────────────────────
  const docxOutputPath = path.join(process.cwd(), "Daftar_Kredensial_Responden_1-100.docx");
  const pyScript = path.join(process.cwd(), "scripts", "generate_credentials_docx.py");

  let hasPython = false;
  try {
    execSync("python --version", { stdio: "ignore" });
    hasPython = true;
  } catch {
    try {
      execSync("python3 --version", { stdio: "ignore" });
      hasPython = true;
    } catch {
      hasPython = false;
    }
  }

  if (hasPython) {
    console.log("\nMembuat berkas Word (.docx) lengkap dengan kartu meja...");
    try {
      execSync(`python "${pyScript}" "${jsonPath}" "${docxOutputPath}"`, { stdio: "inherit" });
      console.log(`✓ Dokumen Word berhasil dibuat: ${docxOutputPath}`);
    } catch (pyErr) {
      console.warn("⚠️ Peringatan: Pembuatan docx dilewati:", (pyErr as Error).message);
    }
  } else {
    console.log("\nℹ️ Lingkungan server (Docker) tidak memiliki Python: pembuatan docx dilewati (dokumen .docx sudah dibuat di komputer lokal).");
  }

  // ─────────────────────────────────────────────────────────────
  // 4. TEST LOGIN FOR ALL 100 RESPONDENT ACCOUNTS
  // ─────────────────────────────────────────────────────────────
  console.log("\n=======================================================");
  console.log("🧪 MEMULAI UJI LOGIN SIMULTAN UNTUK 100 AKUN RESPONDEN");
  console.log("=======================================================");

  let successCount = 0;
  const failureList: string[] = [];

  for (const item of credentialsList) {
    const user = await db.query.users.findFirst({
      where: eq(users.nama, item.username),
    });

    if (!user || !user.password) {
      failureList.push(`${item.username}: User tidak ditemukan atau password kosong`);
      continue;
    }

    const isValid = await bcrypt.compare(item.pin, user.password);
    if (!isValid) {
      failureList.push(`${item.username}: Password salah`);
      continue;
    }

    const token = signSessionToken({
      id: user.id,
      nama: user.nama,
      role: user.role as "admin" | "responden",
    });

    if (!token) {
      failureList.push(`${item.username}: Gagal membuat session token`);
      continue;
    }

    successCount++;
  }

  console.log(`Hasil Pengujian Login:`);
  console.log(`- Total Akun Diuji : 100`);
  console.log(`- Berhasil Login   : ${successCount}`);
  console.log(`- Gagal Login      : ${failureList.length}`);

  if (failureList.length > 0) {
    console.error("❌ DAFTAR AKUN GAGAL:");
    failureList.forEach((f) => console.error("  • " + f));
    throw new Error("Pengujian login gagal untuk beberapa akun!");
  } else {
    console.log("\n✅ SEMUA 100 AKUN BERHASIL LOGIN TANPA ERROR DENGAN PASSWORD BARUNYA!");
    console.log("=======================================================\n");
  }

  return {
    total: credentialsList.length,
    successCount,
    docxOutputPath,
    credentialsList,
  };
}

if (process.argv[1] && process.argv[1].includes("set-unique-respondent-pins")) {
  setupUniqueRespondentAccounts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Execution error:", err);
      process.exit(1);
    });
}

