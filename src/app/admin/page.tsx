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
  const { user, hydrated, logout } = useAuth();
  const router = useRouter();
  const [txLog, setTxLog] = useState<typeof INITIAL_TX>([]);
  const [exporting, setExporting] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.push("/login");
    else if (user.role !== "admin") router.push("/dashboard");
  }, [hydrated, user, router]);

  // Authenticate socket for admin
  useEffect(() => {
    if (!hydrated || !user || user.role !== "admin") return;
    const socket = getSocket();
    
    const authenticate = () => {
      socket.emit("authenticate", { userId: user.id });
    };

    if (socket.connected) {
      authenticate();
    }
    
    socket.on("connect", authenticate);

    const handleAuthError = () => {
      logout();
      router.push("/login");
    };
    socket.on("auth-error", handleAuthError);
    
    return () => {
      socket.off("connect", authenticate);
      socket.off("auth-error", handleAuthError);
    };
  }, [hydrated, user, logout, router]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [txLog]);

  // Listen for trade-executed events for live transaction log
  useEffect(() => {
    const socket = getSocket();
    const onTradeExecuted = (data: any) => {
      setTxLog(prev => [{
        id: Date.now(),
        user: `User ${data.buyerId}`,
        saham: `Stock ${data.stockId}`,
        tipe: "BID",
        harga: data.price,
        jumlah: data.quantity,
        waktu: new Date(data.timestamp).toLocaleTimeString("id-ID"),
      }, ...prev].slice(0, 100));
    };
    socket.on("trade-executed", onTradeExecuted);
    return () => { socket.off("trade-executed", onTradeExecuted); };
  }, []);



  if (!hydrated || !user || user.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <LayoutDashboard className="size-4" /> Panel Admin
        </div>
        <p className="text-xs text-muted-foreground">Kontrol sesi, matriks eksperimen, intervensi, dan monitoring</p>
      </motion.div>

      <div className="flex flex-col items-center gap-4 max-w-4xl mx-auto">
        {/* Main: Scheduler Board */}
        <div className="w-full space-y-4">
          <Card className="border-border bg-white/70 backdrop-blur-md shadow-sm border-t-2 border-t-indigo-500/50 hover:shadow-md transition-all dark:shadow-none dark:bg-slate-950/40 dark:border-t-border">
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
          <Card className="border-border bg-white/70 backdrop-blur-md shadow-sm border-t-2 border-t-emerald-500/50 hover:shadow-md transition-all dark:shadow-none dark:bg-slate-950/40 dark:border-t-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <CardTitle className="text-sm text-foreground">Monitor Transaksi</CardTitle>
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
                  <TableRow className="border-border bg-muted/60">
                    <TableHead className="text-xs text-muted-foreground">User</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Saham</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Tipe</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right">Harga</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right">Lot</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {txLog.map((t) => (
                      <motion.tr key={t.id} layout
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="border-border"
                      >
                        <TableCell className="text-xs text-foreground">{t.user}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground/90">{t.saham}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium border",
                            t.tipe === "BID" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-green-400 border-emerald-200 dark:border-transparent" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 border-rose-200 dark:border-transparent"
                          )}>{t.tipe}</span>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-xs text-right text-muted-foreground">
                          {t.harga.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-xs text-right text-muted-foreground">
                          {t.jumlah}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground/80">{t.waktu}</TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
              <div ref={logEndRef} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
