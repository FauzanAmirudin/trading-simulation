"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ScrollText, DownloadCloud, TrendingUp, Users, BarChart3, DollarSign } from "lucide-react";
import { toast } from "sonner";

const MOCK_PARTICIPANTS = [
  { rank: 1, user: "R-07", totalValue: 125_000_000, pnl: 25_000_000, txCount: 12 },
  { rank: 2, user: "R-12", totalValue: 118_500_000, pnl: 18_500_000, txCount: 9 },
  { rank: 3, user: "R-03", totalValue: 112_000_000, pnl: 12_000_000, txCount: 15 },
  { rank: 4, user: "R-19", totalValue: 108_000_000, pnl: 8_000_000, txCount: 7 },
  { rank: 5, user: "R-22", totalValue: 95_000_000, pnl: -5_000_000, txCount: 11 },
];

export default function AdminResumePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push("/login"); return; }
    setTimeout(() => setLoading(false), 400);
  }, [hydrated, user, router]);

  if (!hydrated || !user) return null;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-200">Resume Sesi</h1>
          <p className="text-sm text-zinc-500">Ringkasan hasil dan peringkat peserta</p>
        </div>
        <Button size="sm" variant="outline" className="border-white/10 text-zinc-400 gap-2" onClick={() => toast.success("Data diunduh (simulasi)")}>
          <DownloadCloud className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/10 p-2.5">
              <Users className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Peserta</div>
              <div className="font-mono text-lg font-bold text-zinc-200">25</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2.5">
              <BarChart3 className="size-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Total Transaksi</div>
              <div className="font-mono text-lg font-bold text-zinc-200">156</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-amber-500/10 p-2.5">
              <DollarSign className="size-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Total Volume</div>
              <div className="font-mono text-lg font-bold text-zinc-200">
                Rp 2.5M
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-rose-500/10 p-2.5">
              <TrendingUp className="size-5 text-rose-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Top Trader</div>
              <div className="font-mono text-lg font-bold text-zinc-200">R-07</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="border-white/5 bg-zinc-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-500" />
            Peringkat Peserta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-xs text-zinc-500 w-12">#</TableHead>
                <TableHead className="text-xs text-zinc-500">Peserta</TableHead>
                <TableHead className="text-xs text-zinc-500 text-right">Total Value</TableHead>
                <TableHead className="text-xs text-zinc-500 text-right">P&L</TableHead>
                <TableHead className="text-xs text-zinc-500 text-right">Transaksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_PARTICIPANTS.map((p) => (
                <TableRow key={p.rank} className="border-white/5">
                  <TableCell className="font-mono text-xs">
                    <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                      p.rank === 1 ? "bg-amber-500/20 text-amber-500" :
                      p.rank === 2 ? "bg-zinc-400/20 text-zinc-400" :
                      p.rank === 3 ? "bg-orange-500/20 text-orange-500" :
                      "text-zinc-600"
                    }`}>{p.rank}</span>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-300 font-medium">{p.user}</TableCell>
                  <TableCell className="font-mono text-xs text-zinc-300 text-right">
                    Rp {p.totalValue.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className={`font-mono text-xs text-right ${p.pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {p.pnl >= 0 ? "+" : ""}Rp {Math.abs(p.pnl).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-300 text-right">{p.txCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
