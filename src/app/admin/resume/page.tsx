"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ScrollText, DownloadCloud, Users, BarChart3, DollarSign, Activity } from "lucide-react";
import { toast } from "sonner";

type TransactionItem = {
  id: number;
  time: string;
  buyer: string;
  seller: string;
  stock: string;
  harga: number;
  jumlah: number;
  total: number;
  intervention: string;
  roundId: number;
};

type RoundInfo = {
  id: number;
  roundNumber: number;
  status: string;
};

export default function AdminResumePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState({
    participantsCount: 0,
    totalTransactionsCount: 0,
    totalVolume: 0,
    avgTransactionValue: 0,
    transactions: [] as TransactionItem[],
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

  // 2. Fetch admin resume stats whenever selected round changes
  useEffect(() => {
    if (!hydrated || !user) return;
    setLoading(true);
    const roundQuery = selectedRound !== "all" ? `?roundId=${selectedRound}` : "";
    fetch(`/api/resume/admin${roundQuery}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setData({
            participantsCount: resData.participantsCount,
            totalTransactionsCount: resData.totalTransactionsCount,
            totalVolume: resData.totalVolume,
            avgTransactionValue: resData.avgTransactionValue,
            transactions: resData.transactions,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading admin resume data:", err);
        setLoading(false);
      });
  }, [hydrated, user, selectedRound]);

  const handleExport = async () => {
    try {
      setExporting(true);
      toast.info("Sedang mengekspor data eksperimen...");
      window.location.href = "/api/export?format=csv";
      setTimeout(() => {
        setExporting(false);
        toast.success("Data transaksi berhasil diekspor!");
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor data");
      setExporting(false);
    }
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-200">Resume Admin</h1>
          <p className="text-sm text-zinc-500">Ringkasan transaksi pasar dan aktivitas trading secara real-time</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-zinc-400 gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/5"
            onClick={handleExport}
            disabled={exporting}
          >
            <DownloadCloud className="size-4" />
            {exporting ? "Mengekspor..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/10 p-2.5">
              <Users className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Total Peserta</div>
              <div className="font-mono text-lg font-bold text-zinc-200">{data.participantsCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2.5">
              <BarChart3 className="size-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Total Transaksi</div>
              <div className="font-mono text-lg font-bold text-zinc-200">{data.totalTransactionsCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-amber-500/10 p-2.5">
              <DollarSign className="size-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Total Volume</div>
              <div className="font-mono text-lg font-bold text-zinc-200">
                Rp {data.totalVolume.toLocaleString("id-ID")}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-violet-500/10 p-2.5">
              <Activity className="size-5 text-violet-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Rerata Nilai</div>
              <div className="font-mono text-lg font-bold text-zinc-200">
                Rp {data.avgTransactionValue.toLocaleString("id-ID")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History Table */}
      <Card className="border-white/5 bg-zinc-900 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-zinc-300">
            <ScrollText className="size-4 text-emerald-500" />
            Riwayat Transaksi Pasar (Real-time)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full bg-zinc-800" />
              <Skeleton className="h-8 w-full bg-zinc-800" />
              <Skeleton className="h-8 w-full bg-zinc-800" />
            </div>
          ) : data.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <ScrollText className="size-8 mb-2 text-zinc-700" />
              <p className="text-xs">Belum ada transaksi di pasar saat ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-xs text-zinc-500 w-[100px]">Waktu</TableHead>
                    <TableHead className="text-xs text-zinc-500">Pembeli</TableHead>
                    <TableHead className="text-xs text-zinc-500">Penjual</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-center">Saham</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Harga</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Lot</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Total Nilai</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-center">Intervensi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-white/5 hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="font-mono text-xs text-zinc-400">{tx.time}</TableCell>
                      <TableCell className="text-xs text-zinc-300 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-500"></span>
                          {tx.buyer}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-rose-500"></span>
                          {tx.seller}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300 font-bold text-center">
                        <span className="bg-zinc-800 px-2 py-0.5 rounded border border-white/5">
                          {tx.stock}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300 text-right">
                        Rp {tx.harga.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300 text-right font-semibold">
                        {tx.jumlah}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300 text-right text-emerald-400 font-semibold">
                        Rp {tx.total.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${
                            tx.intervention === "NONE"
                              ? "bg-zinc-800 text-zinc-400 border border-white/5"
                              : tx.intervention === "FLOOD"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {tx.intervention}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
