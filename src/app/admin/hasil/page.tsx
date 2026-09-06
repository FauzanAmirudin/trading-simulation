"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  DownloadCloud,
  Users,
  DollarSign,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Wallet,
  Coins,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ChevronDown,
  Crown,
  Medal,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type HasilRow = {
  rank: number;
  userId: number;
  nama: string;
  kas: number;
  nilaiPortofolio: number;
  totalKekayaan: number;
  initialCapital: number;
  pnlAmount: number;
  pnlPercent: number;
  jumlahTransaksi: number;
};

type HasilData = {
  top5: HasilRow[];
  all: HasilRow[];
  lastUpdated: string;
};

export default function AdminHasilPage() {
  const { user, hydrated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<HasilData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "pnl" | "kas" | "tx">("rank");
  const [expandedUserIds, setExpandedUserIds] = useState<Set<number>>(new Set());

  const fetchHasil = () => {
    setLoading(true);
    fetch(`/api/admin/hasil`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setData(resData);
        } else {
          toast.error(resData.error);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading admin hasil:", err);
        setLoading(false);
        toast.error("Gagal mengambil data ranking.");
      });
  };

  useEffect(() => {
    if (!hydrated || !user) return;
    fetchHasil();
  }, [hydrated, user]);

  const handleDownloadExcel = async () => {
    try {
      setExporting(true);
      toast.info("Menyiapkan file Excel, mohon tunggu...");
      const res = await fetch(`/api/admin/export-hasil`);

      if (!res.ok) {
        throw new Error("Gagal mengunduh data");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `Ranking_Kekayaan_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Berhasil mengunduh Ranking Kekayaan!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor data");
    } finally {
      setExporting(false);
    }
  };

  const toggleExpand = (userId: number) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Filter & Sort Logic
  const filteredAndSortedList = useMemo(() => {
    if (!data?.all) return [];
    let list = [...data.all];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => item.nama.toLowerCase().includes(q));
    }

    if (sortBy === "pnl") {
      list.sort((a, b) => b.pnlPercent - a.pnlPercent);
    } else if (sortBy === "kas") {
      list.sort((a, b) => b.kas - a.kas);
    } else if (sortBy === "tx") {
      list.sort((a, b) => b.jumlahTransaksi - a.jumlahTransaksi);
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    return list;
  }, [data, searchQuery, sortBy]);

  if (!hydrated || !user) return null;

  const totalRespondents = data?.all.length || 0;
  const totalKekayaanSeluruh =
    data?.all.reduce((acc, curr) => acc + curr.totalKekayaan, 0) || 0;
  const avgKekayaan =
    totalRespondents > 0 ? totalKekayaanSeluruh / totalRespondents : 0;

  // Podium Items: 1st, 2nd, 3rd
  const firstPlace = data?.top5[0];
  const secondPlace = data?.top5[1];
  const thirdPlace = data?.top5[2];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-3.5 sm:space-y-6 pb-28 md:pb-8"
    >
      {/* ─── 1. COMPACT FLUID HEADER & ACTION BAR ─── */}
      <div className="flex flex-col gap-3 rounded-3xl bg-card/70 border border-border/80 p-3.5 sm:p-5 backdrop-blur-md shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <Trophy className="size-3.5 sm:size-4" />
              </div>
              <h1 className="text-[clamp(1.05rem,4vw,1.35rem)] font-extrabold tracking-tight text-foreground truncate">
                Ranking Kekayaan Responden
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
              Peringkat kekayaan bersih (NAV) real-time berdasarkan portofolio & sisa kas.
            </p>
          </div>

          {/* Action Buttons (2-Column Grid on Mobile for Maximum Ergonomics) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchHasil}
              disabled={loading}
              className="h-10 sm:h-9 px-3 rounded-2xl border-border hover:bg-muted font-bold text-xs gap-1.5 shadow-2xs justify-center active:scale-95"
            >
              <RefreshCw className={cn("size-3.5 shrink-0", loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadExcel}
              disabled={exporting || loading}
              className="h-10 sm:h-9 px-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-2xs justify-center active:scale-95"
            >
              <DownloadCloud className="size-3.5 shrink-0" />
              <span className="truncate">{exporting ? "Mengekspor..." : "Export Excel"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 2. MACRO KPI SUMMARY RIBBON (3-Column Grid) ─── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Total Peserta */}
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3 sm:size-4 text-primary shrink-0" />
            <span className="text-[9.5px] sm:text-xs font-semibold truncate">Responden</span>
          </div>
          <div className="font-mono font-black text-sm sm:text-xl text-foreground">
            {totalRespondents} <span className="text-[9px] font-sans font-normal text-muted-foreground hidden sm:inline">Akun</span>
          </div>
        </div>

        {/* Rata-rata NAV */}
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="size-3 sm:size-4 text-emerald-500 shrink-0" />
            <span className="text-[9.5px] sm:text-xs font-semibold truncate">Rerata NAV</span>
          </div>
          <div className="font-mono font-black text-xs sm:text-xl text-emerald-600 dark:text-emerald-400 truncate">
            Rp {avgKekayaan >= 1_000_000 
              ? `${(avgKekayaan / 1_000_000).toFixed(1)} Jt` 
              : avgKekayaan.toLocaleString("id-ID")}
          </div>
        </div>

        {/* Total Ekosistem */}
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="size-3 sm:size-4 text-amber-500 shrink-0" />
            <span className="text-[9.5px] sm:text-xs font-semibold truncate">Total Kas+Saham</span>
          </div>
          <div className="font-mono font-black text-xs sm:text-xl text-foreground truncate">
            Rp {totalKekayaanSeluruh >= 1_000_000_000 
              ? `${(totalKekayaanSeluruh / 1_000_000_000).toFixed(2)} M` 
              : `${(totalKekayaanSeluruh / 1_000_000).toFixed(1)} Jt`}
          </div>
        </div>
      </div>

      {/* ─── 3. TOP 3 OLYMPIC PODIUM (Mobile & Desktop Dynamic Layout) ─── */}
      {data && data.top5.length >= 3 && (
        <div className="rounded-3xl border border-border/80 bg-gradient-to-b from-card to-card/60 p-3.5 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <h2 className="text-xs sm:text-sm font-extrabold text-foreground">
                Podium Juara Investasi
              </h2>
            </div>
            {data.lastUpdated && (
              <span className="font-mono text-[9.5px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/60">
                Live: {new Date(data.lastUpdated).toLocaleTimeString("id-ID")}
              </span>
            )}
          </div>

          {/* 3-Column Olympic Podium Layout: [2nd (Silver) | 1st (Gold, Tallest) | 3rd (Bronze)] */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-2 pb-1">
            {/* 🥈 JUARA 2 (Silver) */}
            {secondPlace && (
              <div className="flex flex-col items-center text-center group">
                <div className="relative mb-1.5">
                  <div className="flex size-9 sm:size-12 items-center justify-center rounded-2xl bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-black text-xs sm:text-sm shadow-xs border-2 border-slate-400 dark:border-slate-500 ring-2 ring-slate-400/20">
                    2
                  </div>
                  <Medal className="size-3.5 text-slate-400 absolute -bottom-1 -right-1" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-foreground truncate w-full max-w-[90px] sm:max-w-[120px]">
                  {secondPlace.nama}
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Rp {(secondPlace.totalKekayaan / 1_000_000).toFixed(1)}Jt
                </span>
                {/* Podium Base */}
                <div className="w-full mt-2 h-16 sm:h-24 rounded-t-2xl bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 border-t-2 border-slate-400 flex flex-col items-center justify-center p-1 shadow-inner">
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                    {secondPlace.pnlPercent >= 0 ? "+" : ""}{secondPlace.pnlPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* 👑 JUARA 1 (Gold - Elevated Center) */}
            {firstPlace && (
              <div className="flex flex-col items-center text-center relative group">
                <div className="relative mb-1.5 animate-bounce-subtle">
                  <Crown className="size-4.5 text-amber-500 absolute -top-4 inset-x-0 mx-auto drop-shadow-xs" />
                  <div className="flex size-11 sm:size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 font-mono font-black text-sm sm:text-base shadow-md border-2 border-yellow-300 ring-4 ring-amber-500/20">
                    1
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-extrabold text-foreground truncate w-full max-w-[95px] sm:max-w-[140px]">
                  {firstPlace.nama}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Rp {(firstPlace.totalKekayaan / 1_000_000).toFixed(1)}Jt
                </span>
                {/* Podium Base (Tallest) */}
                <div className="w-full mt-2 h-22 sm:h-32 rounded-t-2xl bg-gradient-to-b from-amber-500/20 via-yellow-500/15 to-card border-t-2 border-amber-400 flex flex-col items-center justify-center p-1.5 shadow-inner">
                  <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                    {firstPlace.pnlPercent >= 0 ? "+" : ""}{firstPlace.pnlPercent.toFixed(2)}%
                  </span>
                  <span className="text-[9px] font-sans text-muted-foreground mt-0.5">Juara 1</span>
                </div>
              </div>
            )}

            {/* 🥉 JUARA 3 (Bronze) */}
            {thirdPlace && (
              <div className="flex flex-col items-center text-center group">
                <div className="relative mb-1.5">
                  <div className="flex size-9 sm:size-12 items-center justify-center rounded-2xl bg-orange-200 dark:bg-orange-950 text-orange-900 dark:text-orange-200 font-mono font-black text-xs sm:text-sm shadow-xs border-2 border-orange-300 dark:border-orange-800 ring-2 ring-orange-500/20">
                    3
                  </div>
                  <Medal className="size-3.5 text-orange-500 absolute -bottom-1 -right-1" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-foreground truncate w-full max-w-[90px] sm:max-w-[120px]">
                  {thirdPlace.nama}
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Rp {(thirdPlace.totalKekayaan / 1_000_000).toFixed(1)}Jt
                </span>
                {/* Podium Base */}
                <div className="w-full mt-2 h-12 sm:h-18 rounded-t-2xl bg-gradient-to-b from-orange-200/60 to-orange-300/40 dark:from-orange-950/60 dark:to-orange-900/30 border-t-2 border-orange-400 flex flex-col items-center justify-center p-1 shadow-inner">
                  <span className="text-[10px] font-mono font-bold text-orange-700 dark:text-orange-400">
                    {thirdPlace.pnlPercent >= 0 ? "+" : ""}{thirdPlace.pnlPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 4. SEARCH & QUICK SORT CONTROLS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari responden..."
            className="w-full h-10 pl-9 pr-8 rounded-2xl bg-card border border-border/80 text-xs font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Sort Segmented Buttons */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border/70 rounded-2xl overflow-x-auto shadow-2xs">
          <span className="text-[10px] font-bold text-muted-foreground px-2 shrink-0 flex items-center gap-1">
            <SlidersHorizontal className="size-3" />
            <span>Urutkan:</span>
          </span>
          <button
            onClick={() => setSortBy("rank")}
            className={cn(
              "px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 active:scale-95",
              sortBy === "rank"
                ? "bg-card text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Rank NAV
          </button>
          <button
            onClick={() => setSortBy("pnl")}
            className={cn(
              "px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 active:scale-95",
              sortBy === "pnl"
                ? "bg-card text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            P&L %
          </button>
          <button
            onClick={() => setSortBy("kas")}
            className={cn(
              "px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 active:scale-95",
              sortBy === "kas"
                ? "bg-card text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sisa Kas
          </button>
        </div>
      </div>

      {/* ─── 5. FULL LEADERBOARD (Mobile Collapsible Tickets + Desktop Table) ─── */}
      <Card className="rounded-3xl border border-border/80 bg-card/90 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-emerald-600 dark:text-emerald-500" />
            <CardTitle className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>Daftar Lengkap Peringkat Responden</span>
              <span className="text-xs font-mono font-normal text-muted-foreground">
                ({filteredAndSortedList.length})
              </span>
            </CardTitle>
          </div>
          {searchQuery && (
            <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Filter aktif
            </span>
          )}
        </CardHeader>

        <CardContent className="p-3 sm:p-6">
          {loading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-14 w-full rounded-2xl bg-muted/60" />
              <Skeleton className="h-14 w-full rounded-2xl bg-muted/60" />
              <Skeleton className="h-14 w-full rounded-2xl bg-muted/60" />
            </div>
          ) : filteredAndSortedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2 text-center">
              <Trophy className="size-8 text-muted-foreground/50" />
              <p className="text-xs font-bold text-foreground">Responden Tidak Ditemukan</p>
              <p className="text-[11px] text-muted-foreground">
                Tidak ada data yang cocok dengan pencarian &quot;{searchQuery}&quot;.
              </p>
            </div>
          ) : (
            <>
              {/* ── Mobile View: Compact Expandable Ticket Cards (< md) ── */}
              <div className="space-y-2 md:hidden">
                {filteredAndSortedList.map((row) => {
                  const isExpanded = expandedUserIds.has(row.userId);
                  const isTop3 = row.rank <= 3;

                  return (
                    <div
                      key={row.userId}
                      className={cn(
                        "rounded-2xl border transition-all overflow-hidden shadow-2xs",
                        isExpanded
                          ? "border-primary/40 bg-card ring-1 ring-primary/20"
                          : "border-border/70 bg-card hover:border-border"
                      )}
                    >
                      {/* Collapsed Header Bar (1-Tap Toggle) */}
                      <button
                        onClick={() => toggleExpand(row.userId)}
                        className="w-full p-3 flex items-center justify-between gap-2 text-left active:bg-muted/40 transition-colors"
                      >
                        {/* Rank Badge & Name */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-lg text-[10px] font-mono font-black border shrink-0",
                              row.rank === 1
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : row.rank === 2
                                ? "bg-slate-400/20 text-slate-700 dark:text-slate-300 border-slate-400/30"
                                : row.rank === 3
                                ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            #{row.rank}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-foreground truncate block max-w-[120px]">
                              {row.nama}
                            </span>
                            <span className="text-[9.5px] font-mono text-muted-foreground">
                              {row.jumlahTransaksi} Match
                            </span>
                          </div>
                        </div>

                        {/* NAV & PnL % */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 block">
                              Rp {row.totalKekayaan >= 1_000_000 
                                ? `${(row.totalKekayaan / 1_000_000).toFixed(2)}M`
                                : row.totalKekayaan.toLocaleString("id-ID")}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center text-[9.5px] font-mono font-bold",
                                row.pnlPercent >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              )}
                            >
                              {row.pnlPercent >= 0 ? "+" : ""}
                              {row.pnlPercent.toFixed(2)}%
                            </span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180 text-primary"
                            )}
                          />
                        </div>
                      </button>

                      {/* Expandable Breakdown Drawer */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="border-t border-border/50 bg-muted/20 px-3 py-2.5 space-y-2 text-xs"
                          >
                            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                              <div className="p-2 rounded-xl bg-card border border-border/60">
                                <span className="text-[9.5px] text-muted-foreground block">
                                  Sisa Kas
                                </span>
                                <span className="font-mono font-bold text-foreground">
                                  Rp {row.kas.toLocaleString("id-ID")}
                                </span>
                              </div>
                              <div className="p-2 rounded-xl bg-card border border-border/60">
                                <span className="text-[9.5px] text-muted-foreground block">
                                  Nilai Portofolio
                                </span>
                                <span className="font-mono font-bold text-foreground">
                                  Rp {row.nilaiPortofolio.toLocaleString("id-ID")}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 text-[10.5px]">
                              <span className="text-muted-foreground">P&L Bersih (Rp):</span>
                              <span
                                className={cn(
                                  "font-mono font-bold",
                                  row.pnlAmount >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                )}
                              >
                                {row.pnlAmount > 0 ? "+" : ""}Rp{" "}
                                {row.pnlAmount.toLocaleString("id-ID")}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop View: Full Data Table (>= md) ── */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/30">
                      <TableHead className="text-xs text-muted-foreground w-[70px] text-center font-bold">
                        Rank
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground font-bold">
                        Nama Responden
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right font-bold">
                        Sisa Kas
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right font-bold">
                        Nilai Portofolio
                      </TableHead>
                      <TableHead className="text-xs text-foreground text-right font-bold bg-muted">
                        Total NAV
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right font-bold">
                        P&L (Rp)
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right font-bold">
                        P&L (%)
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground text-center font-bold">
                        Tx
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedList.map((row) => (
                      <TableRow
                        key={row.userId}
                        className="border-border hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                              row.rank === 1
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                                : row.rank === 2
                                ? "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300"
                                : row.rank === 3
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {row.rank}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-medium">
                          {row.nama}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground text-right">
                          Rp {row.kas.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground text-right">
                          Rp {row.nilaiPortofolio.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400 text-right font-extrabold bg-muted/30">
                          Rp {row.totalKekayaan.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-mono text-xs text-right font-medium",
                            row.pnlAmount >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {row.pnlAmount > 0 ? "+" : ""}Rp{" "}
                          {row.pnlAmount.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-mono text-xs text-right font-bold",
                            row.pnlPercent >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {row.pnlPercent > 0 ? "+" : ""}
                          {row.pnlPercent.toFixed(2)}%
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground text-center">
                          {row.jumlahTransaksi}
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
    </motion.div>
  );
}

