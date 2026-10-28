import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import {
  predictions,
  transactionsHistory,
  orderBook,
  users,
  stocks,
  rounds,
  roundStocks,
} from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";

    // Fetch all predictions (exclude trial period 0)
    const preds = await db
      .select({
        id: predictions.id,
        userId: predictions.userId,
        userName: users.nama,
        stockId: predictions.stockId,
        stockCode: stocks.kodeSaham,
        roundId: predictions.roundId,
        period: rounds.period,
        tipe: predictions.tipe,
        jumlahLot: predictions.jumlahLot,
        tebakanHarga: predictions.tebakanHarga,
        accuracyScore: predictions.accuracyScore,
        createdAt: predictions.createdAt,
      })
      .from(predictions)
      .innerJoin(users, eq(predictions.userId, users.id))
      .innerJoin(stocks, eq(predictions.stockId, stocks.id))
      .innerJoin(rounds, eq(predictions.roundId, rounds.id))
      .where(gte(rounds.period, 1));

    // Fetch all transactions (exclude trial period 0)
    const txs = await db
      .select({
        id: transactionsHistory.id,
        roundId: transactionsHistory.roundId,
        period: rounds.period,
        stockId: transactionsHistory.stockId,
        stockCode: stocks.kodeSaham,
        harga: transactionsHistory.harga,
        jumlah: transactionsHistory.jumlah,
        total: transactionsHistory.total,
        subSession: transactionsHistory.subSession,
        activeIntervention: transactionsHistory.activeIntervention,
        createdAt: transactionsHistory.createdAt,
      })
      .from(transactionsHistory)
      .innerJoin(stocks, eq(transactionsHistory.stockId, stocks.id))
      .innerJoin(rounds, eq(transactionsHistory.roundId, rounds.id))
      .where(gte(rounds.period, 1));

    if (format === "json") {
      return NextResponse.json({ predictions: preds, transactions: txs });
    }

    // Build CSV for predictions
    const predHeaders = [
      "user_id",
      "user_name",
      "stock_code",
      "round_number",
      "period",
      "pilihan_transaksi",
      "jumlah_lot",
      "tebakan_harga",
      "accuracy_score",
      "created_at",
    ].join(",");

    const predRows = preds.map(p =>
      [
        p.userId,
        p.userName,
        p.stockCode,
        p.roundId,
        Math.ceil(Number(p.roundId) / 4),
        p.tipe || "BELI",
        p.jumlahLot || 1,
        p.tebakanHarga,
        p.accuracyScore || "",
        p.createdAt ? new Date(p.createdAt).toISOString() : "",
      ].join(",")
    );

    // Build CSV for transactions
    const txHeaders = [
      "transaction_id",
      "round_id",
      "period",
      "stock_code",
      "sub_session",
      "harga",
      "jumlah",
      "total",
      "active_intervention",
      "created_at",
    ].join(",");

    const txRows = txs.map(t =>
      [
        t.id,
        t.roundId,
        Math.ceil(Number(t.roundId) / 4),
        t.stockCode,
        t.subSession,
        t.harga,
        t.jumlah,
        t.total,
        t.activeIntervention,
        t.createdAt ? new Date(t.createdAt).toISOString() : "",
      ].join(",")
    );

    const csv = [
      "=== PREDICTIONS ===",
      predHeaders,
      ...predRows,
      "",
      "=== TRANSACTIONS ===",
      txHeaders,
      ...txRows,
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=experiment_data.csv",
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}