"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ScrollText, TrendingUp, TrendingDown, DollarSign, BarChart3, Wallet, Landmark } from "lucide-react";

type TxHistoryItem = {
  id: number;
  time: string;
  stock: string;
  tipe: "BID" | "ASK";
  harga: number;
  jumlah: number;
  total: number;
};

type RoundInfo = {
  id: number;
  roundNumber: number;
  status: string;
};

export default function ResumePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    balance: 100_000_000,
    portfolioValue: 0,
    totalValue: 100_000_000,
    totalBuy: 0,
    totalSell: 0,
    netPnl: 0,
    history: [] as TxHistoryItem[],
  });

  // 1. Fetch started rounds for the filter dropdown
  useEffect(() => {
    if (!hydrated || !user) return;
    fetch("/api/rounds")
      .then((res) => res.json())
      .then((resData) => {
        if (resData.rounds) {
          const started = resData.rounds.filter(
            (r: any) => r.status === "active" || r.status === "closed"
          );
          setRounds(started);
        }
      })
      .catch((err) => console.error("Error fetching rounds:", err));
  }, [hydrated, user]);

  // 2. Fetch responder stats whenever selected round changes
  useEffect(() => {
    if (!hydrated || !user) return;
    setLoading(true);
    const roundQuery = selectedRound !== "all" ? `&roundId=${selectedRound}` : "";
    fetch(`/api/resume/responder?userId=${user.id}${roundQuery}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setData({
            balance: resData.balance,
            portfolioValue: resData.portfolioValue,
            totalValue: resData.totalValue,
            totalBuy: resData.totalBuy,
            totalSell: resData.totalSell,
            netPnl: resData.netPnl,
            history: resData.history,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading resume data:", err);
        setLoading(false);
      });
  }, [hydrated, user, selectedRound]);

  if (!hydrated || !user) return null;

  if (loading && rounds.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-32 w-full bg-zinc-800" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      {/* Header with Session Dropdown Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-200">Resume Sesi</h1>
          <p className="text-sm text-zinc-500">Ringkasan hasil perdagangan dan portofolio Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">Filter Sesi:</span>
          <select
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value)}
            className="bg-zinc-800 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value="all">Semua Sesi (Kumulatif)</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                Ronde {r.roundNumber} ({r.status === "active" ? "Aktif" : "Selesai"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Financial & Portfolio Position cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <Wallet className="size-4 text-emerald-500" />
              Sisa Uang Kas
            </div>
            <div className="font-mono text-xl font-bold text-zinc-200">
              Rp {data.balance.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">Saldo tunai yang siap dibelanjakan</div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <Landmark className="size-4 text-blue-500" />
              Estimasi Nilai Saham
            </div>
            <div className="font-mono text-xl font-bold text-zinc-200">
              Rp {data.portfolioValue.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">Nilai aset portofolio aktif Anda</div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <DollarSign className="size-4 text-amber-500" />
              Total Nilai Aset
            </div>
            <div className="font-mono text-xl font-bold text-emerald-400">
              Rp {data.totalValue.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">Kas + estimasi nilai kepemilikan saham</div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <BarChart3 className="size-4 text-zinc-400" />
              Total Transaksi
            </div>
            <div className="font-mono text-xl font-bold text-zinc-200">{data.history.length}</div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <TrendingUp className="size-4 text-emerald-500" />
              Total Pembelian
            </div>
            <div className="font-mono text-xl font-bold text-emerald-500">
              Rp {data.totalBuy.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <TrendingDown className="size-4 text-rose-500" />
              Total Penjualan
            </div>
            <div className="font-mono text-xl font-bold text-rose-500">
              Rp {data.totalSell.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <DollarSign className="size-4 text-zinc-400" />
              P&L Bersih Realisasi
            </div>
            <div className={`font-mono text-xl font-bold ${data.netPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {data.netPnl >= 0 ? "+" : ""}Rp {data.netPnl.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="border-white/5 bg-zinc-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="size-4 text-zinc-400" />
            Riwayat Transaksi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full bg-zinc-800" />
              <Skeleton className="h-8 w-full bg-zinc-800" />
              <Skeleton className="h-8 w-full bg-zinc-800" />
            </div>
          ) : data.history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <ScrollText className="size-8 mb-2 text-zinc-700" />
              <p className="text-xs">Belum ada transaksi perdagangan pada periode ini</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5">
                  <TableHead className="text-xs text-zinc-500">Waktu</TableHead>
                  <TableHead className="text-xs text-zinc-500">Saham</TableHead>
                  <TableHead className="text-xs text-zinc-500">Tipe</TableHead>
                  <TableHead className="text-xs text-zinc-500 text-right">Harga</TableHead>
                  <TableHead className="text-xs text-zinc-500 text-right">Lot</TableHead>
                  <TableHead className="text-xs text-zinc-500 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.history.map((tx) => (
                  <TableRow key={tx.id} className="border-white/5">
                    <TableCell className="font-mono text-xs text-zinc-400">{tx.time}</TableCell>
                    <TableCell className="text-xs text-zinc-300 font-medium">{tx.stock}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          tx.tipe === "BID"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {tx.tipe === "BID" ? "BELI (BID)" : "JUAL (ASK)"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300 text-right">
                      Rp {tx.harga.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300 text-right">
                      {tx.jumlah}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300 text-right">
                      Rp {tx.total.toLocaleString("id-ID")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
