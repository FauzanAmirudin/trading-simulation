"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardDrive,
  Database,
  ShieldCheck,
  Download,
  RefreshCw,
  FileSpreadsheet,
  FileCode,
  Trash2,
  Clock,
  CheckCircle2,
  Sparkles,
  Search,
  Users,
  ClipboardList,
  UserCheck,
  Brain,
  ClipboardCheck,
  TrendingUp,
  Receipt,
  AlertCircle,
  HelpCircle,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BackupItem = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  type: "zip" | "excel" | "json";
};

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatWib(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).replace(/:/g, ".");
  return `${datePart} ${timePart} WIB`;
}

export default function AdminBackupPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "zip" | "excel" | "json">("all");
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // Authentication & Guard
  useEffect(() => {
    if (!hydrated) return;
    if (!user || user.role !== "admin") {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  // Fetch Backups List
  const fetchBackups = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch("/api/admin/backup?action=list");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal memuat daftar backup.");
      }
      const json = await res.json();
      setBackups(json.backups || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar cadangan data";
      toast.error(msg, { id: "fetch-backup-error" });
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated && user?.role === "admin") {
      fetchBackups();
    }
  }, [hydrated, user, fetchBackups]);

  // Trigger Instant Backup
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    toast.info("Menyiapkan snapshot seluruh data riset (Excel & JSON)...", { id: "backup-create" });
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal membuat cadangan.");
      }
      const data = await res.json();
      toast.success("Cadangan data baru berhasil dibuat dan disimpan di server!", { id: "backup-create" });
      fetchBackups(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat cadangan";
      toast.error(msg, { id: "backup-create" });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Download Existing Backup File
  const handleDownloadFile = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      const res = await fetch(`/api/admin/backup?action=download&filename=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error("Gagal mengunduh berkas cadangan.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Berkas ${filename} berhasil diunduh!`, { id: "backup-dl" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengunduh berkas";
      toast.error(msg, { id: "backup-dl" });
    } finally {
      setDownloadingFile(null);
    }
  };

  // Delete Backup File
  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus berkas cadangan:\n${filename}?`)) {
      return;
    }
    setDeletingFile(filename);
    try {
      const res = await fetch(`/api/admin/backup?filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus berkas.");
      }
      toast.success(`Berkas cadangan ${filename} berhasil dihapus.`, { id: "backup-del" });
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus berkas";
      toast.error(msg, { id: "backup-del" });
    } finally {
      setDeletingFile(null);
    }
  };

  // Quick direct live download of fresh ZIP bundle (All Excel files inside)
  const handleDirectZipExport = async () => {
    toast.info("Menyiapkan paket arsip ZIP berisi seluruh berkas Excel...", { id: "direct-zip" });
    try {
      const res = await fetch("/api/admin/backup?format=zip");
      if (!res.ok) throw new Error("Gagal mengunduh paket arsip ZIP.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_full_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Paket arsip ZIP berhasil diunduh!", { id: "direct-zip" });
      fetchBackups(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengunduh paket ZIP";
      toast.error(msg, { id: "direct-zip" });
    }
  };

  // Quick direct live download of fresh JSON
  const handleDirectJsonExport = async () => {
    toast.info("Menyiapkan snapshot JSON mentah...", { id: "direct-json" });
    try {
      const res = await fetch("/api/admin/backup?format=json");
      if (!res.ok) throw new Error("Gagal mengunduh snapshot JSON.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_full_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Snapshot JSON berhasil diunduh!", { id: "direct-json" });
      fetchBackups(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengunduh snapshot JSON";
      toast.error(msg, { id: "direct-json" });
    }
  };

  // Filtered backups list
  const filteredBackups = backups.filter((b) => {
    const matchesSearch = b.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || b.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);
  const zipCount = backups.filter((b) => b.type === "zip").length;
  const excelCount = backups.filter((b) => b.type === "excel").length;
  const jsonCount = backups.filter((b) => b.type === "json").length;
  const latestBackup = backups[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-muted/30 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="size-3.5" />
              <span>Sistem Pencadangan Data Aktif & Terlindungi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <HardDrive className="size-7 text-primary" />
              Pusat Cadangan &amp; Monitoring Data
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Monitoring riwayat berkas cadangan otomatis server, unduh paket arsip ZIP terkompresi berisi seluruh berkas Excel resmi (Biodata, Profil Responden, Kuesioner, Evaluasi, Resume, Hasil, dan Order Book) beserta snapshot basis data JSON.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:self-start">
            <Button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="gap-2 shadow-sm font-semibold text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className={cn("size-4", isCreatingBackup && "animate-spin")} />
              {isCreatingBackup ? "Membuat Cadangan..." : "Buat Cadangan Baru"}
            </Button>

            <Button
              variant="outline"
              onClick={handleDirectZipExport}
              className="gap-1.5 text-xs sm:text-sm border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
            >
              <Archive className="size-4" />
              Unduh Paket ZIP (.zip)
            </Button>

            <Button
              variant="outline"
              onClick={handleDirectJsonExport}
              className="gap-1.5 text-xs sm:text-sm border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
            >
              <FileCode className="size-4" />
              Unduh JSON (.json)
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchBackups(false)}
              disabled={loading}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title="Segarkan data"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Backups */}
        <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Berkas Cadangan
            </CardTitle>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Database className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-black text-foreground">{backups.length} Berkas</div>
                <p className="text-[11px] text-muted-foreground">
                  {zipCount} ZIP · {excelCount} Excel · {jsonCount} JSON
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Total Storage Used */}
        <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ruang Penyimpanan
            </CardTitle>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <HardDrive className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-black text-foreground">{formatBytes(totalBytes)}</div>
                <p className="text-[11px] text-muted-foreground">Lokasi di server: <code className="font-mono text-indigo-500">./backups/</code></p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Cadangan Terakhir */}
        <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cadangan Terakhir
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : latestBackup ? (
              <div className="space-y-1">
                <div className="text-sm font-bold text-foreground truncate" title={latestBackup.filename}>
                  {formatWib(latestBackup.createdAt)}
                </div>
                <p className="text-[11px] text-muted-foreground truncate font-mono">
                  {latestBackup.filename}
                </p>
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">Belum ada cadangan</div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Status Proteksi */}
        <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proteksi Auto-Backup
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="size-4" />
                Aktif Otomatis
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Mencadangkan data sebelum Reset Penuh (Level 3) dieksekusi.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview 7 Pilar Cakupan Data */}
      <Card className="rounded-3xl border-border/80 shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <HelpCircle className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Daftar Berkas Resmi di Dalam Paket Arsip Backup (.zip)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Isi, template, dan format penamaan berkas di dalam arsip ZIP identik 100% dengan hasil ekspor dari masing-masing halaman admin:
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                  <UserCheck className="size-4 text-emerald-500 shrink-0" />
                  <span>1. Halaman Biodata</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">/admin/biodata</span>
              </div>
              <div className="font-mono text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                Laporan_Biodata_Responden_YYYY-MM-DD.xlsx
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Rekap demografi lengkap, grafik pie chart tertanam, dan lembar data mentah biodata responden.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                  <Brain className="size-4 text-purple-500 shrink-0" />
                  <span>2. Halaman Profil Responden</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">/admin/profil-responden</span>
              </div>
              <div className="font-mono text-[10.5px] text-purple-600 dark:text-purple-400 font-semibold truncate">
                Laporan_Profil_Psikologis_Responden_YYYY-MM-DD.xlsx
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Ringkasan metodologi, grafik 9 kelompok (A–I), daftar profil, matriks jawaban mentah 30 soal LA/EI, &amp; codebook.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                  <ClipboardCheck className="size-4 text-amber-500 shrink-0" />
                  <span>3. Halaman Evaluasi</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">/admin/evaluasi</span>
              </div>
              <div className="font-mono text-[10.5px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                Rekap_Evaluasi_Simulasi_YYYY-MM-DD.xlsx
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Ringkasan distribusi skor 10 pertanyaan evaluasi akhir simulasi dan matriks jawaban responden.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                  <TrendingUp className="size-4 text-sky-500 shrink-0" />
                  <span>4. Halaman Resume (Laporan)</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">/admin/resume</span>
              </div>
              <div className="font-mono text-[10.5px] text-sky-600 dark:text-sky-400 font-semibold truncate">
                Laporan_Trading_Semua_Sesi.xlsx
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Ringkasan ekspor, rata-rata akurasi prediksi responden aktif, dan lembar rincian transaksi per individu responden.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                  <Receipt className="size-4 text-teal-500 shrink-0" />
                  <span>5. Halaman Resume (Order Book)</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">/admin/resume</span>
              </div>
              <div className="font-mono text-[10.5px] text-teal-600 dark:text-teal-400 font-semibold truncate">
                Laporan_OrderBook_Semua_Sesi.xlsx
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Rekapitulasi transaksi sukses (matched) dan seluruh riwayat antrean order book (BID &amp; ASK).
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                  <Users className="size-4 text-blue-500 shrink-0" />
                  <span>6. Halaman Hasil Simulasi</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">/admin/hasil</span>
              </div>
              <div className="font-mono text-[10.5px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                Laporan_Hasil_Semua_Sesi.xlsx
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Peringkat kekayaan bersih (NAV), PnL, persentase return, dan rincian portofolio saham per responden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daftar Berkas Cadangan Table */}
      <Card className="rounded-3xl border-border/80 shadow-xs overflow-hidden">
        <CardHeader className="p-5 sm:p-6 border-b border-border/50 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Database className="size-4 text-primary" />
                Daftar Riwayat Cadangan Tersimpan
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Menampilkan seluruh berkas cadangan (.xlsx dan .json) yang tersimpan di direktori server.
              </p>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama berkas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 pr-3 rounded-xl border border-border/80 bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-56"
                />
              </div>

              <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 text-xs">
                <button
                  onClick={() => setFilterType("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors",
                    filterType === "all" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Semua ({backups.length})
                </button>
                <button
                  onClick={() => setFilterType("zip")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors",
                    filterType === "zip" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ZIP ({zipCount})
                </button>
                <button
                  onClick={() => setFilterType("excel")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors",
                    filterType === "excel" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Excel ({excelCount})
                </button>
                <button
                  onClick={() => setFilterType("json")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors",
                    filterType === "json" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  JSON ({jsonCount})
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredBackups.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-flex p-3 rounded-2xl bg-muted/60 text-muted-foreground">
                <HardDrive className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Tidak Ada Berkas Cadangan Ditemukan</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {searchTerm || filterType !== "all"
                    ? "Tidak ada berkas yang cocok dengan filter pencarian Anda."
                    : "Belum ada berkas cadangan data di server. Klik tombol di bawah untuk membuat cadangan data pertama Anda."}
                </p>
              </div>
              {!searchTerm && filterType === "all" && (
                <Button onClick={handleCreateBackup} disabled={isCreatingBackup} size="sm" className="gap-2 text-xs">
                  <Sparkles className="size-3.5" />
                  Buat Cadangan Pertama Sekarang
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="w-12 text-center text-xs font-bold">No</TableHead>
                    <TableHead className="text-xs font-bold">Nama Berkas Cadangan</TableHead>
                    <TableHead className="w-28 text-center text-xs font-bold">Tipe Berkas</TableHead>
                    <TableHead className="w-28 text-right text-xs font-bold">Ukuran</TableHead>
                    <TableHead className="w-48 text-xs font-bold">Waktu Pembuatan (WIB)</TableHead>
                    <TableHead className="w-36 text-center text-xs font-bold">Status Server</TableHead>
                    <TableHead className="w-36 text-center text-xs font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredBackups.map((item, index) => {
                      const isExcel = item.type === "excel";
                      return (
                        <TableRow
                          key={item.filename}
                          className="border-border/50 hover:bg-muted/30 transition-colors text-xs"
                        >
                          <TableCell className="text-center font-mono text-muted-foreground">
                            {index + 1}
                          </TableCell>

                          <TableCell className="font-mono text-foreground font-semibold">
                            <div className="flex items-center gap-2">
                              {item.type === "zip" ? (
                                <Archive className="size-4 text-purple-500 shrink-0" />
                              ) : item.type === "excel" ? (
                                <FileSpreadsheet className="size-4 text-emerald-500 shrink-0" />
                              ) : (
                                <FileCode className="size-4 text-sky-500 shrink-0" />
                              )}
                              <span className="truncate max-w-xs sm:max-w-md" title={item.filename}>
                                {item.filename}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            {item.type === "zip" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                ZIP ARSIP (.zip)
                              </span>
                            ) : item.type === "excel" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                EXCEL (.xlsx)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                JSON (.json)
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatBytes(item.sizeBytes)}
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {formatWib(item.createdAt)}
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" />
                              Tersimpan
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadFile(item.filename)}
                                disabled={downloadingFile === item.filename}
                                className="h-7 px-2.5 text-[11px] gap-1 border-primary/30 hover:bg-primary/10"
                                title="Unduh berkas cadangan"
                              >
                                <Download className={cn("size-3", downloadingFile === item.filename && "animate-bounce")} />
                                <span>{downloadingFile === item.filename ? "Mengunduh..." : "Unduh"}</span>
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteFile(item.filename)}
                                disabled={deletingFile === item.filename}
                                className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                                title="Hapus berkas dari server"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
