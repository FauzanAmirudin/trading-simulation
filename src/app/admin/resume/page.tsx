"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  ScrollText,
  DownloadCloud,
  Users,
  BarChart3,
  DollarSign,
  Activity,
  Calendar,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExportFilterModal, ExportType } from "@/components/admin/ExportFilterModal";

type TransactionItem = {
  id: number;
  time: string;
  createdAt?: string | null;
  buyer: string;
  seller: string;
  stock: string;
  harga: number;
  jumlah: number;
  total: number;
  intervention: string;
  roundId: number;
};

export default function AdminResumePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  });
  const [loading, setLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<ExportType>("excel");
  const [data, setData] = useState({
    participantsCount: 0,
    totalTransactionsCount: 0,
    totalVolume: 0,
    avgTransactionValue: 0,
    transactions: [] as TransactionItem[],
  });

  const formatWibTime = (isoString?: string | null, fallback = "") => {
    if (!isoString) return fallback;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;
    const timeStr = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
    return `${timeStr} WIB`;
  };

  // 1. Fetch admin resume stats whenever selected date changes
  useEffect(() => {
    if (!hydrated || !user) return;
    setLoading(true);
    const dateQuery = selectedDate ? `?date=${selectedDate}` : "";
    fetch(`/api/resume/admin${dateQuery}`)
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
  }, [hydrated, user, selectedDate]);

  if (!hydrated || !user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6"
    >
      {/* ─── 1. COMPACT FLUID HEADER & FILTER-EXPORT BAR ─── */}
      <div className="flex flex-col gap-3 rounded-3xl bg-card/70 border border-border/80 p-3.5 sm:p-5 backdrop-blur-md shadow-xs">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <ScrollText className="size-3.5 sm:size-4" />
              </div>
              <h1 className="text-[clamp(1.05rem,4vw,1.35rem)] font-extrabold tracking-tight text-foreground truncate">
                Resume Admin
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
              Ringkasan transaksi pasar dan aktivitas perdagangan saham real-time.
            </p>
          </div>
        </div>

        {/* Action Controls: Date Picker & Export Buttons (Fluid Stack / Grid) */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center justify-between gap-2.5 pt-2 border-t border-border/50">
          {/* Date Filter */}
          <div className="flex items-center gap-2 bg-muted/50 border border-border/70 rounded-2xl px-3 py-1.5 min-h-[40px] shadow-2xs">
            <Calendar className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground font-semibold shrink-0">Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-foreground font-mono font-bold focus:outline-none w-full cursor-pointer"
            />
          </div>

          {/* Export Action Buttons (2-Column Grid on Mobile for Maximum Thumb-Touch Ergonomics) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setExportType("excel");
                setIsExportModalOpen(true);
              }}
              className="h-10 sm:h-9 px-3 rounded-2xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 font-bold text-xs gap-1.5 shadow-2xs justify-center"
            >
              <FileSpreadsheet className="size-3.5 shrink-0" />
              <span className="truncate">Laporan (.xlsx)</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setExportType("orderbook");
                setIsExportModalOpen(true);
              }}
              className="h-10 sm:h-9 px-3 rounded-2xl border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 font-bold text-xs gap-1.5 shadow-2xs justify-center"
            >
              <Layers className="size-3.5 shrink-0" />
              <span className="truncate">Order Book</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 2. COMPACT 2x2 BENTO KPI GRID (Ultra-Compact on Mobile) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Peserta */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Total Peserta
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-lg sm:text-2xl text-foreground">
              {data.participantsCount}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Akun terdaftar</span>
          </div>
        </div>

        {/* Card 2: Total Transaksi */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Total Transaksi
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <BarChart3 className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-lg sm:text-2xl text-foreground">
              {data.totalTransactionsCount}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Match dieksekusi</span>
          </div>
        </div>

        {/* Card 3: Total Volume */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Total Volume
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <DollarSign className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-sm sm:text-xl text-foreground truncate" title={`Rp ${data.totalVolume.toLocaleString("id-ID")}`}>
              Rp {data.totalVolume >= 1_000_000_000 
                ? `${(data.totalVolume / 1_000_000_000).toFixed(2)} M` 
                : data.totalVolume >= 1_000_000 
                ? `${(data.totalVolume / 1_000_000).toFixed(1)} Jt` 
                : data.totalVolume.toLocaleString("id-ID")}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Nilai perputaran</span>
          </div>
        </div>

        {/* Card 4: Rerata Nilai Transaksi */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Rerata Nilai
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
              <Activity className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-sm sm:text-xl text-foreground truncate" title={`Rp ${data.avgTransactionValue.toLocaleString("id-ID")}`}>
              Rp {data.avgTransactionValue >= 1_000_000 
                ? `${(data.avgTransactionValue / 1_000_000).toFixed(2)} Jt` 
                : data.avgTransactionValue.toLocaleString("id-ID")}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Rata-rata / match</span>
          </div>
        </div>
      </div>

      {/* ─── 3. TRANSACTION FEED & TABLE (Mobile Cards + Desktop Table) ─── */}
      <Card className="rounded-3xl border border-border/80 bg-card/90 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <CardTitle className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>Riwayat Transaksi Pasar</span>
              <span className="text-xs font-mono font-normal text-muted-foreground">
                ({data.transactions.length})
              </span>
            </CardTitle>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">Real-time Feed</span>
        </CardHeader>

        <CardContent className="p-3 sm:p-6">
          {loading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-16 w-full rounded-2xl bg-muted/60" />
              <Skeleton className="h-16 w-full rounded-2xl bg-muted/60" />
              <Skeleton className="h-16 w-full rounded-2xl bg-muted/60" />
            </div>
          ) : data.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 border border-border/60">
                <ScrollText className="size-6 text-muted-foreground/60" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">Belum Ada Transaksi</p>
                <p className="text-[11px] text-muted-foreground">Tidak ada transaksi yang tercatat pada tanggal ini.</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Mobile View: Compact Transaction Ticket Cards (< md) ── */}
              <div className="space-y-2.5 md:hidden">
                {data.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-all shadow-2xs space-y-2"
                  >
                    {/* Top Row: Stock Badge, Intervention & Time */}
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {tx.stock}
                        </span>
                        {tx.intervention !== "NONE" && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-md border",
                            tx.intervention === "FLOOD" 
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" 
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          )}>
                            {tx.intervention}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                        <Clock className="size-3" />
                        <span>{formatWibTime(tx.createdAt, tx.time)}</span>
                      </div>
                    </div>

                    {/* Middle Row: Buyer -> Seller */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 text-[11px] font-medium">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-muted-foreground text-[10px]">Beli:</span>
                        <span className="font-bold text-foreground truncate max-w-[85px]">{tx.buyer}</span>
                      </div>
                      <ArrowRight className="size-3 text-muted-foreground shrink-0 opacity-50" />
                      <div className="flex items-center gap-1 min-w-0 justify-end">
                        <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-muted-foreground text-[10px]">Jual:</span>
                        <span className="font-bold text-foreground truncate max-w-[85px]">{tx.seller}</span>
                      </div>
                    </div>

                    {/* Bottom Row: Price, Lot & Total Match Value */}
                    <div className="flex items-center justify-between text-xs font-mono pt-1">
                      <div className="text-[11px]">
                        <span className="text-muted-foreground">Rp {tx.harga.toLocaleString("id-ID")}</span>
                        <span className="text-muted-foreground font-sans text-[10px]"> × </span>
                        <span className="font-bold text-foreground">{tx.jumlah}L</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block font-sans">Total Nilai</span>
                        <span className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                          Rp {tx.total.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop View: Full Data Table (>= md) ── */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/30">
                      <TableHead className="text-xs text-muted-foreground w-[90px]">Waktu</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Pembeli</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Penjual</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-center">Saham</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">Harga</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">Lot</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">Total Nilai</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-center">Intervensi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-border hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatWibTime(tx.createdAt, tx.time)}
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-500"></span>
                            {tx.buyer}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-rose-500"></span>
                            {tx.seller}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-bold text-center">
                          <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-lg border border-primary/20 font-mono text-xs">
                            {tx.stock}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground text-right font-medium">
                          Rp {tx.harga.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground text-right font-bold">
                          {tx.jumlah} L
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-emerald-600 dark:text-emerald-400 font-extrabold">
                          Rp {tx.total.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "inline-block rounded-md px-2 py-0.5 text-[9.5px] font-bold border",
                              tx.intervention === "NONE"
                                ? "bg-muted text-muted-foreground border-border"
                                : tx.intervention === "FLOOD"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            {tx.intervention}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── 4. EXPORT CONFIGURATION & FILTER MODAL ─── */}
      <ExportFilterModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exportType={exportType}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
    </motion.div>
  );
}

