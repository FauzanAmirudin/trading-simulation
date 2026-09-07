"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Globe,
  Timer,
  Activity,
  Layers,
  CheckSquare,
  Square,
  Filter,
  DownloadCloud,
  Loader2,
  CalendarDays,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ExportType = "excel" | "orderbook" | "hasil";

interface RoundItem {
  id: number;
  roundNumber: number | null;
  period: number;
  sessionGroup: number;
  roundIndex: number;
  status: string;
  subSessionStatus: string;
  activeIntervention: string | null;
  startTime: string | null;
  endTime?: string | null;
  createdAt: string;
  tradeCount: number;
  predictionCount?: number;
  orderCount?: number;
}

interface ExportFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportType: ExportType;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

export function ExportFilterModal({
  isOpen,
  onClose,
  exportType,
  selectedDate,
  onDateChange,
}: ExportFilterModalProps) {
  // Utility: Mendapatkan tanggal hari ini dalam format YYYY-MM-DD WIB (Asia/Jakarta)
  const getTodayWib = () => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  };

  const todayWib = getTodayWib();

  const [rounds, setRounds] = useState<RoundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedRoundIds, setSelectedRoundIds] = useState<Set<number>>(new Set());
  const [onlyCompleted, setOnlyCompleted] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<number | "ALL">("ALL");
  const [sessionFilter, setSessionFilter] = useState<number | "ALL">("ALL");
  const [dateFilterMode, setDateFilterMode] = useState<"date" | "ALL">("date");
  const [filterDate, setFilterDate] = useState<string>(() => selectedDate || todayWib);

  // Sinkronisasi saat modal dibuka atau selectedDate dari luar berubah
  useEffect(() => {
    if (isOpen) {
      setFilterDate(selectedDate || todayWib);
      setDateFilterMode("date");
    }
  }, [isOpen, selectedDate]);

  const handleDateSelect = (newDate: string) => {
    setFilterDate(newDate);
    setDateFilterMode("date");
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  // Format tanggal Indonesia (WIB)
  const formatWibDate = (isoStringOrDate?: string | null) => {
    if (!isoStringOrDate) return "—";
    const d = new Date(
      isoStringOrDate.includes("T") ? isoStringOrDate : `${isoStringOrDate}T00:00:00+07:00`
    );
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  };

  // Format waktu 24 jam Indonesia (WIB) — Tanpa AM/PM
  const formatWibTime = (isoString?: string | null) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    const timeStr = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).replace(/:/g, ".");
    return `${timeStr} WIB`;
  };

  // Hitung durasi ronde jika startTime dan endTime ada
  const formatDuration = (startStr?: string | null, endStr?: string | null) => {
    if (!startStr || !endStr) return null;
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    const diffSec = Math.floor((end - start) / 1000);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s`;
  };

  const fetchRounds = (dateMode: "date" | "ALL", targetDate: string) => {
    setLoading(true);
    const dateParam = dateMode === "date" && targetDate ? `?date=${targetDate}` : "?date=ALL";
    fetch(`/api/admin/rounds/list${dateParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rounds) {
          setRounds(data.rounds);
          const validIds = data.rounds
            .filter((r: RoundItem) => r.status !== "aborted" && r.status !== "pending")
            .map((r: RoundItem) => r.id);
          setSelectedRoundIds(new Set(validIds));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching rounds list:", err);
        toast.error("Gagal memuat daftar sesi untuk export");
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchRounds(dateFilterMode, filterDate);
  }, [isOpen, dateFilterMode, filterDate]);

  if (!isOpen) return null;

  // Available sessions & periods in current loaded rounds
  const availableSessions = Array.from(new Set(rounds.map((r) => r.sessionGroup))).sort((a, b) => a - b);
  const availablePeriods = Array.from(new Set(rounds.map((r) => r.period))).sort((a, b) => a - b);

  const filteredRounds = rounds.filter((r) => {
    if (periodFilter !== "ALL" && r.period !== periodFilter) return false;
    if (sessionFilter !== "ALL" && r.sessionGroup !== sessionFilter) return false;
    if (onlyCompleted && (r.status === "aborted" || r.status === "pending")) return false;
    return true;
  });

  const handleToggleRound = (roundId: number) => {
    setSelectedRoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) next.delete(roundId);
      else next.add(roundId);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredRounds.map((r) => r.id);
    setSelectedRoundIds((prev) => new Set([...prev, ...allFilteredIds]));
  };

  const handleDeselectAll = () => {
    const allFilteredIds = new Set(filteredRounds.map((r) => r.id));
    setSelectedRoundIds((prev) => {
      const next = new Set(prev);
      for (const id of allFilteredIds) next.delete(id);
      return next;
    });
  };

  const handleDownload = async () => {
    try {
      if (selectedRoundIds.size === 0) {
        toast.warning("Silakan pilih minimal 1 ronde untuk diunduh");
        return;
      }

      setDownloading(true);
      toast.info("Menyiapkan file laporan bersih...");

      const params = new URLSearchParams();
      params.set("roundIds", Array.from(selectedRoundIds).join(","));
      params.set("onlyCompleted", String(onlyCompleted));
      if (dateFilterMode === "date" && filterDate) {
        params.set("date", filterDate);
      } else {
        params.set("date", "ALL");
      }

      const endpoint =
        exportType === "orderbook"
          ? "/api/admin/export-orderbook"
          : exportType === "hasil"
          ? "/api/admin/export-hasil"
          : "/api/admin/export-excel";

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Gagal mengunduh file Excel.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const titlePrefix =
        exportType === "orderbook"
          ? "Laporan_OrderBook"
          : exportType === "hasil"
          ? "Laporan_Hasil"
          : "Laporan_Trading";

      const dateSuffix = dateFilterMode === "date" && filterDate ? filterDate : "Semua_Sesi";
      a.download = `${titlePrefix}_${dateSuffix}.xlsx`;

      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
      }, 1500);

      toast.success("Berhasil mengunduh laporan Excel!");
      onClose();
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(err.message || "Gagal mengekspor data");
    } finally {
      setDownloading(false);
    }
  };

  const exportTitle =
    exportType === "orderbook"
      ? "Ekspor Order Book & Spread"
      : exportType === "hasil"
      ? "Ekspor Hasil & Leaderboard"
      : "Ekspor Laporan Transaksi & Prediksi";

  const isTodayActive = dateFilterMode === "date" && filterDate === todayWib;
  const isCustomDateActive = dateFilterMode === "date" && filterDate !== todayWib;
  const isAllDatesActive = dateFilterMode === "ALL";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-xs">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{exportTitle}</h3>
                <p className="text-xs text-muted-foreground">
                  Pilih tanggal & filter ronde yang akan diekspor ke file Excel
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <Globe className="size-3 shrink-0" />
                    <span>Waktu: <strong>WIB (UTC+7) · 24 Jam</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10.5px] font-semibold text-primary">
                    <Calendar className="size-3 shrink-0" />
                    <span>
                      Target:{" "}
                      <strong className="font-bold">
                        {dateFilterMode === "ALL"
                          ? "Semua Riwayat"
                          : formatWibDate(filterDate)}
                      </strong>
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={downloading}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Filter Controls Bar */}
          <div className="p-3.5 sm:p-4 border-b border-border/40 bg-muted/15 flex flex-col gap-3 shrink-0">
            {/* ROW 1: Date Filter Section (High-Contrast Emerald Themed) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> Tanggal:
                </span>
                
                {/* Date Controls Container */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-background/80 rounded-xl border border-border shadow-xs">
                  {/* Preset: Hari Ini */}
                  <button
                    type="button"
                    onClick={() => handleDateSelect(todayWib)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1",
                      isTodayActive
                        ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/40"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <span>Hari Ini</span>
                    {isTodayActive && <span className="text-[9px] opacity-80 font-normal">({formatWibDate(todayWib).split(",")[1]?.trim()})</span>}
                  </button>

                  {/* Interactive Date Picker */}
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all border",
                      isCustomDateActive
                        ? "bg-emerald-600 text-white font-bold border-emerald-500 shadow-sm ring-2 ring-emerald-500/40"
                        : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/70"
                    )}
                  >
                    <Calendar className={cn("size-3 shrink-0", isCustomDateActive ? "text-white" : "text-emerald-500")} />
                    <span className="text-[10.5px] font-semibold shrink-0">Pilih:</span>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleDateSelect(e.target.value);
                        }
                      }}
                      className={cn(
                        "bg-transparent text-[11px] font-mono font-bold focus:outline-none cursor-pointer p-0",
                        isCustomDateActive ? "text-white [color-scheme:dark]" : "text-foreground"
                      )}
                    />
                  </div>

                  {/* Preset: Semua Riwayat */}
                  <button
                    type="button"
                    onClick={() => setDateFilterMode("ALL")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                      isAllDatesActive
                        ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/40"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    Semua Riwayat
                  </button>
                </div>
              </div>

              {/* Quick Checklist Actions (Pilih Semua / Batal) */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-7 px-2.5 text-[11px] font-bold gap-1 text-foreground hover:bg-background border border-border/60 rounded-lg shadow-2xs"
                >
                  <CheckSquare className="size-3 text-emerald-500" /> Pilih Semua
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="h-7 px-2.5 text-[11px] font-bold gap-1 text-muted-foreground hover:text-foreground hover:bg-background border border-border/60 rounded-lg shadow-2xs"
                >
                  <Square className="size-3 text-muted-foreground" /> Batal Semua
                </Button>
              </div>
            </div>

            {/* ROW 2: Period (Blue) & Session (Indigo) Filter Tabs */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/40">
              {/* Period Filter (Blue Themed) */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Periode:
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-background/80 rounded-xl border border-border shadow-xs">
                  <button
                    type="button"
                    onClick={() => setPeriodFilter("ALL")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                      periodFilter === "ALL"
                        ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/40"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    Semua
                  </button>
                  {(availablePeriods.length > 0 ? availablePeriods : [1, 2, 3]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriodFilter(p)}
                      className={cn(
                        "px-2 py-1 text-[11px] font-bold rounded-lg transition-all",
                        periodFilter === p
                          ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Filter (Indigo Themed) */}
              {availableSessions.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Sesi:
                  </span>
                  <div className="flex items-center gap-1 p-0.5 bg-background/80 rounded-xl border border-border shadow-xs">
                    <button
                      type="button"
                      onClick={() => setSessionFilter("ALL")}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                        sessionFilter === "ALL"
                          ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      Semua
                    </button>
                    {availableSessions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSessionFilter(s)}
                        className={cn(
                          "px-2 py-1 text-[11px] font-bold rounded-lg transition-all",
                          sessionFilter === s
                            ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/40"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        )}
                      >
                        Sesi {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ROW 3: Active Filters Summary Ribbon (Clear Visual Confirmation) */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-background/60 border border-border/60 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-muted-foreground flex items-center gap-1">
                  <Filter className="size-3 text-primary" /> Filter Aktif:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  📅 {dateFilterMode === "ALL" ? "Semua Riwayat" : formatWibDate(filterDate)}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/30">
                  📊 {periodFilter === "ALL" ? "Semua Periode" : `Periode ${periodFilter}`}
                </span>
                {sessionFilter !== "ALL" && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/30">
                    🔄 Sesi {sessionFilter}
                  </span>
                )}
              </div>

              <div className="font-mono font-bold text-foreground">
                <span className={cn(selectedRoundIds.size > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
                  {selectedRoundIds.size}
                </span>{" "}
                <span className="text-muted-foreground font-sans text-[10.5px]">
                  dari {filteredRounds.length} ronde siap unduh
                </span>
              </div>
            </div>
          </div>

          {/* Checklist Body */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2.5 min-h-[240px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="size-6 animate-spin text-emerald-500" />
                <span className="text-xs font-semibold">Memuat daftar ronde eksperimen...</span>
              </div>
            ) : filteredRounds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3 text-center px-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <AlertTriangle className="size-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Tidak Ada Ronde Ditemukan</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                    {dateFilterMode === "date"
                      ? `Tidak ada data ronde pada tanggal ${formatWibDate(filterDate)} dengan kriteria filter saat ini.`
                      : "Tidak ada data ronde dengan filter yang Anda pilih."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  {dateFilterMode === "date" && filterDate !== todayWib && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDateSelect(todayWib)}
                      className="h-8 text-xs font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1.5"
                    >
                      <RotateCcw className="size-3.5" /> Tampilkan Hari Ini ({formatWibDate(todayWib).split(",")[1]?.trim()})
                    </Button>
                  )}
                  {dateFilterMode === "date" && (
                    <Button
                      size="sm"
                      onClick={() => setDateFilterMode("ALL")}
                      className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      <Globe className="size-3.5" /> Tampilkan Semua Riwayat
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              filteredRounds.map((r) => {
                const isSelected = selectedRoundIds.has(r.id);
                const isAborted = r.status === "aborted";
                const isRunning = r.status === "active";
                const roundTime = r.startTime ?? r.createdAt;
                const dateStr = formatWibDate(roundTime);
                const timeStr = formatWibTime(roundTime);
                const duration = formatDuration(r.startTime, r.endTime);

                return (
                  <div
                    key={r.id}
                    onClick={() => handleToggleRound(r.id)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 select-none",
                      isSelected
                        ? "border-emerald-500/60 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30 dark:bg-emerald-500/10"
                        : "border-border/60 bg-muted/20 opacity-60 hover:opacity-90 hover:border-border"
                    )}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          "size-5 rounded-md border flex items-center justify-center transition-all shrink-0 mt-0.5 sm:mt-0 shadow-2xs",
                          isSelected
                            ? "border-emerald-500 bg-emerald-600 text-white"
                            : "border-muted-foreground/40 bg-card"
                        )}
                      >
                        {isSelected && <CheckCircle2 className="size-3.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-xs font-extrabold text-foreground">
                            Periode {r.period} · Sesi {r.sessionGroup} · Ronde {r.roundIndex + 1}
                          </span>
                          {isAborted && (
                            <span className="px-1.5 py-0.5 text-[9.5px] font-bold rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              Dihentikan / Aborted
                            </span>
                          )}
                          {isRunning && (
                            <span className="px-1.5 py-0.5 text-[9.5px] font-bold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Sedang Berjalan
                            </span>
                          )}
                          {!isAborted && !isRunning && (
                            <span className="px-1.5 py-0.5 text-[9.5px] font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Selesai
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono">
                            <Activity className="size-3 text-muted-foreground/80 shrink-0" />
                            <span>{r.tradeCount} Match</span>
                          </span>
                          {(r.predictionCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              <span>{r.predictionCount} Prediksi</span>
                            </span>
                          )}
                          {(r.orderCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400 font-semibold">
                              <span>{r.orderCount} Order</span>
                            </span>
                          )}
                          {duration && (
                            <span className="flex items-center gap-1 font-mono">
                              <Timer className="size-3 text-muted-foreground/80 shrink-0" />
                              <span>Durasi {duration}</span>
                            </span>
                          )}
                          {r.activeIntervention && r.activeIntervention !== "NONE" && (
                            <span className="font-semibold text-primary">
                              {r.activeIntervention}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: WIB Date & Time Badge (Strict WIB, No ID, No AM/PM) */}
                    <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 sm:gap-1 pl-8 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40 shrink-0">
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs shadow-2xs border transition-colors",
                          isSelected
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-background text-foreground border-border/80"
                        )}
                        title={`Waktu sesi (WIB): ${timeStr}`}
                      >
                        <Clock className="size-3 text-emerald-500 shrink-0" />
                        <span>{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground font-medium">
                        <Calendar className="size-3 text-muted-foreground/70 shrink-0" />
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="onlyCompletedCheck"
                checked={onlyCompleted}
                onChange={(e) => setOnlyCompleted(e.target.checked)}
                className="size-4 rounded accent-emerald-600 cursor-pointer"
              />
              <label
                htmlFor="onlyCompletedCheck"
                className="text-xs font-semibold text-foreground cursor-pointer select-none"
              >
                Abaikan otomatis sesi yang dihentikan (Aborted)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={downloading}
                className="text-xs text-muted-foreground"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={downloading || selectedRoundIds.size === 0}
                className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white min-w-[150px] shadow-md shadow-emerald-600/25"
              >
                {downloading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Mengunduh...
                  </>
                ) : (
                  <>
                    <DownloadCloud className="size-3.5" /> Unduh ({selectedRoundIds.size} Ronde)
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

