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

    // ==========================================
    // WORKSHEETS PER RESPONDEN
    // ==========================================
    for (const user of allRespondents) {
      const userPredictions = allPredictions.filter(p => p.userId === user.id);
      const userTransactions = allTransactions.filter(tx => {
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        return buyerId === user.id || sellerId === user.id;
      });

      // If user has no predictions and no transactions, and there are rounds, we can still include sheet or skip if empty
      const safeSheetName = (user.nama || `User_${user.id}`).replace(/[\\/?*\[\]]/g, '').substring(0, 31);
      const sheet = workbook.addWorksheet(safeSheetName);

      // --- SECTION 1: PREDICTIONS ---
      const predHeaderRow = sheet.addRow([
        'Waktu Input', 'Periode', 'Sesi', 'Ronde', 'Kode Saham', 'Harga Buka', 'Harga Prediksi', 'Harga Akhir', 'Selisih', 'Akurasi'
      ]);
      
      predHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
      });

      if (userPredictions.length === 0) {
        const emptyRow = sheet.addRow(['-', '-', '-', '-', 'Tidak ada prediksi pada ronde yang dipilih', '-', '-', '-', '-', '-']);
        emptyRow.eachCell((cell) => {
          cell.border = borderStyle;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        for (const p of userPredictions) {
          const round = roundMap[p.roundId];
          const stock = stockMap[p.stockId];
          const openingPrice = round?.openingPrices && (round.openingPrices as any)[p.stockId]
            ? Number((round.openingPrices as any)[p.stockId])
            : Number(stock?.basePrice || 0);
            
          const finalPrice = (finalPrices[p.roundId] && finalPrices[p.roundId][p.stockId]) 
            ? finalPrices[p.roundId][p.stockId] 
            : openingPrice;

          const predPrice = Number(p.tebakanHarga);
          const selisih = Math.abs(predPrice - openingPrice);

          const timeStr = formatWibDateTime(p.createdAt);
          const akurasiRaw = p.accuracyScore ? Number(p.accuracyScore) : null;
          const akurasiVal = akurasiRaw !== null ? akurasiRaw : null;

          const row = sheet.addRow([
            timeStr,
            `Periode ${round?.period || "-"}`,
            `Sesi ${round?.sessionGroup || "-"}`,
            `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
            stock?.kodeSaham || "-",
            openingPrice,
            predPrice,
            finalPrice,
            selisih,
            akurasiVal
          ]);

          row.eachCell((cell, colNumber) => {
            cell.border = borderStyle;
            cell.alignment = { vertical: 'middle' };
            
            if ([6, 7, 8, 9].includes(colNumber)) {
              cell.numFmt = 'Rp #,##0.00';
            }
            if (colNumber === 10 && cell.value !== null) {
              cell.numFmt = '0.00%';
            }
          });
        }
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
        { width: 24 }, // Waktu
        { width: 12 }, // Periode
        { width: 10 }, // Sesi
        { width: 10 }, // Ronde
        { width: 14 }, // Saham
        { width: 12 }, // Tipe / Harga Buka
        { width: 20 }, // Harga Prediksi / Harga
        { width: 20 }, // Harga Akhir / Lot
        { width: 24 }, // Selisih / Total
        { width: 20 }, // Akurasi / Intervensi
        { width: 26 }, // Lawan (only in TX)
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