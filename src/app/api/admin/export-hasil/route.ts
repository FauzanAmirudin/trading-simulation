import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, portfolios, stocks, transactionsHistory, orderBook } from "@/db/schema";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  try {
    const allRespondents = await db.select().from(users).where(eq(users.role, "responden"));
    if (allRespondents.length === 0) {
      return NextResponse.json({ error: "Tidak ada data responden." }, { status: 404 });
    }

    const allStocks = await db.select().from(stocks);
    const stockMap = Object.fromEntries(allStocks.map(s => [s.id, s]));

    const allPortfolios = await db.select().from(portfolios);
    const allTransactions = await db.select().from(transactionsHistory).orderBy(transactionsHistory.createdAt);
    const allOrders = await db.select().from(orderBook);

    // Get last traded price per stock
    const lastPrices: Record<number, number> = {};
    for (const tx of allTransactions) {
      lastPrices[tx.stockId] = Number(tx.harga);
    }

    // Map order id to user id
    const orderUserMap = Object.fromEntries(allOrders.map(o => [o.id, o.userId]));

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

    // Sort descending by totalKekayaan
    results.sort((a, b) => b.totalKekayaan - a.totalKekayaan);

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

    results.forEach((r, idx) => {
      const row = sheet1.addRow([
        idx + 1, r.nama, r.kas, r.nilaiPortofolio, r.totalKekayaan, 
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

    // --- WORKSHEET 2: DETAIL PORTOFOLIO ---
    const sheet2 = workbook.addWorksheet("Detail Portofolio Per User");
    const s2Header = sheet2.addRow([
      'Nama Responden', 'Kode Saham', 'Nama Saham', 'Harga Dasar', 
      'Harga Terakhir', 'Perubahan Harga (%)', 'Jumlah Lot', 
      'Lembar', 'Nilai Portofolio', 'Unrealized P&L (Rp)'
    ]);

    s2Header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9BBB59' } }; 
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borderStyle;
    });

    results.forEach((r) => {
      r.portoDetails.forEach(pd => {
        const row = sheet2.addRow([
          r.nama, pd.kodeSaham, pd.namaSaham, pd.basePrice, 
          pd.lastPrice, pd.perubahanHargaPersen / 100, pd.jumlahLot, 
          pd.lembar, pd.currentVal, pd.unrealizedPnl
        ]);

        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle; cell.alignment = { vertical: 'middle' };
          if ([4, 5, 9, 10].includes(colNumber)) { cell.numFmt = 'Rp #,##0.00'; }
          if (colNumber === 6) { cell.numFmt = '0.00%'; }
        });
      });
    });

    sheet2.columns = [
      { width: 30 }, { width: 15 }, { width: 25 }, { width: 20 }, 
      { width: 20 }, { width: 20 }, { width: 12 }, { width: 12 }, 
      { width: 22 }, { width: 22 }
    ];
    sheet2.views = [{ state: 'frozen', ySplit: 1 }];

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Ranking_Kekayaan_${dateStr}.xlsx"`,
      },
    });

  } catch (error) {
    console.error("[Export Excel Hasil Admin] Error:", error);
    return NextResponse.json({ error: "Gagal men-generate file Excel hasil." }, { status: 500 });
  }
}
