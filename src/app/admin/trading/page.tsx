"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Users, RadioTower, Timer } from "lucide-react";

const MOCK_TX = [
  { id: 1, user: "R-01", saham: "BBCA", tipe: "BID", harga: 10200, jumlah: 5, waktu: "10:00:15" },
  { id: 2, user: "R-02", saham: "BBRI", tipe: "ASK", harga: 5700, jumlah: 3, waktu: "10:00:22" },
  { id: 3, user: "R-03", saham: "TLKM", tipe: "BID", harga: 4000, jumlah: 2, waktu: "10:01:05" },
  { id: 4, user: "R-04", saham: "BBCA", tipe: "ASK", harga: 10300, jumlah: 4, waktu: "10:02:30" },
  { id: 5, user: "R-05", saham: "BBRI", tipe: "BID", harga: 5600, jumlah: 2, waktu: "10:03:00" },
];

const MOCK_STOCKS = [
  { kode: "BBCA", bid: 10200, ask: 10300, volume: 1520, change: 0.8 },
  { kode: "BBRI", bid: 5600, ask: 5700, volume: 2840, change: -0.3 },
  { kode: "TLKM", bid: 3980, ask: 4050, volume: 980, change: 1.2 },
  { kode: "ASII", bid: 4850, ask: 4920, volume: 760, change: 0.5 },
  { kode: "UNVR", bid: 3100, ask: 3180, volume: 420, change: -0.6 },
];

export default function AdminTradingPage() {
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
      <div>
        <h1 className="text-lg font-semibold text-zinc-200">Monitor Trading</h1>
        <p className="text-sm text-zinc-500">Pantau aktivitas perdagangan seluruh peserta</p>
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {MOCK_STOCKS.map((s, i) => (
          <Card key={s.kode} className="border-white/5 bg-zinc-900">
            <CardContent className="pt-4">
              <div className="text-sm font-medium text-zinc-200 mb-1">{s.kode}</div>
              <div className="font-mono text-lg font-bold text-zinc-200">
                Rp {s.ask.toLocaleString("id-ID")}
              </div>
              <div className={`font-mono text-xs flex items-center gap-1 ${s.change >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {s.change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {s.change >= 0 ? "+" : ""}{s.change}%
              </div>
              <div className="text-[10px] text-zinc-600 mt-1">
                Vol: {s.volume.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Transactions */}
      <Card className="border-white/5 bg-zinc-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              <CardTitle className="text-sm">Transaksi Terkini</CardTitle>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <CardDescription className="text-xs">5 transaksi terakhir</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-xs text-zinc-500">Waktu</TableHead>
                <TableHead className="text-xs text-zinc-500">User</TableHead>
                <TableHead className="text-xs text-zinc-500">Saham</TableHead>
                <TableHead className="text-xs text-zinc-500">Tipe</TableHead>
                <TableHead className="text-xs text-zinc-500 text-right">Harga</TableHead>
                <TableHead className="text-xs text-zinc-500 text-right">Lot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {MOCK_TX.map((tx, i) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-white/5"
                  >
                    <TableCell className="font-mono text-xs text-zinc-400">{tx.waktu}</TableCell>
                    <TableCell className="text-xs text-zinc-300">{tx.user}</TableCell>
                    <TableCell className="text-xs text-zinc-300 font-medium">{tx.saham}</TableCell>
                    <TableCell>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        tx.tipe === "BID" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      }`}>{tx.tipe}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300 text-right">
                      Rp {tx.harga.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300 text-right">{tx.jumlah}</TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/10 p-2.5">
              <Users className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Peserta Aktif</div>
              <div className="font-mono text-lg font-bold text-zinc-200">12</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2.5">
              <Activity className="size-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Total Order</div>
              <div className="font-mono text-lg font-bold text-zinc-200">47</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-amber-500/10 p-2.5">
              <RadioTower className="size-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Match Terjadi</div>
              <div className="font-mono text-lg font-bold text-zinc-200">23</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-rose-500/10 p-2.5">
              <Timer className="size-5 text-rose-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Sisa Waktu</div>
              <div className="font-mono text-lg font-bold text-zinc-200">01:45</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
