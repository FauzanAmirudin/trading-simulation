"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ScrollText, TrendingUp, TrendingDown, DollarSign, BarChart3, Target } from "lucide-react";

const MOCK_HISTORY = [
  { time: "10:01:15", stock: "BBCA", tipe: "BID", harga: 10200, jumlah: 2, total: 2040000 },
  { time: "10:05:30", stock: "BBRI", tipe: "ASK", harga: 5700, jumlah: 1, total: 570000 },
  { time: "10:12:45", stock: "TLKM", tipe: "BID", harga: 4000, jumlah: 3, total: 1200000 },
  { time: "10:20:00", stock: "BBCA", tipe: "ASK", harga: 10400, jumlah: 1, total: 1040000 },
];

export default function ResumePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push("/login"); return; }
    setTimeout(() => setLoading(false), 400);
  }, [hydrated, user, router]);

  if (!hydrated || !user) return null;

  const totalBuy = MOCK_HISTORY.filter((t) => t.tipe === "BID").reduce((s, t) => s + t.total, 0);
  const totalSell = MOCK_HISTORY.filter((t) => t.tipe === "ASK").reduce((s, t) => s + t.total, 0);
  const netPnl = totalSell - totalBuy;

  if (loading) {
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
      <div>
        <h1 className="text-lg font-semibold text-zinc-200">Resume Sesi</h1>
        <p className="text-sm text-zinc-500">Ringkasan hasil perdagangan sesi ini</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <BarChart3 className="size-4" />
              Total Transaksi
            </div>
            <div className="font-mono text-xl font-bold text-zinc-200">{MOCK_HISTORY.length}</div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <TrendingUp className="size-4 text-emerald-500" />
              Total Beli
            </div>
            <div className="font-mono text-xl font-bold text-emerald-500">
              Rp {totalBuy.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <TrendingDown className="size-4 text-rose-500" />
              Total Jual
            </div>
            <div className="font-mono text-xl font-bold text-rose-500">
              Rp {totalSell.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
              <DollarSign className="size-4" />
              P&L Bersih
            </div>
            <div className={`font-mono text-xl font-bold ${netPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {netPnl >= 0 ? "+" : ""}Rp {netPnl.toLocaleString("id-ID")}
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
              {MOCK_HISTORY.map((tx, i) => (
                <TableRow key={i} className="border-white/5">
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
                      {tx.tipe}
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
