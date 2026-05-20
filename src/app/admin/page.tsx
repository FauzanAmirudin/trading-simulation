"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import AdminSchedulerBoard from "@/components/admin/AdminSchedulerBoard";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Users, Loader2, RadioTower, DownloadCloud,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const INITIAL_TX: { id: number; user: string; saham: string; tipe: string; harga: number; jumlah: number; waktu: string }[] = [];

export default function AdminPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [txLog, setTxLog] = useState<typeof INITIAL_TX>([]);
  const [exporting, setExporting] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.push("/login");
    else if (user.role !== "admin") router.push("/dashboard");
  }, [hydrated, user, router]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [txLog]);

  // Listen for trade-executed events for live transaction log
  useEffect(() => {
    const socket = getSocket();
    socket.on("trade-executed", (data: any) => {
      setTxLog(prev => [{
        id: Date.now(),
        user: `User ${data.buyerId}`,
        saham: `Stock ${data.stockId}`,
        tipe: "BID",
        harga: data.price,
        jumlah: data.quantity,
        waktu: new Date(data.timestamp).toLocaleTimeString("id-ID"),
      }, ...prev].slice(0, 100));
    });
    return () => { socket.off("trade-executed"); };
  }, []);

  const exportData = async () => {
    setExporting(true);
    const res = await fetch("/api/export?format=csv");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  if (!hydrated || !user || user.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <LayoutDashboard className="size-4" /> Panel Admin
        </div>
        <p className="text-xs text-zinc-600">Kontrol sesi, matriks eksperimen, intervensi, dan monitoring</p>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main: Scheduler Board */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Experimental Scheduler</CardTitle>
              <CardDescription className="text-xs">
                Mulai ronde dengan satu klik — sistem otomatis menangani transisi sesi dan intervensi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminSchedulerBoard />
            </CardContent>
          </Card>

          {/* Live Monitor */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-zinc-500" />
                  <CardTitle className="text-sm">Monitor Transaksi</CardTitle>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="relative flex size-2">
                    <RadioTower className="size-2 text-emerald-500 animate-ping absolute" />
                    <RadioTower className="size-2 text-emerald-500 relative" />
                  </span>
                  <span className="text-emerald-500">Live</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-xs text-zinc-500">User</TableHead>
                    <TableHead className="text-xs text-zinc-500">Saham</TableHead>
                    <TableHead className="text-xs text-zinc-500">Tipe</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Harga</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Lot</TableHead>
                    <TableHead className="text-xs text-zinc-500">Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {txLog.map((t) => (
                      <motion.tr key={t.id} layout
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="border-white/5"
                      >
                        <TableCell className="text-xs text-zinc-300">{t.user}</TableCell>
                        <TableCell className="text-xs font-medium text-zinc-200">{t.saham}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                            t.tipe === "BID" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          )}>{t.tipe}</span>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-xs text-right text-zinc-400">
                          {t.harga.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-xs text-right text-zinc-400">
                          {t.jumlah}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600">{t.waktu}</TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
              <div ref={logEndRef} />
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-3">
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500"><Users className="size-3.5" /> Responden</div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">0</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500"><Activity className="size-3.5" /> Total Transaksi</div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">{txLog.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Ekspor Data</CardTitle></CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={exportData} disabled={exporting}>
                {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <DownloadCloud className="size-3.5" />}
                {exporting ? "Memproses..." : "Unduh CSV"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
