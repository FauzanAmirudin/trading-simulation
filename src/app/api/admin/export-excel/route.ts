import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, predictions, transactionsHistory, orderBook, rounds, stocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // optional YYYY-MM-DD filter

    // Fetch all respondents
    const allRespondents = await db.select().from(users).where(eq(users.role, "responden"));

    if (allRespondents.length === 0) {
      return NextResponse.json({ error: "Tidak ada data responden." }, { status: 404 });
    }

    // Fetch all stocks for mapping
    const allStocks = await db.select().from(stocks);
    const stockMap = Object.fromEntries(allStocks.map(s => [s.id, s]));

    // Fetch all rounds for mapping
    const allRounds = await db.select().from(rounds);
    const roundMap = Object.fromEntries(allRounds.map(r => [r.id, r]));

    // Fetch all transactions to calculate final price
    const allTransactions = await db.select().from(transactionsHistory).orderBy(transactionsHistory.createdAt);
    
    // Final price per round and stock (last transaction price)
    const finalPrices: Record<number, Record<number, number>> = {};
    for (const tx of allTransactions) {
      if (!finalPrices[tx.roundId]) finalPrices[tx.roundId] = {};
      finalPrices[tx.roundId][tx.stockId] = Number(tx.harga);
    }

    // Fetch all orders for mapping counterparty
    const allOrders = await db.select().from(orderBook);
    const orderUserMap = Object.fromEntries(allOrders.map(o => [o.id, o.userId]));
    const userMap = Object.fromEntries(await db.select().from(users).then(res => res.map(u => [u.id, u.nama])));

    // Fetch all predictions
    const allPredictions = await db.select().from(predictions).orderBy(predictions.createdAt);

    // Create the Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Trading Simulator Admin";
    workbook.created = new Date();

    // Helper for formatting
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };

    // Process per user
    for (const user of allRespondents) {
      let userPredictions = allPredictions.filter(p => p.userId === user.id);
      let userTransactions = allTransactions.filter(tx => {
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        return buyerId === user.id || sellerId === user.id;
      });

      if (dateParam) {
        const getWibDateString = (d: Date) => {
          return d.toISOString().split('T')[0];
        };
        userPredictions = userPredictions.filter(p => p.createdAt && getWibDateString(new Date(p.createdAt)) === dateParam);
        userTransactions = userTransactions.filter(tx => tx.createdAt && getWibDateString(new Date(tx.createdAt)) === dateParam);
      }

      // Skip creating a sheet if there is absolutely no data for this user and we are filtering
      if (dateParam && userPredictions.length === 0 && userTransactions.length === 0) {
        continue;
      }

      // Create Worksheet for this user
      // Excel limits sheet name to 31 characters and forbids some special characters
      const safeSheetName = (user.nama || `User_${user.id}`).replace(/[\\/?*\[\]]/g, '').substring(0, 31);
      const sheet = workbook.addWorksheet(safeSheetName);

      // --- SECTION 1: PREDICTIONS ---
      const predHeaderRow = sheet.addRow([
        'Waktu Input', 'Periode', 'Ronde', 'Kode Saham', 'Harga Buka', 'Harga Prediksi', 'Harga Akhir', 'Selisih', 'Akurasi'
      ]);
      
      predHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
      });

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
        // Selisih antara tebakan dengan Harga Buka (karena ini prediksi Equilibrium pre-market)
        const selisih = Math.abs(predPrice - openingPrice);

        const timeStr = p.createdAt ? p.createdAt.toISOString().replace('T', ' ').substring(0, 19) : "";
        const akurasiRaw = p.accuracyScore ? Number(p.accuracyScore) : null;
        
        // Nilai dari DB sudah berupa desimal (contoh 0.95 untuk 95%), tidak perlu dibagi 100.
        const akurasiVal = akurasiRaw !== null ? akurasiRaw : null;

        const row = sheet.addRow([
          timeStr,
          `Periode ${round?.period || "-"}`,
          `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
          stock?.kodeSaham || "-",
          openingPrice,
          predPrice,
          finalPrice,
          selisih,
          akurasiVal
        ]);

        // Apply number format & borders
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: 'middle' };
          
          if ([5, 6, 7, 8].includes(colNumber)) {
            cell.numFmt = 'Rp #,##0.00';
          }
          if (colNumber === 9 && cell.value !== null) {
            cell.numFmt = '0.00%';
          }
        });
      }

      // Add spacer rows
      sheet.addRow([]);
      sheet.addRow([]);

      // --- SECTION 2: TRANSACTIONS ---
      const txHeaderRow = sheet.addRow([
        'Waktu Transaksi', 'Periode', 'Ronde', 'Kode Saham', 'Tipe', 'Harga', 'Jumlah (Lot)', 'Total Value', 'Intervensi Aktif', 'Lawan Transaksi'
      ]);

      txHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
      });

      for (const tx of userTransactions) {
        const round = roundMap[tx.roundId];
        const stock = stockMap[tx.stockId];
        
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        
        const isBuyer = buyerId === user.id;
        const tipe = isBuyer ? "BELI" : "JUAL";
        const lawanId = isBuyer ? sellerId : buyerId;
        const lawanName = lawanId ? userMap[lawanId] || `User #${lawanId}` : "Sistem/Unknown";

        const timeStr = tx.createdAt ? tx.createdAt.toISOString().replace('T', ' ').substring(0, 19) : "";

        const row = sheet.addRow([
          timeStr,
          `Periode ${round?.period || "-"}`,
          `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
          stock?.kodeSaham || "-",
          tipe,
          Number(tx.harga),
          tx.jumlah,
          Number(tx.total),
          tx.activeIntervention || "NONE",
          lawanName
        ]);

        // Apply styles
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: 'middle' };
          
          if (colNumber === 5) {
             cell.font = { bold: true, color: { argb: isBuyer ? 'FF00B050' : 'FFFF0000' } };
             cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if ([6, 8].includes(colNumber)) {
            cell.numFmt = 'Rp #,##0.00';
          }
          if (colNumber === 7) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
      }

      // Adjust column widths
      sheet.columns = [
        { width: 22 }, // Waktu
        { width: 12 }, // Periode
        { width: 10 }, // Ronde
        { width: 15 }, // Saham
        { width: 20 }, // Harga / Tipe
        { width: 20 }, // Harga Prediksi / Harga
        { width: 20 }, // Harga Akhir / Lot
        { width: 25 }, // Selisih / Total
        { width: 20 }, // Akurasi / Intervensi
        { width: 30 }, // Lawan (only in TX)
      ];

      // Freeze top rows (just for prediction table header context if possible, or just standard freeze)
      // Since there are two tables, we just don't freeze, or freeze the first row. We'll freeze row 1.
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const downloadFileName = dateParam ? `Laporan_Trading_${dateParam}.xlsx` : `Laporan_Trading_All.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
      },
    });

  } catch (error) {
    console.error("[Export Excel Admin] Error:", error);
    return NextResponse.json({ error: "Gagal men-generate file Excel." }, { status: 500 });
  }
}