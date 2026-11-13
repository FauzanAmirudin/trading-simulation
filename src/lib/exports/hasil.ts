import { db } from "@/db/connect";
import { users, portfolios, stocks, transactionsHistory, orderBook, rounds } from "@/db/schema";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { sortRespondentsSequentially } from "./sort-utils";
import { isDemoUsername } from "@/lib/demo-users";

export type HasilExportOptions = {
  date?: string | null;
  roundIds?: string | null;
  excludedRoundIds?: string | null;
  onlyCompleted?: string | null;
  period?: string | null;
};

export async function generateHasilWorkbook(options: HasilExportOptions = {}): Promise<{ buffer: Buffer; filename: string } | null> {
  const {
    date: dateParam = null,
    roundIds: roundIdsParam = null,
    excludedRoundIds: excludedRoundIdsParam = null,
    onlyCompleted: onlyCompletedParam = null,
    period: periodParam = null,
  } = options;

  try {
    const allRespondentsRaw = await db.select().from(users).where(eq(users.role, "responden"));
    const allRespondents = allRespondentsRaw.filter((u) => !isDemoUsername(u.nama));
    const officialUserIds = new Set(allRespondents.map((u) => u.id));

    if (allRespondents.length === 0) {
      return null;
    }

    const allStocks = await db.select().from(stocks);
    const stockMap = Object.fromEntries(allStocks.map(s => [s.id, s]));

    // Fetch and filter valid rounds (kecualikan Periode 0 / Sesi Uji Coba dari laporan export Excel)
    const allRoundsRaw = await db.select().from(rounds);
    const allRounds = allRoundsRaw.filter(r => r.period >= 1);
    
    let validRounds = allRounds;
    if (roundIdsParam) {
      const explicitIds = new Set(roundIdsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0));
      validRounds = allRounds.filter(r => explicitIds.has(r.id));
    } else {
      const excludedSet = new Set<number>(
        excludedRoundIdsParam
          ? excludedRoundIdsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0)
          : []
      );

      const matchesDate = (d: Date | string | null | undefined, targetDateStr: string): boolean => {
        if (!d || !targetDateStr) return false;
        const dateObj = typeof d === "string" ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return false;
        const wib = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(dateObj);
        return wib === targetDateStr;
      };

      validRounds = allRounds.filter(r => {
        if (excludedSet.has(r.id)) return false;
        if (onlyCompletedParam === "true" || onlyCompletedParam === null) {
          if (r.status === "aborted" || r.status === "pending") return false;
        }
        if (periodParam && r.period !== Number(periodParam)) return false;
        if (dateParam && dateParam !== "ALL") {
          const roundTime = r.startTime ?? r.createdAt;
          if (!matchesDate(roundTime, dateParam)) return false;
        }
        return true;
      });
    }

    const validRoundIds = new Set<number>(validRounds.map(r => r.id));

    const allPortfolios = await db.select().from(portfolios);
    const allOrders = await db.select().from(orderBook);
    const orderUserMap = Object.fromEntries(allOrders.map(o => [o.id, o.userId]));

    const allTransactionsRaw = await db.select().from(transactionsHistory).orderBy(transactionsHistory.createdAt);
    const allTransactions = allTransactionsRaw
      .filter(tx => validRoundIds.has(tx.roundId))
      .filter(tx => {
        const bId = orderUserMap[tx.orderBuyId];
        const sId = orderUserMap[tx.orderSellId];
        return (!bId || officialUserIds.has(bId)) && (!sId || officialUserIds.has(sId));
      });

    // Get last traded price per stock
    const lastPrices: Record<number, number> = {};
    for (const tx of allTransactions) {
      lastPrices[tx.stockId] = Number(tx.harga);
    }

    // Map order id to user id (already mapped above)

    // Transaction count per user
    const txCountPerUser: Record<number, number> = {};
    for (const tx of allTransactions) {
      const buyerId = orderUserMap[tx.orderBuyId];
      const sellerId = orderUserMap[tx.orderSellId];
      if (buyerId) txCountPerUser[buyerId] = (txCountPerUser[buyerId] || 0) + 1;
      if (sellerId) txCountPerUser[sellerId] = (txCountPerUser[sellerId] || 0) + 1;
    }

    // Calculate initial base portfolio value (36 stocks * 10 lots * 100 shares * basePrice)
    const initialBasePortfolioValue = allStocks.reduce((sum, stock) => {
      return sum + (10 * 100 * Number(stock.basePrice));
    }, 0);
    const initialCapital = 100000000 + initialBasePortfolioValue;

    // Build the results per user
    const results = allRespondents.map((user) => {
      const userKas = Number(user.saldo);
      const userPortos = allPortfolios.filter(p => p.userId === user.id);
      
      let nilaiPortofolio = 0;
      const portoDetails = [];

      // Calculate details for all 36 stocks
      for (const stock of allStocks) {
        const p = userPortos.find(up => up.stockId === stock.id);
        const jumlahLot = p?.jumlahLot || 0;
        const lastPrice = lastPrices[stock.id] || Number(stock.basePrice);
        const basePrice = Number(stock.basePrice);
        const lembar = jumlahLot * 100;
        const currentVal = lembar * lastPrice;
        const unrealizedPnl = (lastPrice - basePrice) * lembar;

        nilaiPortofolio += currentVal;

        portoDetails.push({
          kodeSaham: stock.kodeSaham,
          namaSaham: stock.namaSaham,
          basePrice,
          lastPrice,
          perubahanHargaPersen: ((lastPrice - basePrice) / basePrice) * 100,
          jumlahLot,
          lembar,
          currentVal,
          unrealizedPnl
        });
      }

      const totalKekayaan = userKas + nilaiPortofolio;
      const pnlAmount = totalKekayaan - initialCapital;
      const pnlPercent = (pnlAmount / initialCapital) * 100;
      const jumlahTransaksi = txCountPerUser[user.id] || 0;

      return {
        userId: user.id,
        nama: user.nama,
        kas: userKas,
        nilaiPortofolio,
        totalKekayaan,
        initialCapital,
        pnlAmount,
        pnlPercent,
        jumlahTransaksi,
        portoDetails
      };
    });

    // Sort descending by totalKekayaan for Leaderboard ranking
    results.sort((a, b) => b.totalKekayaan - a.totalKekayaan);
    const resultsWithRank = results.map((r, idx) => ({ ...r, rank: idx + 1 }));
    // Create the Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Trading Simulator Admin";
    workbook.created = new Date();

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const headerFill: ExcelJS.Fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' }
    };
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true, color: { argb: 'FFFFFFFF' }
    };

    // --- WORKSHEET 1: RANKING KEKAYAAN ---
    const sheet1 = workbook.addWorksheet("Ranking Kekayaan");
    const s1Header = sheet1.addRow([
      'Peringkat', 'Nama Responden', 'Saldo Kas', 'Nilai Portofolio', 
      'Total Kekayaan (NAV)', 'Modal Awal', 'Keuntungan/Kerugian (Rp)', 
      'Keuntungan/Kerugian (%)', 'Jumlah Transaksi'
    ]);

    s1Header.eachCell((cell) => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borderStyle;
    });

    resultsWithRank.forEach((r) => {
      const row = sheet1.addRow([
        r.rank, r.nama, r.kas, r.nilaiPortofolio, r.totalKekayaan, 
        r.initialCapital, r.pnlAmount, r.pnlPercent / 100, r.jumlahTransaksi
      ]);
      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle; cell.alignment = { vertical: 'middle' };
        if ([3, 4, 5, 6, 7].includes(colNumber)) { cell.numFmt = 'Rp #,##0.00'; }
        if (colNumber === 8) { cell.numFmt = '0.00%'; }
      });
    });

    sheet1.columns = [
      { width: 10 }, { width: 30 }, { width: 22 }, { width: 22 }, 
      { width: 25 }, { width: 22 }, { width: 25 }, { width: 22 }, { width: 18 }
    ];
    sheet1.views = [{ state: 'frozen', ySplit: 1 }];

    // ==========================================
    // WORKSHEETS PER RESPONDEN (DETAIL PORTOFOLIO INDIVIDUAL)
    // ==========================================
    const existingSheetNames = new Set<string>(["Ranking Kekayaan"]);
    const getUniqueSheetName = (baseName: string) => {
      let cleaned = (baseName || "User").replace(/[\\/?*\[\]:]/g, "").trim().substring(0, 28);
      if (!cleaned) cleaned = "User";
      let uniqueName = cleaned;
      let counter = 1;
      while (existingSheetNames.has(uniqueName.toLowerCase())) {
        uniqueName = `${cleaned.substring(0, 25)}_${counter}`;
        counter++;
      }
      existingSheetNames.add(uniqueName.toLowerCase());
      return uniqueName;
    };

    const tableHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' } // Deep Blue
    };

    // Urutkan lembar kerja per responden secara sekuensial (responden 1 s/d seterusnya)
    const sortedForSheets = sortRespondentsSequentially(resultsWithRank);

    sortedForSheets.forEach((r) => {
      const sheetName = getUniqueSheetName(r.nama || `User_${r.userId}`);
      const userSheet = workbook.addWorksheet(sheetName);

      // Section A: Header Ringkasan Profil Finansial Responden
      const titleRow = userSheet.addRow([`DETAIL PORTOFOLIO SAHAM — ${r.nama.toUpperCase()}`]);
      titleRow.font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };
      userSheet.addRow([]);

      userSheet.addRow(['Nama Responden:', r.nama, '', 'Peringkat NAV:', `#${r.rank} dari ${resultsWithRank.length}`]);
      userSheet.addRow(['Valuasi Saham:', r.nilaiPortofolio, '', 'Total Kekayaan (NAV):', r.totalKekayaan]);
      userSheet.addRow(['Laba/Rugi (PnL):', r.pnlAmount, '', 'Return (%):', r.pnlPercent / 100]);
      userSheet.addRow(['Total Transaksi:', `${r.jumlahTransaksi} transaksi`]);
      userSheet.addRow([]);

      // Format financial summary cells (Rows 3, 4, 5, 6)
      [3, 4, 5, 6].forEach((rowNum) => {
        const row = userSheet.getRow(rowNum);
        row.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
        row.getCell(4).font = { bold: true, color: { argb: 'FF475569' } };
        
        if (rowNum === 4 || rowNum === 5) {
          row.getCell(2).numFmt = 'Rp #,##0.00';
          row.getCell(5).numFmt = 'Rp #,##0.00';
          row.getCell(2).font = { bold: true };
          row.getCell(5).font = { bold: true };
        } else if (rowNum === 6) {
          row.getCell(2).numFmt = 'Rp #,##0.00';
          row.getCell(5).numFmt = '0.00%';
          row.getCell(2).font = { bold: true, color: { argb: r.pnlAmount >= 0 ? 'FF16A34A' : 'FFDC2626' } };
          row.getCell(5).font = { bold: true, color: { argb: r.pnlPercent >= 0 ? 'FF16A34A' : 'FFDC2626' } };
        }
      });

      // Section B: Tabel Rincian 36 Emiten Saham
      const tableHeaderRow = userSheet.addRow([
        'No', 'Kode Saham', 'Nama Saham', 'Harga Dasar (Base Price)', 
        'Harga Terakhir (Last Price)', 'Perubahan Harga (%)', 'Jumlah Lot', 
        'Jumlah Lembar', 'Nilai Pasar (Rp)', 'Laba/Rugi Belum Terealisasi (Unrealized PnL)'
      ]);

      tableHeaderRow.eachCell((cell) => {
        cell.fill = tableHeaderFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderStyle;
      });
      tableHeaderRow.height = 26;

      let totalLots = 0;
      let totalLembar = 0;
      let totalValuasi = 0;
      let totalPnl = 0;

      r.portoDetails.forEach((pd, stockIdx) => {
        totalLots += pd.jumlahLot;
        totalLembar += pd.lembar;
        totalValuasi += pd.currentVal;
        totalPnl += pd.unrealizedPnl;

        const row = userSheet.addRow([
          stockIdx + 1,
          pd.kodeSaham,
          pd.namaSaham,
          pd.basePrice,
          pd.lastPrice,
          pd.perubahanHargaPersen / 100,
          pd.jumlahLot,
          pd.lembar,
          pd.currentVal,
          pd.unrealizedPnl,
        ]);

        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: 'middle' };

          if (colNumber === 1 || colNumber === 2) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (colNumber === 4 || colNumber === 5 || colNumber === 9 || colNumber === 10) {
            cell.numFmt = 'Rp #,##0.00';
          }
          if (colNumber === 6) {
            cell.numFmt = '0.00%';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (pd.perubahanHargaPersen > 0) {
              cell.font = { color: { argb: 'FF16A34A' }, bold: true };
            } else if (pd.perubahanHargaPersen < 0) {
              cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            }
          }
          if (colNumber === 7 || colNumber === 8) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if (colNumber === 10) {
            if (pd.unrealizedPnl > 0) {
              cell.font = { color: { argb: 'FF16A34A' }, bold: true };
            } else if (pd.unrealizedPnl < 0) {
              cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            }
          }
        });
      });

      // Section C: Baris Total Keseluruhan Portofolio
      const totalRow = userSheet.addRow([
        'TOTAL', '', '', '', '', '', totalLots, totalLembar, totalValuasi, totalPnl
      ]);
      userSheet.mergeCells(`A${totalRow.number}:F${totalRow.number}`);

      totalRow.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.alignment = { vertical: 'middle' };

        if (colNumber === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (colNumber === 7 || colNumber === 8) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
        if (colNumber === 9 || colNumber === 10) {
          cell.numFmt = 'Rp #,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 10) {
            cell.font = { bold: true, color: { argb: totalPnl >= 0 ? 'FF16A34A' : 'FFDC2626' } };
          }
        }
      });
      totalRow.height = 24;

      userSheet.columns = [
        { width: 6 },   // No
        { width: 14 },  // Kode Saham
        { width: 28 },  // Nama Saham
        { width: 22 },  // Base Price
        { width: 22 },  // Last Price
        { width: 18 },  // Perubahan %
        { width: 14 },  // Jumlah Lot
        { width: 16 },  // Jumlah Lembar
        { width: 24 },  // Nilai Pasar
        { width: 28 },  // Unrealized PnL
      ];

      userSheet.views = [{ state: 'frozen', ySplit: 9 }];
    });

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = dateParam && dateParam !== "ALL"
      ? `Laporan_Hasil_${dateParam}.xlsx`
      : `Laporan_Hasil_Semua_Sesi.xlsx`;

    return { buffer: Buffer.from(buffer), filename };
  } catch (error) {
    console.error("[Export Excel Hasil Admin] Error:", error);
    throw error;
  }
}
