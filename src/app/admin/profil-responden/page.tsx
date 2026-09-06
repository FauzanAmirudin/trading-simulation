"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Brain,
  DownloadCloud,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Loader2,
  UserCheck,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Award,
  X,
  Users,
  Activity,
  Eye,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PROFILE_MATRIX, ProfileGroup } from "@/lib/questionnaire-logic";

type RespondentProfile = {
  userId: number;
  nama: string;
  isCompleted: boolean;
  laRawScore: number | null;
  laAvgScore: number | null;
  laCategory: "T" | "S" | "R" | null;
  eiRawScore: number | null;
  eiAvgScore: number | null;
  eiCategory: "T" | "S" | "R" | null;
  profileCode: string | null;
  profileLabel: string | null;
  profileGroup: ProfileGroup | null;
  profileGroupName: string | null;
  profileDescription: string | null;
  completedAt: string | null;
};

type SummaryStats = {
  totalRespondents: number;
  completedCount: number;
  pendingCount: number;
  laOverallAvg: number;
  eiOverallAvg: number;
  groupDistribution: Record<string, number>;
  laCatDistribution: Record<string, number>;
  eiCatDistribution: Record<string, number>;
};

export default function AdminRespondentProfilesPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();

  const [respondents, setRespondents] = useState<RespondentProfile[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [laFilter, setLaFilter] = useState("ALL");
  const [eiFilter, setEiFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "PENDING">("ALL");
  const [sortBy, setSortBy] = useState("name");

  // Mobile Expanded Cards & Matrix Drawer
  const [expandedUserIds, setExpandedUserIds] = useState<Record<number, boolean>>({});
  const [showMobileMatrix, setShowMobileMatrix] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (groupFilter !== "ALL") queryParams.set("group", groupFilter);
      if (laFilter !== "ALL") queryParams.set("la", laFilter);
      if (eiFilter !== "ALL") queryParams.set("ei", eiFilter);
      if (sortBy) queryParams.set("sortBy", sortBy);

      const res = await fetch(`/api/admin/profiles?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRespondents(data.respondents || []);
        setStats(data.stats || null);
      } else {
        toast.error(data.error || "Gagal memuat profil responden.", { id: "fetch-prof-err" });
      }
    } catch (err) {
      console.error("Error fetching profiles:", err);
      toast.error("Gagal terhubung ke server.", { id: "fetch-prof-err" });
    } finally {
      setLoading(false);
    }
  }, [search, groupFilter, laFilter, eiFilter, sortBy]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetchProfiles();
  }, [hydrated, user, router, fetchProfiles]);

  // Recalculate Terciles
  const handleRecalculate = async () => {
    if (
      !confirm(
        "Kalkulasi ulang Tercile akan mengurutkan skor seluruh responden yang telah mengisi kuesioner dan membagi kategori (T/S/R) menjadi 3 kelompok sama rata secara otomatis. Lanjutkan?"
      )
    ) {
      return;
    }

    setRecalculating(true);
    try {
      const res = await fetch("/api/admin/profiles/recalculate", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Tercile berhasil dihitung ulang!", { id: "recalc-toast" });
        fetchProfiles();
      } else {
        toast.error(data.error || "Gagal mengkalkulasi ulang.", { id: "recalc-toast" });
      }
    } catch (err) {
      toast.error("Terjadi kesalahan pada server saat kalkulasi.", { id: "recalc-toast" });
    } finally {
      setRecalculating(false);
    }
  };

  // Export to Excel
  const handleExport = async () => {
    setExporting(true);
    toast.info("Menyiapkan berkas Excel profil responden...", { id: "export-profiles-toast" });
    try {
      const res = await fetch("/api/admin/export-profiles");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal mengekspor data");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan_Profil_Psikologis_Responden_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Berhasil mengunduh data profil Excel!", { id: "export-profiles-toast" });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengekspor data", { id: "export-profiles-toast" });
    } finally {
      setExporting(false);
    }
  };

  const toggleExpand = (userId: number) => {
    setExpandedUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Filter by status on client
  const displayedRespondents = respondents.filter((r) => {
    if (statusFilter === "COMPLETED") return r.isCompleted;
    if (statusFilter === "PENDING") return !r.isCompleted;
    return true;
  });

  if (!hydrated || !user || user.role !== "admin") return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6 space-y-3.5 sm:space-y-5 pb-28 md:pb-8">
      {/* ── 1. Fluid Header Bar ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-card/85 border border-border/80 p-3 sm:p-5 backdrop-blur-md shadow-xs flex flex-col gap-3">
        <div className="flex items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary shrink-0 border border-primary/20 shadow-2xs">
              <Brain className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[14px] sm:text-lg font-black tracking-tight text-foreground truncate" style={{ fontSize: "clamp(0.95rem, 3.5vw, 1.25rem)" }}>
                Hasil Profil Psikologis Responden
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">
                Skor Loss Aversion (LA), Emotional Intelligence (EI), dan pemetaan 9 kelompok profil.
              </p>
            </div>
          </div>

          {/* Desktop/Tablet Header Actions */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRecalculate}
              disabled={recalculating}
              className="h-9 px-3 rounded-xl text-xs font-bold border-border hover:bg-muted gap-1.5 active:scale-95"
            >
              <RefreshCw className={cn("size-3.5", recalculating && "animate-spin")} />
              <span>{recalculating ? "Menghitung..." : "Hitung Ulang Tercile"}</span>
            </Button>

            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="h-9 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs active:scale-95"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <DownloadCloud className="size-3.5" />
              )}
              <span>Ekspor Excel (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Mobile Header Action Buttons (< sm) */}
        <div className="grid grid-cols-2 gap-2 sm:hidden pt-1 border-t border-border/40">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="h-10 px-2 rounded-xl text-[11px] font-bold border-border bg-card/80 text-foreground gap-1.5 active:scale-95 touch-manipulation"
          >
            <RefreshCw className={cn("size-3.5 text-muted-foreground", recalculating && "animate-spin text-primary")} />
            <span className="truncate">{recalculating ? "Menghitung..." : "Hitung Tercile"}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="h-10 px-2 rounded-xl text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5 shadow-xs active:scale-95 touch-manipulation"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <DownloadCloud className="size-3.5" />
            )}
            <span className="truncate">Ekspor Excel</span>
          </Button>
        </div>
      </div>

      {/* ── 2. Macro Stats Bento Grid (2x2 on Mobile, 4 on Desktop) ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Responden Selesai */}
          <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-2xs space-y-0.5 sm:space-y-1">
            <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">Responden Selesai</span>
            <div className="text-base sm:text-2xl font-mono font-black text-foreground">
              {stats.completedCount} <span className="text-[10px] sm:text-xs text-muted-foreground font-sans font-normal">/ {stats.totalRespondents}</span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block truncate">
              {stats.totalRespondents > 0
                ? `${Math.round((stats.completedCount / stats.totalRespondents) * 100)}% Partisipasi`
                : "—"}
            </span>
          </div>

          {/* Rerata Skor LA */}
          <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-teal-500/5 border border-teal-500/20 shadow-2xs space-y-0.5 sm:space-y-1">
            <span className="text-[9.5px] sm:text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider block truncate">Rerata Skor LA</span>
            <div className="text-base sm:text-2xl font-mono font-black text-teal-600 dark:text-teal-400">
              {stats.laOverallAvg > 0 ? stats.laOverallAvg.toFixed(1) : "—"}
            </div>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">
              T: {stats.laCatDistribution.T} · S: {stats.laCatDistribution.S} · R: {stats.laCatDistribution.R}
            </span>
          </div>

          {/* Rerata Skor EI */}
          <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-500/5 border border-indigo-500/20 shadow-2xs space-y-0.5 sm:space-y-1">
            <span className="text-[9.5px] sm:text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider block truncate">Rerata Skor EI</span>
            <div className="text-base sm:text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400">
              {stats.eiOverallAvg > 0 ? stats.eiOverallAvg.toFixed(1) : "—"}
            </div>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">
              T: {stats.eiCatDistribution.T} · S: {stats.eiCatDistribution.S} · R: {stats.eiCatDistribution.R}
            </span>
          </div>

          {/* Dominansi Kelompok */}
          <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-2xs space-y-0.5 sm:space-y-1">
            <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">Dominansi Kelompok</span>
            <div className="text-sm sm:text-lg font-bold text-foreground truncate">
              {(() => {
                const entries = Object.entries(stats.groupDistribution);
                entries.sort((a, b) => b[1] - a[1]);
                if (entries.length > 0 && entries[0][1] > 0) {
                  return `Kel. ${entries[0][0]} (${entries[0][1]} User)`;
                }
                return "Belum Terbentuk";
              })()}
            </div>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">9 Kelompok (A–I)</span>
          </div>
        </div>
      )}

      {/* ── 3. 9-Group Distribution Ribbon (Collapsible on Mobile, Full on Desktop) ── */}
      {stats && stats.completedCount > 0 && (
        <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/85 p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-foreground">
            <button
              type="button"
              onClick={() => setShowMobileMatrix(!showMobileMatrix)}
              className="flex items-center gap-1.5 hover:text-primary transition-colors touch-manipulation min-h-[36px] sm:min-h-0 text-left min-w-0"
              aria-expanded={showMobileMatrix}
            >
              <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 border border-primary/20">
                <Layers className="size-3.5" />
              </div>
              <span className="truncate text-xs sm:text-sm font-black">Distribusi 9 Kelompok Profil</span>
              <span className="sm:hidden text-[11px] text-primary font-mono font-bold ml-1 inline-flex items-center gap-0.5 shrink-0 px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 active:scale-95 transition-transform">
                <ChevronDown className={cn("size-3 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", showMobileMatrix && "rotate-180")} />
                <span>{showMobileMatrix ? "Tutup" : "Buka Matriks"}</span>
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              {groupFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setGroupFilter("ALL")}
                  className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1 active:scale-95 transition-transform touch-manipulation"
                >
                  <span>Filter: Kel. {groupFilter}</span>
                  <X className="size-2.5" />
                </button>
              )}
              <span className="text-[10px] font-mono font-bold text-muted-foreground hidden xs:inline px-2 py-0.5 rounded-full bg-muted/60">
                {stats.completedCount} Terprofil
              </span>
            </div>
          </div>

          {/* Desktop Matrix: Always 9 Columns */}
          <div className="hidden sm:grid sm:grid-cols-9 gap-1.5 pt-3">
            {(["A", "B", "C", "D", "E", "F", "G", "H", "I"] as ProfileGroup[]).map((grp) => {
              const def = PROFILE_MATRIX[grp];
              const count = stats.groupDistribution[grp] || 0;
              const isSelected = groupFilter === grp;

              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setGroupFilter(groupFilter === grp ? "ALL" : grp)}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-xl border text-center transition-all active:scale-95 select-none touch-manipulation min-h-[44px]",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30 text-primary"
                      : count > 0
                      ? "border-border/80 bg-card hover:bg-muted/40 text-foreground"
                      : "border-border/40 bg-muted/10 text-muted-foreground opacity-50"
                  )}
                >
                  <div className="text-[9.5px] sm:text-[10px] font-mono font-black uppercase">
                    {grp} · {def.code.slice(2, 4)}/{def.code.slice(4)}
                  </div>
                  <div className="text-sm sm:text-base font-mono font-black mt-0.5">{count}</div>
                  <div className="text-[8px] sm:text-[9px] font-semibold text-muted-foreground truncate">{def.label}</div>
                </button>
              );
            })}
          </div>

          {/* Mobile Ultra-Smooth Hardware-Accelerated Matrix Drawer (3x3 Grid) */}
          <div
            className="grid sm:hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ gridTemplateRows: showMobileMatrix ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div
                className={cn(
                  "pt-3 pb-0.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  showMobileMatrix ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
                )}
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {(["A", "B", "C", "D", "E", "F", "G", "H", "I"] as ProfileGroup[]).map((grp) => {
                    const def = PROFILE_MATRIX[grp];
                    const count = stats.groupDistribution[grp] || 0;
                    const isSelected = groupFilter === grp;

                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setGroupFilter(groupFilter === grp ? "ALL" : grp)}
                        className={cn(
                          "p-2 rounded-xl border text-center transition-all duration-150 active:scale-95 select-none touch-manipulation min-h-[50px] flex flex-col justify-center",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30 text-primary font-bold"
                            : count > 0
                            ? "border-border/80 bg-card/90 text-foreground"
                            : "border-border/40 bg-muted/10 text-muted-foreground opacity-50"
                        )}
                      >
                        <div className="text-[10px] font-mono font-black uppercase tracking-tight">
                          {grp} · {def.code.slice(2, 4)}/{def.code.slice(4)}
                        </div>
                        <div className="text-sm font-mono font-black text-foreground mt-0.5">
                          {count} <span className="text-[8.5px] font-normal text-muted-foreground font-sans">User</span>
                        </div>
                        <div className="text-[8.5px] font-semibold text-muted-foreground truncate">{def.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── 4. Search, Filter & Sort Controls (Ultra-Fluid 2x2 Grid with Zero-Lag Native Pickers) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Search Input with Clear Button */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama responden..."
            className="pl-9 pr-9 text-xs sm:text-sm bg-card/90 border-border/80 h-11 sm:h-9 rounded-xl sm:rounded-2xl shadow-2xs placeholder:text-muted-foreground/70 focus-visible:ring-primary focus-visible:border-primary transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground text-xs active:scale-90 transition-transform touch-manipulation"
              aria-label="Hapus pencarian"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns: 2x2 Grid on Mobile (< sm), Flex Row on Desktop (>= sm) */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* 1. Kelompok Filter */}
          <div className="relative w-full sm:w-auto">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full appearance-none rounded-xl sm:rounded-2xl border border-border/80 bg-card/90 pl-3 pr-7 py-2 text-[11px] sm:text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-11 sm:h-9 shadow-2xs truncate transition-colors cursor-pointer active:scale-[0.98]"
            >
              <option value="ALL">Semua Kelompok</option>
              {(["A", "B", "C", "D", "E", "F", "G", "H", "I"] as ProfileGroup[]).map((g) => (
                <option key={g} value={g}>
                  Kel. {g} ({PROFILE_MATRIX[g].label})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>

          {/* 2. LA Filter */}
          <div className="relative w-full sm:w-auto">
            <select
              value={laFilter}
              onChange={(e) => setLaFilter(e.target.value)}
              className="w-full appearance-none rounded-xl sm:rounded-2xl border border-border/80 bg-card/90 pl-3 pr-7 py-2 text-[11px] sm:text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-11 sm:h-9 shadow-2xs truncate transition-colors cursor-pointer active:scale-[0.98]"
            >
              <option value="ALL">Semua LA</option>
              <option value="T">LA: Tinggi (T)</option>
              <option value="S">LA: Sedang (S)</option>
              <option value="R">LA: Rendah (R)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>

          {/* 3. EI Filter */}
          <div className="relative w-full sm:w-auto">
            <select
              value={eiFilter}
              onChange={(e) => setEiFilter(e.target.value)}
              className="w-full appearance-none rounded-xl sm:rounded-2xl border border-border/80 bg-card/90 pl-3 pr-7 py-2 text-[11px] sm:text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-11 sm:h-9 shadow-2xs truncate transition-colors cursor-pointer active:scale-[0.98]"
            >
              <option value="ALL">Semua EI</option>
              <option value="T">EI: Tinggi (T)</option>
              <option value="S">EI: Sedang (S)</option>
              <option value="R">EI: Rendah (R)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>

          {/* 4. Sort By Filter */}
          <div className="relative w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full appearance-none rounded-xl sm:rounded-2xl border border-border/80 bg-card/90 pl-3 pr-7 py-2 text-[11px] sm:text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-11 sm:h-9 shadow-2xs truncate transition-colors cursor-pointer active:scale-[0.98]"
            >
              <option value="name">Urut: ID/Nama</option>
              <option value="laScore">Urut: Skor LA</option>
              <option value="eiScore">Urut: Skor EI</option>
              <option value="completedAt">Urut: Waktu</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* ── 5. Main Profiles Table / List ── */}
      <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/90 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground text-xs gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Memuat data profil responden...</span>
            </div>
          ) : displayedRespondents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 text-muted-foreground px-4">
              <Brain className="size-8 opacity-40" />
              <p className="text-xs font-bold text-foreground">Tidak Ada Responden</p>
              <p className="text-[11px] max-w-xs">Tidak ada data profil yang sesuai dengan filter pencarian yang dipilih.</p>
              {(search || groupFilter !== "ALL" || laFilter !== "ALL" || eiFilter !== "ALL") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setGroupFilter("ALL");
                    setLaFilter("ALL");
                    setEiFilter("ALL");
                  }}
                  className="h-8 px-3 text-xs rounded-xl mt-1 font-semibold"
                >
                  Reset Filter
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile View: Compact Tickets (< md) */}
              <div className="divide-y divide-border/60 md:hidden">
                {displayedRespondents.map((r, index) => {
                  const isExpanded = expandedUserIds[r.userId];
                  return (
                    <div key={r.userId} className="p-3 sm:p-4 space-y-2.5 bg-card/40">
                      {/* Header Row: No + Name + Profile Group Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="size-7 rounded-xl bg-card border border-border flex items-center justify-center text-[10.5px] font-mono font-bold text-muted-foreground shrink-0 shadow-2xs">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-foreground truncate">{r.nama}</span>
                        </div>

                        {r.isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-black shrink-0 shadow-2xs">
                            {r.profileLabel} · Kel. {r.profileGroup}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold shrink-0">
                            Belum Mengisi
                          </span>
                        )}
                      </div>

                      {/* Summary Metrics Row */}
                      {r.isCompleted && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          {/* Loss Aversion Card */}
                          <div className="p-2.5 rounded-xl bg-teal-500/5 border border-teal-500/15 space-y-0.5">
                            <span className="text-[9px] text-teal-600 dark:text-teal-400 font-bold block truncate uppercase">
                              Loss Aversion (LA)
                            </span>
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-xs font-black text-foreground">
                                {r.laRawScore} <span className="text-[9.5px] font-normal text-muted-foreground">pts</span>
                              </span>
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded-md text-[9px] font-bold border",
                                  r.laCategory === "T"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : r.laCategory === "S"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                )}
                              >
                                {r.laCategory === "T" ? "Tinggi" : r.laCategory === "S" ? "Sedang" : "Rendah"}
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground block truncate">
                              Rerata: {r.laAvgScore?.toFixed(2)} / 5.0
                            </span>
                          </div>

                          {/* Emotional Intel Card */}
                          <div className="p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15 space-y-0.5">
                            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold block truncate uppercase">
                              Emotional Intel (EI)
                            </span>
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-xs font-black text-foreground">
                                {r.eiRawScore} <span className="text-[9.5px] font-normal text-muted-foreground">pts</span>
                              </span>
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded-md text-[9px] font-bold border",
                                  r.eiCategory === "T"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : r.eiCategory === "S"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                )}
                              >
                                {r.eiCategory === "T" ? "Tinggi" : r.eiCategory === "S" ? "Sedang" : "Rendah"}
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground block truncate">
                              Rerata: {r.eiAvgScore?.toFixed(2)} / 5.0
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Expand Toggle for Behavioral Explanation & Detail Page Button */}
                      {r.isCompleted && (
                        <div className="space-y-2 pt-1">
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.userId)}
                            className="w-full flex items-center justify-between text-[11px] font-bold text-muted-foreground hover:text-foreground touch-manipulation min-h-[36px] select-none py-1 transition-colors"
                            aria-expanded={isExpanded}
                          >
                            <span>{isExpanded ? "Tutup Karakteristik" : "Lihat Karakteristik Kelompok"}</span>
                            <ChevronDown className={cn("size-3.5 text-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", isExpanded && "rotate-180")} />
                          </button>

                          {/* Ultra-Smooth Hardware-Accelerated Accordion Drawer */}
                          <div
                            className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                          >
                            <div className="overflow-hidden">
                              <div
                                className={cn(
                                  "pt-1 pb-1 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                  isExpanded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1.5 pointer-events-none"
                                )}
                              >
                                <div className="p-3 rounded-2xl bg-muted/50 border border-border/60 text-[11px] space-y-1.5">
                                  <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                    <Sparkles className="size-3 text-primary shrink-0" />
                                    <span>{r.profileGroupName}</span>
                                  </div>
                                  <p className="text-muted-foreground leading-relaxed text-[10.5px]">{r.profileDescription}</p>
                                  {r.completedAt && (
                                    <div className="text-[9.5px] font-mono text-muted-foreground pt-1.5 border-t border-border/40">
                                      Waktu Submit: {new Date(r.completedAt).toLocaleString("id-ID")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Dedicated Detail Page Button on Mobile */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/profil-responden/${r.userId}`)}
                            className="w-full h-10 text-xs font-bold rounded-xl bg-primary/5 hover:bg-primary/10 text-primary border-primary/20 gap-1.5 shadow-2xs active:scale-[0.98] transition-transform touch-manipulation"
                          >
                            <Eye className="size-3.5" />
                            <span>Lihat Detail Hasil Pengisian Form (30 Butir) ›</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Full Data Table (>= md) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-14 text-center text-xs font-bold text-muted-foreground">No</TableHead>
                      <TableHead className="w-36 text-xs font-bold text-muted-foreground">Responden</TableHead>
                      <TableHead className="w-24 text-center text-xs font-bold text-muted-foreground">Status</TableHead>
                      <TableHead className="w-32 text-center text-xs font-bold text-muted-foreground">Loss Aversion (LA)</TableHead>
                      <TableHead className="w-32 text-center text-xs font-bold text-muted-foreground">Emotional Intel (EI)</TableHead>
                      <TableHead className="w-32 text-center text-xs font-bold text-muted-foreground">String Profil</TableHead>
                      <TableHead className="w-24 text-center text-xs font-bold text-muted-foreground">Kelompok</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground">Karakteristik Perilaku</TableHead>
                      <TableHead className="w-24 text-center text-xs font-bold text-muted-foreground">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRespondents.map((r, index) => (
                      <TableRow
                        key={r.userId}
                        className="border-border/60 hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/admin/profil-responden/${r.userId}`)}
                      >
                        <TableCell className="text-center font-mono font-bold text-xs text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {r.nama}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="size-3" />
                              <span>Lengkap</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              <Clock className="size-3" />
                              <span>Belum</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {r.isCompleted ? (
                            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                              {r.laRawScore} pts ({r.laAvgScore?.toFixed(2)}) · <span className="font-sans font-black underline">{r.laCategory}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {r.isCompleted ? (
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {r.eiRawScore} pts ({r.eiAvgScore?.toFixed(2)}) · <span className="font-sans font-black underline">{r.eiCategory}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.isCompleted ? (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-black bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                              {r.profileLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.isCompleted ? (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-muted border border-border">
                              Kel. {r.profileGroup} ({r.profileCode})
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm whitespace-normal leading-relaxed py-3" title={r.profileDescription || ""}>
                          {r.profileDescription || "—"}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/admin/profil-responden/${r.userId}`)}
                            className="h-8 px-2.5 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-xl gap-1"
                            title="Lihat Detail Pengisian Kuesioner"
                          >
                            <Eye className="size-3.5" />
                            <span>Detail</span>
                          </Button>
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
    </div>
  );
}

