"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import AdminSchedulerBoard from "@/components/admin/AdminSchedulerBoard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Users,
  Loader2,
  RadioTower,
  DownloadCloud,
  LayoutDashboard,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const INITIAL_TX: {
  id: number;
  user: string;
  saham: string;
  tipe: string;
  harga: number;
  jumlah: number;
  waktu: string;
}[] = [];

export default function AdminPage() {
  const { user, hydrated, logout } = useAuth();
  const router = useRouter();
  const [txLog, setTxLog] = useState<typeof INITIAL_TX>([]);
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
      setTxLog((prev) =>
        [
          {
            id: Date.now(),
            user: `User ${data.buyerId}`,
            saham: `Stock ${data.stockId}`,
            tipe: "BID",
            harga: data.price,
            jumlah: data.quantity,
            waktu: new Date(data.timestamp).toLocaleTimeString("id-ID"),
          },
          ...prev,
        ].slice(0, 100)
      );
    };
    socket.on("trade-executed", onTradeExecuted);
    return () => {
      socket.off("trade-executed", onTradeExecuted);
    };
  }, []);

  if (!hydrated || !user || user.role !== "admin") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6 pb-28 md:pb-8"
    >
      {/* ─── 1. COMPACT HEADER BAR ─── */}
      <div className="flex flex-col gap-1 rounded-3xl bg-card/70 border border-border/80 p-3.5 sm:p-5 backdrop-blur-md shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <LayoutDashboard className="size-3.5 sm:size-4" />
          </div>
          <h1 className="text-[clamp(1.05rem,4vw,1.35rem)] font-extrabold tracking-tight text-foreground truncate">
            Panel Kontrol Eksperimen
          </h1>
        </div>
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
          Kontrol otomatisasi sesi eksperimen, periode matriks, intervensi pasar, dan pemantauan live.
        </p>
      </div>

      {/* ─── 2. MAIN SCHEDULER BOARD CARD ─── */}
      <Card className="rounded-3xl border border-border/80 bg-card/90 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-xs sm:text-sm font-bold text-foreground">
            Experimental Scheduler
          </CardTitle>
          <CardDescription className="text-[11px] sm:text-xs">
            Mulai ronde dengan satu klik — sistem otomatis menangani transisi sesi dan intervensi
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6">
          <AdminSchedulerBoard />
        </CardContent>
      </Card>

      {/* ─── 3. LIVE TRANSACTION MONITOR (Mobile Tickets + Desktop Table) ─── */}
      <Card className="rounded-3xl border border-border/80 bg-card/90 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-emerald-600 dark:text-emerald-500" />
            <CardTitle className="text-xs sm:text-sm font-bold text-foreground">
              Monitor Transaksi Live
            </CardTitle>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-ping" />
            Live Stream
          </span>
        </CardHeader>

        <CardContent className="p-3 sm:p-6">
          {txLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-1.5 text-center">
              <Activity className="size-8 opacity-40 animate-pulse" />
              <p className="text-xs font-bold text-foreground">Belum Ada Transaksi</p>
              <p className="text-[11px] text-muted-foreground">
                Menunggu transaksi baru yang dieksekusi di ronde aktif.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Compact Transaction Tickets (< md) */}
              <div className="space-y-2 md:hidden max-h-72 overflow-y-auto">
                {txLog.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-2xl border border-border/70 bg-card shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[11px] text-foreground">
                          {t.user}
                        </span>
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-md bg-primary/10 text-primary border border-primary/20">
                          {t.saham}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {t.waktu}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-border/40">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-md border",
                          t.tipe === "BID"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        )}
                      >
                        {t.tipe}
                      </span>
                      <span className="font-bold text-foreground">
                        Rp {t.harga.toLocaleString("id-ID")}{" "}
                        <span className="text-muted-foreground font-sans font-normal text-[10px]">
                          × {t.jumlah}L
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* Desktop View: Full Data Table (>= md) */}
              <div className="hidden md:block max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/40 sticky top-0 z-10">
                      <TableHead className="text-xs text-muted-foreground">User</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Saham</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Tipe</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">
                        Harga
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">Lot</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence initial={false}>
                      {txLog.map((t) => (
                        <motion.tr
                          key={t.id}
                          layout
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="border-border hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="text-xs text-foreground">{t.user}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground/90">
                            {t.saham}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium border",
                                t.tipe === "BID"
                                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-green-400 border-emerald-200 dark:border-transparent"
                                  : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 border-rose-200 dark:border-transparent"
                              )}
                            >
                              {t.tipe}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-xs text-right text-muted-foreground">
                            {t.harga.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-xs text-right text-muted-foreground">
                            {t.jumlah}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground/80">
                            {t.waktu}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                <div ref={logEndRef} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

