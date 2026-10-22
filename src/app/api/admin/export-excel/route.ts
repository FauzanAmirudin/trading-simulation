import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, predictions, transactionsHistory, orderBook, rounds, stocks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import ExcelJS from "exceljs";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // optional YYYY-MM-DD or "ALL"
    const roundIdsParam = searchParams.get("roundIds"); // comma-separated round IDs
    const excludedRoundIdsParam = searchParams.get("excludedRoundIds");
    const onlyCompletedParam = searchParams.get("onlyCompleted");
    const periodParam = searchParams.get("period");
    const sessionParam = searchParams.get("session");

    // Fetch all respondents
    const allRespondents = await db.select().from(users).where(eq(users.role, "responden"));
    if (allRespondents.length === 0) {
      return NextResponse.json({ error: "Tidak ada data responden." }, { status: 404 });
    }

    // Fetch all stocks for mapping
    const allStocks = await db.select().from(stocks);
    const stockMap = Object.fromEntries(allStocks.map(s => [s.id, s]));

    // Fetch all rounds for mapping
    const allRounds = await db.select().from(rounds).orderBy(desc(rounds.id));
    const roundMap = Object.fromEntries(allRounds.map(r => [r.id, r]));

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

    const validRoundIds = new Set<number>(validRounds.map(r => r.id));

    // Fetch all transactions for valid rounds
    const allTransactionsRaw = await db.select().from(transactionsHistory).orderBy(transactionsHistory.createdAt);
    const allTransactions = allTransactionsRaw.filter(tx => validRoundIds.has(tx.roundId));

    // Calculate final price per round and stock
    const finalPrices: Record<number, Record<number, number>> = {};
    for (const tx of allTransactions) {
      if (!finalPrices[tx.roundId]) finalPrices[tx.roundId] = {};
      finalPrices[tx.roundId][tx.stockId] = Number(tx.harga);
    }

    // Fetch all orders for mapping counterparty
    const allOrders = await db.select().from(orderBook);
    const orderUserMap = Object.fromEntries(allOrders.map(o => [o.id, o.userId]));
    const userMap = Object.fromEntries(await db.select().from(users).then(res => res.map(u => [u.id, u.nama])));

    // Fetch all predictions for valid rounds
    const allPredictionsRaw = await db.select().from(predictions).orderBy(predictions.createdAt);
    const allPredictions = allPredictionsRaw.filter(p => validRoundIds.has(p.roundId));

    // Filter only respondents who actively participated in trading (have predictions or transactions in valid rounds)
    const activeRespondentsRaw = allRespondents.filter(user => {
      const hasPreds = allPredictions.some(p => p.userId === user.id);
      const hasTx = allTransactions.some(tx => {
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        return buyerId === user.id || sellerId === user.id;
      });
      return hasPreds || hasTx;
    });

    // Natural sort: responden1, responden2, ..., responden9, responden10, ..., responden90
    const activeRespondents = [...activeRespondentsRaw].sort((a, b) => {
      const nameA = a.nama || `User_${a.id}`;
      const nameB = b.nama || `User_${b.id}`;

      // Extract numeric suffix if pattern like 'responden12' or 'user12'
      const matchA = nameA.match(/\d+/);
      const matchB = nameB.match(/\d+/);

      if (matchA && matchB) {
        const prefixA = nameA.replace(/\d+.*/, '').toLowerCase();
        const prefixB = nameB.replace(/\d+.*/, '').toLowerCase();
        if (prefixA === prefixB) {
          const numA = parseInt(matchA[0], 10);
          const numB = parseInt(matchB[0], 10);
          if (numA !== numB) return numA - numB;
        }
      }

      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

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
    
    summarySheet.addRow(["LAPORAN HASIL SIMULASI INVESTASI"]);
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    summarySheet.addRow(["Waktu Ekspor:", formatWibDateTime(new Date())]);
    summarySheet.addRow(["Total Ronde Terpilih:", validRounds.length]);
    summarySheet.addRow(["Total Responden Terdaftar:", allRespondents.length]);
    summarySheet.addRow(["Total Responden Aktif:", activeRespondents.length]);
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
    summarySheet.views = [{ state: 'frozen', ySplit: 7 }];

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

    userSummarySheet.addRow(["LAPORAN RATA-RATA AKURASI PREDIKSI RESPONDEN AKTIF"]);
    userSummarySheet.getRow(1).font = { bold: true, size: 14 };
    userSummarySheet.addRow(["Waktu Ekspor:", formatWibDateTime(new Date())]);
    userSummarySheet.addRow(["Total Responden Aktif:", activeRespondents.length]);
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

    if (activeRespondents.length === 0) {
      const emptySummaryRow = userSummarySheet.addRow([
        "-", "-", "Tidak ada responden yang aktif pada ronde yang dipilih", "-", "-", "-", "-"
      ]);
      emptySummaryRow.eachCell(cell => {
        cell.border = borderStyle;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    } else {
      activeRespondents.forEach((user, idx) => {
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
          : null;
        const userAvgSelisih = userPreds.length > 0 ? totalUserSelisih / userPreds.length : null;

        if (userAvgAkurasi !== null) allUserAverages.push(userAvgAkurasi);
        if (userAvgSelisih !== null) allUserSelisih.push(userAvgSelisih);

        const row = userSummarySheet.addRow([
          idx + 1,
          user.id,
          user.nama || `User #${user.id}`,
          roundsSet.size,
          userPreds.length,
          userAvgSelisih !== null ? userAvgSelisih : "-",
          userAvgAkurasi !== null ? userAvgAkurasi : "-"
        ]);

        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: 'middle' };

          if ([1, 2, 4, 5].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (colNumber === 6 && typeof cell.value === 'number') {
            cell.numFmt = 'Rp #,##0.00';
          }
          if (colNumber === 7 && typeof cell.value === 'number') {
            cell.numFmt = '0.00%';
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E7FF' } // Soft indigo highlight
            };
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

    userSummarySheet.mergeCells(grandAvgRow.number, 1, grandAvgRow.number, 4);

    grandAvgRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.border = borderStyle;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' } // Light gray fill
      };
      if (colNumber === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (colNumber === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (colNumber === 6 && typeof cell.value === 'number') {
        cell.numFmt = 'Rp #,##0.00';
      }
      if (colNumber === 7 && typeof cell.value === 'number') {
        cell.numFmt = '0.00%';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC7D2FE' } // Distinct indigo highlight
        };
      }
    });

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
    // WORKSHEETS PER RESPONDEN AKTIF (URUT NATURAL 1 s.d. 90)
    // ==========================================
    for (const user of activeRespondents) {
      const userPredictions = allPredictions.filter(p => p.userId === user.id);
      const userTransactions = allTransactions.filter(tx => {
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        return buyerId === user.id || sellerId === user.id;
      });

      // Sort user predictions chronologically by period, session, round, and creation time
      userPredictions.sort((a, b) => {
        const rA = roundMap[a.roundId];
        const rB = roundMap[b.roundId];
        if (rA && rB) {
          if (rA.period !== rB.period) return rA.period - rB.period;
          if (rA.sessionGroup !== rB.sessionGroup) return rA.sessionGroup - rB.sessionGroup;
          if (rA.roundIndex !== rB.roundIndex) return rA.roundIndex - rB.roundIndex;
        }
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });

      // Pre-calculate round-level average accuracy for this user
      const userRoundAccuracies: Record<number, number[]> = {};
      for (const p of userPredictions) {
        if (!userRoundAccuracies[p.roundId]) {
          userRoundAccuracies[p.roundId] = [];
        }
        const { akurasiVal } = getPredictionMetrics(p);
        if (akurasiVal !== null) {
          userRoundAccuracies[p.roundId].push(akurasiVal);
        }
      }

      const userRoundAvgMap: Record<number, number | null> = {};
      for (const roundIdStr in userRoundAccuracies) {
        const roundId = Number(roundIdStr);
        const accs = userRoundAccuracies[roundId];
        userRoundAvgMap[roundId] = accs.length > 0
          ? accs.reduce((a, b) => a + b, 0) / accs.length
          : null;
      }

      // If user has no predictions and no transactions, and there are rounds, we can still include sheet or skip if empty
      const safeSheetName = (user.nama || `User_${user.id}`).replace(/[\\/?*\[\]]/g, '').substring(0, 31);
      const sheet = workbook.addWorksheet(safeSheetName);

      // --- SECTION 1: PREDIKSI & ORDER TRANSAKSI RESPONDEN ---
      const predHeaderRow = sheet.addRow([
        'Waktu Input', 'Periode', 'Sesi', 'Ronde', 'Kode Saham', 'Pilihan Transaksi', 'Jumlah (Lot)', 'Harga Tebak / Order', 'Harga Acuan / Buka', 'Harga Akhir', 'Selisih', 'Akurasi', 'Rata-rata Akurasi Ronde'
      ]);
      
      predHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
      });

      if (userPredictions.length === 0) {
        const emptyRow = sheet.addRow(['-', '-', '-', '-', 'Tidak ada prediksi/order pada ronde yang dipilih', '-', '-', '-', '-', '-', '-', '-', '-']);
        emptyRow.eachCell((cell) => {
          cell.border = borderStyle;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        // Group contiguous predictions by roundId so we can merge cells per round
        type RoundGroup = {
          roundId: number;
          predictions: typeof userPredictions;
        };

        const roundGroups: RoundGroup[] = [];
        for (const p of userPredictions) {
          const lastGroup = roundGroups[roundGroups.length - 1];
          if (lastGroup && lastGroup.roundId === p.roundId) {
            lastGroup.predictions.push(p);
          } else {
            roundGroups.push({ roundId: p.roundId, predictions: [p] });
          }
        }

        for (const group of roundGroups) {
          const roundAvg = userRoundAvgMap[group.roundId] ?? null;
          const startRow = sheet.rowCount + 1;

          for (let i = 0; i < group.predictions.length; i++) {
            const p = group.predictions[i];
            const { round, stock, openingPrice, finalPrice, predPrice, selisih, akurasiVal } = getPredictionMetrics(p);

            const timeStr = formatWibDateTime(p.createdAt);
            const pilihan = p.tipe || "-";
            const lot = p.jumlahLot || 1;

            const row = sheet.addRow([
              timeStr,
              `Periode ${round?.period || "-"}`,
              `Sesi ${round?.sessionGroup || "-"}`,
              `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
              stock?.kodeSaham || "-",
              pilihan,
              lot,
              predPrice,
              openingPrice,
              finalPrice,
              selisih,
              akurasiVal,
              i === 0 ? (roundAvg !== null ? roundAvg : "-") : ""
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
              if (colNumber === 12 && cell.value !== null && typeof cell.value === 'number') {
                cell.numFmt = '0.00%';
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }
            });
          }

          const endRow = sheet.rowCount;

          // Merge Column 13 ("Rata-rata Akurasi Ronde") for this round
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
          masterCell.value = roundAvg !== null ? roundAvg : "-";
          if (typeof roundAvg === 'number') {
            masterCell.numFmt = '0.00%';
          }
          masterCell.font = { bold: true };
          masterCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Summary row for user overall average accuracy
        const allUserAccs = userPredictions
          .map(p => getPredictionMetrics(p).akurasiVal)
          .filter((v): v is number => v !== null);

        const overallUserAvg = allUserAccs.length > 0
          ? allUserAccs.reduce((a, b) => a + b, 0) / allUserAccs.length
          : null;

        const totalUserAvgRow = sheet.addRow([
          "RATA-RATA KESELURUHAN AKURASI:",
          "", "", "", "", "", "", "", "", "", "", "",
          overallUserAvg !== null ? overallUserAvg : "-"
        ]);

        sheet.mergeCells(totalUserAvgRow.number, 1, totalUserAvgRow.number, 12);

        totalUserAvgRow.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
          };
          if (colNumber === 1) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if (colNumber === 13 && typeof cell.value === 'number') {
            cell.numFmt = '0.00%';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFC7D2FE' }
            };
          }
        });
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
        const emptyRow = sheet.addRow(['-', '-', '-', '-', 'Tidak ada transaksi match pada ronde yang dipilih', '-', '-', '-', '-', '-', '-']);
        emptyRow.eachCell((cell) => {
          cell.border = borderStyle;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
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
    const uint8 = new Uint8Array(buffer as ArrayBuffer);
    const downloadFileName = dateParam && dateParam !== "ALL"
      ? `Laporan_Trading_${dateParam}.xlsx`
      : `Laporan_Trading_All.xlsx`;

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
        'Content-Length': String(uint8.byteLength),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error("[Export Excel Admin] Error:", error);
    return NextResponse.json({ error: "Gagal men-generate file Excel." }, { status: 500 });
  }
}