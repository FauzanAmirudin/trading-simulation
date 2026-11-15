import fs from "fs";
import path from "path";
import { ZipArchive } from "archiver";
import { db, ensureQuestionnaireSchema } from "@/db/connect";
import {
  users,
  stocks,
  rounds,
  roundStocks,
  predictions,
  orderBook,
  portfolios,
  transactionsHistory,
  sessions,
  sessionStocks,
  questions,
  questionnaireResponses,
  respondentProfiles,
  respondentBiodata,
  simulationEvaluations,
  experimentalConfig,
} from "@/db/schema";
import { asc } from "drizzle-orm";
import { generateBiodataWorkbook } from "./exports/biodata";
import { generateProfilesWorkbook } from "./exports/profiles";
import { generateEvaluationWorkbook } from "./exports/evaluation";
import { generateResumeWorkbook } from "./exports/resume";
import { generateHasilWorkbook } from "./exports/hasil";
import { generateOrderBookWorkbook } from "./exports/orderbook";

const BACKUP_DIR = path.join(process.cwd(), "backups");

export function ensureBackupDir(): string {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[BackupService] Gagal memastikan direktori BACKUP_DIR:", err);
  }
  return BACKUP_DIR;
}

export function formatWibDateTime(d?: Date | string | null): string {
  if (!d) return "-";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return "-";
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(dateObj);
  const timePart = dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).replace(/:/g, ".");
  return `${datePart} ${timePart} WIB`;
}

export function getBackupTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export interface JsonBackupResult {
  timestamp: string;
  jsonPath: string;
  jsonFilename: string;
  jsonString: string;
  recordCounts: Record<string, number>;
  payload: any;
}

export interface BackupResult {
  timestamp: string;
  zipPath: string;
  zipFilename: string;
  jsonPath: string;
  jsonFilename: string;
  filesIncluded: string[];
  recordCounts: Record<string, number>;
  zipBuffer: Buffer;
}

// ─────────────────────────────────────────────────────────────
// CORE EXPORT 1: CREATE FAST DATABASE JSON SNAPSHOT
// ─────────────────────────────────────────────────────────────
export async function createJsonBackup(reason: string = "manual-export"): Promise<JsonBackupResult> {
  ensureBackupDir();
  await ensureQuestionnaireSchema().catch((e) =>
    console.warn("[BackupService] ensureQuestionnaireSchema warning:", e)
  );

  const timestamp = getBackupTimestamp();
  const baseFilename = `backup_full_${timestamp}`;

  // Fetch raw database records across all tables with safe fallbacks
  const [
    allUsers,
    allStocks,
    allRounds,
    allRoundStocks,
    allPredictions,
    allOrderBook,
    allPortfolios,
    allTransactions,
    allSessions,
    allSessionStocks,
    allQuestions,
    allQuestionnaireResponses,
    allProfiles,
    allBiodata,
    allEvaluations,
    allConfig,
  ] = await Promise.all([
    db.select().from(users).orderBy(asc(users.id)).catch(() => []),
    db.select().from(stocks).orderBy(asc(stocks.id)).catch(() => []),
    db.select().from(rounds).orderBy(asc(rounds.id)).catch(() => []),
    db.select().from(roundStocks).orderBy(asc(roundStocks.id)).catch(() => []),
    db.select().from(predictions).orderBy(asc(predictions.id)).catch(() => []),
    db.select().from(orderBook).orderBy(asc(orderBook.id)).catch(() => []),
    db.select().from(portfolios).orderBy(asc(portfolios.id)).catch(() => []),
    db.select().from(transactionsHistory).orderBy(asc(transactionsHistory.id)).catch(() => []),
    db.select().from(sessions).orderBy(asc(sessions.id)).catch(() => []),
    db.select().from(sessionStocks).orderBy(asc(sessionStocks.id)).catch(() => []),
    db.select().from(questions).orderBy(asc(questions.orderNumber)).catch(() => []),
    db.select().from(questionnaireResponses).orderBy(asc(questionnaireResponses.id)).catch(() => []),
    db.select().from(respondentProfiles).orderBy(asc(respondentProfiles.id)).catch(() => []),
    db.select().from(respondentBiodata).orderBy(asc(respondentBiodata.id)).catch(() => []),
    db.select().from(simulationEvaluations).orderBy(asc(simulationEvaluations.id)).catch(() => []),
    db.select().from(experimentalConfig).orderBy(asc(experimentalConfig.id)).catch(() => []),
  ]);

  const recordCounts = {
    users: allUsers.length,
    stocks: allStocks.length,
    rounds: allRounds.length,
    roundStocks: allRoundStocks.length,
    predictions: allPredictions.length,
    orderBook: allOrderBook.length,
    portfolios: allPortfolios.length,
    transactionsHistory: allTransactions.length,
    sessions: allSessions.length,
    sessionStocks: allSessionStocks.length,
    questions: allQuestions.length,
    questionnaireResponses: allQuestionnaireResponses.length,
    respondentProfiles: allProfiles.length,
    respondentBiodata: allBiodata.length,
    simulationEvaluations: allEvaluations.length,
    experimentalConfig: allConfig.length,
  };

  const jsonPayload = {
    metadata: {
      title: "Trading Simulation Full Backup Snapshot",
      reason,
      createdAtWib: formatWibDateTime(new Date()),
      timestampIso: new Date().toISOString(),
      recordCounts,
    },
    tables: {
      users: allUsers,
      stocks: allStocks,
      rounds: allRounds,
      roundStocks: allRoundStocks,
      predictions: allPredictions,
      orderBook: allOrderBook,
      portfolios: allPortfolios,
      transactionsHistory: allTransactions,
      sessions: allSessions,
      sessionStocks: allSessionStocks,
      questions: allQuestions,
      questionnaireResponses: allQuestionnaireResponses,
      respondentProfiles: allProfiles,
      respondentBiodata: allBiodata,
      simulationEvaluations: allEvaluations,
      experimentalConfig: allConfig,
    },
  };

  const jsonFilename = `${baseFilename}.json`;
  const jsonPath = path.join(BACKUP_DIR, jsonFilename);
  const jsonString = JSON.stringify(jsonPayload, null, 2);

  try {
    fs.writeFileSync(jsonPath, jsonString, "utf8");
  } catch (writeErr) {
    console.error("[BackupService] Gagal menulis file JSON backup ke disk:", writeErr);
  }

  return {
    timestamp,
    jsonPath,
    jsonFilename,
    jsonString,
    recordCounts,
    payload: jsonPayload,
  };
}

// ─────────────────────────────────────────────────────────────
// CORE EXPORT 2: CREATE FULL BACKUP ZIP (ALL INDIVIDUAL EXCELS + JSON)
// ─────────────────────────────────────────────────────────────
export async function createFullBackup(reason: string = "hard-reset"): Promise<BackupResult> {
  ensureBackupDir();

  // 1. Generate JSON snapshot first (persisted to disk)
  const jsonBackup = await createJsonBackup(reason);
  const { timestamp, jsonPath, jsonFilename, jsonString, recordCounts } = jsonBackup;
  const baseFilename = `backup_full_${timestamp}`;

  // 2. Build each individual Excel report using the official generator functions
  const [
    biodataRes,
    profilesRes,
    evalRes,
    resumeRes,
    hasilRes,
    orderBookRes,
  ] = await Promise.all([
    generateBiodataWorkbook().catch((err: unknown) => {
      console.error("[Backup] Warning: Gagal mengekspor biodata:", err);
      return null;
    }),
    generateProfilesWorkbook().catch((err: unknown) => {
      console.error("[Backup] Warning: Gagal mengekspor profil responden:", err);
      return null;
    }),
    generateEvaluationWorkbook().catch((err: unknown) => {
      console.error("[Backup] Warning: Gagal mengekspor evaluasi:", err);
      return null;
    }),
    generateResumeWorkbook({ date: "ALL" }).catch((err: unknown) => {
      console.error("[Backup] Warning: Gagal mengekspor resume trading:", err);
      return null;
    }),
    generateHasilWorkbook({ date: "ALL" }).catch((err: unknown) => {
      console.error("[Backup] Warning: Gagal mengekspor hasil simulasi:", err);
      return null;
    }),
    generateOrderBookWorkbook({ date: "ALL" }).catch((err: unknown) => {
      console.error("[Backup] Warning: Gagal mengekspor order book:", err);
      return null;
    }),
  ]);

  const filesToZip: Array<{ name: string; buffer: Buffer }> = [];

  if (biodataRes?.buffer) {
    filesToZip.push({ name: biodataRes.filename, buffer: biodataRes.buffer });
  }
  if (profilesRes?.buffer) {
    filesToZip.push({ name: profilesRes.filename, buffer: profilesRes.buffer });
  }
  if (evalRes?.buffer) {
    filesToZip.push({ name: evalRes.filename, buffer: evalRes.buffer });
  }
  if (resumeRes?.buffer) {
    filesToZip.push({ name: resumeRes.filename, buffer: resumeRes.buffer });
  }
  if (hasilRes?.buffer) {
    filesToZip.push({ name: hasilRes.filename, buffer: hasilRes.buffer });
  }
  if (orderBookRes?.buffer) {
    filesToZip.push({ name: orderBookRes.filename, buffer: orderBookRes.buffer });
  }
  filesToZip.push({
    name: "snapshot_database_lengkap.json",
    buffer: Buffer.from(jsonString, "utf8"),
  });

  // 3. Bundle all into a single ZIP file using ZipArchive
  const zipFilename = `${baseFilename}.zip`;
  const zipPath = path.join(BACKUP_DIR, zipFilename);

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const outputStream = fs.createWriteStream(zipPath);

  // Standard Promise implementation compatible with Node 18, 20, 22, 24+
  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    const onDone = () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    };

    const onError = (err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    outputStream.on("close", onDone);
    outputStream.on("finish", onDone);
    outputStream.on("error", (err) => {
      console.error("[BackupService] File write stream error:", err);
    });
    archive.on("error", onError);
    archive.on("end", () => {
      setTimeout(onDone, 50);
    });

    archive.pipe(outputStream);

    for (const item of filesToZip) {
      archive.append(item.buffer, { name: item.name });
    }

    archive.finalize();
  });

  const filesIncluded = filesToZip.map((f) => f.name);

  return {
    timestamp,
    zipPath,
    zipFilename,
    jsonPath,
    jsonFilename,
    filesIncluded,
    recordCounts,
    zipBuffer,
  };
}

export function listBackups(): Array<{
  filename: string;
  sizeBytes: number;
  createdAt: Date;
  type: "zip" | "excel" | "json";
}> {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter((f) => f.startsWith("backup_") && (f.endsWith(".zip") || f.endsWith(".xlsx") || f.endsWith(".json")))
    .map((filename) => {
      const fullPath = path.join(BACKUP_DIR, filename);
      const stat = fs.statSync(fullPath);
      let type: "zip" | "excel" | "json" = "json";
      if (filename.endsWith(".zip")) type = "zip";
      else if (filename.endsWith(".xlsx")) type = "excel";

      return {
        filename,
        sizeBytes: stat.size,
        createdAt: stat.birthtime || stat.mtime,
        type,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
