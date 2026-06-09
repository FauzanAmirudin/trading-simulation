import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { transactionsHistory, orderBook, stocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // optional YYYY-MM-DD filter

    // Fetch all transactions and join with stocks
    const txs = await db
      .select({
        id: transactionsHistory.id,
        stockCode: stocks.kodeSaham,
        harga: transactionsHistory.harga,
        jumlah: transactionsHistory.jumlah,
        total: transactionsHistory.total,
        subSession: transactionsHistory.subSession,
        activeIntervention: transactionsHistory.activeIntervention,
        createdAt: transactionsHistory.createdAt,
        orderBuyId: transactionsHistory.orderBuyId,
        orderSellId: transactionsHistory.orderSellId,
      })
      .from(transactionsHistory)
      .innerJoin(stocks, eq(transactionsHistory.stockId, stocks.id))
      .orderBy(transactionsHistory.createdAt);

    // Filter by date if provided
    let filteredTxs = txs;
    if (dateParam) {
      filteredTxs = txs.filter(t => {
        if (!t.createdAt) return false;
        const wibDate = new Date(t.createdAt).toISOString().split("T")[0];
        return wibDate === dateParam;
      });
    }

    if (filteredTxs.length === 0) {
      return NextResponse.json({ error: "Tidak ada data transaksi pada tanggal tersebut." }, { status: 404 });
    }

    // Extract all relevant order IDs to fetch in one go
    const orderIdsToFetch = new Set<number>();
    for (const tx of filteredTxs) {
      if (tx.orderBuyId) orderIdsToFetch.add(tx.orderBuyId);
      if (tx.orderSellId) orderIdsToFetch.add(tx.orderSellId);
    }

    // Fetch relevant orders
    const allOrders = await db.select({
        id: orderBook.id,
        harga: orderBook.harga,
        tipe: orderBook.tipe
    }).from(orderBook);
    
    // Create maps for quick lookup and original amount calculation
    const orderPriceMap = Object.fromEntries(allOrders.map(o => [o.id, Number(o.harga)]));
    
    // Calculate matched amounts per order to recover the original requested lot size
    const orderMatchedLots: Record<number, number> = {};
    for (const tx of txs) { // using all txs, not just filtered ones, in case a tx happened on a different day (rare but safe)
      if (tx.orderBuyId) orderMatchedLots[tx.orderBuyId] = (orderMatchedLots[tx.orderBuyId] || 0) + tx.jumlah;
      if (tx.orderSellId) orderMatchedLots[tx.orderSellId] = (orderMatchedLots[tx.orderSellId] || 0) + tx.jumlah;
    }

    // Fetch all raw orders for the new sheet (Log Order Masuk)
    const allRawOrders = await db
      .select({
        id: orderBook.id,
        stockCode: stocks.kodeSaham,
        tipe: orderBook.tipe,
        harga: orderBook.harga,
        jumlah: orderBook.jumlah,
        createdAt: orderBook.createdAt,
      })
      .from(orderBook)
      .innerJoin(stocks, eq(orderBook.stockId, stocks.id))
      .orderBy(orderBook.createdAt);

    let filteredOrders = allRawOrders;
    if (dateParam) {
      filteredOrders = allRawOrders.filter(o => {
        if (!o.createdAt) return false;
        const wibDate = new Date(o.createdAt).toISOString().split("T")[0];
        return wibDate === dateParam;
      });
    }

    // Create the Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Trading Simulator Admin";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Order Book & Spread");

    // Header styling
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

    const headerRow = sheet.addRow([
      'No', 'Waktu', 'Saham', 'Sub-Sesi', 'Bid Beli (Best Bid)', 'Bid Jual (Best Ask)', 
      'Harga Transaksi', 'Selisih (Spread)', 'Jumlah (Lot)', 'Total Nilai', 'Intervensi'
    ]);

    headerRow.eachCell((cell) => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borderStyle;
    });

    // Add rows
    filteredTxs.forEach((tx, idx) => {
        const timeStr = tx.createdAt ? tx.createdAt.toISOString().replace('T', ' ').substring(0, 19) : "";
        const bidBeli = orderPriceMap[tx.orderBuyId] || Number(tx.harga); // Fallback to tx price if order not found (shouldn't happen)
        const bidJual = orderPriceMap[tx.orderSellId] || Number(tx.harga);
        const hargaTransaksi = Number(tx.harga);
        const selisih = Math.abs(bidJual - bidBeli);

        const row = sheet.addRow([
            idx + 1,
            timeStr,
            tx.stockCode,
            tx.subSession,
            bidBeli,
            bidJual,
            hargaTransaksi,
            selisih,
            tx.jumlah,
            Number(tx.total),
            tx.activeIntervention || "NONE"
        ]);

        row.eachCell((cell, colNumber) => {
            cell.border = borderStyle; cell.alignment = { vertical: 'middle' };
            if ([5, 6, 7, 8, 10].includes(colNumber)) { cell.numFmt = 'Rp #,##0.00'; }
            if (colNumber === 9) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        });
    });

    // Column widths
    sheet.columns = [
      { width: 5 }, { width: 22 }, { width: 10 }, { width: 10 }, 
      { width: 22 }, { width: 22 }, { width: 22 }, { width: 20 }, 
      { width: 15 }, { width: 25 }, { width: 20 }
    ];
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ==========================================
    // SHEET 2: Log Order Masuk
    // ==========================================
    const sheet2 = workbook.addWorksheet("Log Order Masuk");

    const headerRow2 = sheet2.addRow([
      'No', 'Waktu', 'Saham', 'Tipe', 'Bid Beli', 'Bid Jual', 'Jumlah (Lot)'
    ]);

    headerRow2.eachCell((cell) => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borderStyle;
    });

    filteredOrders.forEach((o, idx) => {
        const timeStr = o.createdAt ? o.createdAt.toISOString().replace('T', ' ').substring(0, 19) : "";
        const harga = Number(o.harga);
        const isBid = o.tipe === "BID";
        const isAsk = o.tipe === "ASK";
        // Hitung total lot awal (lot sisa di DB + lot yang sudah terjual di history transaksi)
        const originalLots = o.jumlah + (orderMatchedLots[o.id] || 0);

        const row = sheet2.addRow([
            idx + 1,
            timeStr,
            o.stockCode,
            o.tipe,
            isBid ? harga : "-",
            isAsk ? harga : "-",
            originalLots
        ]);

        row.eachCell((cell, colNumber) => {
            cell.border = borderStyle; cell.alignment = { vertical: 'middle' };
            if ([5, 6].includes(colNumber) && cell.value !== "-") { 
                cell.numFmt = 'Rp #,##0.00'; 
            }
            if (colNumber === 7) { 
                cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; 
            }
        });
    });

    sheet2.columns = [
      { width: 8 }, { width: 22 }, { width: 12 }, { width: 10 }, 
      { width: 20 }, { width: 20 }, { width: 15 }
    ];
    sheet2.views = [{ state: 'frozen', ySplit: 1 }];

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const downloadFileName = dateParam ? `Laporan_OrderBook_${dateParam}.xlsx` : `Laporan_OrderBook_All.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
      },
    });

  } catch (error) {
    console.error("[Export OrderBook Admin] Error:", error);
    return NextResponse.json({ error: "Gagal men-generate file Excel OrderBook." }, { status: 500 });
  }
}
