import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, predictions, transactionsHistory, orderBook, rounds, stocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import dayjs from "dayjs";
const { ZipArchive } = require("archiver");

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

    // Create a Promise to handle the Zip stream
    const chunks: Buffer[] = [];
    const archive = new ZipArchive({
      zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', function(err: any) {
      throw err;
    });

    const streamPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: any) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: any) => reject(err));
    });

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
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Trading Simulator Admin";
      workbook.created = new Date();

      let userPredictions = allPredictions.filter(p => p.userId === user.id);
      let userTransactions = allTransactions.filter(tx => {
        const buyerId = orderUserMap[tx.orderBuyId];
        const sellerId = orderUserMap[tx.orderSellId];
        return buyerId === user.id || sellerId === user.id;
      });

      if (dateParam) {
        userPredictions = userPredictions.filter(p => dayjs(p.createdAt).format("YYYY-MM-DD") === dateParam);
        userTransactions = userTransactions.filter(tx => dayjs(tx.createdAt).format("YYYY-MM-DD") === dateParam);
      }

      // ── SHEET 1: PREDIKSI ──
      const sheet1 = workbook.addWorksheet("Prediksi Harga");
      sheet1.columns = [
        { header: 'Waktu Input', key: 'waktu', width: 22 },
        { header: 'Periode', key: 'periode', width: 12 },
        { header: 'Ronde', key: 'ronde', width: 10 },
        { header: 'Kode Saham', key: 'saham', width: 15 },
        { header: 'Harga Buka', key: 'hargaBuka', width: 20 },
        { header: 'Harga Prediksi', key: 'hargaPrediksi', width: 20 },
        { header: 'Harga Akhir', key: 'hargaAkhir', width: 20 },
        { header: 'Selisih', key: 'selisih', width: 20 },
        { header: 'Akurasi', key: 'akurasi', width: 15 },
      ];

      // Style Header
      const headerRow1 = sheet1.getRow(1);
      headerRow1.eachCell((cell) => {
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
        const selisih = Math.abs(predPrice - finalPrice);

        const row = sheet1.addRow({
          waktu: dayjs(p.createdAt).format("YYYY-MM-DD HH:mm:ss"),
          periode: `Periode ${round?.period || "-"}`,
          ronde: `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
          saham: stock?.kodeSaham || "-",
          hargaBuka: openingPrice,
          hargaPrediksi: predPrice,
          hargaAkhir: finalPrice,
          selisih: selisih,
          akurasi: p.accuracyScore ? Number(p.accuracyScore) : null,
        });

        // Apply number format & borders
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: 'middle' };
          
          if ([5, 6, 7, 8].includes(colNumber)) {
            cell.numFmt = 'Rp #,##0.00';
          }
          if (colNumber === 9 && cell.value !== null) {
            cell.numFmt = '0.0000';
          }
        });
      }

      // ── SHEET 2: TRANSAKSI ──
      const sheet2 = workbook.addWorksheet("Riwayat Transaksi");
      sheet2.columns = [
        { header: 'Waktu Transaksi', key: 'waktu', width: 22 },
        { header: 'Periode', key: 'periode', width: 12 },
        { header: 'Ronde', key: 'ronde', width: 10 },
        { header: 'Kode Saham', key: 'saham', width: 15 },
        { header: 'Tipe', key: 'tipe', width: 12 },
        { header: 'Harga', key: 'harga', width: 20 },
        { header: 'Jumlah (Lot)', key: 'jumlah', width: 15 },
        { header: 'Total Value', key: 'total', width: 25 },
        { header: 'Intervensi Aktif', key: 'intervensi', width: 20 },
        { header: 'Lawan Transaksi', key: 'lawan', width: 30 },
      ];

      // Style Header
      const headerRow2 = sheet2.getRow(1);
      headerRow2.eachCell((cell) => {
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

        const row = sheet2.addRow({
          waktu: dayjs(tx.createdAt).format("YYYY-MM-DD HH:mm:ss"),
          periode: `Periode ${round?.period || "-"}`,
          ronde: `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
          saham: stock?.kodeSaham || "-",
          tipe: tipe,
          harga: Number(tx.harga),
          jumlah: tx.jumlah,
          total: Number(tx.total),
          intervensi: tx.activeIntervention || "NONE",
          lawan: lawanName,
        });

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

      // Freeze top rows for easy scrolling
      sheet1.views = [{ state: 'frozen', ySplit: 1 }];
      sheet2.views = [{ state: 'frozen', ySplit: 1 }];

      // Write to buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      const safeName = user.nama.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      archive.append(Buffer.from(buffer), { name: `Laporan_Trading_${safeName}_${user.id}.xlsx` });
    }

    archive.finalize();

    const zipBuffer = await streamPromise;
    const downloadFileName = dateParam ? `Laporan_Trading_${dateParam}.zip` : `Laporan_Trading_All.zip`;

    return new NextResponse(zipBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
      },
    });

  } catch (error) {
    console.error("[Export Excel Admin] Error:", error);
    return NextResponse.json({ error: "Gagal men-generate file Excel." }, { status: 500 });
  }
}