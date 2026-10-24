"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  UserCheck,
  DownloadCloud,
  RefreshCw,
  Search,
  PieChart,
  GraduationCap,
  Briefcase,
  Wallet,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Layers,
  Sparkles,
  Filter,
  Brain,
  ChevronDown,
  Loader2,
  Printer,
  X,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RespondentRow = {
  userId: number;
  nama: string;
  isFilled: boolean;
  biodata: {
    jenisKelamin: string;
    usia: number;
    programStudi: string;
    semester: number;
    pernahInvestasiSaham: string;
    pernahPelatihanInvestasi: string;
    sumberPenghasilan: string;
    sumberPenghasilanLainnya: string | null;
    jurusanSma: string;
    createdAt: string;
  } | null;
};

type BiodataStats = {
  totalRegistered: number;
  filledCount: number;
  pendingCount: number;
  completionRate: number;
  jenisKelamin: {
    lakiLaki: { count: number; percentage: number };
    perempuan: { count: number; percentage: number };
  };
  pernahInvestasiSaham: {
    ya: { count: number; percentage: number };
    tidak: { count: number; percentage: number };
  };
  pelatihanInvestasi: {
    ya: { count: number; percentage: number };
    tidak: { count: number; percentage: number };
  };
  jurusanSma: {
    ipa: { count: number; percentage: number };
    ips: { count: number; percentage: number };
    bahasa: { count: number; percentage: number };
  };
  sumberPenghasilan: {
    orangTua: { count: number; percentage: number };
    beasiswa: { count: number; percentage: number };
    pekerjaanSampingan: { count: number; percentage: number };
    lainnya: { count: number; percentage: number };
    rincianLainnya: string[];
  };
  usia: {
    average: number;
    min: number;
    max: number;
    groups: Array<{ group: string; count: number; percentage: number }>;
  };
  semester: Array<{ semester: number; count: number; percentage: number }>;
  programStudi: Array<{ name: string; count: number; percentage: number }>;
};

type PieSlice = {
  label: string;
  count: number;
  percentage: number;
  color: string;
  sublabel?: string;
};

// ── Reusable Standalone Circular Pie Chart Component (Diagram Lingkaran Penuh) ──
function CircularPieChartCard({
  title,
  questionNumber,
  slices,
  total,
  icon,
  badgeText,
}: {
  title: string;
  questionNumber: number;
  slices: PieSlice[];
  total: number;
  icon?: React.ReactNode;
  badgeText?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Slices that have at least 1 count or non-zero percentage
  const activeSlices = slices.filter((s) => s.count > 0);
  const totalCount = activeSlices.reduce((acc, s) => acc + s.count, 0);

  const cx = 130;
  const cy = 130;
  const radius = 95;

  let currentAngle = -90; // Start at 12 o'clock

  const sliceData = activeSlices.map((slice, idx) => {
    const angle = (slice.count / (totalCount || 1)) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const midAngle = startAngle + angle / 2;
    const midRad = (midAngle * Math.PI) / 180;

    const isFullCircle = angle >= 359.9;
    const largeArcFlag = angle > 180 ? 1 : 0;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const pathData = isFullCircle
      ? ""
      : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    // Center text coordinates
    const labelRadius = radius * 0.62;
    const lx = cx + labelRadius * Math.cos(midRad);
    const ly = cy + labelRadius * Math.sin(midRad);

    // Explode effect on hover
    const isHovered = hoveredIdx === idx;
    const explodeDist = isHovered ? 6 : 0;
    const ex = explodeDist * Math.cos(midRad);
    const ey = explodeDist * Math.sin(midRad);

    return {
      slice,
      idx,
      angle,
      isFullCircle,
      pathData,
      lx,
      ly,
      ex,
      ey,
      isHovered,
    };
  });

  return (
    <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors group">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="size-7 rounded-xl bg-primary/10 text-primary font-mono font-black text-xs flex items-center justify-center shrink-0 border border-primary/20">
            {questionNumber}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-foreground truncate" title={title}>
              {title}
            </h3>
            {badgeText && (
              <span className="text-[10px] text-muted-foreground block truncate">
                {badgeText}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div className="p-1.5 rounded-xl bg-muted/60 text-muted-foreground shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Pie Chart SVG Canvas (Diagram Lingkaran Gambar) */}
      <div className="flex flex-col items-center justify-center py-1">
        <div className="relative size-60 sm:size-64 flex items-center justify-center">
          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="size-36 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
                <PieChart className="size-8 text-muted-foreground/40" />
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                Belum ada data responden
              </span>
            </div>
          ) : (
            <svg
              viewBox="0 0 260 260"
              className="size-full overflow-visible drop-shadow-md select-none"
            >
              <defs>
                <filter id={`shadow-${questionNumber}`} x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Slices Rendering */}
              {sliceData.map((item) => {
                if (item.isFullCircle) {
                  return (
                    <circle
                      key={item.idx}
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={item.slice.color}
                      stroke="hsl(var(--card))"
                      strokeWidth="2.5"
                      onMouseEnter={() => setHoveredIdx(item.idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer transition-all duration-200"
                    />
                  );
                }

                return (
                  <path
                    key={item.idx}
                    d={item.pathData}
                    fill={item.slice.color}
                    stroke="hsl(var(--card))"
                    strokeWidth="2.5"
                    transform={`translate(${item.ex}, ${item.ey})`}
                    onMouseEnter={() => setHoveredIdx(item.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer transition-transform duration-200"
                  />
                );
              })}

              {/* Text Labels inside Slices (Exactly as in Reference Image: Percentage & Count) */}
              {sliceData.map((item) => {
                // Only render text inside slice if slice is large enough (>= 6%)
                if (item.slice.percentage < 6) return null;

                const isLarge = item.slice.percentage >= 15;
                const isMedium = item.slice.percentage >= 9;

                return (
                  <g
                    key={`text-${item.idx}`}
                    transform={`translate(${item.ex}, ${item.ey})`}
                    className="pointer-events-none select-none transition-transform duration-200"
                  >
                    {/* Percentage Text */}
                    <text
                      x={item.lx}
                      y={isMedium ? item.ly - 4 : item.ly + 3}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#FFFFFF"
                      fontWeight="900"
                      fontSize={isLarge ? "14" : isMedium ? "11.5" : "10"}
                      style={{ textShadow: "0 1.5px 3px rgba(0,0,0,0.6)" }}
                      className="font-mono tracking-tight"
                    >
                      {item.slice.percentage}%
                    </text>

                    {/* Respondent Count Subtext (e.g. (48 artikel / responden)) */}
                    {isMedium && (
                      <text
                        x={item.lx}
                        y={item.ly + 10}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#FFFFFF"
                        fontWeight="700"
                        fontSize="8.5"
                        opacity="0.95"
                        style={{ textShadow: "0 1.5px 2px rgba(0,0,0,0.6)" }}
                        className="font-sans"
                      >
                        ({item.slice.count})
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Legend & Breakdown Badges */}
      <div className="space-y-1.5 pt-1 border-t border-border/50">
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {slices.map((slice, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={slice.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={cn(
                  "p-2 rounded-xl border transition-all flex items-center justify-between gap-1.5 cursor-pointer",
                  isHovered
                    ? "bg-accent border-primary/40 shadow-xs ring-1 ring-primary/20 scale-[1.02]"
                    : "bg-muted/40 border-border/60 hover:bg-muted/70"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-3 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-[11px] font-bold text-foreground truncate" title={slice.label}>
                    {slice.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black font-mono text-foreground block leading-none">
                    {slice.percentage}%
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {slice.count} resp.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export default function AdminBiodataPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<BiodataStats | null>(null);
  const [respondents, setRespondents] = useState<RespondentRow[]>([]);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FILLED" | "PENDING">("ALL");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "Laki-laki" | "Perempuan">("ALL");
  const [sahamFilter, setSahamFilter] = useState<"ALL" | "Ya" | "Tidak">("ALL");
  const [smaFilter, setSmaFilter] = useState<"ALL" | "IPA" | "IPS" | "Bahasa/lain-lain">("ALL");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/biodata");
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
        setRespondents(data.respondents || []);
      } else {
        toast.error(data.error || "Gagal memuat data biodata responden.");
      }
    } catch (err) {
      console.error("Error loading admin biodata:", err);
      toast.error("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, []);

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

    fetchData();
  }, [hydrated, user, router, fetchData]);

  // Export Excel Handler
  const handleExport = async () => {
    setExporting(true);
    toast.info("Menyiapkan berkas Excel rekap biodata responden...", { id: "export-biodata-toast" });
    try {
      const res = await fetch("/api/admin/export-biodata");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal mengekspor data");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan_Biodata_Responden_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Berhasil mengunduh berkas Excel biodata!", { id: "export-biodata-toast" });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengekspor data", { id: "export-biodata-toast" });
    } finally {
      setExporting(false);
    }
  };

  // Filtered respondents
  const filteredRespondents = useMemo(() => {
    return respondents.filter((r) => {
      if (statusFilter === "FILLED" && !r.isFilled) return false;
      if (statusFilter === "PENDING" && r.isFilled) return false;

      if (r.biodata) {
        if (genderFilter !== "ALL" && r.biodata.jenisKelamin !== genderFilter) return false;
        if (sahamFilter !== "ALL" && r.biodata.pernahInvestasiSaham !== sahamFilter) return false;
        if (smaFilter !== "ALL" && r.biodata.jurusanSma !== smaFilter) return false;
      } else if (genderFilter !== "ALL" || sahamFilter !== "ALL" || smaFilter !== "ALL") {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = r.nama.toLowerCase().includes(q);
        const idMatch = r.userId.toString().includes(q);
        const prodiMatch = r.biodata?.programStudi.toLowerCase().includes(q) || false;
        if (!nameMatch && !idMatch && !prodiMatch) return false;
      }

      return true;
    });
  }, [respondents, statusFilter, genderFilter, sahamFilter, smaFilter, search]);

  // ── Prepare Pie Slices for each of the 8 Questions ──
  const total = stats?.filledCount || 0;

  // 1. Jenis Kelamin Slices
  const slicesJenisKelamin: PieSlice[] = [
    {
      label: "Laki-laki",
      count: stats?.jenisKelamin.lakiLaki.count || 0,
      percentage: stats?.jenisKelamin.lakiLaki.percentage || 0,
      color: "#2563EB", // Blue
    },
    {
      label: "Perempuan",
      count: stats?.jenisKelamin.perempuan.count || 0,
      percentage: stats?.jenisKelamin.perempuan.percentage || 0,
      color: "#DB2777", // Pink
    },
  ];

  // 2. Pernah Investasi Saham
  const slicesSaham: PieSlice[] = [
    {
      label: "Pernah (Ya)",
      count: stats?.pernahInvestasiSaham.ya.count || 0,
      percentage: stats?.pernahInvestasiSaham.ya.percentage || 0,
      color: "#16A34A", // Green
    },
    {
      label: "Belum (Tidak)",
      count: stats?.pernahInvestasiSaham.tidak.count || 0,
      percentage: stats?.pernahInvestasiSaham.tidak.percentage || 0,
      color: "#DC2626", // Red
    },
  ];

  // 3. Pelatihan Keuangan / Investasi
  const slicesPelatihan: PieSlice[] = [
    {
      label: "Pernah (Ya)",
      count: stats?.pelatihanInvestasi.ya.count || 0,
      percentage: stats?.pelatihanInvestasi.ya.percentage || 0,
      color: "#2563EB", // Blue
    },
    {
      label: "Belum (Tidak)",
      count: stats?.pelatihanInvestasi.tidak.count || 0,
      percentage: stats?.pelatihanInvestasi.tidak.percentage || 0,
      color: "#F97316", // Orange
    },
  ];

  // 4. Jurusan Sewaktu SMA
  const slicesSma: PieSlice[] = [
    {
      label: "IPA",
      count: stats?.jurusanSma.ipa.count || 0,
      percentage: stats?.jurusanSma.ipa.percentage || 0,
      color: "#2563EB", // Blue
    },
    {
      label: "IPS",
      count: stats?.jurusanSma.ips.count || 0,
      percentage: stats?.jurusanSma.ips.percentage || 0,
      color: "#EAB308", // Yellow
    },
    {
      label: "Bahasa / Lainnya",
      count: stats?.jurusanSma.bahasa.count || 0,
      percentage: stats?.jurusanSma.bahasa.percentage || 0,
      color: "#16A34A", // Green
    },
  ];

  // 5. Sumber Penghasilan Utama
  const slicesSumber: PieSlice[] = [
    {
      label: "Orang tua",
      count: stats?.sumberPenghasilan.orangTua.count || 0,
      percentage: stats?.sumberPenghasilan.orangTua.percentage || 0,
      color: "#16A34A", // Green
    },
    {
      label: "Pekerjaan sampingan",
      count: stats?.sumberPenghasilan.pekerjaanSampingan.count || 0,
      percentage: stats?.sumberPenghasilan.pekerjaanSampingan.percentage || 0,
      color: "#2563EB", // Blue
    },
    {
      label: "Beasiswa",
      count: stats?.sumberPenghasilan.beasiswa.count || 0,
      percentage: stats?.sumberPenghasilan.beasiswa.percentage || 0,
      color: "#EAB308", // Yellow
    },
    {
      label: "Lainnya",
      count: stats?.sumberPenghasilan.lainnya.count || 0,
      percentage: stats?.sumberPenghasilan.lainnya.percentage || 0,
      color: "#9333EA", // Purple
    },
  ];

  // 6. Distribusi Kelompok Usia
  const ageColors = ["#0D9488", "#2563EB", "#F97316", "#DC2626"];
  const slicesUsia: PieSlice[] =
    stats?.usia.groups.map((g, idx) => ({
      label: g.group.includes("<") || g.group.includes(">") ? `${g.group} Thn` : `${g.group} Thn`,
      count: g.count,
      percentage: g.percentage,
      color: ageColors[idx % ageColors.length],
    })) || [];

  // 7. Distribusi Semester
  const semColors = [
    "#2563EB",
    "#0D9488",
    "#16A34A",
    "#EAB308",
    "#F97316",
    "#DC2626",
    "#9333EA",
    "#DB2777",
  ];
  const slicesSemester: PieSlice[] =
    stats?.semester.map((s, idx) => ({
      label: `Semester ${s.semester}`,
      count: s.count,
      percentage: s.percentage,
      color: semColors[idx % semColors.length],
    })) || [];

  // 8. Sebaran Program Studi / Jurusan Kuliah (Top 5 + Lainnya)
  const prodiColors = ["#16A34A", "#2563EB", "#EAB308", "#F97316", "#9333EA", "#64748B"];
  const rawProdi = stats?.programStudi || [];
  const topProdi = rawProdi.slice(0, 5);
  const remainingProdi = rawProdi.slice(5);
  const remainingCount = remainingProdi.reduce((acc, p) => acc + p.count, 0);

  const slicesProdi: PieSlice[] = topProdi.map((p, idx) => ({
    label: p.name,
    count: p.count,
    percentage: p.percentage,
    color: prodiColors[idx % prodiColors.length],
  }));

  if (remainingCount > 0) {
    const remPct = total > 0 ? Number(((remainingCount / total) * 100).toFixed(1)) : 0;
    slicesProdi.push({
      label: "Program Studi Lainnya",
      count: remainingCount,
      percentage: remPct,
      color: "#64748B",
    });
  }

  if (!hydrated || (loading && !stats)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-foreground">Menyiapkan Diagram Gambar Biodata...</p>
          <p className="text-xs text-muted-foreground">Merender 8 diagram lingkaran persentase</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6 space-y-5 sm:space-y-6 pb-28 md:pb-12">
      {/* ── Sub-Navigation Pill Header (Switch between Profiles & Biodata) ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/60 max-w-fit print:hidden">
        <button
          type="button"
          onClick={() => router.push("/admin/profil-responden")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <Brain className="size-3.5" />
          <span>Profil Psikologis (LA & EI)</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-background text-foreground shadow-xs ring-1 ring-border/50 transition-all cursor-default"
        >
          <UserCheck className="size-3.5 text-primary" />
          <span>Biodata & Demografi</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
            {stats?.filledCount || 0}
          </span>
        </button>
      </div>

      {/* ── Page Header & Action Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <PieChart className="size-5" />
            </span>
            <span>Diagram Gambar Biodata Responden</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Visualisasi diagram lingkaran (*Pie Chart*) persentase lengkap untuk 8 butir data responden.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-xl gap-1.5 text-xs font-bold cursor-pointer"
            title="Cetak Laporan / Simpan PDF"
          >
            <Printer className="size-3.5" />
            <span className="hidden sm:inline">Cetak / PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={loading}
            className="h-9 px-3 rounded-xl gap-1.5 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Segarkan</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="h-9 px-4 rounded-xl gap-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 cursor-pointer"
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

      {/* ── 4 Top KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs font-semibold text-muted-foreground">Total Responden</span>
            <span className="p-1.5 rounded-lg bg-muted text-muted-foreground">
              <Users className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
            {stats?.totalRegistered || 0}
          </div>
          <p className="text-[10.5px] text-muted-foreground">Akun responden terdaftar</p>
        </Card>

        <Card className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 sm:p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Biodata Terisi
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {stats?.filledCount || 0}
          </div>
          <p className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
            Lengkap 8 butir instrumen
          </p>
        </Card>

        <Card className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 sm:p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs font-bold text-amber-700 dark:text-amber-400">
              Belum Mengisi
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
            {stats?.pendingCount || 0}
          </div>
          <p className="text-[10.5px] text-amber-700/80 dark:text-amber-400/80 font-medium">
            Tertahan di Step 1
          </p>
        </Card>

        <Card className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 sm:p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs font-bold text-primary">Tingkat Pengisian</span>
            <span className="p-1.5 rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-primary">
            {stats?.completionRate || 0}%
          </div>
          <div className="h-1.5 w-full bg-primary/20 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${stats?.completionRate || 0}%` }}
            />
          </div>
        </Card>
      </div>

      {/* ── SECTION: 8 CIRCULAR PIE CHARTS (DIAGRAM LINGKARAN GAMBAR LENGKAP) ── */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-primary" />
            <h2 className="text-base sm:text-lg font-black text-foreground">
              8 Diagram Lingkaran Biodata Responden
            </h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Total {total} Data Responden
          </span>
        </div>

        {/* 2-Column Responsive Grid (Large, Detailed, Beautiful Pie Charts) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* 1. Jenis Kelamin */}
          <CircularPieChartCard
            questionNumber={1}
            title="Jenis Kelamin"
            badgeText="Laki-laki vs Perempuan"
            slices={slicesJenisKelamin}
            total={total}
            icon={<UserCheck className="size-4" />}
          />

          {/* 2. Pengalaman Investasi di Pasar Saham */}
          <CircularPieChartCard
            questionNumber={2}
            title="Pengalaman Investasi di Pasar Saham"
            badgeText="Pernah vs Belum Pernah"
            slices={slicesSaham}
            total={total}
            icon={<TrendingUp className="size-4" />}
          />

          {/* 3. Mata Kuliah / Pelatihan Investasi */}
          <CircularPieChartCard
            questionNumber={3}
            title="Pelatihan / Mata Kuliah Keuangan"
            badgeText="Pelatihan atau Kuliah Investasi Pribadi"
            slices={slicesPelatihan}
            total={total}
            icon={<BookOpen className="size-4" />}
          />

          {/* 4. Jurusan Sewaktu SMA */}
          <CircularPieChartCard
            questionNumber={4}
            title="Jurusan Sewaktu SMA"
            badgeText="Peminatan IPA, IPS, atau Bahasa"
            slices={slicesSma}
            total={total}
            icon={<GraduationCap className="size-4" />}
          />

          {/* 5. Sumber Penghasilan Utama */}
          <CircularPieChartCard
            questionNumber={5}
            title="Sumber Penghasilan Utama"
            badgeText="Orang Tua, Beasiswa, Side-Job, Lainnya"
            slices={slicesSumber}
            total={total}
            icon={<Wallet className="size-4" />}
          />

          {/* 6. Distribusi Kelompok Usia */}
          <CircularPieChartCard
            questionNumber={6}
            title="Distribusi Kelompok Usia"
            badgeText={`Rerata: ${stats?.usia.average || 0} Tahun (Min: ${stats?.usia.min || 0}, Max: ${stats?.usia.max || 0})`}
            slices={slicesUsia}
            total={total}
            icon={<Calendar className="size-4" />}
          />

          {/* 7. Distribusi Semester Perkuliahan */}
          <CircularPieChartCard
            questionNumber={7}
            title="Distribusi Semester Perkuliahan"
            badgeText="Tingkat Perkuliahan Saat Ini"
            slices={slicesSemester}
            total={total}
            icon={<Layers className="size-4" />}
          />

          {/* 8. Sebaran Program Studi / Jurusan Kuliah */}
          <CircularPieChartCard
            questionNumber={8}
            title="Sebaran Program Studi / Jurusan Kuliah"
            badgeText={`Top Program Studi (${stats?.programStudi.length || 0} Terdata)`}
            slices={slicesProdi}
            total={total}
            icon={<Briefcase className="size-4" />}
          />
        </div>
      </div>

      {/* ── SECTION: RESPONDENT BIODATA DATA TABLE ── */}
      <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card shadow-xs overflow-hidden print:hidden">
        <div className="p-4 sm:p-5 border-b border-border/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Daftar Isian Biodata Per Responden</h2>
              <p className="text-xs text-muted-foreground">
                Menampilkan {filteredRespondents.length} dari {respondents.length} responden
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari nama, ID, atau prodi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills Row */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
            <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1 mr-1">
              <Filter className="size-3" /> Filter:
            </span>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl bg-muted border border-border text-[11px] font-semibold text-foreground cursor-pointer focus:outline-none"
            >
              <option value="ALL">Status: Semua</option>
              <option value="FILLED">Status: Lengkap</option>
              <option value="PENDING">Status: Belum Mengisi</option>
            </select>

            {/* Gender Filter */}
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl bg-muted border border-border text-[11px] font-semibold text-foreground cursor-pointer focus:outline-none"
            >
              <option value="ALL">Gender: Semua</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>

            {/* Saham Filter */}
            <select
              value={sahamFilter}
              onChange={(e) => setSahamFilter(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl bg-muted border border-border text-[11px] font-semibold text-foreground cursor-pointer focus:outline-none"
            >
              <option value="ALL">Saham: Semua</option>
              <option value="Ya">Pernah Saham (Ya)</option>
              <option value="Tidak">Belum Pernah (Tidak)</option>
            </select>

            {/* SMA Filter */}
            <select
              value={smaFilter}
              onChange={(e) => setSmaFilter(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl bg-muted border border-border text-[11px] font-semibold text-foreground cursor-pointer focus:outline-none"
            >
              <option value="ALL">SMA: Semua</option>
              <option value="IPA">IPA</option>
              <option value="IPS">IPS</option>
              <option value="Bahasa/lain-lain">Bahasa/Lain</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center text-xs">No</TableHead>
                <TableHead className="text-xs">Nama Responden</TableHead>
                <TableHead className="text-center text-xs">Status</TableHead>
                <TableHead className="text-center text-xs">Jenis Kelamin</TableHead>
                <TableHead className="text-center text-xs">Usia</TableHead>
                <TableHead className="text-xs">Program Studi</TableHead>
                <TableHead className="text-center text-xs">Semester</TableHead>
                <TableHead className="text-center text-xs">Saham?</TableHead>
                <TableHead className="text-center text-xs">Pelatihan?</TableHead>
                <TableHead className="text-xs">Penghasilan</TableHead>
                <TableHead className="text-center text-xs">Jurusan SMA</TableHead>
                <TableHead className="text-center text-xs">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRespondents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-28 text-center text-muted-foreground text-xs">
                    Tidak ada responden yang sesuai dengan filter pencarian.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRespondents.map((r, idx) => (
                  <TableRow key={r.userId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-foreground">
                      <div>{r.nama}</div>
                      <span className="text-[10px] font-mono text-muted-foreground">ID #{r.userId}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.isFilled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-2.5" /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          <Clock className="size-2.5" /> Belum
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium">
                      {r.biodata?.jenisKelamin || "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {r.biodata ? `${r.biodata.usia} thn` : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={r.biodata?.programStudi}>
                      {r.biodata?.programStudi || "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {r.biodata ? `Sem ${r.biodata.semester}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.biodata ? (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
                            r.biodata.pernahInvestasiSaham === "Ya"
                              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {r.biodata.pernahInvestasiSaham}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.biodata ? (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
                            r.biodata.pernahPelatihanInvestasi === "Ya"
                              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {r.biodata.pernahPelatihanInvestasi}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate" title={r.biodata?.sumberPenghasilan}>
                      {r.biodata
                        ? r.biodata.sumberPenghasilan === "Lainnya" && r.biodata.sumberPenghasilanLainnya
                          ? `Lainnya: ${r.biodata.sumberPenghasilanLainnya}`
                          : r.biodata.sumberPenghasilan
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium">
                      {r.biodata?.jurusanSma || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/admin/profil-responden/${r.userId}`)}
                        className="h-8 px-2 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-xl gap-1 cursor-pointer"
                        title="Buka Berkas Responden"
                      >
                        <Eye className="size-3.5" />
                        <span className="hidden sm:inline">Detail</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
