import { db } from "@/db/connect";
import { users, predictions, transactionsHistory, orderBook, rounds, stocks, roundStocks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { sortRespondentsSequentially } from "./sort-utils";
import { isDemoUsername } from "@/lib/demo-users";

export type ResumeExportOptions = {
  date?: string | null;
  roundIds?: string | null;
  excludedRoundIds?: string | null;
  onlyCompleted?: string | null;
  period?: string | null;
  session?: string | null;
};

function matchesDate(d: Date | string | null | undefined, targetDateStr: string): boolean {
  if (!d || !targetDateStr) return false;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return false;

  const wibDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);

  return wibDate === targetDateStr;
}

const formatWibDateTime = (d?: Date | string | null) => {
  if (!d) return "-";
  const dateObj = new Date(d);
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
};

export async function generateResumeWorkbook(options: ResumeExportOptions = {}): Promise<{ buffer: Buffer; filename: string } | null> {
  const {
    date: dateParam = "ALL",
    roundIds: roundIdsParam = null,
    excludedRoundIds: excludedRoundIdsParam = null,
    onlyCompleted: onlyCompletedParam = null,
    period: periodParam = null,
    session: sessionParam = null,
  } = options;

  try {
    // Fetch all respondents (excluding demo accounts)
    const allRespondentsRaw = await db.select().from(users).where(eq(users.role, "responden"));
    const allRespondents = allRespondentsRaw.filter((u) => !isDemoUsername(u.nama));
    const officialUserIds = new Set(allRespondents.map((u) => u.id));

    if (allRespondents.length === 0) {
      return null;
    }

    // Fetch all stocks for mapping
    const allStocks = await db.select().from(stocks);
    const stockMap = Object.fromEntries(allStocks.map(s => [s.id, s]));

    // Fetch all rounds for mapping (kecualikan Periode 0 / Sesi Uji Coba dari laporan export Excel)
    const allRoundsRaw = await db.select().from(rounds).orderBy(desc(rounds.id));
    const allRounds = allRoundsRaw.filter(r => r.period >= 1);
    const roundMap = Object.fromEntries(allRounds.map(r => [r.id, r]));

    // Fetch roundStocks mapping active stocks per round
    const allRoundStocks = await db.select().from(roundStocks);
    const roundStocksMap: Record<number, number[]> = {};
    for (const rs of allRoundStocks) {
      if (!roundStocksMap[rs.roundId]) {
        roundStocksMap[rs.roundId] = [];
      }
      roundStocksMap[rs.roundId].push(rs.stockId);
    }

    // Determine valid rounds
    let validRounds = allRounds;

    if (roundIdsParam) {
      const explicitIds = new Set(
        roundIdsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0)
      );
      validRounds = allRounds.filter(r => explicitIds.has(r.id));
    } else {
      const excludedSet = new Set<number>(
        excludedRoundIdsParam
          ? excludedRoundIdsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0)
          : []
      );

      validRounds = allRounds.filter(r => {
        if (excludedSet.has(r.id)) return false;
        if (onlyCompletedParam === "true" || onlyCompletedParam === null) {
          if (r.status === "aborted" || r.status === "pending") return false;
        }
        if (periodParam && r.period !== Number(periodParam)) return false;
        if (sessionParam && r.sessionGroup !== Number(sessionParam)) return false;
        if (dateParam && dateParam !== "ALL") {
          const roundTime = r.startTime ?? r.createdAt;
          if (!matchesDate(roundTime, dateParam)) return false;
        }
        return true;
      });
    }

    // Urutkan ronde secara kronologis: Periode, Sesi, Ronde
    validRounds.sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      if (a.sessionGroup !== b.sessionGroup) return a.sessionGroup - b.sessionGroup;
      if (a.roundIndex !== b.roundIndex) return a.roundIndex - b.roundIndex;
      return a.id - b.id;
    });

    const validRoundIds = new Set<number>(validRounds.map(r => r.id));

    // Fetch all orders for mapping counterparty
    const allOrders = await db.select().from(orderBook);
    const orderUserMap = Object.fromEntries(allOrders.map(o => [o.id, o.userId]));
    const userMap = Object.fromEntries(await db.select().from(users).then(res => res.map(u => [u.id, u.nama])));

    // Fetch and filter all transactions for valid rounds and official respondents only
    const allTransactionsRaw = await db.select().from(transactionsHistory).orderBy(transactionsHistory.createdAt);
    const allTransactions = allTransactionsRaw
      .filter(tx => validRoundIds.has(tx.roundId))
      .filter(tx => {
        const bId = orderUserMap[tx.orderBuyId];
        const sId = orderUserMap[tx.orderSellId];
        return (!bId || officialUserIds.has(bId)) && (!sId || officialUserIds.has(sId));
      });

    // Calculate final price per round and stock
    const finalPrices: Record<number, Record<number, number>> = {};
    for (const tx of allTransactions) {
      if (!finalPrices[tx.roundId]) finalPrices[tx.roundId] = {};
      finalPrices[tx.roundId][tx.stockId] = Number(tx.harga);
    }

    // Fetch all predictions for valid rounds and official respondents only
    const allPredictionsRaw = await db.select().from(predictions).orderBy(predictions.createdAt);
    const allPredictions = allPredictionsRaw.filter(p => validRoundIds.has(p.roundId) && officialUserIds.has(p.userId));

    // Natural sort SELURUH responden resmi (responden1 s.d responden100)
    // agar seluruh responden tercatat lengkap di Excel meskipun tidak bertransaksi
    const sortedRespondents = sortRespondentsSequentially(allRespondents);

    const activeRespondentsCount = allRespondents.filter(user => {
      const hasPreds = allPredictions.some(p => p.userId === user.id);
      const hasTx = allTransactions.some(tx => {
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        return buyerId === user.id || sellerId === user.id;
      });
      return hasPreds || hasTx;
    }).length;

    // Create the Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Trading Simulator Admin";
    workbook.created = new Date();

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' } // Deep Blue
    };
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };

    // ==========================================
    // WORKSHEET 1: RINGKASAN EKSPOR
    // ==========================================
    const summarySheet = workbook.addWorksheet("Ringkasan Ekspor");
    
    summarySheet.addRow(["LAPORAN HASIL SIMULASI INVESTASI (TRADING & PREDIKSI)"]);
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    summarySheet.addRow(["Waktu Ekspor:", formatWibDateTime(new Date())]);
    summarySheet.addRow(["Total Ronde Terpilih:", validRounds.length]);
    summarySheet.addRow(["Total Responden Terdaftar:", allRespondents.length]);
    summarySheet.addRow(["Total Responden Aktif Transaksi:", activeRespondentsCount]);
    summarySheet.addRow(["Total Responden Pasif (0 Transaksi):", allRespondents.length - activeRespondentsCount]);
    summarySheet.addRow(["Total Prediksi Terinput:", allPredictions.length]);
    summarySheet.addRow(["Total Transaksi Match:", allTransactions.length]);
    summarySheet.addRow([]);

    const summaryHeader = summarySheet.addRow([
      "No", "ID Ronde", "Periode", "Sesi", "Ronde", "Status", "Intervensi", "Waktu Mulai (WIB)", "Waktu Selesai (WIB)", "Total Transaksi", "Total Prediksi"
    ]);
    summaryHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borderStyle;
    });

    validRounds.forEach((r, idx) => {
      const rTxCount = allTransactions.filter(t => t.roundId === r.id).length;
      const rPredCount = allPredictions.filter(p => p.roundId === r.id).length;
      const startWib = formatWibDateTime(r.startTime || r.createdAt);
      const endWib = formatWibDateTime(r.endTime);

      const row = summarySheet.addRow([
        idx + 1,
        r.id,
        `Periode ${r.period}`,
        `Sesi ${r.sessionGroup}`,
        `Ronde ${r.roundIndex + 1}`,
        r.status.toUpperCase(),
        r.activeIntervention || "NONE",
        startWib,
        endWib,
        rTxCount,
        rPredCount,
      ]);

      row.eachCell((cell) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle' };
      });
    });

    summarySheet.columns = [
      { width: 6 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 },
      { width: 14 }, { width: 22 }, { width: 24 }, { width: 24 }, { width: 16 }, { width: 16 }
    ];
    summarySheet.views = [{ state: 'frozen', ySplit: 10 }];

    // Helper to calculate prediction accuracy metrics consistently
    const getPredictionMetrics = (p: typeof allPredictions[0]) => {
      const round = roundMap[p.roundId];
      const stock = stockMap[p.stockId];
      const openingPrice = round?.openingPrices && (round.openingPrices as any)[p.stockId]
        ? Number((round.openingPrices as any)[p.stockId])
        : Number(stock?.basePrice || 0);
        
      const finalPrice = (finalPrices[p.roundId] && finalPrices[p.roundId][p.stockId]) 
        ? finalPrices[p.roundId][p.stockId] 
        : openingPrice;

      const predPrice = Number(p.tebakanHarga);
      const selisih = Math.abs(predPrice - finalPrice);
      const calculatedAccuracy = finalPrice > 0 ? Math.max(0, 1 - selisih / finalPrice) : 0;
      const akurasiVal = (p.accuracyScore !== null && p.accuracyScore !== undefined && p.accuracyScore !== "")
        ? Number(p.accuracyScore)
        : calculatedAccuracy;

      return {
        round,
        stock,
        openingPrice,
        finalPrice,
        predPrice,
        selisih,
        akurasiVal
      };
    };

    // ==========================================
    // WORKSHEET 2: RATA-RATA AKURASI USER
    // ==========================================
    const userSummarySheet = workbook.addWorksheet("Rata-rata Akurasi User");

    userSummarySheet.addRow(["LAPORAN RATA-RATA AKURASI PREDIKSI SELURUH RESPONDEN"]);
    userSummarySheet.getRow(1).font = { bold: true, size: 14 };
    userSummarySheet.addRow(["Waktu Ekspor:", formatWibDateTime(new Date())]);
    userSummarySheet.addRow(["Total Responden Terdaftar:", sortedRespondents.length]);
    userSummarySheet.addRow([]);

    const userSummaryHeader = userSummarySheet.addRow([
      "No",
      "ID User",
      "Nama Responden",
      "Total Ronde Diikuti",
      "Total Prediksi Terinput",
      "Rata-rata Selisih (Rp)",
      "Rata-rata Akurasi Keseluruhan"
    ]);

    userSummaryHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borderStyle;
    });

    let grandTotalPreds = 0;
    const allUserAverages: number[] = [];
    const allUserSelisih: number[] = [];

    if (sortedRespondents.length === 0) {
      const emptySummaryRow = userSummarySheet.addRow([
        "-", "-", "Tidak ada responden yang terdaftar pada sistem", "-", "-", "-", "-"
      ]);
      emptySummaryRow.eachCell(cell => {
        cell.border = borderStyle;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    } else {
      sortedRespondents.forEach((user, idx) => {
        const userPreds = allPredictions.filter(p => p.userId === user.id);
        const roundsSet = new Set<number>();
        const accuracies: number[] = [];
        let totalUserSelisih = 0;

        for (const p of userPreds) {
          roundsSet.add(p.roundId);
          const { selisih, akurasiVal } = getPredictionMetrics(p);
          totalUserSelisih += selisih;
          if (akurasiVal !== null) {
            accuracies.push(akurasiVal);
          }
        }

        grandTotalPreds += userPreds.length;
        const userAvgAkurasi = accuracies.length > 0
          ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
          : 0; // Tercatat 0 jika tidak ada transaksi
        const userAvgSelisih = userPreds.length > 0 ? totalUserSelisih / userPreds.length : 0;

        if (accuracies.length > 0) allUserAverages.push(userAvgAkurasi);
        if (userPreds.length > 0) allUserSelisih.push(userAvgSelisih);

        const row = userSummarySheet.addRow([
          idx + 1,
          user.id,
          user.nama || `User #${user.id}`,
          roundsSet.size,
          userPreds.length,
          userAvgSelisih,
          userAvgAkurasi
        ]);

        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: 'middle' };

          if ([1, 2, 4, 5].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (colNumber === 6) {
            cell.numFmt = 'Rp #,##0.00';
            if (userPreds.length === 0) {
              cell.font = { color: { argb: 'FF6B7280' } };
            }
          }
          if (colNumber === 7) {
            cell.numFmt = '0.00%';
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (userPreds.length === 0) {
              cell.font = { color: { argb: 'FF6B7280' } };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E7FF' } // Soft indigo highlight
              };
            }
          }
        });
      });
    }

    // Add Grand Average summary row
    const grandAvgAkurasi = allUserAverages.length > 0
      ? allUserAverages.reduce((a, b) => a + b, 0) / allUserAverages.length
      : null;
    const grandAvgSelisih = allUserSelisih.length > 0
      ? allUserSelisih.reduce((a, b) => a + b, 0) / allUserSelisih.length
      : null;

    const grandAvgRow = userSummarySheet.addRow([
      "RATA-RATA SELURUH RESPONDEN",
      "",
      "",
      "",
      grandTotalPreds,
      grandAvgSelisih !== null ? grandAvgSelisih : "-",
      grandAvgAkurasi !== null ? grandAvgAkurasi : "-"
    ]);

    for (let c = 1; c <= 4; c++) {
      const cell = grandAvgRow.getCell(c);
      cell.border = borderStyle;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      };
      if (c === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    const col5 = grandAvgRow.getCell(5);
    col5.border = borderStyle;
    col5.font = { bold: true };
    col5.alignment = { horizontal: 'center', vertical: 'middle' };
    col5.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    };

    const col6 = grandAvgRow.getCell(6);
    col6.border = borderStyle;
    col6.font = { bold: true };
    col6.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    };
    if (typeof col6.value === 'number') {
      col6.numFmt = 'Rp #,##0.00';
    }

    const col7 = grandAvgRow.getCell(7);
    col7.border = borderStyle;
    col7.font = { bold: true };
    if (typeof col7.value === 'number') {
      col7.numFmt = '0.00%';
      col7.alignment = { horizontal: 'center', vertical: 'middle' };
      col7.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC7D2FE' }
      };
    }

    userSummarySheet.mergeCells(grandAvgRow.number, 1, grandAvgRow.number, 4);

    userSummarySheet.columns = [
      { width: 8 },  // 1. No
      { width: 12 }, // 2. ID User
      { width: 28 }, // 3. Nama Responden
      { width: 22 }, // 4. Total Ronde Diikuti
      { width: 24 }, // 5. Total Prediksi Terinput
      { width: 24 }, // 6. Rata-rata Selisih (Rp)
      { width: 30 }, // 7. Rata-rata Akurasi Keseluruhan
    ];
    userSummarySheet.views = [{ state: 'frozen', ySplit: 5 }];

    // ==========================================
    // WORKSHEETS PER RESPONDEN (LENGKAP SELURUH RESPONDEN 1 s.d 100)
    // ==========================================
    const usedSheetNames = new Set<string>();

    for (const user of sortedRespondents) {
      const userPredictions = allPredictions.filter(p => p.userId === user.id);
      const userTransactions = allTransactions.filter(tx => {
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        return buyerId === user.id || sellerId === user.id;
      });

      const baseSheetName = (user.nama || `User_${user.id}`).replace(/[\\/?*\[\]]/g, '').substring(0, 31);
      let safeSheetName = baseSheetName;
      let collisionIdx = 1;
      while (usedSheetNames.has(safeSheetName.toLowerCase())) {
        safeSheetName = `${baseSheetName.substring(0, 27)}_${collisionIdx++}`;
      }
      usedSheetNames.add(safeSheetName.toLowerCase());
      const sheet = workbook.addWorksheet(safeSheetName);

      // --- SECTION 1: PREDIKSI & ORDER TRANSAKSI RESPONDEN ---
      const predHeaderRow = sheet.addRow([
        'Waktu Input', 'Periode', 'Sesi', 'Ronde', 'Kode Saham', 'Pilihan Transaksi', 'Jumlah (Lot)', 'Harga Tebak / Order', 'Harga Open', 'Harga Akhir', 'Selisih', 'Akurasi', 'Rata-rata Akurasi Ronde'
      ]);
      
      predHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
      });

      if (validRounds.length === 0) {
        const emptyRow = sheet.addRow(['-', '-', '-', '-', 'Tidak ada ronde yang dipilih', '-', 0, 0, 0, 0, 0, 0, 0]);
        emptyRow.eachCell((cell) => {
          cell.border = borderStyle;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        const userAllAccuracies: number[] = [];

        // Loop melalui setiap ronde valid secara berurutan (Periode -> Sesi -> Ronde)
        for (const round of validRounds) {
          // Dapatkan daftar seluruh saham aktif pada ronde ini
          let roundStockIds: number[] = roundStocksMap[round.id] || [];
          if (roundStockIds.length === 0 && round.openingPrices && typeof round.openingPrices === "object") {
            roundStockIds = Object.keys(round.openingPrices).map(Number).filter(n => !isNaN(n) && n > 0);
          }
          if (roundStockIds.length === 0) {
            const fromPreds = allPredictions.filter(p => p.roundId === round.id).map(p => p.stockId);
            if (fromPreds.length > 0) roundStockIds = Array.from(new Set(fromPreds));
          }
          if (roundStockIds.length === 0) {
            const fromTxs = allTransactions.filter(t => t.roundId === round.id).map(t => t.stockId);
            if (fromTxs.length > 0) roundStockIds = Array.from(new Set(fromTxs));
          }
          roundStockIds = Array.from(new Set(roundStockIds));
          roundStockIds.sort((a, b) => {
            const sA = stockMap[a];
            const sB = stockMap[b];
            return (sA?.kodeSaham || "").localeCompare(sB?.kodeSaham || "");
          });

          // Fallback jika ronde tidak memiliki saham tercatat: buat 1 baris ronde kosong bernilai 0
          if (roundStockIds.length === 0) {
            const row = sheet.addRow([
              '-',
              `Periode ${round.period}`,
              `Sesi ${round.sessionGroup}`,
              `Ronde ${round.roundIndex + 1}`,
              '-',
              '-',
              0,
              0,
              0,
              0,
              0,
              0,
              0
            ]);
            row.eachCell((cell, colNumber) => {
              cell.border = borderStyle;
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              if ([8, 9, 10, 11].includes(colNumber)) cell.numFmt = 'Rp #,##0.00';
              if (colNumber === 7) cell.numFmt = '#,##0';
              if (colNumber === 12 || colNumber === 13) cell.numFmt = '0.00%';
            });
            continue;
          }

          const startRow = sheet.rowCount + 1;
          const roundAccuracies: number[] = [];

          // Untuk setiap saham pada ronde ini:
          for (const stockId of roundStockIds) {
            const stock = stockMap[stockId];
            const stockPreds = userPredictions.filter(p => p.roundId === round.id && p.stockId === stockId);

            if (stockPreds.length > 0) {
              // Kasus A: Responden melakukan prediksi / aksi transaksi
              for (const p of stockPreds) {
                const { openingPrice, finalPrice, predPrice, selisih, akurasiVal } = getPredictionMetrics(p);
                const timeStr = formatWibDateTime(p.createdAt);
                const pilihan = p.tipe || "-";
                const lot = p.jumlahLot || 1;

                if (akurasiVal !== null) {
                  roundAccuracies.push(akurasiVal);
                  userAllAccuracies.push(akurasiVal);
                }

                const row = sheet.addRow([
                  timeStr,
                  `Periode ${round.period}`,
                  `Sesi ${round.sessionGroup}`,
                  `Ronde ${round.roundIndex + 1}`,
                  stock?.kodeSaham || "-",
                  pilihan,
                  lot,
                  predPrice,
                  openingPrice,
                  finalPrice,
                  selisih,
                  akurasiVal ?? 0,
                  "" // Akan diisi dan dimerge nanti
                ]);

                row.eachCell((cell, colNumber) => {
                  cell.border = borderStyle;
                  cell.alignment = { vertical: 'middle' };

                  if ([2, 3, 4, 5].includes(colNumber)) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                  }
                  if (colNumber === 6) {
                    const isBeli = pilihan.toUpperCase() === "BELI" || pilihan.toUpperCase() === "BID";
                    const isJual = pilihan.toUpperCase() === "JUAL" || pilihan.toUpperCase() === "ASK";
                    cell.font = { bold: true, color: { argb: isBeli ? 'FF00B050' : isJual ? 'FFFF0000' : 'FF000000' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                  }
                  if (colNumber === 7) {
                    cell.numFmt = '#,##0';
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                  }
                  if ([8, 9, 10, 11].includes(colNumber)) {
                    cell.numFmt = 'Rp #,##0.00';
                  }
                  if (colNumber === 12) {
                    cell.numFmt = '0.00%';
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                  }
                });
              }
            } else {
              // Kasus B: Responden TIDAK melakukan transaksi/aksi jual beli pada saham ini di ronde ini:
              // Rekam bernilai 0 di hasil ekspor sesuai arahan agar lengkap tiap sesi dan rondenya
              const openingPrice = round?.openingPrices && (round.openingPrices as any)[stockId]
                ? Number((round.openingPrices as any)[stockId])
                : Number(stock?.basePrice || 0);
              const finalPrice = (finalPrices[round.id] && finalPrices[round.id][stockId])
                ? finalPrices[round.id][stockId]
                : openingPrice;

              const row = sheet.addRow([
                "-",
                `Periode ${round.period}`,
                `Sesi ${round.sessionGroup}`,
                `Ronde ${round.roundIndex + 1}`,
                stock?.kodeSaham || "-",
                "-",
                0,
                0,
                openingPrice,
                finalPrice,
                0,
                0,
                "" // Diisi dan dimerge nanti
              ]);

              row.eachCell((cell, colNumber) => {
                cell.border = borderStyle;
                cell.alignment = { vertical: 'middle' };

                if ([1, 2, 3, 4, 5, 6].includes(colNumber)) {
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                  if (colNumber === 6) {
                    cell.font = { color: { argb: 'FF6B7280' } };
                  }
                }
                if (colNumber === 7) {
                  cell.numFmt = '#,##0';
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                  cell.font = { color: { argb: 'FF6B7280' } };
                }
                if ([8, 9, 10, 11].includes(colNumber)) {
                  cell.numFmt = 'Rp #,##0.00';
                  if (colNumber === 8 || colNumber === 11) {
                    cell.font = { color: { argb: 'FF6B7280' } };
                  }
                }
                if (colNumber === 12) {
                  cell.numFmt = '0.00%';
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                  cell.font = { color: { argb: 'FF6B7280' } };
                }
              });
            }
          }

          const endRow = sheet.rowCount;

          // Merge Column 13 ("Rata-rata Akurasi Ronde") untuk ronde ini
          const roundAvg = roundAccuracies.length > 0
            ? roundAccuracies.reduce((a, b) => a + b, 0) / roundAccuracies.length
            : 0;

          for (let r = startRow; r <= endRow; r++) {
            const cell = sheet.getCell(r, 13);
            cell.border = borderStyle;
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E7FF' } // Soft indigo highlight
            };
          }

          if (endRow > startRow) {
            sheet.mergeCells(startRow, 13, endRow, 13);
          }

          const masterCell = sheet.getCell(startRow, 13);
          masterCell.value = roundAvg;
          masterCell.numFmt = '0.00%';
          masterCell.font = { bold: true };
          if (roundAccuracies.length === 0) {
            masterCell.font = { bold: false, color: { argb: 'FF6B7280' } };
          }
          masterCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Summary row for user overall average accuracy
        const overallUserAvg = userAllAccuracies.length > 0
          ? userAllAccuracies.reduce((a, b) => a + b, 0) / userAllAccuracies.length
          : 0;

        const totalUserAvgRow = sheet.addRow([
          "RATA-RATA KESELURUHAN AKURASI:",
          "", "", "", "", "", "", "", "", "", "", "",
          overallUserAvg
        ]);

        for (let c = 1; c <= 12; c++) {
          const cell = totalUserAvgRow.getCell(c);
          cell.border = borderStyle;
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
          };
          if (c === 1) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
        }

        const avgCell = totalUserAvgRow.getCell(13);
        avgCell.border = borderStyle;
        avgCell.font = { bold: true };
        avgCell.numFmt = '0.00%';
        avgCell.alignment = { horizontal: 'center', vertical: 'middle' };
        avgCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC7D2FE' }
        };

        sheet.mergeCells(totalUserAvgRow.number, 1, totalUserAvgRow.number, 12);
      }

      // Spacer rows
      sheet.addRow([]);
      sheet.addRow([]);

      // --- SECTION 2: TRANSACTIONS ---
      const txHeaderRow = sheet.addRow([
        'Waktu Transaksi', 'Periode', 'Sesi', 'Ronde', 'Kode Saham', 'Tipe', 'Harga', 'Jumlah (Lot)', 'Total Value', 'Intervensi Aktif', 'Lawan Transaksi'
      ]);

      txHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
      });

      if (userTransactions.length === 0) {
        const emptyRow = sheet.addRow(['-', '-', '-', '-', 'Tidak ada transaksi (0 transaksi match)', '-', 0, 0, 0, '-', '-']);
        emptyRow.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if ([7, 9].includes(colNumber)) {
            cell.numFmt = 'Rp #,##0.00';
            cell.font = { color: { argb: 'FF6B7280' } };
          }
          if (colNumber === 8) {
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FF6B7280' } };
          }
        });
      } else {
        for (const tx of userTransactions) {
          const round = roundMap[tx.roundId];
          const stock = stockMap[tx.stockId];
          
          const buyerId = orderUserMap[tx.orderBuyId];
          const sellerId = orderUserMap[tx.orderSellId];
          
          const isBuyer = buyerId === user.id;
          const tipe = isBuyer ? "BELI" : "JUAL";
          const lawanId = isBuyer ? sellerId : buyerId;
          const lawanName = lawanId ? userMap[lawanId] || `User #${lawanId}` : "Sistem/Unknown";

          const timeStr = formatWibDateTime(tx.createdAt);

          const row = sheet.addRow([
            timeStr,
            `Periode ${round?.period || "-"}`,
            `Sesi ${round?.sessionGroup || "-"}`,
            `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
            stock?.kodeSaham || "-",
            tipe,
            Number(tx.harga),
            tx.jumlah,
            Number(tx.total),
            tx.activeIntervention || "NONE",
            lawanName
          ]);

          row.eachCell((cell, colNumber) => {
            cell.border = borderStyle;
            cell.alignment = { vertical: 'middle' };
            
            if (colNumber === 6) {
               cell.font = { bold: true, color: { argb: isBuyer ? 'FF00B050' : 'FFFF0000' } };
               cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if ([7, 9].includes(colNumber)) {
              cell.numFmt = 'Rp #,##0.00';
            }
            if (colNumber === 8) {
              cell.numFmt = '#,##0';
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
          });
        }
      }

      sheet.columns = [
        { width: 24 }, // 1. Waktu Input / Transaksi
        { width: 12 }, // 2. Periode
        { width: 10 }, // 3. Sesi
        { width: 10 }, // 4. Ronde
        { width: 14 }, // 5. Kode Saham
        { width: 18 }, // 6. Pilihan Transaksi / Tipe
        { width: 14 }, // 7. Jumlah (Lot) / Harga
        { width: 22 }, // 8. Harga Tebak / Order / Jumlah Lot TX
        { width: 22 }, // 9. Harga Acuan / Buka / Total Value TX
        { width: 20 }, // 10. Harga Akhir / Intervensi
        { width: 24 }, // 11. Selisih / Lawan Transaksi
        { width: 16 }, // 12. Akurasi
        { width: 26 }, // 13. Rata-rata Akurasi Ronde
      ];

      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const downloadFileName = dateParam && dateParam !== "ALL"
      ? `Laporan_Trading_${dateParam}.xlsx`
      : `Laporan_Trading_Semua_Sesi.xlsx`;

    return { buffer: Buffer.from(buffer), filename: downloadFileName };
  } catch (error) {
    console.error("[Export Excel Admin] Error:", error);
    throw error;
  }
}