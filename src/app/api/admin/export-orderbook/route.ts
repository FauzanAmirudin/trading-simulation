import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { transactionsHistory, orderBook, stocks, rounds, users } from "@/db/schema";
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
    const dateParam = searchParams.get("date"); // optional YYYY-MM-DD filter
    const roundIdsParam = searchParams.get("roundIds"); // optional comma-separated IDs
    const excludedRoundIdsParam = searchParams.get("excludedRoundIds");
    const onlyCompletedParam = searchParams.get("onlyCompleted");
    const periodParam = searchParams.get("period");
    const sessionParam = searchParams.get("session");

    // Fetch all rounds and build round map
    const allRounds = await db.select().from(rounds).orderBy(desc(rounds.id));
    const roundMap = Object.fromEntries(allRounds.map(r => [r.id, r]));

    // Fetch all users for respondent names
    const allUsers = await db.select({ id: users.id, nama: users.nama }).from(users);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.nama]));

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

    // Fetch transactions
    const txsRaw = await db
      .select({
        id: transactionsHistory.id,
        roundId: transactionsHistory.roundId,
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

    // Filter by valid round IDs
    const filteredTxs = txsRaw.filter(t => validRoundIds.has(t.roundId));

    // Fetch relevant orders
    const allOrders = await db.select({
      id: orderBook.id,
      roundId: orderBook.roundId,
      userId: orderBook.userId,
      stockCode: stocks.kodeSaham,
      tipe: orderBook.tipe,
      harga: orderBook.harga,
      jumlah: orderBook.jumlah,
      status: orderBook.status,
      createdAt: orderBook.createdAt,
    })
    .from(orderBook)
    .innerJoin(stocks, eq(orderBook.stockId, stocks.id))
    .orderBy(orderBook.createdAt);

    const filteredOrders = allOrders.filter(o => validRoundIds.has(o.roundId));
    const orderPriceMap = Object.fromEntries(allOrders.map(o => [o.id, Number(o.harga)]));

    // Calculate matched amounts per order
    const orderMatchedLots: Record<number, number> = {};
    for (const tx of txsRaw) {
      if (tx.orderBuyId) orderMatchedLots[tx.orderBuyId] = (orderMatchedLots[tx.orderBuyId] || 0) + tx.jumlah;
      if (tx.orderSellId) orderMatchedLots[tx.orderSellId] = (orderMatchedLots[tx.orderSellId] || 0) + tx.jumlah;
    }

    // Create the Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Trading Simulator Admin";
    workbook.created = new Date();

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const headerFill: ExcelJS.Fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' }
    };
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true, color: { argb: 'FFFFFFFF' }
    };

    // ==========================================
    // SHEET 1: Order Book & Spread
    // ==========================================
    const sheet = workbook.addWorksheet("Order Book & Spread");

    const headerRow = sheet.addRow([
      'No', 'Waktu Transaksi', 'Periode', 'Sesi', 'Ronde', 'Saham', 'Sub-Sesi', 
      'Bid Beli (Best Bid)', 'Bid Jual (Best Ask)', 'Harga Transaksi', 'Selisih (Spread)', 
      'Jumlah (Lot)', 'Total Nilai', 'Intervensi'
    ]);

    headerRow.eachCell((cell) => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borderStyle;
    });

    if (filteredTxs.length === 0) {
      const emptyRow = sheet.addRow([
        '-', '-', '-', '-', '-', '-', 'Tidak ada transaksi lelang yang match pada sesi/ronde ini', 
        '-', '-', '-', '-', '-', '-', '-'
      ]);
      emptyRow.eachCell((cell) => {
        cell.border = borderStyle; cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    } else {
      filteredTxs.forEach((tx, idx) => {
        const round = roundMap[tx.roundId];
        const timeStr = formatWibDateTime(tx.createdAt);
        const bidBeli = orderPriceMap[tx.orderBuyId] || Number(tx.harga);
        const bidJual = orderPriceMap[tx.orderSellId] || Number(tx.harga);
        const hargaTransaksi = Number(tx.harga);
        const selisih = Math.abs(bidJual - bidBeli);

        const row = sheet.addRow([
          idx + 1,
          timeStr,
          `Periode ${round?.period || "-"}`,
          `Sesi ${round?.sessionGroup || "-"}`,
          `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
          tx.stockCode,
          `Sub-Sesi ${tx.subSession}`,
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
          if ([8, 9, 10, 11, 13].includes(colNumber)) { cell.numFmt = 'Rp #,##0.00'; }
          if (colNumber === 12) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        });
      });
    }

    sheet.columns = [
      { width: 6 }, { width: 24 }, { width: 12 }, { width: 10 }, { width: 10 },
      { width: 12 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 20 }, 
      { width: 18 }, { width: 14 }, { width: 24 }, { width: 18 }
    ];
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ==========================================
    // SHEET 2: Log Order Masuk
    // ==========================================
    const sheet2 = workbook.addWorksheet("Log Order Masuk");

    const headerRow2 = sheet2.addRow([
      'No', 'Waktu Masuk', 'Periode', 'Sesi', 'Ronde', 'Nama Responden', 'Saham', 'Tipe Order', 
      'Harga (Bid/Ask)', 'Jumlah Lot (Awal)', 'Status Order'
    ]);

    headerRow2.eachCell((cell) => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borderStyle;
    });

    if (filteredOrders.length === 0) {
      const emptyRow = sheet2.addRow([
        '-', '-', '-', '-', '-', '-', 'Tidak ada order yang diinput pada sesi/ronde ini', '-', '-', '-', '-'
      ]);
      emptyRow.eachCell((cell) => {
        cell.border = borderStyle; cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    } else {
      filteredOrders.forEach((o, idx) => {
        const round = roundMap[o.roundId];
        const userName = userMap[o.userId] || (o.userId ? `User #${o.userId}` : "Sistem/Unknown");
        const timeStr = formatWibDateTime(o.createdAt);
        const harga = Number(o.harga || 0);
        const originalLots = Number(o.jumlah || 0) + (orderMatchedLots[o.id] || 0);
        const tipeOrder = (o.tipe || "BID").toUpperCase();
        const statusOrder = (o.status || "OPEN").toUpperCase();

        const row = sheet2.addRow([
          idx + 1,
          timeStr,
          `Periode ${round?.period || "-"}`,
          `Sesi ${round?.sessionGroup || "-"}`,
          `Ronde ${round?.roundIndex !== undefined ? round.roundIndex + 1 : "-"}`,
          userName,
          o.stockCode || "-",
          tipeOrder,
          harga,
          originalLots,
          statusOrder
        ]);

        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle; cell.alignment = { vertical: 'middle' };
          if (colNumber === 8) {
            cell.font = { bold: true, color: { argb: tipeOrder === "BID" ? 'FF00B050' : 'FFFF0000' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (colNumber === 9) { cell.numFmt = 'Rp #,##0.00'; }
          if (colNumber === 10) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        });
      });
    }

    sheet2.columns = [
      { width: 6 }, { width: 24 }, { width: 12 }, { width: 10 }, { width: 10 },
      { width: 24 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 18 }, { width: 14 }
    ];
    sheet2.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const uint8 = new Uint8Array(buffer as ArrayBuffer);
    const downloadFileName = dateParam && dateParam !== "ALL"
      ? `Laporan_OrderBook_${dateParam}.xlsx`
      : `Laporan_OrderBook_All.xlsx`;

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
    console.error("[Export OrderBook Admin] Error:", error);
    return NextResponse.json({ error: "Gagal men-generate file Excel OrderBook." }, { status: 500 });
  }
}
